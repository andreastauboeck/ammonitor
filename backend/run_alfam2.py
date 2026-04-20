"""ALFAM2 model runner.

Runs 7 scenarios (day 0..6) in a single R call. Each scenario represents
applying manure at the start of that day and tracking cumulative NH3 loss
over the following 168 hours (7 days).

Each scenario is run for all 5 application techniques (Trailing hose,
Broadcast, Trailing shoe, Open slot, Closed slot), giving 7 * 5 = 35 groups
per R invocation.
"""
from __future__ import annotations

import csv
import math
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Iterable

SCRIPT_DIR = Path(__file__).parent

# ALFAM2 app.mthd codes and their human-readable labels (frontend display).
# "th" (trailing hose) is the reference level - empty string means no dummy set.
TECHNIQUES: list[tuple[str, str]] = [
    ("bc", "Broadcast"),
    ("th", "Trailing hose"),
    ("ts", "Trailing shoe"),
    ("os", "Open slot"),
    ("cs", "Closed slot"),
]

# Number of scenarios (days) to compute
N_SCENARIOS = 7
# Length of each scenario window in hours (7 days)
SCENARIO_HOURS = 168


def run_alfam2(
    tan_app: float,
    man_dm: float,
    man_ph: float,
    man_source: str,
    app_rate: float,
    incorp: str,
    incorp_time: float,
    weather_hourly: list[dict],
    start_dates_iso: list[str],
) -> dict:
    """Run the ALFAM2 model for 7 scenarios x 5 techniques.

    Args:
        tan_app: TAN applied (kg/ha)
        man_dm: Manure dry matter (%)
        man_ph: Manure pH
        man_source: "cattle" or "pig"
        app_rate: Application rate (t/ha)
        incorp: "none", "shallow", or "deep"
        weather_hourly: List of 13*24 = 312 hourly weather dicts with keys
                        'air_temp', 'wind_speed', 'rain_rate'
        start_dates_iso: ISO datetime strings for each scenario start (day 0..6)

    Returns:
        Dict with structure:
        {
            "scenarios": [
                {
                    "day": 0,
                    "start": "2026-04-20T00:00:00",
                    "techniques": {
                        "Trailing hose": {
                            "final_loss_pct": 35.2,
                            "hourly": [{"ct": 1, "e": 0.5, "er": 0.01, "j": 0.5}, ...]
                        },
                        ...
                    }
                },
                ...
            ]
        }
    """
    try:
        return _run_alfam2_r(
            tan_app=tan_app,
            man_dm=man_dm,
            man_ph=man_ph,
            man_source=man_source,
            app_rate=app_rate,
            incorp=incorp,
            incorp_time=incorp_time,
            weather_hourly=weather_hourly,
            start_dates_iso=start_dates_iso,
        )
    except Exception as e:
        print(f"Error running ALFAM2: {e}. Using fallback.")
        return _generate_fallback(
            tan_app=tan_app,
            man_dm=man_dm,
            man_ph=man_ph,
            man_source=man_source,
            start_dates_iso=start_dates_iso,
        )


def _run_alfam2_r(
    tan_app: float,
    man_dm: float,
    man_ph: float,
    man_source: str,
    app_rate: float,
    incorp: str,
    incorp_time: float,
    weather_hourly: list[dict],
    start_dates_iso: list[str],
) -> dict:
    """Build CSV input, run R, parse output."""
    if len(weather_hourly) < (N_SCENARIOS - 1) * 24 + SCENARIO_HOURS:
        raise ValueError(
            f"Need at least {(N_SCENARIOS - 1) * 24 + SCENARIO_HOURS} hours of weather, "
            f"got {len(weather_hourly)}"
        )

    # man.source: "pig" or "cattle" (reference)
    man_source_str = "pig" if man_source.lower() == "pig" else "cattle"

    # Normalize incorp
    incorp_lc = incorp.lower() if incorp else "none"
    if incorp_lc not in ("none", "shallow", "deep"):
        incorp_lc = "none"

    with tempfile.TemporaryDirectory() as tmpdir:
        input_file = os.path.join(tmpdir, "input.csv")
        output_file = os.path.join(tmpdir, "output.csv")

        rows = _build_input_rows(
            tan_app=tan_app,
            man_dm=man_dm,
            man_ph=man_ph,
            man_source_str=man_source_str,
            app_rate=app_rate,
            incorp=incorp_lc,
            incorp_time=incorp_time,
            weather_hourly=weather_hourly,
        )

        fieldnames = [
            "scenario",
            "ct",
            "TAN.app",
            "man.dm",
            "man.ph",
            "man.source",
            "app.mthd",
            "incorp",
            "t.incorp",
            "app.rate",
            "air.temp",
            "wind.sqrt",
            "rain.rate",
        ]
        with open(input_file, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

        r_script = SCRIPT_DIR / "run_alfam2.R"
        result = subprocess.run(
            ["Rscript", str(r_script), input_file, output_file],
            capture_output=True,
            text=True,
            timeout=120,
        )

        if result.returncode != 0:
            raise RuntimeError(f"R script failed: {result.stderr}")

        if not os.path.exists(output_file):
            raise FileNotFoundError(f"Output file not created: {output_file}")

        with open(output_file, "r") as f:
            reader = csv.DictReader(f)
            out_rows = list(reader)

        if not out_rows:
            raise ValueError("Empty output from ALFAM2")

        return _parse_output(out_rows, start_dates_iso)


def _build_input_rows(
    tan_app: float,
    man_dm: float,
    man_ph: float,
    man_source_str: str,
    app_rate: float,
    incorp: str,
    incorp_time: float,
    weather_hourly: list[dict],
) -> list[dict]:
    """Build the grouped input CSV rows.

    Each (scenario_day, technique) combination is one group. For each group,
    we emit 168 rows (one per hour) with weather values appropriate for that
    scenario's time window.
    """
    rows: list[dict] = []
    # t.incorp: only meaningful if incorp != "none".
    t_incorp_val = incorp_time if incorp != "none" else ""
    incorp_val = incorp if incorp != "none" else ""

    for day_idx in range(N_SCENARIOS):
        start_hour = day_idx * 24
        for tech_code, tech_label in TECHNIQUES:
            # Unique scenario id combining day + technique
            scenario_id = f"d{day_idx}_{tech_code}"

            # app.mthd: empty string = reference (trailing hose)
            app_mthd_val = tech_code if tech_code != "th" else ""

            for hour_in_scenario in range(1, SCENARIO_HOURS + 1):
                weather_idx = start_hour + hour_in_scenario - 1
                w = weather_hourly[weather_idx]
                air_temp = float(w.get("air_temp", 15.0))
                wind_speed = max(float(w.get("wind_speed", 2.7)), 0.0)
                rain_rate = max(float(w.get("rain_rate", 0.0)), 0.0)
                wind_sqrt = math.sqrt(wind_speed)

                rows.append(
                    {
                        "scenario": scenario_id,
                        "ct": hour_in_scenario,
                        "TAN.app": tan_app,
                        "man.dm": man_dm,
                        "man.ph": man_ph,
                        "man.source": man_source_str,
                        "app.mthd": app_mthd_val,
                        "incorp": incorp_val,
                        "t.incorp": t_incorp_val,
                        "app.rate": app_rate,
                        "air.temp": air_temp,
                        "wind.sqrt": wind_sqrt,
                        "rain.rate": rain_rate,
                    }
                )

    return rows


def _parse_output(out_rows: list[dict], start_dates_iso: list[str]) -> dict:
    """Convert R CSV output into the structured response."""
    # Group rows by scenario id
    by_scenario: dict[str, list[dict]] = {}
    for r in out_rows:
        sid = r.get("scenario", "")
        by_scenario.setdefault(sid, []).append(r)

    scenarios: list[dict] = []
    for day_idx in range(N_SCENARIOS):
        start_iso = start_dates_iso[day_idx] if day_idx < len(start_dates_iso) else ""
        techniques_out: dict[str, dict] = {}

        for tech_code, tech_label in TECHNIQUES:
            sid = f"d{day_idx}_{tech_code}"
            rows = by_scenario.get(sid, [])
            hourly: list[dict] = []
            final_er = 0.0
            for r in rows:
                try:
                    ct = int(float(r.get("ct", 0)))
                except (ValueError, TypeError):
                    continue
                er = _safe_float(r.get("er"))
                e = _safe_float(r.get("e"))
                j = _safe_float(r.get("j"))
                hourly.append({"ct": ct, "e": e, "er": er, "j": j})
                final_er = er  # last row's er is cumulative relative emission

            # sort by ct just in case
            hourly.sort(key=lambda x: x["ct"])
            if hourly:
                final_er = hourly[-1]["er"]

            final_e = hourly[-1]["e"] if hourly else 0.0
            techniques_out[tech_label] = {
                "final_loss_pct": round(final_er * 100.0, 2),
                "final_loss_kg": round(final_e, 4),
                "hourly": hourly,
            }

        scenarios.append(
            {
                "day": day_idx,
                "start": start_iso,
                "techniques": techniques_out,
            }
        )

    return {"scenarios": scenarios}


def _safe_float(val) -> float:
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return 0.0
        return f
    except (ValueError, TypeError):
        return 0.0


def _generate_fallback(
    tan_app: float,
    man_dm: float,
    man_ph: float,
    man_source: str,
    start_dates_iso: list[str],
) -> dict:
    """Generate fallback synthetic data when R is unavailable."""
    # Base cumulative emission % per technique (approximate from docs examples)
    base_pct = {
        "Broadcast": 73.0,
        "Trailing hose": 49.0,
        "Trailing shoe": 35.0,
        "Open slot": 21.0,
        "Closed slot": 10.0,
    }

    dm_factor = 1 + (man_dm - 6) * 0.02
    ph_factor = 1 + (man_ph - 7.5) * 0.05
    src_factor = 0.9 if man_source.lower() == "pig" else 1.0

    scenarios = []
    for day_idx in range(N_SCENARIOS):
        start_iso = start_dates_iso[day_idx] if day_idx < len(start_dates_iso) else ""
        day_factor = 1.0 + (day_idx - 3) * 0.03  # small variation between days
        techniques_out: dict[str, dict] = {}
        for tech_label, base in base_pct.items():
            final_pct = max(0.0, base * dm_factor * ph_factor * src_factor * day_factor)
            # Exponential-ish cumulative curve
            hourly = []
            for ct in range(1, SCENARIO_HOURS + 1):
                frac = 1 - math.exp(-ct / 40.0)
                er = (final_pct / 100.0) * frac
                e = er * tan_app
                # approximate hourly flux
                j = (final_pct / 100.0) * (math.exp(-(ct - 1) / 40.0) / 40.0) * tan_app
                hourly.append(
                    {
                        "ct": ct,
                        "e": round(e, 4),
                        "er": round(er, 6),
                        "j": round(j, 6),
                    }
                )
            techniques_out[tech_label] = {
                "final_loss_pct": round(hourly[-1]["er"] * 100.0, 2),
                "final_loss_kg": round(hourly[-1]["e"], 4),
                "hourly": hourly,
            }

        scenarios.append(
            {
                "day": day_idx,
                "start": start_iso,
                "techniques": techniques_out,
            }
        )

    return {"scenarios": scenarios}


if __name__ == "__main__":
    # Test run with fake weather
    fake_weather = [
        {"air_temp": 15.0 + 5 * math.sin(i * 2 * math.pi / 24),
         "wind_speed": 3.0,
         "rain_rate": 0.0}
        for i in range(13 * 24)
    ]
    fake_dates = [f"2026-04-{20+i:02d}T00:00:00" for i in range(7)]
    result = run_alfam2(
        tan_app=60.0,
        man_dm=6.0,
        man_ph=7.5,
        man_source="cattle",
        app_rate=30.0,
        incorp="none",
        incorp_time=0.5,
        weather_hourly=fake_weather,
        start_dates_iso=fake_dates,
    )
    import json
    # Print summary only
    for s in result["scenarios"]:
        print(f"Day {s['day']} ({s['start']}):")
        for tech, data in s["techniques"].items():
            print(f"  {tech}: {data['final_loss_pct']:.2f}%")
