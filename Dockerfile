FROM python:3.11-slim

ENV DEBIAN_FRONTEND=noninteractive

# ---- System dependencies ----
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        ffmpeg \
        libgl1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY backend /app/backend
WORKDIR /app/backend

# ---- Python dependencies ----
RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# ---- Non-root user ----
RUN useradd -m appuser && chown -R appuser /app
USER appuser

# ---- Runtime ----
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
