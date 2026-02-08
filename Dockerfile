# Stage 1: Install Python dependencies
FROM python:3.13-slim AS builder

WORKDIR /build

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends gcc python3-dev; \
    rm -rf /var/lib/apt/lists/*

COPY pyproject.toml requirements.txt ./
COPY src/ ./src/

RUN set -eux; \
    pip install --no-cache-dir --upgrade pip; \
    pip install --no-cache-dir --timeout 1000 -r requirements.txt; \
    pip install --no-cache-dir .

# Stage 2: Runtime image
FROM python:3.13-slim

ARG UID=1000
ARG GID=1000

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends git curl; \
    apt-get clean; \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN set -eux; \
    groupadd -g "$GID" appuser; \
    useradd -m -u "$UID" -g "$GID" appuser

COPY --from=builder --chown=$UID:$GID /usr/local/lib/python3.13/site-packages/ /usr/local/lib/python3.13/site-packages/
COPY --chown=$UID:$GID src/ ./src/
COPY --chown=$UID:$GID static/ ./static/

RUN set -eux; \
    chown -R appuser:appuser /app; \
    mkdir -p /tmp/gitunderstand; \
    chown appuser:appuser /tmp/gitunderstand

USER appuser

EXPOSE 8080

CMD ["python", "-m", "api"]
