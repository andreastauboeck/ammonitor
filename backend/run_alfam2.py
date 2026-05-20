"""ALFAM2 model runner.

Runs N_DAYS consecutive days in a single R call. Each day represents
applying manure at the start of that day and tracking cumulative NH3 loss
over the following PREDICTION_HOURS hours.

Each day is run for all variant values of the selected variable, giving
N_DAYS * <num_values> groups per R invocation.
"""
from __future__ import annotations

import csv
import logging
import math
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Literal

SCRIPT_DIR = Path(__file__).parent
logger = logging.getLogger("ammonitor.alfam2")

N_DAYS = 8
PREDICTION_HOURS = 168

VariableName = Literal[
    "app_mthd",
    "app_time",
    "man_dm",
    "man_ph",
    "incorp_depth",
    "incorp_time",
    "man_source",
]


def run_alfam2(
    variable: VariableName,
    values: list[Any],
    app_mthd: str = "th",
    man_dm: float = 6.0,
    man_ph: float = 7.5,
    man_source: str = "cattle",
    application_hour: int = 12,
    incorp_depth: str = "none",
    incorp_time: float = 0.0,
    weather_hourly: list[dict] = None,
    start_dates_iso: list[str] = None,
    conf_int: float | None = None,
    n_ci: int | None = None,
    day_indices: list[int] | None = None,
) -> dict:
    """Multi-variant entry point: vary `variable` across `values`.

    For each day and each value, builds one row group that overrides the
    chosen scalar parameter with the variant value (everything else stays
    fixed). Used by `/api/calculate`.

    By default runs all N_DAYS consecutive days. When `day_indices` is
    provided, only those day offsets (0-based) are computed.
    """
    return _run_alfam2_r(
        variable=variable,
        values=values,
        app_mthd=app_mthd,
        man_dm=man_dm,
        man_ph=man_ph,
        man_source=man_source,
        application_hour=application_hour,
        incorp_depth=incorp_depth,
        incorp_time=incorp_time,
        weather_hourly=weather_hourly,
        start_dates_iso=start_dates_iso,
        conf_int=conf_int,
        n_ci=n_ci,
        day_indices=day_indices,
    )


def run_alfam2_single(
    app_mthd: str = "th",
    man_dm: float = 6.0,
    man_ph: float = 7.5,
    man_source: str = "cattle",
    application_hour: int = 12,
    incorp_depth: str = "none",
    incorp_time: float = 0.0,
    weather_hourly: list[dict] = None,
    start_dates_iso: list[str] = None,
    conf_int: float | None = None,
    n_ci: int | None = None,
    day_indices: list[int] | None = None,
) -> dict:
    """Single-scenario entry point: ALL scalars resolved by the caller.

    No `variable` / `value` discriminator — the caller has already
    decided every parameter. Used by `/api/calculate-ci` so the CI
    fetch only ever runs one scenario (the chosen variant on the chosen
    day) with confidence intervals.

    Returns the same shape as `run_alfam2` but with `days[*].variants`
    always of length 1 (the result of this single scenario).
    """
    return _run_alfam2_r(
        variable=None,
        values=[None],  # single placeholder variant
        app_mthd=app_mthd,
        man_dm=man_dm,
        man_ph=man_ph,
        man_source=man_source,
        application_hour=application_hour,
        incorp_depth=incorp_depth,
        incorp_time=incorp_time,
        weather_hourly=weather_hourly,
        start_dates_iso=start_dates_iso,
        conf_int=conf_int,
        n_ci=n_ci,
        day_indices=day_indices,
    )


def _run_alfam2_r(
    variable: VariableName | None,
    values: list[Any],
    app_mthd: str,
    man_dm: float,
    man_ph: float,
    man_source: str,
    application_hour: int,
    incorp_depth: str,
    incorp_time: float,
    weather_hourly: list[dict],
    start_dates_iso: list[str],
    conf_int: float | None,
    n_ci: int | None,
    day_indices: list[int] | None,
) -> dict:
    """Invoke the ALFAM2 R script with the given parameters.

    When `variable is None`, the rows use the scalar parameters as-is
    (single-scenario path); `values` may be `[None]` as a placeholder.
    """
    effective_day_indices = (
        list(range(N_DAYS)) if day_indices is None else sorted(set(day_indices))
    )
    max_day = max(effective_day_indices) if effective_day_indices else 0
    min_needed = max_day * 24 + application_hour + PREDICTION_HOURS
    if weather_hourly is not None and len(weather_hourly) < min_needed:
        raise ValueError(
            f"Need at least {min_needed} hours of weather, got {len(weather_hourly)}"
        )

    man_source_str = "pig" if str(man_source).lower() == "pig" else "cattle"
    incorp_lc = (incorp_depth or "none").lower()
    if incorp_lc not in ("none", "shallow", "deep"):
        incorp_lc = "none"

    with tempfile.TemporaryDirectory() as tmpdir:
        input_file = os.path.join(tmpdir, "input.csv")
        output_file = os.path.join(tmpdir, "output.csv")

        rows = _build_input_rows(
            variable=variable,
            values=values,
            app_mthd=app_mthd,
            man_dm=man_dm,
            man_ph=man_ph,
            man_source_str=man_source_str,
            application_hour=application_hour,
            incorp_depth=incorp_lc,
            incorp_time=incorp_time,
            weather_hourly=weather_hourly,
            day_indices=effective_day_indices,
        )

        fieldnames = [
            "day_variant",
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
        with open(input_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

        r_script = SCRIPT_DIR / "run_alfam2.R"
        r_args = ["Rscript", str(r_script), input_file, output_file]
        if conf_int is not None:
            r_args.append(str(conf_int))
            if n_ci is not None:
                r_args.append(str(n_ci))
        logger.info("alfam2.r_start variable=%s days=%d variants=%d rows=%d",
                    variable or "(single)", N_DAYS, len(values), len(rows))
        proc = subprocess.run(
            r_args,
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )

        if proc.returncode != 0:
            logger.error("alfam2.r_fail rc=%d stderr=%s", proc.returncode, proc.stderr[:500])
            raise RuntimeError(f"R script failed: {proc.stderr}")

        if not os.path.exists(output_file):
            raise FileNotFoundError(f"Output file not created: {output_file}")

        with open(output_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            out_rows = list(reader)

        if not out_rows:
            raise ValueError("Empty output from ALFAM2")

        return _parse_output(out_rows, start_dates_iso, values, effective_day_indices)


def _parse_float(val) -> float:
    return float(val)


def _build_input_rows(
    variable: VariableName | None,
    values: list[Any],
    app_mthd: str,
    man_dm: float,
    man_ph: float,
    man_source_str: str,
    application_hour: int,
    incorp_depth: str,
    incorp_time: float,
    weather_hourly: list[dict],
    day_indices: list[int] | None = None,
) -> list[dict]:
    """Build ALFAM2 input CSV rows.

    For each day in `day_indices` (or all N_DAYS) and each entry in
    `values`, builds 168 hourly rows starting at the given application
    time. When `variable` is set, the matching scalar is overridden by
    `var_value`; when `variable is None`, the scalars are used as-is and
    `values` is treated as a single placeholder.
    """
    rows: list[dict] = []
    day_idx_iter = day_indices if day_indices is not None else range(N_DAYS)

    for day_idx in day_idx_iter:
        for var_idx, var_value in enumerate(values):
            scalars = _override_scalars(
                variable,
                var_value,
                app_mthd=app_mthd,
                man_dm=man_dm,
                man_ph=man_ph,
                man_source_str=man_source_str,
                application_hour=application_hour,
                incorp_depth=incorp_depth,
                incorp_time=incorp_time,
            )
            rows.extend(
                _build_day_variant_rows(
                    csv_id=f"d{day_idx}_v{var_idx}",
                    day_idx=day_idx,
                    weather_hourly=weather_hourly,
                    **scalars,
                )
            )

    return rows


def _override_scalars(
    variable: VariableName | None,
    var_value: Any,
    *,
    app_mthd: str,
    man_dm: float,
    man_ph: float,
    man_source_str: str,
    application_hour: int,
    incorp_depth: str,
    incorp_time: float,
) -> dict:
    """Apply a variant value onto the matching scalar parameter.

    Returns a dict of resolved scalars ready to feed
    `_build_day_variant_rows`. When `variable is None`, scalars are
    returned unchanged.
    """
    out_app_mthd = app_mthd
    out_dm = man_dm
    out_ph = man_ph
    out_source = man_source_str
    out_app_hour = application_hour
    out_incorp_depth = incorp_depth
    out_incorp_time = incorp_time

    if variable == "app_mthd":
        out_app_mthd = str(var_value)
    elif variable == "man_dm":
        out_dm = _parse_float(var_value)
    elif variable == "man_ph":
        out_ph = _parse_float(var_value)
    elif variable == "man_source":
        out_source = "pig" if str(var_value).lower() == "pig" else "cattle"
    elif variable == "app_time":
        out_app_hour = int(var_value)
    elif variable == "incorp_time":
        out_incorp_time = _parse_float(var_value)
    elif variable == "incorp_depth":
        out_incorp_depth = str(var_value)
        if out_incorp_depth == "none":
            out_incorp_time = 0

    return {
        "app_mthd": out_app_mthd,
        "man_dm": out_dm,
        "man_ph": out_ph,
        "man_source_str": out_source,
        "application_hour": out_app_hour,
        "incorp_depth": out_incorp_depth,
        "incorp_time": out_incorp_time,
    }


def _build_day_variant_rows(
    *,
    csv_id: str,
    day_idx: int,
    weather_hourly: list[dict],
    app_mthd: str,
    man_dm: float,
    man_ph: float,
    man_source_str: str,
    application_hour: int,
    incorp_depth: str,
    incorp_time: float,
) -> list[dict]:
    """Build the 168 hourly CSV rows for one (day, variant) group."""
    tan_app = 60.0  # Fixed reference; does not affect er (relative emission)
    start_hour = day_idx * 24 + application_hour

    # incorp and t.incorp: only meaningful when depth != "none"
    t_incorp_val = incorp_time if incorp_depth != "none" else ""
    incorp_val = incorp_depth if incorp_depth != "none" else ""

    rows: list[dict] = []
    for hour_idx in range(1, PREDICTION_HOURS + 1):
        weather_idx = start_hour + hour_idx - 1
        w = weather_hourly[weather_idx]
        air_temp = float(w["air_temp"])
        wind_speed = max(float(w["wind_speed"]), 0.0)
        rain_rate = max(float(w["rain_rate"]), 0.0)
        wind_sqrt = math.sqrt(wind_speed)

        rows.append({
            "day_variant": csv_id,
            "ct": hour_idx,
            "TAN.app": tan_app,
            "man.dm": man_dm,
            "man.ph": man_ph,
            "man.source": man_source_str,
            "app.mthd": app_mthd,
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
    values: list[Any],
    day_indices: list[int] | None = None,
) -> dict:
    """Group R output rows by day and variant value, returning ordered arrays."""
    by_csv_id: dict[str, list[dict]] = {}
    for r in out_rows:
        csv_id = r.get("day_variant", "")
        by_csv_id.setdefault(csv_id, []).append(r)

    day_idx_iter = day_indices if day_indices is not None else list(range(N_DAYS))
    days: list[dict] = []
    for day_idx in day_idx_iter:
        start_iso = start_dates_iso[day_idx] if day_idx < len(start_dates_iso) else ""
        variants_out: list[dict] = []

        for var_idx, var_value in enumerate(values):
            csv_id = f"d{day_idx}_v{var_idx}"
            rows = by_csv_id.get(csv_id, [])
            hourly: list[dict] = []
            for r in rows:
                try:
                    hour = int(float(r.get("ct", 0)))
                except (ValueError, TypeError):
                    continue
                er = _safe_float(r.get("er"))
                point: dict = {"hour": hour, "er": er}
                er_lwr = r.get("er.lwr", "")
                er_upr = r.get("er.upr", "")
                if er_lwr != "" and er_upr != "":
                    point["er_lwr"] = _safe_float(er_lwr)
                    point["er_upr"] = _safe_float(er_upr)
                hourly.append(point)

            hourly.sort(key=lambda x: x["hour"])
            final_er = hourly[-1]["er"] if hourly else 0.0
            final_point = hourly[-1] if hourly else {}

            variant_out: dict = {
                "value": var_value,
                "final_loss_pct": round(final_er * 100.0, 2),
                "hourly": hourly,
            }
            if "er_lwr" in final_point and "er_upr" in final_point:
                variant_out["final_loss_lwr"] = round(final_point["er_lwr"] * 100.0, 2)
                variant_out["final_loss_upr"] = round(final_point["er_upr"] * 100.0, 2)

            variants_out.append(variant_out)

        days.append({
            "day": day_idx,
            "start": start_iso,
            "variants": variants_out,
        })

    return {
        "days": days,
    }


if __name__ == "__main__":
    fake_weather = [
        {"air_temp": 15.0 + 5 * math.sin(i * 2 * math.pi / 24),
         "wind_speed": 3.0,
         "rain_rate": 0.0}
        for i in range(400)
    ]
    fake_dates = [f"2026-04-{20+i:02d}T00:00:00" for i in range(8)]
    result = run_alfam2(
        variable="app_mthd",
        values=["bc", "th", "ts", "os", "cs"],
        app_mthd="th",
        weather_hourly=fake_weather,
        start_dates_iso=fake_dates,
    )
    for day in result["days"]:
        print(f"Day {day['day']} ({day['start']}):")
        for v in day["variants"]:
            print(f"  {v['value']}: {v['final_loss_pct']:.2f}%")
