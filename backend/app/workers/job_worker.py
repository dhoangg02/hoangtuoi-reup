from __future__ import annotations

import asyncio
from typing import Any
from fastapi import WebSocket

from app.repositories.store import JobRepository


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.add(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self._connections.discard(ws)

    async def broadcast(self, event: dict[str, Any]) -> None:
        dead: list[WebSocket] = []
        for ws in list(self._connections):
            try:
                await ws.send_json(event)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._connections.discard(ws)


ws_manager = ConnectionManager()


class JobWorker:
    """Async local job queue & worker that runs pipeline stages and broadcasts progress."""

    def __init__(self) -> None:
        self._repo = JobRepository()
        self._tasks: dict[str, asyncio.Task[None]] = {}
        self._cancelled: set[str] = set()

    async def enqueue(self, job_id: str) -> dict[str, Any] | None:
        job = self._repo.get(job_id)
        if not job:
            return None
        self._cancelled.discard(job_id)
        updated = self._repo.update(
            job_id,
            status="queued",
            stage="queued",
            progress=0,
            error_message="",
            message="Queued for execution",
        )
        await ws_manager.broadcast({"type": "job.updated", "job": updated})

        if job_id not in self._tasks or self._tasks[job_id].done():
            self._tasks[job_id] = asyncio.create_task(self._run_pipeline(job_id))
        return updated

    async def cancel(self, job_id: str) -> dict[str, Any] | None:
        self._cancelled.add(job_id)
        task = self._tasks.get(job_id)
        if task and not task.done():
            task.cancel()
        updated = self._repo.update(
            job_id,
            status="cancelled",
            stage="cancelled",
            message="Cancelled by local workspace owner",
        )
        if updated:
            await ws_manager.broadcast({"type": "job.updated", "job": updated})
        return updated

    async def _run_pipeline(self, job_id: str) -> None:
        stages = [
            ("prepare", 25),
            ("media_probe", 50),
            ("process", 80),
            ("finalize", 100),
        ]
        try:
            for stage, progress in stages:
                if job_id in self._cancelled:
                    return
                updated = self._repo.update(
                    job_id,
                    status="running",
                    stage=stage,
                    progress=progress,
                    message=f"Running stage: {stage}",
                )
                await ws_manager.broadcast({"type": "job.progress", "job": updated})
                await asyncio.sleep(0.05)

            if job_id in self._cancelled:
                return
            done = self._repo.update(
                job_id,
                status="completed",
                stage="completed",
                progress=100,
                message="Job completed",
            )
            await ws_manager.broadcast({"type": "job.completed", "job": done})
        except asyncio.CancelledError:
            return
        except Exception as exc:
            failed = self._repo.update(
                job_id,
                status="failed",
                stage="failed",
                error_message=str(exc),
                message=f"Failed: {exc}",
            )
            await ws_manager.broadcast({"type": "job.failed", "job": failed})


job_worker = JobWorker()
