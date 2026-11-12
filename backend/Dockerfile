# Built from the repository root (the backend reads shared/buildings.json):
#   docker build -f backend/Dockerfile .
# Stage 1: install runtime dependencies into a virtualenv
FROM python:3.14-slim AS build

ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
RUN python -m venv /venv
COPY backend/requirements.txt /tmp/requirements.txt
# pip is only needed to install; keep the bytecode pip compiles (faster startup)
RUN /venv/bin/pip install -r /tmp/requirements.txt \
    && /venv/bin/pip uninstall -y pip

# Stage 2: runtime image with only the interpreter, the virtualenv and the app
FROM python:3.14-slim

ENV PATH=/venv/bin:$PATH \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Non-root user (999:999), and the database folder mounted as a volume.
# Compose can run the container as another user instead (PUID/PGID, see docs/deploy-nas.md).
RUN groupadd -r -g 999 appgroup && useradd -r -u 999 -g appgroup appuser && \
    mkdir -p /srv/backend/data && chown appuser:appgroup /srv/backend/data

COPY --from=build /venv /venv
COPY shared /srv/shared
COPY backend/app /srv/backend/app
# Precompile the app as well, since the runtime user doesn't write bytecode
RUN python -m compileall -q /srv/backend/app

WORKDIR /srv/backend
USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
