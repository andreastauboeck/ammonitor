"""ALFAM2 model runner.

Runs 7 scenarios (day 0..6) in a single R call. Each scenario represents
applying manure at the start of that day and tracking cumulative NH3 loss
over the following 168 hours (7 days).

Each scenario is run for all variants of the selected variable, giving
7 * <num_variants> groups per R invocation.
"""
from __future__ import annotations

import csv
import math
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Literal

SCRIPT_DIR = Path(__file__).parent

N_SCENARIOS = 7
SCENARIO_HOURS = 168

VariableName = Literal[
    "app.mthd", "app.time", "man.dm", "man.ph", "incorp", "incorp.depth", "man.source"
]


def run_alfam2(
    variable: VariableName,
    variants: list[tuple[Any, str]],
    app_mthd: str = "th",
    man_dm: float = 6.0,
    man_ph: float = 7.5,
    man_source: str = "cattle",
    application_hour: int = 12,
    incorp: str = "none",
    incorp_time: float = 1.0,
    weather_hourly: list[dict] = None,
    start_dates_iso: list[str] = None,
) -> dict:
    return _run_alfam2_r(
        variable=variable,
        variants=variants,
        app_mthd=app_mthd,
        man_dm=man_dm,
        man_ph=man_ph,
        man_source=man_source,
        application_hour=application_hour,
        incorp=incorp,
        incorp_time=incorp_time,
        weather_hourly=weather_hourly,
        start_dates_iso=start_dates_iso,
    )


def _run_alfam2_r(
    variable: VariableName,
    variants: list[tuple[any, str]],
    app_mthd: str,
    man_dm: float,
    man_ph: float,
    man_source: str,
    application_hour: int,
    incorp: str,
    incorp_time: float,
    weather_hourly: list[dict],
    start_dates_iso: list[str],
) -> dict:
    min_needed = (N_SCENARIOS - 1) * 24 + application_hour + SCENARIO_HOURS
    if weather_hourly is not None and len(weather_hourly) < min_needed:
        raise ValueError(
            f"Need at least {min_needed} hours of weather, got {len(weather_hourly)}"
        )

    man_source_str = "pig" if man_source.lower() == "pig" else "cattle"
    incorp_lc = incorp.lower() if incorp else "none"
    if incorp_lc not in ("none", "shallow", "deep"):
        incorp_lc = "none"

    with tempfile.TemporaryDirectory() as tmpdir:
        input_file = os.path.join(tmpdir, "input.csv")
        output_file = os.path.join(tmpdir, "output.csv")

        rows = _build_input_rows(
            variable=variable,
            variants=variants,
            app_mthd=app_mthd,
            man_dm=man_dm,
            man_ph=man_ph,
            man_source_str=man_source_str,
            application_hour=application_hour,
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

        return _parse_output(out_rows, start_dates_iso, variants)


def _parse_app_hour(val) -> int:
    s = str(val).strip()
    if ":" in s:
        return int(s.split(":")[0])
    return int(float(s))


def _parse_float(val) -> float:
    return float(val)


def _build_input_rows(
    variable: VariableName,
    variants: list[tuple[any, str]],
    app_mthd: str,
    man_dm: float,
    man_ph: float,
    man_source_str: str,
    application_hour: int,
    incorp: str,
    incorp_time: float,
    weather_hourly: list[dict],
) -> list[dict]:
    rows: list[dict] = []
    tan_app = 60.0  # Fixed reference; does not affect er (relative emission)

    for day_idx in range(N_SCENARIOS):
        for var_idx, (var_value, var_label) in enumerate(variants):
            scenario_id = f"d{day_idx}_v{var_idx}"

            # Determine per-row values based on which variable is active
            row_dm = man_dm
            row_ph = man_ph
            row_source = man_source_str
            row_app_hour = application_hour
            row_incorp = incorp
            row_incorp_time = incorp_time

            if variable == "app.mthd":
                app_mthd_val = var_value
            else:
                app_mthd_val = app_mthd

            if variable == "man.dm":
                row_dm = _parse_float(var_value)
            if variable == "man.ph":
                row_ph = _parse_float(var_value)
            if variable == "man.source":
                row_source = "pig" if str(var_value).lower() == "pig" else "cattle"
            if variable == "app.time":
                row_app_hour = _parse_app_hour(var_value)

            if variable == "incorp":
                row_incorp_time = _parse_float(var_value)

            if variable == "incorp.depth":
                row_incorp = var_value if var_value != "none" else "none"
                # If depth is "none", don't send t.incorp
                if var_value == "none":
                    row_incorp = "none"
                    row_incorp_time = 0

            start_hour = day_idx * 24 + row_app_hour

            # t.incorp and incorp: only meaningful when incorp != "none"
            t_incorp_val = row_incorp_time if row_incorp != "none" else ""
            incorp_val = row_incorp if row_incorp != "none" else ""

            for hour_in_scenario in range(1, SCENARIO_HOURS + 1):
                weather_idx = start_hour + hour_in_scenario - 1
                w = weather_hourly[weather_idx]
                air_temp = float(w.get("air_temp", 15.0))
                wind_speed = max(float(w.get("wind_speed", 2.7)), 0.0)
                rain_rate = max(float(w.get("rain_rate", 0.0)), 0.0)
                wind_sqrt = math.sqrt(wind_speed)

                rows.append({
                    "scenario": scenario_id,
                    "ct": hour_in_scenario,
                    "TAN.app": tan_app,
                    "man.dm": row_dm,
                    "man.ph": row_ph,
                    "man.source": row_source,
                    "app.mthd": app_mthd_val,
                    "incorp": incorp_val,
                    "t.incorp": t_incorp_val,
                    "app.rate": 30.0,
                    "air.temp": air_temp,
                    "wind.sqrt": wind_sqrt,
                    "rain.rate": rain_rate,
                })

    return rows


def _safe_float(val) -> float:
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return 0.0
        return f
    except (ValueError, TypeError):
        return 0.0


def _parse_output(
    out_rows: list[dict],
    start_dates_iso: list[str],
    variants: list[tuple[any, str]],
) -> dict:
    by_scenario: dict[str, list[dict]] = {}
    for r in out_rows:
        sid = r.get("scenario", "")
        by_scenario.setdefault(sid, []).append(r)

    scenarios: list[dict] = []
    for day_idx in range(N_SCENARIOS):
        start_iso = start_dates_iso[day_idx] if day_idx < len(start_dates_iso) else ""
        variants_out: dict[str, dict] = {}

        for var_idx, (var_value, var_label) in enumerate(variants):
            sid = f"d{day_idx}_v{var_idx}"
            rows = by_scenario.get(sid, [])
            hourly: list[dict] = []
            final_er = 0.0
            for r in rows:
                try:
                    hour = int(float(r.get("ct", 0)))
                except (ValueError, TypeError):
                    continue
                er = _safe_float(r.get("er"))
                j = _safe_float(r.get("j"))
                hourly.append({"hour": hour, "er": er, "j": j})
                final_er = er

            hourly.sort(key=lambda x: x["hour"])
            if hourly:
                final_er = hourly[-1]["er"]

            variants_out[var_label] = {
                "final_loss_pct": round(final_er * 100.0, 2),
                "hourly": hourly,
            }

        scenarios.append({
            "day": day_idx,
            "start": start_iso,
            "variants": variants_out,
        })

    return {
        "variable": None,  # filled by caller
        "variant_labels": [label for _, label in variants],
        "scenarios": scenarios,
    }


if __name__ == "__main__":
    fake_weather = [
        {"air_temp": 15.0 + 5 * math.sin(i * 2 * math.pi / 24),
         "wind_speed": 3.0,
         "rain_rate": 0.0}
        for i in range(400)
    ]
    fake_dates = [f"2026-04-{20+i:02d}T00:00:00" for i in range(7)]
    result = run_alfam2(
        variable="app.mthd",
        variants=[("bc", "Broadcast"), ("th", "Trailing hose"), ("ts", "Trailing shoe"), ("os", "Open slot"), ("cs", "Closed slot")],
        app_mthd="th",
        weather_hourly=fake_weather,
        start_dates_iso=fake_dates,
    )
    for s in result["scenarios"]:
        print(f"Day {s['day']} ({s['start']}):")
        for label, data in s["variants"].items():
            print(f"  {label}: {data['final_loss_pct']:.2f}%")
