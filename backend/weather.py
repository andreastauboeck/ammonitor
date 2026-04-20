"""Open-Meteo weather fetcher with simple in-memory caching."""
from __future__ import annotations

import json
import math
import time
import urllib.parse
import urllib.request
from threading import Lock

# How many days of hourly forecast we need:
# For 7 scenarios (day 0..6) each spanning 7 days (168 h), we need
# data from day 0 hour 0 up to day 6 + 7 days = day 13 = 13 * 24 = 312 hours.
# We fetch 14 days (336 hours) to be safe for application time variation to come.
FORECAST_DAYS = 14
HOURS_NEEDED = 13 * 24  # 312

# Cache TTL in seconds (10 minutes)
CACHE_TTL = 600

# Rounding precision for the cache key to group nearby coordinates
COORD_PRECISION = 2  # ~1.1 km

_cache: dict[tuple, tuple[float, dict]] = {}
_cache_lock = Lock()


def fetch_weather(lat: float, lng: float, timezone_name: str = "auto") -> dict:
    """Fetch hourly weather forecast from Open-Meteo.

    Returns a dict:
    {
        "hourly": [
            {"time_iso": "2026-04-20T00:00", "air_temp": 12.3, "wind_speed": 3.1, "rain_rate": 0.0},
            ...
        ],
        "daily_starts": ["2026-04-20T00:00", "2026-04-21T00:00", ...]
    }

    Raises RuntimeError if the fetch fails.
    """
    key = (
        round(lat, COORD_PRECISION),
        round(lng, COORD_PRECISION),
        timezone_name,
    )

    with _cache_lock:
        cached = _cache.get(key)
        if cached is not None:
            ts, data = cached
            if time.time() - ts < CACHE_TTL:
                return data

    data = _fetch_from_open_meteo(lat, lng, timezone_name)

    with _cache_lock:
        _cache[key] = (time.time(), data)

    return data


def _fetch_from_open_meteo(lat: float, lng: float, timezone_name: str) -> dict:
    params = {
        "latitude": f"{lat:.4f}",
        "longitude": f"{lng:.4f}",
        "hourly": "temperature_2m,wind_speed_10m,precipitation",
        "wind_speed_unit": "ms",
        "forecast_days": str(FORECAST_DAYS),
        "timezone": timezone_name,
    }
    url = "https://api.open-meteo.com/v1/forecast?" + urllib.parse.urlencode(params)

    req = urllib.request.Request(url, headers={"User-Agent": "ammonitor/0.1"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode("utf-8")
    except Exception as e:
        raise RuntimeError(f"Open-Meteo request failed: {e}") from e

    try:
        payload = json.loads(body)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Invalid JSON from Open-Meteo: {e}") from e

    hourly = payload.get("hourly") or {}
    times = hourly.get("time") or []
    temps = hourly.get("temperature_2m") or []
    winds = hourly.get("wind_speed_10m") or []
    rains = hourly.get("precipitation") or []

    if not times or len(times) < HOURS_NEEDED:
        raise RuntimeError(
            f"Open-Meteo returned only {len(times)} hourly points "
            f"(need at least {HOURS_NEEDED})"
        )

    out_hourly = []
    for i in range(min(len(times), FORECAST_DAYS * 24)):
        t = times[i]
        out_hourly.append(
            {
                "time_iso": t,
                "air_temp": _safe_num(temps[i] if i < len(temps) else None, 15.0),
                "wind_speed": _safe_num(winds[i] if i < len(winds) else None, 2.7),
                "rain_rate": _safe_num(rains[i] if i < len(rains) else None, 0.0),
            }
        )

    # Extract the timestamp at 00:00 of each of the first 7 days
    daily_starts: list[str] = []
    seen_dates: set[str] = set()
    for h in out_hourly:
        t_iso = h["time_iso"]
        # Expected format "YYYY-MM-DDTHH:MM"
        date_part = t_iso.split("T")[0]
        if date_part not in seen_dates:
            seen_dates.add(date_part)
            # Use the 00:00 of the day if available, else the first hour of that day
            midnight_iso = f"{date_part}T00:00"
            # If the first encountered entry is not midnight, still use midnight as day start
            daily_starts.append(midnight_iso)
        if len(daily_starts) >= 7:
            break

    return {
        "hourly": out_hourly,
        "daily_starts": daily_starts,
        "timezone": payload.get("timezone"),
    }


def _safe_num(v, default: float) -> float:
    try:
        if v is None:
            return default
        f = float(v)
        if math.isnan(f) or math.isinf(f):
            return default
        return f
    except (ValueError, TypeError):
        return default
