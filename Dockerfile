# Dockerfile for running swing_analyzer.py
FROM python:3.11-slim

# noninteractive
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        ffmpeg \
        libgl1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ---- Python dependencies ----
# Copy requirements first (for Docker layer cache)
COPY requirements.txt /app/requirements.txt

RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# ---- Application code ----
COPY swing_analyzer.py /app/swing_analyzer.py
COPY app.py /app/app.py
COPY pages /app/pages

# Create non-root user
RUN useradd -m appuser && chown -R appuser /app
USER appuser

# Volume for input/output data
VOLUME ["/data"]

EXPOSE 8501

CMD ["streamlit", "run", "app.py", "--server.address=0.0.0.0", "--server.port=8501"]
