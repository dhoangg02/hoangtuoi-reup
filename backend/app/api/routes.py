from __future__ import annotations

from pathlib import Path
from typing import Any
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse

from app.core.config import get_config
from app.models.schemas import (
    ChannelCreate,
    JobCreate,
    JobPatch,
    SeriesCreate,
    WatermarkCreate,
)
from app.repositories.store import (
    ChannelRepository,
    JobRepository,
    SeriesRepository,
    SettingsRepository,
    WatermarkRepository,
)
from app.utils.media import check_dir_status, detect_binary
from app.workers.job_worker import (
    AVAILABLE_VOICES,
    VOICE_PROFILE_MAP,
    _get_whisper_model,
    _synthesize_tts_mp3,
    job_worker,
    ws_manager,
)

router = APIRouter(prefix="/api/v1")

job_repo = JobRepository()
channel_repo = ChannelRepository()
series_repo = SeriesRepository()
watermark_repo = WatermarkRepository()
settings_repo = SettingsRepository()


@router.get("/health")
def get_health() -> dict[str, Any]:
    cfg = get_config()
    ffmpeg = detect_binary("ffmpeg")
    ffprobe = detect_binary("ffprobe")
    degraded: list[str] = []
    if not ffmpeg["available"]:
        degraded.append("ffmpeg_missing")
    return {
        "status": "ok" if not degraded else "degraded",
        "runtime_mode": "LOCAL_STANDALONE",
        "backend": "open-source-clean-room",
        "version": cfg.version,
        "degraded_reasons": degraded,
        "ffmpeg": ffmpeg,
        "ffprobe": ffprobe,
        "voices": AVAILABLE_VOICES,
        "paths": {
            "data_dir": check_dir_status(cfg.data_dir),
            "job_storage_dir": check_dir_status(cfg.job_storage_dir),
            "cache": check_dir_status(cfg.cache_dir),
            "output": check_dir_status(cfg.output_dir),
            "logs": check_dir_status(cfg.logs_dir),
        },
    }


@router.get("/startup/status")
def get_startup_status() -> dict[str, Any]:
    return get_resources_status()


@router.get("/resources")
def get_resources_status() -> dict[str, Any]:
    import asyncio
    import importlib.metadata

    ffmpeg = detect_binary("ffmpeg")
    ffprobe = detect_binary("ffprobe")
    yt_dlp_bin = detect_binary("yt-dlp")

    def _pkg_ver(name: str) -> str | None:
        try:
            return importlib.metadata.version(name)
        except Exception:
            return None

    edge_ver = _pkg_ver("edge-tts")
    whisper_ver = _pkg_ver("faster-whisper")
    ytdlp_ver = _pkg_ver("yt-dlp")

    items = [
        {
            "id": "ffmpeg",
            "name": "FFmpeg & FFprobe Media Engine",
            "category": "binary",
            "installed": bool(ffmpeg["available"] and ffprobe["available"]),
            "version": ffmpeg.get("path") or "missing",
            "description": "Tách nhạc/thoại, trộn âm thanh lồng tiếng và đóng phụ đề MP4",
        },
        {
            "id": "yt-dlp",
            "name": "yt-dlp Video Downloader (Douyin / TikTok / YouTube)",
            "category": "python",
            "installed": bool(ytdlp_ver or yt_dlp_bin["available"]),
            "version": ytdlp_ver or yt_dlp_bin.get("path") or "missing",
            "description": "Tải video nguồn chất lượng gốc từ link chia sẻ",
        },
        {
            "id": "faster-whisper",
            "name": "Faster-Whisper AI Speech-to-Text (Offline ASR)",
            "category": "ai_model",
            "installed": bool(whisper_ver),
            "version": f"v{whisper_ver} (Models: tiny / base / small)" if whisper_ver else "missing",
            "description": "Mô hình AI nhận diện lời thoại đa ngôn ngữ kèm mốc thời gian",
        },
        {
            "id": "edge-tts",
            "name": f"Neural Vietnamese TTS Voices ({len(AVAILABLE_VOICES)} Giọng AI)",
            "category": "ai_voice",
            "installed": bool(edge_ver),
            "version": f"v{edge_ver}" if edge_ver else "missing",
            "description": "Bộ 6 giọng đọc AI Neural Tiếng Việt (Hoài My, Nam Minh, Ngọc Lan, Hùng Dũng, Tiểu Vy, Minh Quân)",
        },
    ]
    all_ready = all(item["installed"] for item in items)
    return {
        "ready": all_ready,
        "runtime_mode": "LOCAL_STANDALONE",
        "resources": items,
        "voices": AVAILABLE_VOICES,
        "downloads": [],
    }


@router.post("/resources/install")
async def install_or_update_resources(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    import asyncio
    import subprocess
    import sys

    body = payload or {}
    whisper_model = str(body.get("whisper_model") or "base")

    def _run_install() -> list[str]:
        logs: list[str] = []
        proc = subprocess.run(
            [
                sys.executable,
                "-m",
                "pip",
                "install",
                "--upgrade",
                "edge-tts>=7.3.1",
                "yt-dlp",
                "faster-whisper",
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        logs.append(f"pip upgrade exit={proc.returncode}")
        # Pre-load & cache Faster-Whisper model weights locally
        _get_whisper_model(whisper_model)
        logs.append(f"faster-whisper model '{whisper_model}' cached")
        return logs

    logs = await asyncio.to_thread(_run_install)
    status = get_resources_status()
    status["install_logs"] = logs
    return status


@router.get("/voices")
def list_voices() -> list[dict[str, Any]]:
    return AVAILABLE_VOICES


@router.get("/voices/preview")
async def preview_voice(voice_id: str = "vi-VN-HoaiMyNeural", rate: str = "+10%", text: str = "") -> FileResponse:
    import hashlib

    cfg = get_config()
    preview_dir = cfg.cache_dir / "voice_previews"
    preview_dir.mkdir(parents=True, exist_ok=True)

    profile = VOICE_PROFILE_MAP.get(voice_id, AVAILABLE_VOICES[0])
    sample_text = (text or "").strip() or str(profile.get("sample_text") or "Xin chào các bạn.")
    digest = hashlib.sha1(f"{voice_id}|{rate}|{sample_text}".encode("utf-8")).hexdigest()[:12]
    mp3_path = preview_dir / f"preview_{voice_id}_{digest}.mp3"

    if not mp3_path.exists() or mp3_path.stat().st_size < 200:
        await _synthesize_tts_mp3(sample_text, voice_id=voice_id, rate=rate, dest_mp3=mp3_path)

    return FileResponse(path=str(mp3_path), media_type="audio/mpeg", filename=mp3_path.name)


# --- Jobs ---
@router.get("/jobs")
def list_jobs() -> list[dict[str, Any]]:
    return job_repo.list()


@router.post("/jobs", status_code=201)
def create_job(payload: JobCreate) -> dict[str, Any]:
    return job_repo.create(payload.title, payload.url, payload.options)


@router.post("/jobs/demo", status_code=201)
async def create_and_start_demo_job(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    body = payload or {}
    options = {
        "source_lang": "zh",
        "target_lang": "vi",
        "voice_id": body.get("voice_id", "vi-VN-HoaiMyNeural"),
        "voice_rate": body.get("voice_rate", "+10%"),
        "bg_volume": float(body.get("bg_volume", 0.15)),
        "whisper_model": body.get("whisper_model", "base"),
        "burn_subtitles": bool(body.get("burn_subtitles", True)),
    }
    job = job_repo.create(
        title="Demo Dịch & Lồng Tiếng Video Trung → Việt",
        url="demo",
        options=options,
    )
    started = await job_worker.enqueue(job["id"])
    return started or job


@router.get("/jobs/{job_id}")
def get_job(job_id: str) -> dict[str, Any]:
    job = job_repo.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.patch("/jobs/{job_id}")
@router.put("/jobs/{job_id}")
def update_job(job_id: str, payload: JobPatch) -> dict[str, Any]:
    fields = payload.model_dump(exclude_none=True)
    updated = job_repo.update(job_id, **fields)
    if not updated:
        raise HTTPException(status_code=404, detail="Job not found")
    return updated


@router.delete("/jobs/{job_id}")
def delete_job(job_id: str) -> dict[str, Any]:
    if not job_repo.delete(job_id):
        raise HTTPException(status_code=404, detail="Job not found")
    return {"deleted": True, "id": job_id}


@router.post("/jobs/{job_id}/start")
@router.post("/jobs/{job_id}/retry")
async def start_job(job_id: str) -> dict[str, Any]:
    updated = await job_worker.enqueue(job_id, redub_only=False)
    if not updated:
        raise HTTPException(status_code=404, detail="Job not found")
    return updated


@router.post("/jobs/{job_id}/redub")
async def redub_job(job_id: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    job = job_repo.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    body = payload or {}
    studio = job_repo.get_studio(job_id) or {}
    if "segments" in body and isinstance(body["segments"], list):
        studio["segments"] = body["segments"]
        job_repo.put_studio(job_id, studio)

    options = dict(job.get("options") or {})
    for key in ("voice_id", "voice_rate", "bg_volume", "burn_subtitles"):
        if key in body:
            options[key] = body[key]
    job_repo.update(job_id, options=options)

    updated = await job_worker.enqueue(job_id, redub_only=True)
    if not updated:
        raise HTTPException(status_code=404, detail="Job not found")
    return updated


@router.post("/jobs/{job_id}/cancel")
async def cancel_job(job_id: str) -> dict[str, Any]:
    updated = await job_worker.cancel(job_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Job not found")
    return updated


@router.get("/jobs/{job_id}/studio")
def get_studio(job_id: str) -> dict[str, Any]:
    studio = job_repo.get_studio(job_id)
    if studio is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return studio


@router.put("/jobs/{job_id}/studio")
def put_studio(job_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    studio = job_repo.put_studio(job_id, payload)
    if studio is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return studio


@router.get("/jobs/{job_id}/video")
def stream_output_video(job_id: str) -> FileResponse:
    job = job_repo.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    out_path = Path(job.get("output_path") or "")
    if not out_path.is_file():
        cfg = get_config()
        out_path = cfg.output_dir / f"{job_id}_vi_dubbed.mp4"
    if not out_path.is_file():
        raise HTTPException(status_code=404, detail="Output video not ready")
    return FileResponse(path=str(out_path), media_type="video/mp4", filename=out_path.name)


@router.get("/jobs/{job_id}/source-video")
def stream_source_video(job_id: str) -> FileResponse:
    cfg = get_config()
    src_path = cfg.job_storage_dir / job_id / "source.mp4"
    if not src_path.is_file():
        raise HTTPException(status_code=404, detail="Source video not found")
    return FileResponse(path=str(src_path), media_type="video/mp4", filename=f"{job_id}_source.mp4")


@router.get("/jobs/{job_id}/srt")
def download_srt(job_id: str) -> FileResponse:
    cfg = get_config()
    srt_path = cfg.output_dir / f"{job_id}_vi.srt"
    if not srt_path.is_file():
        srt_path = cfg.job_storage_dir / job_id / "vi.srt"
    if not srt_path.is_file():
        raise HTTPException(status_code=404, detail="SRT file not found")
    return FileResponse(path=str(srt_path), media_type="text/plain; charset=utf-8", filename=f"{job_id}_vi.srt")


# --- Channels ---
@router.get("/channels")
def list_channels() -> list[dict[str, Any]]:
    return channel_repo.list()


@router.post("/channels", status_code=201)
def create_channel(payload: ChannelCreate) -> dict[str, Any]:
    return channel_repo.create(payload.name, payload.url, payload.platform)


@router.delete("/channels/{channel_id}")
def delete_channel(channel_id: str) -> dict[str, Any]:
    if not channel_repo.delete(channel_id):
        raise HTTPException(status_code=404, detail="Channel not found")
    return {"deleted": True, "id": channel_id}


# --- Series ---
@router.get("/series")
def list_series() -> list[dict[str, Any]]:
    return series_repo.list()


@router.post("/series", status_code=201)
def create_series(payload: SeriesCreate) -> dict[str, Any]:
    return series_repo.create(payload.name, payload.description)


@router.delete("/series/{series_id}")
def delete_series(series_id: str) -> dict[str, Any]:
    if not series_repo.delete(series_id):
        raise HTTPException(status_code=404, detail="Series not found")
    return {"deleted": True, "id": series_id}


# --- Watermarks ---
@router.get("/watermarks")
def list_watermarks() -> list[dict[str, Any]]:
    return watermark_repo.list()


@router.post("/watermarks", status_code=201)
def create_watermark(payload: WatermarkCreate) -> dict[str, Any]:
    return watermark_repo.create(payload.name, payload.config)


@router.put("/watermarks/{watermark_id}")
def update_watermark(watermark_id: str, payload: WatermarkCreate) -> dict[str, Any]:
    updated = watermark_repo.update(watermark_id, payload.name, payload.config)
    if not updated:
        raise HTTPException(status_code=404, detail="Watermark not found")
    return updated


@router.delete("/watermarks/{watermark_id}")
def delete_watermark(watermark_id: str) -> dict[str, Any]:
    if not watermark_repo.delete(watermark_id):
        raise HTTPException(status_code=404, detail="Watermark not found")
    return {"deleted": True, "id": watermark_id}


# --- Settings ---
@router.get("/settings")
def get_settings() -> dict[str, Any]:
    return settings_repo.get_all()


@router.put("/settings")
@router.post("/settings")
def put_settings(payload: dict[str, Any]) -> dict[str, Any]:
    return settings_repo.put_all(payload)


# --- WebSocket ---
@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    await ws_manager.connect(ws)
    try:
        await ws.send_json({"type": "connected", "runtime_mode": "LOCAL_STANDALONE"})
        while True:
            msg = await ws.receive_text()
            if msg == "ping":
                await ws.send_json({"type": "pong"})
    except WebSocketDisconnect:
        ws_manager.disconnect(ws)
