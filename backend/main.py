"""FastAPI backend for ammonitor.

Serves the API at /api/* and, in production, the built React frontend at /.
"""
from __future__ import annotations

import os
from datetime import datetime, time as dt_time, timedelta
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.middleware.trustedhost import TrustedHostMiddleware

from run_alfam2 import run_alfam2
from weather import fetch_weather

VERSION = os.getenv("VERSION", "0.1.0")
ENVIRONMENT = os.getenv("ENVIRONMENT", "dev")

app = FastAPI(title="ammonitor API", version=VERSION)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=[
        "ammonitor.fly.dev",
        "ammonitor.online",
        "www.ammonitor.online",
    ],
)


class CalculateInput(BaseModel):
    lat: float
    lng: float
    tan_app: float = Field(..., description="TAN applied (kg/ha)")
    man_dm: float = Field(..., description="Manure dry matter (%)")
    man_ph: float = Field(..., description="Manure pH")
    man_source: Literal["cattle", "pig"] = "cattle"
    application_time: Literal["06:00", "14:00", "18:00"] = "14:00"
    incorp: Literal["none", "shallow", "deep"] = "none"
    incorp_time: float = Field(
        0.5, description="Time after application when incorporation occurs (hours)"
    )
    timezone: str = Field("auto", description="IANA timezone name for weather")


@app.get("/api/status")
def get_status() -> dict[str, str]:
    return {
        "status": "ok",
        "version": VERSION,
        "environment": ENVIRONMENT,
    }


@app.post("/api/calculate")
def calculate(input_data: CalculateInput) -> dict:
    """Run ALFAM2 calculation for 7 scenarios x 5 techniques."""
    try:
        weather = fetch_weather(input_data.lat, input_data.lng, input_data.timezone)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Weather fetch failed: {e}")

    # Compute daily_starts: for each of 7 days, the start timestamp of the
    # scenario (application time). The first weather hour is at 00:00 of day 0.
    first_hour_iso = weather["hourly"][0]["time_iso"]
    first_date = datetime.fromisoformat(first_hour_iso).date()
    app_hour = int(input_data.application_time.split(":")[0])

    daily_starts = [
        datetime.combine(
            first_date + timedelta(days=i), dt_time(hour=app_hour)
        ).isoformat(timespec="minutes")
        for i in range(7)
    ]

    # app_rate does not affect ALFAM2 (parameter set 3 has no app.rate.ni
    # coefficient). We pass a fixed reference value internally.
    result = run_alfam2(
        tan_app=input_data.tan_app,
        man_dm=input_data.man_dm,
        man_ph=input_data.man_ph,
        man_source=input_data.man_source,
        app_rate=30.0,
        incorp=input_data.incorp,
        incorp_time=input_data.incorp_time,
        application_hour=app_hour,
        weather_hourly=weather["hourly"],
        start_dates_iso=daily_starts,
    )

    # Return only what frontend needs: scenarios + weather
    return {
        "scenarios": result["scenarios"],
        "weather": weather["hourly"],
    }


# Serve the built frontend if present (production mode).
_FRONTEND_DIST = Path(__file__).parent / "frontend" / "dist"

if _FRONTEND_DIST.is_dir():
    _ASSETS_DIR = _FRONTEND_DIST / "assets"
    if _ASSETS_DIR.is_dir():
        app.mount("/assets", StaticFiles(directory=_ASSETS_DIR), name="assets")

    @app.get("/")
    def serve_index() -> FileResponse:
        return FileResponse(_FRONTEND_DIST / "index.html")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str) -> FileResponse:
        candidate = _FRONTEND_DIST / full_path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_FRONTEND_DIST / "index.html")
