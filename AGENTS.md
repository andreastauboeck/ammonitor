# AGENTS.md — ammonitor Project Reference

## Project Overview

Ammonia (NH3) emission prediction and monitoring decision-support tool for agriculture. Uses the ALFAM2 model (R package) driven by weather forecasts (Open-Meteo) to predict NH3 loss from manure application across 7-day scenarios, comparing variants of application parameters.

**Version:** See `VERSION` file at repo root (currently `0.2.0`)

**Tech stack:** Python 3 / FastAPI / R (ALFAM2) / React 18 / TypeScript / Tailwind CSS / Recharts / Leaflet / Docker / Fly.io

---

## Architecture

```
User clicks map on Home page
  → navigates to /calculate/{lat}/{lng}
  → Calculation.tsx reads lat/lng from URL params

Calculation.tsx:
  1. Reverse-geocodes lat/lng via Nominatim (displays location name)
  2. Reads browser timezone
  3. Builds request body from formData + VARIANT_DEFS[variable]
  4. POST /api/calculate → backend

Backend main.py /api/calculate:
  1. Validates input (e.g. incorp="none" + variable="incorp" → 422)
  2. fetch_weather(lat, lng, timezone) → Open-Meteo (cached 10 min)
  3. Computes 7 daily start datetimes
  4. Calls run_alfam2(...)

run_alfam2.py:
  1. Builds input CSV: 7 days × N variants × 168 hours per row
  2. Calls Rscript run_alfam2.R <input.csv> <output.csv>
  3. run_alfam2.R calls ALFAM2::alfam2()
  4. Parses output CSV into {variant_labels, scenarios[{day, start, variants[{final_loss_pct, hourly}]}]}

Backend returns:
  { variable, variant_labels, scenarios, weather }

Frontend renders:
  - No day selected → OverviewChart (grouped bars: final_loss_pct per variant per day)
  - Day selected → DetailChart (lines: hourly er over 168h, + weather sub-chart)
```

---

## Key Files

| File | Purpose | Key Exports/Functions |
|------|---------|----------------------|
| `VERSION` | Single-line version string | Read by CI pipeline for Docker image tagging |
| `backend/main.py` | FastAPI app: API routes + SPA serving | `app`, `CalculateInput`, `VariantDef` |
| `backend/run_alfam2.py` | ALFAM2 R model runner | `run_alfam2()`, `_build_input_rows()`, `_parse_output()` |
| `backend/run_alfam2.R` | R-side ALFAM2 invocation | Called via `Rscript` |
| `backend/weather.py` | Open-Meteo forecast fetcher | `fetch_weather()` |
| `backend/requirements.txt` | Python dependencies | `fastapi`, `uvicorn` |
| `frontend/src/main.tsx` | React app bootstrap + routes | Routes: `/`, `/calculate/:lat/:lng`, `/calculate/:lat/:lng/:day` |
| `frontend/src/pages/types.ts` | Shared types, constants, utilities | `VARIANT_DEFS`, `INPUT_LABELS`, `DEFAULT_FORM_DATA`, `VARIANT_COLORS`, `ApiResponse`, `FormData` |
| `frontend/src/pages/Home.tsx` | Leaflet map location selector | Search + click → navigate to calculation |
| `frontend/src/pages/Calculation.tsx` | Parameter form + chart orchestration | Form state, API calls, URL param sync |
| `frontend/src/pages/OverviewChart.tsx` | 7-day grouped bar chart | Click bar → detail view |
| `frontend/src/pages/DetailChart.tsx` | Hourly line chart + weather | Log-scale x-axis, app.time offset, incorp markers |
| `Dockerfile` | Multi-stage production build | r-base → frontend-build → runtime |
| `fly.toml` | Fly.io deployment config | App: ammonitor, region: fra, port: 8000 |
| `.github/workflows/deploy.yml` | CI/CD: build → push → deploy | VERSION file → Docker tags → Fly.io |

---

## API Reference

### `POST /api/calculate`

**Request body:**
```json
{
  "lat": 48.23,
  "lng": 14.70,
  "variable": "app.mthd",
  "variants": [
    {"value": "bc", "label": "Broadcast"},
    {"value": "th", "label": "Trailing hose"},
    {"value": "ts", "label": "Trailing shoe"},
    {"value": "os", "label": "Open slot"},
    {"value": "cs", "label": "Closed slot"}
  ],
  "app_mthd": "th",
  "man_dm": 6.0,
  "man_ph": 7.5,
  "man_source": "cattle",
  "application_time": "12:00",
  "incorp": "none",
  "incorp_time": 4,
  "timezone": "Europe/Vienna"
}
```

**Response:**
```json
{
  "variable": "app.mthd",
  "variant_labels": ["Broadcast", "Trailing hose", "Trailing shoe", "Open slot", "Closed slot"],
  "scenarios": [
    {
      "day": 0,
      "start": "2026-04-28T12:00",
      "variants": {
        "Broadcast": {
          "final_loss_pct": 34.56,
          "hourly": [{"hour": 1, "er": 0.12, "j": 0.45}, ...]
        }
      }
    }
  ],
  "weather": [{"time_iso": "2026-04-28T12:00", "air_temp": 12.3, "wind_speed": 3.1, "rain_rate": 0.0}, ...]
}
```

### `GET /api/status`

Returns `{"status": "ok", "version": "0.2.0", "environment": "production"}`

---

## Frontend Conventions

- **VARIANT_DEFS** in `types.ts` is the **canonical source of truth** for variant options. The backend receives them in the API request body — no hardcoded definitions on the backend side.
- **Color scheme:** 5 fixed colors `[#ef4444, #3b82f6, #8b5cf6, #10b981, #f59e0b]` indexed by variant position.
- **URL params:** All form state is serialized to URL search params for shareable URLs. Form deserialization reads them back on page load.
- **Variable selector:** Radio button column — one variable at a time. The selected variable's dropdown is disabled since it will be varied.
- **Incorp depth = "none":** Disables incorp time as a variable option. Switching depth to "none" while variable is "incorp" auto-falls back to "app.mthd".
- **TAN applied:** Free number input, never a variable. er is independent of TAN; kg/ha is computed frontend-side as `er × tanApp / 100`.
- **app.time detail chart:** When `app.time` is the variable, emission lines start at their actual clock time. X-axis uses hybrid labels (clock + elapsed hours). Weather aligns naturally via real-time lookup. Later-starting variants get a 0% emission start point.
- **Incorp markers:** When incorp is the variable, each variant gets a dashed reference line at its incorp hour in the matching variant color. When fixed, a single yellow marker appears.

---

## Backend Conventions

- **ALFAM2 input CSV columns:** `scenario, ct, TAN.app, man.dm, man.ph, man.source, app.mthd, incorp, t.incorp, app.rate, air.temp, wind.sqrt, rain.rate`
- **ALFAM2 output CSV columns:** `scenario, ct, e, er, j, jinst`
- **Fixed model parameters:** `TAN.app = 60.0`, `app.rate = 30.0` — hardcoded in `_build_input_rows()`, not configurable from the frontend.
- **Incorp depth "none":** Means empty `incorp` and `t.incorp` columns in the CSV (NA in R).
- **wind.sqrt:** Precomputed in Python before sending to R.
- **Scenario IDs:** Pattern `d{day_idx}_v{var_idx}` (e.g. `d0_v0`, `d2_v4`).
- **Weather caching:** In-memory cache with 10-min TTL, coordinate keys rounded to 2 decimal places (~1.1 km).
- **Variant value parsing:** `_parse_app_hour()` handles `"06:00"` → 6, `_parse_float()` ensures numeric types from JSON.
- **Error strategy:** 422 for validation errors, 502 for weather fetch failures, 500 for R script failures.

---

## Development Setup

### Backend

```bash
cd backend
C:\ammonitor\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm run dev
```

Vite dev server on port 5173 proxies `/api/*` to `http://localhost:8000` (configured in `vite.config.ts`).

### Build frontend

```bash
cd frontend
npm run build
```

Output goes to `frontend/dist/`, which the backend serves in production mode.

---

## Deployment

### Docker image

3-stage build:
1. **r-base** — Installs R + ALFAM2 package (rarely changes, good cache layer)
2. **frontend-build** — `npm install` + `npm run build`
3. **runtime** — Python3 + pip deps + R (copied from r-base) + backend + built frontend

Build arg: `VERSION` → baked into image as env var → returned by `/api/status`.

### CI/CD pipeline (`.github/workflows/deploy.yml`)

Trigger: push to `main`. Steps:
1. Read `VERSION` file
2. Build + push Docker image to GHCR with tags: `latest`, commit SHA, version number
3. Deploy to Fly.io using the pushed image

Required secrets: `GITHUB_TOKEN` (auto), `FLY_API_TOKEN`.

### Version bumping

Edit the `VERSION` file at the repo root, commit, push to main. The pipeline will tag the image accordingly.

### Fly.io config (`fly.toml`)

- App: `ammonitor`, region: `fra`, port: 8000
- VM: shared-cpu-1x, 256 MB RAM
- Scales to zero when idle (min 0 machines)

---

## Known Gotchas

- **PowerShell on Windows:** Cannot use inline Python (`cmd /c "python -c ..."`) or certain curl quoting patterns. Write temp `.py` files instead.
- **R script NA handling:** Empty `incorp` and `t.incorp` columns become NA in R. The R script normalizes these before calling `alfam2()`.
- **Log-scale Recharts:** Requires `type="number"` on XAxis with numeric `dataKey`. String labels won't work with log scale.
- **ResponsiveContainer:** Needs a flex parent with explicit height. Use `flex-1 min-h-0` pattern.
- **Y-axis labels as SVG:** Get clipped on mobile. Use HTML labels with `writing-mode: vertical-rl` outside the SVG instead.
- **`__pycache__`:** Stale `.pyc` files can cause the backend to load old code. Delete `backend/__pycache__/` if auto-reload behaves oddly.
- **Trailing hose in ALFAM2:** The value `"th"` is the reference category. When it's the only `app.mthd` value (non-variable case), pass it directly — don't convert to empty string.
- **app.time variable in detail chart:** Each variant starts at a different real clock time. Weather lookup must use per-variant offsets from the earliest application hour.
- **flyctl vs fly:** In GitHub Actions, use `flyctl` (the installed binary name), not `fly`. Locally either works.
