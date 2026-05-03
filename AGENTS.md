# AGENTS.md — ammonitor Project Reference

## Project Overview

Ammonia (NH3) emission prediction and monitoring decision-support tool for agriculture. Uses the ALFAM2 model (R package) driven by weather forecasts (Open-Meteo) to predict NH3 loss from manure application across 8 days, comparing variants of application parameters.

**Version:** See `VERSION` file at repo root (currently `0.3.0`)

**Tech stack:** Python 3 / FastAPI / R (ALFAM2) / React 18 / TypeScript / Tailwind CSS / Recharts / Leaflet / i18next / Docker / Fly.io

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
  1. Validates input (e.g. incorp_depth="none" + variable="incorp_time" → 422)
     also validates `values` against canonical VARIANT_VALUES[variable]
  2. fetch_weather(lat, lng, timezone) → Open-Meteo (cached 10 min)
  3. Computes 8 daily start datetimes
  4. Calls run_alfam2(...)

run_alfam2.py:
  1. Builds input CSV: 8 days × N values × 168 hours per row
  2. Calls Rscript run_alfam2.R <input.csv> <output.csv>
  3. run_alfam2.R calls ALFAM2::alfam2()
  4. Parses output CSV into {days: [{day, start, variants: [{value, final_loss_pct, hourly}]}]}

Backend returns:
  { variable, values, days, weather }

Frontend renders:
  - No day selected → OverviewChart (grouped bars: final_loss_pct per value per day + daily weather chart with min/max bands)
  - Day selected → DetailChart (lines: hourly er over 168h, + hourly weather sub-chart)
```

---

## Key Files

| File | Purpose | Key Exports/Functions |
|------|---------|----------------------|
| `VERSION` | Single-line version string | Read by CI pipeline for Docker image tagging |
| `backend/main.py` | FastAPI app: API routes + SPA serving | `app`, `CalculateInput`, `VARIANT_VALUES` |
| `backend/run_alfam2.py` | ALFAM2 R model runner | `run_alfam2()`, `_build_input_rows()`, `_parse_output()` |
| `backend/run_alfam2.R` | R-side ALFAM2 invocation | Called via `Rscript` |
| `backend/weather.py` | Open-Meteo forecast fetcher | `fetch_weather()` |
| `backend/requirements.txt` | Python dependencies | `fastapi`, `uvicorn` |
| `frontend/src/main.tsx` | React app bootstrap + routes + i18n init | Routes: `/`, `/calculate/:lat/:lng`, `/calculate/:lat/:lng/:day` |
| `frontend/src/i18n/index.ts` | i18next initialization | Detection: localStorage → navigator → en |
| `frontend/src/i18n/locales/{en,de}.json` | Translation maps | Nested keys: `variables.*`, `variants.*`, `categories.*`, etc. |
| `frontend/src/components/LanguageSwitcher.tsx` | EN/DE toggle | `i18n.changeLanguage()` |
| `frontend/src/pages/types.ts` | Shared types, constants, utilities | `VARIANT_DEFS`, `DEFAULT_FORM_DATA`, `VARIANT_COLORS`, `ApiResponse`, `FormData` |
| `frontend/src/pages/Home.tsx` | Leaflet map location selector | Search + click → navigate to calculation |
| `frontend/src/pages/Calculation.tsx` | Parameter form + chart orchestration | Form state, API calls, URL param sync |
| `frontend/src/pages/OverviewChart.tsx` | 8-day grouped bar chart + weather sub-chart | Click bar → detail view; weather min/max area bands |
| `frontend/src/pages/DetailChart.tsx` | Hourly line chart + weather | Log-scale x-axis, app_time offset, incorp markers |
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
  "variable": "app_mthd",
  "values": ["bc", "th", "ts", "os", "cs"],
  "app_mthd": "th",
  "app_time": 12,
  "man_dm": 6.0,
  "man_ph": 7.5,
  "man_source": "cattle",
  "incorp_depth": "none",
  "incorp_time": 4,
  "timezone": "Europe/Vienna"
}
```

- `variable`: which parameter to vary. One of: `app_mthd`, `app_time`, `man_dm`, `man_ph`, `man_source`, `incorp_depth`, `incorp_time`
- `values`: list of variant values. Must be a subset of the canonical set defined per variable in `VARIANT_VALUES` (backend). Display labels are NOT part of the API — translate `values` client-side.
- `app_time`: integer hour 0–23 (no fractional hours; matches model's hourly weather granularity)
- `man_source`: `"cattle"` or `"pig"` (Literal-validated)
- `incorp_depth`: `"none"`, `"shallow"`, or `"deep"` (Literal-validated)
- `app_mthd` (when not the variable): `"bc"`, `"th"`, `"ts"`, `"os"`, `"cs"` (Literal-validated)

**Response:**
```json
{
  "variable": "app_mthd",
  "values": ["bc", "th", "ts", "os", "cs"],
  "days": [
    {
      "day": 0,
      "start": "2026-04-28T12:00",
      "variants": [
        {"value": "bc", "final_loss_pct": 53.66, "hourly": [{"hour": 1, "er": 0.12}, ...]},
        {"value": "th", "final_loss_pct": 32.69, "hourly": [...]},
        ...
      ]
    }
  ],
  "weather": [{"time_iso": "2026-04-28T12:00", "air_temp": 12.3, "wind_speed": 3.1, "rain_rate": 0.0}, ...]
}
```

- `days[].variants` is an **ordered array** (matches the request `values` order). Each item has a stable `value` ID, the final percent loss, and the 168-hour `hourly` curve.
- All variant identifiers are stable (no display strings). Frontend translates them via i18n.

### `GET /api/status`

Returns `{"status": "ok", "version": "0.3.0", "environment": "production"}`

---

## Frontend Conventions

- **VARIANT_DEFS** in `types.ts` lists allowed variant values per variable. The backend has the canonical set in `VARIANT_VALUES` (Python). Both must stay in sync.
- **i18n via i18next:** Display labels are looked up via `t(\`variants.${variable}.${value}\`)`. The API uses stable IDs (`bc`, `cattle`, `none`, etc.) — never display strings.
- **Detection order:** localStorage → navigator → English fallback. User choice persisted in `localStorage["ammonitor-lang"]`.
- **Color scheme:** 6 fixed colors `[#ef4444, #3b82f6, #8b5cf6, #10b981, #f59e0b, #ec4899]` indexed by variant position.
- **URL params:** All form state is serialized to URL search params for shareable URLs. Form deserialization reads them back on page load.
- **Variable selector:** Radio button column — one variable at a time. The selected variable's dropdown is disabled since it will be varied.
- **Incorp depth = "none":** Sets incorp_time = 0. Switching depth to "none" while variable is `incorp_time` or `incorp_depth` auto-falls back to `app_mthd`.
- **TAN applied:** Dropdown preset, never a variable. `er` is independent of TAN; kg/ha is computed frontend-side as `er × tanApp / 100`.
- **app_time detail chart:** When `app_time` is the variable, emission lines start at their actual clock time. X-axis uses hybrid labels (clock + elapsed hours). Weather aligns naturally via real-time lookup. Later-starting variants get a 0% emission start point.
- **Incorp markers:** When `incorp_time` is the variable, each variant gets a dashed reference line at its incorp hour in the matching variant color. When fixed, a single yellow marker appears.
- **LanguageSwitcher** lives in `components/`, used in Home, Calculation, Imprint, Privacy, Terms.
- **Navigation model (Option B):** No auto-redirect from `/`. `/` always shows the landing page. Recent locations are shown in a dropdown (from localStorage `ammonitor-locations`), most recent highlighted. User clicks a saved location → marker placed on map → clicks "Start Calculation" → navigates to `/calculate/{lat}/{lng}`. "Back to map" from Calculation is a simple `Link to="/"` with no side effects.
- **Theme (light/dark):** Tailwind `darkMode: 'class'`. `ThemeProvider` in `src/theme/ThemeContext.tsx` manages mode (`light` | `dark` | `system`), persists to `localStorage["ammonitor-theme"]`, defaults to `system` (follows `prefers-color-scheme`). FOUC-prevention inline script in `index.html` applies `dark` class on `<html>` and updates `<meta name="theme-color">` before React mounts. Recharts colors come from `src/theme/chartColors.ts` (`getChartColors(resolved)`) — passed as props into custom tooltips since Recharts doesn't read CSS classes for `stroke`/`fill`.
- **Settings menu:** `SettingsMenu` (`src/components/SettingsMenu.tsx`) is a cog button + popover that contains `ThemeSwitcher` + `LanguageSwitcher` stacked. Used in Home top bar, Calculation sticky bar, and all legal pages. Click-outside / Escape closes.
- **Site icon:** `SiteIcon` (`src/components/SiteIcon.tsx`) renders a small rounded amber tile with `/logo.png` inside — used in the Calculation sticky bar so the logo always identifies the app at a glance.
- **Map gestures:** `leaflet-gesture-handling` plugin requires Ctrl + scroll (or ⌘ + scroll on macOS) to zoom on desktop, and two-finger pan on mobile. Prevents the map from hijacking page scroll/swipe. Registered globally via `L.Map.addInitHook('addHandler', 'gestureHandling', GestureHandling)` in `Home.tsx`. Hint strings come from i18n (`map.gesture_*`).---

## Backend Conventions

- **ALFAM2 input CSV columns:** `day_variant, ct, TAN.app, man.dm, man.ph, man.source, app.mthd, incorp, t.incorp, app.rate, air.temp, wind.sqrt, rain.rate`
- **ALFAM2 output CSV columns:** `day_variant, ct, e, er, j, jinst`
- **Fixed model parameters:** `TAN.app = 60.0`, `app.rate = 30.0` — hardcoded in `_build_input_rows()`, not configurable from the frontend.
- **Incorp depth "none":** Means empty `incorp` and `t.incorp` columns in the CSV (NA in R).
- **wind.sqrt:** Precomputed in Python before sending to R.
- **Day/variant IDs (CSV column):** Pattern `d{day_idx}_v{var_idx}` (e.g. `d0_v0`, `d2_v4`). The CSV column is named `day_variant`, used by the R script as the grouping column.
- **Weather caching:** In-memory cache with 10-min TTL, coordinate keys rounded to 2 decimal places (~1.1 km).
- **Variant value parsing:** `_parse_app_hour()` handles `"06:00"` → 6, `_parse_float()` ensures numeric types from JSON.
- **Error strategy:** 422 for validation errors, 502 for weather fetch failures, 500 for R script failures.

---

## PWA (manifest-only)

ammonitor is installable to home screen on iOS/Android via a Web App Manifest. **No service worker** — no offline support; app needs network to function.

- **Manifest**: `frontend/public/manifest.webmanifest` — name, icons, theme/background colors (`#0f172a` slate-900), `display: standalone`, `start_url: /`.
- **Icons**: `frontend/public/icons/icon-{192,512}.png` (full-bleed) + `icon-maskable-512.png` (logo at 70% in safe zone for Android adaptive crop).
- **Generated by**: `scripts/gen-icons.py` (uses Pillow). Run from repo root: `.venv\Scripts\python.exe scripts\gen-icons.py`. Re-run if `frontend/public/logo.png` changes. The script also produces `frontend/public/og-banner.png` (1200×630 social-share preview, see "Social sharing" below).
- **`frontend/index.html`** declares: `<link rel="manifest">`, `<meta name="theme-color">`, Apple-specific tags (`apple-mobile-web-app-*`, `apple-touch-icon`) for iOS Safari standalone mode.
- **Backend serving**: existing SPA fallback in `backend/main.py` (line ~264) serves files from `_FRONTEND_DIST` first, so `/manifest.webmanifest` and `/icons/*` are served correctly without changes.
- **Install UX**: rely on native browser UI (Chrome/Edge address-bar install button, iOS Safari "Add to Home Screen"). No custom install prompt.
- **Updates**: standard browser cache rules; no service-worker update flow to manage.

---

## Social sharing & Open Graph

- **Share button** lives in the Calculation sticky bar (`frontend/src/components/ShareButton.tsx`). Uses `navigator.share` with clipboard fallback + brief toast (`share.copied`). Shareable text uses `share.text_with_subject` → "Ammonia emission forecast for {Vienna — Apr 28}". URL is the source of truth (path + query) — no separate share-id needed.
- **Open Graph + Twitter Card meta tags** in `frontend/index.html` use absolute URLs to `https://ammonitor.online/og-banner.png`. Same preview for every shared URL (SPA limitation — crawlers don't run JS reliably).
- **OG banner** `frontend/public/og-banner.png` (1200×630): amber-50 background, logo + "ammonitor" + tagline left, slate-900 chart-preview card with VARIANT_COLORS bars right. Generated by `scripts/gen-icons.py` using bundled `scripts/fonts/Inter-{Bold,Regular}.ttf` (OFL, ~820 KB).
- **Cache invalidation reminder**: messengers cache OG previews. After changing tags or banner, re-scrape via Facebook's [Sharing Debugger](https://developers.facebook.com/tools/debug/) for WhatsApp/Facebook, [Twitter Card Validator](https://cards-dev.twitter.com/validator). Telegram/Discord/Slack usually self-refresh.

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
- **Tailwind config changes need Vite restart.** HMR doesn't reload the PostCSS plugin config. After editing `tailwind.config.js` (e.g. adding `darkMode: 'class'`), stop and restart `npm run dev` or you'll see stale CSS — the new utility classes (e.g. `dark:bg-*`) will be served but won't activate as expected.
