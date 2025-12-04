docker build -t swing-analyzer:latest -f Dockerfile .
docker run --rm -v "$(pwd)/data:/data" swing-analyzer:latest