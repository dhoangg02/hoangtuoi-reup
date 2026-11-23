from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from app.core.database import get_conn


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_job(row: Any) -> dict[str, Any]:
    return {
        "id": row["id"],
        "title": row["title"],
        "url": row["url"],
        "status": row["status"],
        "stage": row["stage"],
        "progress": row["progress"],
        "options": json.loads(row["options_json"] or "{}"),
        "output_path": row["output_path"],
        "error_message": row["error_message"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


class JobRepository:
    def list(self) -> list[dict[str, Any]]:
        with get_conn() as conn:
            rows = conn.execute("SELECT * FROM jobs ORDER BY created_at DESC").fetchall()
            return [_row_to_job(r) for r in rows]

    def get(self, job_id: str) -> dict[str, Any] | None:
        with get_conn() as conn:
            row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
            return _row_to_job(row) if row else None

    def create(self, title: str, url: str, options: dict[str, Any]) -> dict[str, Any]:
        job_id = f"job-{uuid.uuid4().hex[:10]}"
        now = utc_now()
        with get_conn() as conn:
            conn.execute(
                """
                INSERT INTO jobs (id, title, url, status, stage, progress, options_json, created_at, updated_at)
                VALUES (?, ?, ?, 'queued', 'init', 0, ?, ?, ?)
                """,
                (job_id, title or url or job_id, url, json.dumps(options), now, now),
            )
            conn.execute(
                """
                INSERT INTO job_history (job_id, status, stage, progress, message, created_at)
                VALUES (?, 'queued', 'init', 0, 'Job created', ?)
                """,
                (job_id, now),
            )
        return self.get(job_id)  # type: ignore[return-value]

    def update(self, job_id: str, **fields: Any) -> dict[str, Any] | None:
        current = self.get(job_id)
        if not current:
            return None
        now = utc_now()
        title = fields.get("title", current["title"])
        url = fields.get("url", current["url"])
        status = fields.get("status", current["status"])
        stage = fields.get("stage", current["stage"])
        progress = fields.get("progress", current["progress"])
        options = fields.get("options", current["options"])
        output_path = fields.get("output_path", current["output_path"])
        error_message = fields.get("error_message", current["error_message"])
        with get_conn() as conn:
            conn.execute(
                """
                UPDATE jobs
                SET title = ?, url = ?, status = ?, stage = ?, progress = ?,
                    options_json = ?, output_path = ?, error_message = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    title,
                    url,
                    status,
                    stage,
                    progress,
                    json.dumps(options),
                    output_path,
                    error_message,
                    now,
                    job_id,
                ),
            )
            if "status" in fields or "stage" in fields or "progress" in fields:
                conn.execute(
                    """
                    INSERT INTO job_history (job_id, status, stage, progress, message, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (job_id, status, stage, progress, fields.get("message", ""), now),
                )
        return self.get(job_id)

    def delete(self, job_id: str) -> bool:
        with get_conn() as conn:
            cur = conn.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
            return cur.rowcount > 0

    def get_studio(self, job_id: str) -> dict[str, Any] | None:
        with get_conn() as conn:
            row = conn.execute("SELECT studio_json FROM jobs WHERE id = ?", (job_id,)).fetchone()
            if not row:
                return None
            return json.loads(row["studio_json"] or "{}")

    def put_studio(self, job_id: str, studio: dict[str, Any]) -> dict[str, Any] | None:
        with get_conn() as conn:
            cur = conn.execute(
                "UPDATE jobs SET studio_json = ?, updated_at = ? WHERE id = ?",
                (json.dumps(studio), utc_now(), job_id),
            )
            if cur.rowcount == 0:
                return None
        return studio


class ChannelRepository:
    def list(self) -> list[dict[str, Any]]:
        with get_conn() as conn:
            rows = conn.execute("SELECT * FROM channels ORDER BY created_at DESC").fetchall()
            return [dict(r) for r in rows]

    def create(self, name: str, url: str, platform: str) -> dict[str, Any]:
        cid = f"ch-{uuid.uuid4().hex[:8]}"
        now = utc_now()
        with get_conn() as conn:
            conn.execute(
                "INSERT INTO channels (id, name, url, platform, created_at) VALUES (?, ?, ?, ?, ?)",
                (cid, name, url, platform, now),
            )
        return {"id": cid, "name": name, "url": url, "platform": platform, "created_at": now}

    def delete(self, cid: str) -> bool:
        with get_conn() as conn:
            return conn.execute("DELETE FROM channels WHERE id = ?", (cid,)).rowcount > 0


class SeriesRepository:
    def list(self) -> list[dict[str, Any]]:
        with get_conn() as conn:
            rows = conn.execute("SELECT * FROM series ORDER BY created_at DESC").fetchall()
            return [
                {
                    "id": r["id"],
                    "name": r["name"],
                    "description": r["description"],
                    "episodes": json.loads(r["episodes_json"] or "[]"),
                    "created_at": r["created_at"],
                }
                for r in rows
            ]

    def create(self, name: str, description: str) -> dict[str, Any]:
        sid = f"ser-{uuid.uuid4().hex[:8]}"
        now = utc_now()
        with get_conn() as conn:
            conn.execute(
                "INSERT INTO series (id, name, description, episodes_json, created_at) VALUES (?, ?, ?, '[]', ?)",
                (sid, name, description, now),
            )
        return {"id": sid, "name": name, "description": description, "episodes": [], "created_at": now}

    def delete(self, sid: str) -> bool:
        with get_conn() as conn:
            return conn.execute("DELETE FROM series WHERE id = ?", (sid,)).rowcount > 0


class WatermarkRepository:
    def list(self) -> list[dict[str, Any]]:
        with get_conn() as conn:
            rows = conn.execute("SELECT * FROM watermarks ORDER BY created_at DESC").fetchall()
            return [
                {
                    "id": r["id"],
                    "name": r["name"],
                    "config": json.loads(r["config_json"] or "{}"),
                    "created_at": r["created_at"],
                }
                for r in rows
            ]

    def create(self, name: str, config: dict[str, Any]) -> dict[str, Any]:
        wid = f"wm-{uuid.uuid4().hex[:8]}"
        now = utc_now()
        with get_conn() as conn:
            conn.execute(
                "INSERT INTO watermarks (id, name, config_json, created_at) VALUES (?, ?, ?, ?)",
                (wid, name, json.dumps(config), now),
            )
        return {"id": wid, "name": name, "config": config, "created_at": now}

    def update(self, wid: str, name: str, config: dict[str, Any]) -> dict[str, Any] | None:
        with get_conn() as conn:
            cur = conn.execute(
                "UPDATE watermarks SET name = ?, config_json = ? WHERE id = ?",
                (name, json.dumps(config), wid),
            )
            if cur.rowcount == 0:
                return None
            row = conn.execute("SELECT * FROM watermarks WHERE id = ?", (wid,)).fetchone()
            return {
                "id": row["id"],
                "name": row["name"],
                "config": json.loads(row["config_json"] or "{}"),
                "created_at": row["created_at"],
            }

    def delete(self, wid: str) -> bool:
        with get_conn() as conn:
            return conn.execute("DELETE FROM watermarks WHERE id = ?", (wid,)).rowcount > 0


class SettingsRepository:
    def get_all(self) -> dict[str, Any]:
        with get_conn() as conn:
            rows = conn.execute("SELECT key, value_json FROM settings").fetchall()
            return {r["key"]: json.loads(r["value_json"]) for r in rows}

    def put_all(self, data: dict[str, Any]) -> dict[str, Any]:
        now = utc_now()
        with get_conn() as conn:
            for k, v in data.items():
                conn.execute(
                    """
                    INSERT INTO settings (key, value_json, updated_at)
                    VALUES (?, ?, ?)
                    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
                    """,
                    (k, json.dumps(v), now),
                )
        return self.get_all()
