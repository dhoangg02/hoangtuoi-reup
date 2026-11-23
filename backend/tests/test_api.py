from __future__ import annotations

import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import configure
from app.core.database import init_db
from app.main import create_app


@pytest.fixture()
def client(tmp_path: Path):
    cfg = configure(data_dir=tmp_path / "data")
    init_db(cfg.db_path)
    app = create_app()
    with TestClient(app) as tc:
        yield tc


def test_health_and_startup(client: TestClient):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    body = res.json()
    assert body["runtime_mode"] == "LOCAL_STANDALONE"
    assert body["backend"] == "open-source-clean-room"
    assert body["paths"]["data_dir"]["writable"] is True

    startup = client.get("/api/v1/startup/status")
    assert startup.status_code == 200
    assert startup.json()["ready"] is True


def test_jobs_crud_pipeline_and_studio(client: TestClient):
    # Create
    res = client.post("/api/v1/jobs", json={"title": "Demo Video", "url": "https://example.com/v.mp4"})
    assert res.status_code == 201
    job = res.json()
    job_id = job["id"]
    assert job["status"] == "queued"

    # List & Get
    assert len(client.get("/api/v1/jobs").json()) == 1
    assert client.get(f"/api/v1/jobs/{job_id}").json()["title"] == "Demo Video"

    # Patch
    patched = client.patch(f"/api/v1/jobs/{job_id}", json={"title": "Renamed Video"}).json()
    assert patched["title"] == "Renamed Video"

    # Studio
    assert client.put(f"/api/v1/jobs/{job_id}/studio", json={"tracks": [1, 2]}).status_code == 200
    assert client.get(f"/api/v1/jobs/{job_id}/studio").json() == {"tracks": [1, 2]}

    # Start & let pipeline finish
    start_res = client.post(f"/api/v1/jobs/{job_id}/start")
    assert start_res.status_code == 200
    time.sleep(0.35)
    done = client.get(f"/api/v1/jobs/{job_id}").json()
    assert done["status"] == "completed"
    assert done["progress"] == 100

    # Delete
    assert client.delete(f"/api/v1/jobs/{job_id}").status_code == 200
    assert client.get(f"/api/v1/jobs/{job_id}").status_code == 404


def test_channels_series_watermarks_settings(client: TestClient):
    ch = client.post("/api/v1/channels", json={"name": "Local Ch", "url": "https://example.com"}).json()
    assert len(client.get("/api/v1/channels").json()) == 1
    assert client.delete(f"/api/v1/channels/{ch['id']}").status_code == 200

    ser = client.post("/api/v1/series", json={"name": "Series 1", "description": "Desc"}).json()
    assert len(client.get("/api/v1/series").json()) == 1
    assert client.delete(f"/api/v1/series/{ser['id']}").status_code == 200

    wm = client.post("/api/v1/watermarks", json={"name": "Logo", "config": {"opacity": 0.8}}).json()
    assert len(client.get("/api/v1/watermarks").json()) == 1
    upd = client.put(f"/api/v1/watermarks/{wm['id']}", json={"name": "Logo 2", "config": {"opacity": 0.5}}).json()
    assert upd["name"] == "Logo 2"
    assert client.delete(f"/api/v1/watermarks/{wm['id']}").status_code == 200

    assert client.put("/api/v1/settings", json={"language": "vi", "threads": 4}).status_code == 200
    assert client.get("/api/v1/settings").json() == {"language": "vi", "threads": 4}


def test_websocket_connection(client: TestClient):
    with client.websocket_connect("/api/v1/ws") as ws:
        hello = ws.receive_json()
        assert hello["type"] == "connected"
        assert hello["runtime_mode"] == "LOCAL_STANDALONE"
        ws.send_text("ping")
        assert ws.receive_json() == {"type": "pong"}
