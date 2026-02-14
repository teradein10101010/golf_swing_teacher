# Project Structure

```text
.
├── apps
│   ├── backend
│   │   ├── app
│   │   ├── Dockerfile
│   │   ├── main.py
│   │   └── requirements.txt
│   └── frontend
│       ├── src
│       ├── Dockerfile
│       ├── package.json
│       └── vite.config.js
├── scripts
│   └── rebuild-containers.sh
├── docker-compose.yml
└── .pre-commit-config.yaml
```

- Backend code is under `apps/backend`.
- Frontend code is under `apps/frontend`.
- Utility scripts are under `scripts`.
