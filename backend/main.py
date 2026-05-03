"""FastAPI backend for ammonitor.

Serves the API at /api/* and, in production, the built React frontend at /.
"""
from __future__ import annotations

import os
import subprocess
from datetime import datetime, time as dt_time, timedelta
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.middleware.trustedhost import TrustedHostMiddleware

from run_alfam2 import run_alfam2
from weather import fetch_weather

VERSION = os.getenv("VERSION", "0.1.0")
ENVIRONMENT = os.getenv("ENVIRONMENT", "dev")


def _get_alfam2_info() -> tuple[str, str]:
    try:
        ver_proc = subprocess.run(
            ["Rscript", "-e", "library(ALFAM2); cat(as.character(packageVersion('ALFAM2')))"],
            capture_output=True, text=True, timeout=30, check=False,
        )
        alfam2_version = ver_proc.stdout.strip() if ver_proc.returncode == 0 else "unknown"
    except Exception:
        alfam2_version = "unknown"

    try:
        pars_proc = subprocess.run(
            ["Rscript", "-e",
             "library(ALFAM2);"
             "cat(max(as.numeric(sub('alfam2pars','',"
             "ls('package:ALFAM2',pattern='alfam2pars\\\\d+$')))))"],
            capture_output=True, text=True, timeout=30, check=False,
        )
        alfam2_pars_set = pars_proc.stdout.strip() if pars_proc.returncode == 0 else "3"
    except Exception:
        alfam2_pars_set = "3"

    return alfam2_version, alfam2_pars_set


ALFAM2_VERSION, ALFAM2_PARS_SET = _get_alfam2_info()

app = FastAPI(title="ammonitor API", version=VERSION)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=[
        "ammonitor.fly.dev",
        "ammonitor.online",
        "www.ammonitor.online",
    ] if ENVIRONMENT == "production" else ["*"],
)

VariableName = Literal[
    "app_mthd",
    "app_time",
    "man_dm",
    "man_ph",
    "incorp_depth",
    "incorp_time",
    "man_source",
]

ManureSource = Literal["cattle", "pig"]
IncorpDepth = Literal["none", "shallow", "deep"]
AppMethod = Literal["bc", "th", "ts", "os", "cs"]

# Canonical allowed values per variable. Single source of truth used to
# validate incoming `values` lists.
VARIANT_VALUES: dict[str, list[Any]] = {
    "app_mthd": ["bc", "th", "ts", "os", "cs"],
    "app_time": [6, 8, 12, 16, 20],
    "man_dm": [2, 4, 6, 10, 14],
    "man_ph": [5.5, 6.5, 7.5, 8.0, 9.0],
    "man_source": ["cattle", "pig"],
    "incorp_depth": ["none", "shallow", "deep"],
    "incorp_time": [0, 2, 4, 8, 12, 24],
}


CALCULATE_EXAMPLE = {
    "lat": 48.23,
    "lng": 14.70,
    "variable": "app_mthd",
    "values": ["bc", "th", "ts", "os", "cs"],
    "app_mthd": "th",
    "app_time": 12,
    "man_dm": 6.0,
    "man_ph": 7.5,
    "man_source": "cattle",
    "incorp_depth": "none",
    "incorp_time": 4,
    "timezone": "Europe/Vienna",
}


class CalculateInput(BaseModel):
    """Request body for the /api/calculate endpoint.

    Run the ALFAM2 ammonia loss model over 8 consecutive days for one
    variable parameter, comparing all `values` against the same fixed
    parameter set. Each variant is simulated for 168 hours starting at the
    given application time on each day.
    """
    lat: float = Field(..., ge=-90, le=90, description="Latitude (WGS84)")
    lng: float = Field(..., ge=-180, le=180, description="Longitude (WGS84)")
    variable: VariableName = Field(
        "app_mthd",
        description="Which parameter to vary across runs"
    )
    values: list[Any] = Field(
        ...,
        description="Variant values to compare. Must be a subset of the "
                    "allowed values for the given variable."
    )
    app_mthd: AppMethod = Field(
        "th", description="Application method when variable != 'app_mthd'"
    )
    app_time: int = Field(
        12, ge=0, le=23,
        description="Application time as hour of day (0-23)"
    )
    man_dm: float = Field(
        6.0, ge=1.0, le=15.0, description="Manure dry matter (% w/w)"
    )
    man_ph: float = Field(
        7.5, ge=5.5, le=9.0, description="Manure pH"
    )
    man_source: ManureSource = Field(
        "cattle", description="Manure source"
    )
    incorp_depth: IncorpDepth = Field(
        "none", description="Incorporation depth"
    )
    incorp_time: float = Field(
        0.0, ge=0.0, description="Incorporation time (hours after application)"
    )
    timezone: str = Field(
        "auto", description="IANA timezone for weather forecast"
    )

    model_config = {
        "json_schema_extra": {
            "example": CALCULATE_EXAMPLE,
        }
    }


@app.get("/api/status")
def get_status() -> dict[str, str]:
    """Return backend health, version and environment."""
    return {
        "status": "ok",
        "version": VERSION,
        "environment": ENVIRONMENT,
        "alfam2_version": ALFAM2_VERSION,
        "alfam2_pars_set": ALFAM2_PARS_SET,
    }


@app.post("/api/calculate",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": CALCULATE_EXAMPLE,
                }
            }
        }
    })
def calculate(input_data: CalculateInput) -> dict:
    """Run ALFAM2 emission prediction for all variants across 8 days.

    Returns hourly emission ratios (er) and per-day final loss percentages
    for each variant value, plus the hourly weather used for the simulation.
    """
    variable = input_data.variable

    if variable == "incorp_time" and input_data.incorp_depth == "none":
        raise HTTPException(
            status_code=422,
            detail="Cannot vary incorporation time when incorporation depth is 'none'",
        )

    allowed = VARIANT_VALUES.get(variable, [])
    invalid = [v for v in input_data.values if v not in allowed]
    if invalid:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid values for variable '{variable}': {invalid}. "
                   f"Allowed: {allowed}",
        )

    if not input_data.values:
        raise HTTPException(
            status_code=422,
            detail="`values` must not be empty",
        )

    try:
        weather = fetch_weather(input_data.lat, input_data.lng, input_data.timezone)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Weather fetch failed: {e}") from e

    first_hour_iso = weather["hourly"][0]["time_iso"]
    first_date = datetime.fromisoformat(first_hour_iso).date()

    daily_starts = [
        datetime.combine(
            first_date + timedelta(days=i),
            dt_time(hour=input_data.app_time),
        ).isoformat(timespec="minutes")
        for i in range(8)
    ]

    try:
        result = run_alfam2(
            variable=variable,
            values=input_data.values,
            app_mthd=input_data.app_mthd,
            man_dm=input_data.man_dm,
            man_ph=input_data.man_ph,
            man_source=input_data.man_source,
            application_hour=input_data.app_time,
            incorp_depth=input_data.incorp_depth,
            incorp_time=input_data.incorp_time,
            weather_hourly=weather["hourly"],
            start_dates_iso=daily_starts,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ALFAM2 model error: {e}") from e

    return {
        "variable": variable,
        "values": input_data.values,
        "days": result["days"],
        "weather": weather["hourly"],
    }


# Serve the built frontend if present (production mode).
_FRONTEND_DIST = Path(__file__).parent / "frontend" / "dist"

if _FRONTEND_DIST.is_dir():
    _ASSETS_DIR = _FRONTEND_DIST / "assets"
    if _ASSETS_DIR.is_dir():
        app.mount("/assets", StaticFiles(directory=_ASSETS_DIR), name="assets")

    @app.get("/", include_in_schema=False)
    def serve_index() -> FileResponse:
        """Serve the SPA entry point."""
        return FileResponse(_FRONTEND_DIST / "index.html")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str) -> FileResponse:
        """Serve a static asset or fall back to the SPA entry point."""
        candidate = _FRONTEND_DIST / full_path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_FRONTEND_DIST / "index.html")
