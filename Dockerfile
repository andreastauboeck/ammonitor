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
    r-base \
    r-base-dev \
    r-recommended \
    libblas3 \
    liblapack3 \
    && rm -rf /var/lib/apt/lists/*

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
# Stage 3: Runtime (final stage) - use same debian base for R compatibility
# -----------------------------------------------------------------------------
FROM debian:bookworm-slim AS runtime

ARG VERSION=0.2.0

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ENVIRONMENT=production \
    VERSION=${VERSION}

WORKDIR /app

# Install Python + copy complete R from r-base
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    libblas3 \
    liblapack3 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=r-base /usr /usr
COPY --from=r-base /etc /etc

# Install Python dependencies.
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir --break-system-packages -r requirements.txt

# Copy backend source.
COPY backend/ ./

# Copy the built frontend into the location main.py expects.
COPY --from=frontend-build /app/dist ./frontend/dist

EXPOSE 8000

CMD ["python3", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]