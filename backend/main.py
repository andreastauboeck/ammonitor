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

from run_alfam2 import run_alfam2, VARIANT_DEFS
from weather import fetch_weather

VERSION = os.getenv("VERSION", "0.1.0")
ENVIRONMENT = os.getenv("ENVIRONMENT", "dev")

app = FastAPI(title="ammonitor API", version=VERSION)

VariableName = Literal[
    "app.mthd", "app.time", "man.dm", "man.ph", "incorp", "incorp.depth", "man.source"
]


class CalculateInput(BaseModel):
    lat: float
    lng: float
    variable: VariableName = "app.mthd"
    app_mthd: str = Field("th", description="Application method (when not the variable)")
    man_dm: float = Field(6.0, description="Manure dry matter (%)")
    man_ph: float = Field(7.5, description="Manure pH")
    man_source: Literal["cattle", "pig"] = "cattle"
    application_time: Literal["06:00", "08:00", "12:00", "16:00", "20:00"] = "12:00"
    incorp: Literal["none", "shallow", "deep"] = "none"
    incorp_time: float = Field(1.0, description="Incorporation time (hours)")
    timezone: str = Field("auto", description="IANA timezone name for weather")


@app.get("/api/status")
def get_status() -> dict[str, str]:
    return {
        "status": "ok",
        "version": VERSION,
        "environment": ENVIRONMENT,
    }


@app.get("/api/variants/{variable}")
def get_variants(variable: VariableName) -> dict:
    variants = VARIANT_DEFS[variable]
    return {
        "variable": variable,
        "variants": [{"value": v, "label": label} for v, label in variants],
    }


@app.post("/api/calculate")
def calculate(input_data: CalculateInput) -> dict:
    variable = input_data.variable

    # Validate: incorp variable requires incorp depth != none
    if variable == "incorp" and input_data.incorp == "none":
        raise HTTPException(
            status_code=422,
            detail="Cannot vary incorporation time when incorporation depth is 'none'",
        )

    try:
        weather = fetch_weather(input_data.lat, input_data.lng, input_data.timezone)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Weather fetch failed: {e}")

    first_hour_iso = weather["hourly"][0]["time_iso"]
    first_date = datetime.fromisoformat(first_hour_iso).date()
    app_hour = int(input_data.application_time.split(":")[0])

    daily_starts = [
        datetime.combine(
            first_date + timedelta(days=i), dt_time(hour=app_hour)
        ).isoformat(timespec="minutes")
        for i in range(7)
    ]

    result = run_alfam2(
        variable=variable,
        app_mthd=input_data.app_mthd,
        man_dm=input_data.man_dm,
        man_ph=input_data.man_ph,
        man_source=input_data.man_source,
        application_hour=app_hour,
        incorp=input_data.incorp,
        incorp_time=input_data.incorp_time,
        weather_hourly=weather["hourly"],
        start_dates_iso=daily_starts,
    )

    result["variable"] = variable

    return {
        "variable": result["variable"],
        "variant_labels": result["variant_labels"],
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
