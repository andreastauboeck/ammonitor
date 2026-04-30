# 🌱 ammonitor

**Ammonia emission prediction & monitoring** — a decision-support tool for agriculture.

Select a field on the map, choose your manure application parameters, and instantly see how different strategies affect NH₃ loss over the next 7 days.

Powered by the [ALFAM2](https://projects.au.dk/alfam) emission model (Hafner et al.) driven by real-time weather forecasts from [Open-Meteo](https://open-meteo.com/).

> ALFAM2 is a semi-empirical model for predicting ammonia volatilization from field-applied manure, developed from over 2,000 measurements across Europe. Many thanks to the ALFAM2 team for making their R package openly available.

## 🧪 What it does

- **Compare** up to 5 variants of any parameter (application technique, time, dry matter, pH, incorporation depth/time, manure source)
- **Visualize** 7-day emission forecasts with hourly detail and aligned weather data
- **Share** predictions via URL — all parameters are serialized to the address bar
- **Compute** absolute losses (kg/ha) from your own TAN applied value

## 🛠️ Stack

`FastAPI` · `React` · `TypeScript` · `Tailwind` · `Recharts` · `Leaflet` · `R/ALFAM2` · `Docker` · `Fly.io`

## 🚀 Quick start

**Prerequisites:** Python 3.12+, Node.js 20+, R + ALFAM2 package

```bash
# Backend
cd backend && pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

Open <http://localhost:5173> — Vite proxies `/api/*` to the backend automatically.

## 🐳 Docker

```bash
docker build -t ammonitor .
docker run --rm -p 8000:8000 ammonitor
```

Open <http://localhost:8000> — single container serves both UI and API.

## 📦 Deployment

Push to `main` triggers the CI/CD pipeline (GitHub Actions → GHCR → Fly.io).  
Bump the version by editing the `VERSION` file at the repo root.

## 🙏 Credits

- [ALFAM2](https://projects.au.dk/alfam) — semi-empirical NH₃ emission model (Hafner et al.)
- [Open-Meteo](https://open-meteo.com/) — free weather forecast API (CC BY 4.0)
- [Nominatim](https://nominatim.openstreetmap.org/) / [OpenStreetMap](https://www.openstreetmap.org/) — geocoding & map data (ODbL)

## 📄 License

AGPL-3.0
