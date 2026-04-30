"""FastAPI backend for ammonitor.

Serves the API at /api/* and, in production, the built React frontend at /.
"""
from __future__ import annotations

import os
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
    "app.mthd", "app.time", "man.dm", "man.ph", "incorp", "incorp.depth", "man.source"
]


class VariantDef(BaseModel):
    """A single variant: value sent to ALFAM2 and display label."""
    value: Any
    label: str


CALCULATE_EXAMPLE = {
    "lat": 48.23,
    "lng": 14.70,
    "variable": "app.mthd",
    "variants": [
        {"value": "bc", "label": "Broadcast"},
        {"value": "th", "label": "Trailing hose"},
        {"value": "ts", "label": "Trailing shoe"},
        {"value": "os", "label": "Open slot"},
        {"value": "cs", "label": "Closed slot"},
    ],
    "app_mthd": "th",
    "man_dm": 6.0,
    "man_ph": 7.5,
    "man_source": "cattle",
    "application_time": "12:00",
    "incorp": "none",
    "incorp_time": 4,
    "timezone": "Europe/Vienna",
}


class CalculateInput(BaseModel):
    """Request body for the /api/calculate endpoint."""
    lat: float
    lng: float
    variable: VariableName = "app.mthd"
    variants: list[VariantDef] = Field(
        ..., description="Variant definitions from frontend"
    )
    app_mthd: str = Field("th", description="Application method (when not the variable)")
    man_dm: float = Field(6.0, description="Manure dry matter (%)")
    man_ph: float = Field(7.5, description="Manure pH")
    man_source: str = Field("cattle", description="Manure source")
    application_time: str = Field("12:00", description="Application time (HH:MM)")
    incorp: str = Field("none", description="Incorporation depth")
    incorp_time: float = Field(1.0, description="Incorporation time (hours)")
    timezone: str = Field("auto", description="IANA timezone name for weather")

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
    """Run ALFAM2 emission prediction for all variants across 7 days."""
    variable = input_data.variable

    if variable == "incorp" and input_data.incorp == "none":
        raise HTTPException(
            status_code=422,
            detail="Cannot vary incorporation time when incorporation depth is 'none'",
        )

    try:
        weather = fetch_weather(input_data.lat, input_data.lng, input_data.timezone)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Weather fetch failed: {e}") from e

    first_hour_iso = weather["hourly"][0]["time_iso"]
    first_date = datetime.fromisoformat(first_hour_iso).date()

    app_hour_str = input_data.application_time.split(":")[0]
    app_hour = int(app_hour_str)

    daily_starts = [
        datetime.combine(
            first_date + timedelta(days=i), dt_time(hour=app_hour)
        ).isoformat(timespec="minutes")
        for i in range(7)
    ]

    variant_tuples = [(v.value, v.label) for v in input_data.variants]

    try:
        result = run_alfam2(
            variable=variable,
            variants=variant_tuples,
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ALFAM2 model error: {e}") from e

    return {
        "variable": variable,
        "variant_labels": result["variant_labels"],
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
