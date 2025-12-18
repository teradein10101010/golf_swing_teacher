# Dockerfile for running swing_analyzer.py
# Base image
FROM python:3.11-slim

# noninteractive
ENV DEBIAN_FRONTEND=noninteractive

# Install system deps (ffmpeg for OpenCV video support, common libs)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        ffmpeg \
        libgl1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python packages
# Use headless OpenCV inside container; install mediapipe and other deps
RUN pip install --no-cache-dir \
    numpy \
    pandas \
    matplotlib \
    opencv-python-headless \
    mediapipe \
    streamlit

# Copy application code
COPY swing_analyzer.py /app/swing_analyzer.py
COPY app.py /app/app.py
COPY pages /app/pages
# (optional) If you have a Streamlit wrapper, copy it as well
# COPY streamlit_app.py /app/streamlit_app.py

# Create a non-root user to run the app
RUN useradd -m appuser && chown -R appuser /app
USER appuser

# Mount point for input/output (host folder with video and where CSV will be written)
VOLUME ["/data"]

EXPOSE 8501
# Default command: expects /data/swing.mp4 to exist on the host mount
# Run both swing analyzer and metrics overlay tool
CMD ["streamlit", "run", "app.py", "--server.address=0.0.0.0", "--server.port=8501"]
