# syntax=docker/dockerfile:1.7

# -----------------------------------------------------------------------------
# Stage 1: R runtime + ALFAM2 package (changes rarely - good caching)
# -----------------------------------------------------------------------------
FROM debian:bookworm-slim AS r-base

RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    ca-certificates \
    gnupg \
    software-properties-common \
    && rm -rf /var/lib/apt/lists/*

RUN wget -qO- https://cloud.r-project.org/bin/linux/ubuntu/marutter_pubkey.asc | apt-key add - \
    && add-apt-repository "deb https://cloud.r-project.org/bin/linux/ubuntu bookworm-cran40/" \
    && apt-get update

RUN apt-get install -y --no-install-recommends r-base r-base-dev && rm -rf /var/lib/apt/lists/*

RUN R -e "install.packages('ALFAM2', repos='https://cloud.r-project.org/')"

# -----------------------------------------------------------------------------
# Stage 2: Build React frontend (changes often)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS frontend-build

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 3: Runtime (final stage)
# -----------------------------------------------------------------------------
FROM python:3.12-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ENVIRONMENT=production \
    VERSION=0.1.0

WORKDIR /app

# Copy R installation from r-base stage (cached, rarely changes)
COPY --from=r-base /usr /usr

# Install Python dependencies.
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source.
COPY backend/ ./

# Copy the built frontend into the location main.py expects.
COPY --from=frontend-build /app/dist ./frontend/dist

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]