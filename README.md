# ammonitor

Ammonia emission prediction and monitoring service as a decision support tool for agriculture.

## Stack

- **Backend**: FastAPI (Python 3.12), served with Uvicorn
- **Frontend**: React + TypeScript + Tailwind CSS, bundled with Vite
- **Container**: Single Docker image serving both via FastAPI in production

## Project layout

```
ammonitor/
├── backend/            # FastAPI app
│   ├── main.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/           # React + TS + Tailwind (Vite)
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── .idea/runConfigurations/   # PyCharm run configs (shared)
├── Dockerfile          # Multi-stage, single container (frontend + backend)
└── .dockerignore
```

## Development

### Prerequisites

- Python 3.12
- Node.js 20
- PyCharm (optional, but run configs are provided)

### First-time setup

Backend:

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate
pip install -r requirements.txt
```

Frontend:

```bash
cd frontend
npm install
```

### Running from PyCharm

Three run configurations are included in `.idea/runConfigurations/` and are
tracked in git:

- **Backend** – runs `uvicorn main:app --reload` on port `8000`
- **Frontend** – runs `npm run dev` (Vite) on port `5173`
- **Full Stack** – compound config that launches both at once

Open the project in PyCharm, pick **Full Stack**, press Run. Then browse to
<http://localhost:5173>.

> The Python interpreter for the `Backend` configuration must be set to your
> project venv (`backend/.venv`) the first time.

### Running manually

Two terminals:

```bash
# Terminal 1 – backend
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

```bash
# Terminal 2 – frontend
cd frontend
npm run dev
```

Open <http://localhost:5173>.

### Hot reload

- **Backend**: `uvicorn --reload` restarts on any `.py` change.
- **Frontend**: Vite HMR updates modules in the browser without a full reload
  and preserves component state.
- **API calls**: The Vite dev server proxies `/api/*` to `http://localhost:8000`,
  so the frontend can call `fetch('/api/status')` with no CORS setup.

## API

| Method | Path          | Description                       |
|--------|---------------|-----------------------------------|
| GET    | `/api/status` | Returns status, version, environment |

Example response:

```json
{ "status": "ok", "version": "0.1.0", "environment": "dev" }
```

Configurable via environment variables:

- `VERSION` (default `0.1.0`)
- `ENVIRONMENT` (default `dev`; use `alpha`, `beta`, `production`, etc.)

## Docker (production)

The `Dockerfile` is multi-stage: Node builds the frontend, then the output is
copied into a Python image where FastAPI serves both the API and the static
frontend.

Build:

```bash
docker build -t ammonitor .
```

Run:

```bash
docker run --rm -p 8000:8000 \
  -e ENVIRONMENT=production \
  -e VERSION=0.1.0 \
  ammonitor
```

Open <http://localhost:8000> — the single container serves both UI and API.
