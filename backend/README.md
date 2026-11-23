# HoangTuoi Reup Backend

Open-source Python 3.11 + FastAPI + Uvicorn + SQLite backend for **HoangTuoi Reup**.

- Persists local workspace data in SQLite (`<data-dir>/hoangtuoi-reup.db`).
- Exposes `/api/v1/*` REST APIs and `/api/v1/ws` WebSocket progress events.

## Run in Development

```powershell
pip install -r requirements.txt
python -m app.main --host 127.0.0.1 --port 63405 --data-dir ../data
```

## Run Tests

```powershell
pytest -v
```

## Build Standalone Executable

```powershell
pip install pyinstaller
python build_backend.py
```
