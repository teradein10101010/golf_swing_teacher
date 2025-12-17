docker build -t swing-analyzer:latest -f Dockerfile .
docker run  -p 8501:8501 --rm -v "$(pwd)/data:/data" swing-analyzer:latest