from __future__ import annotations

import argparse
from contextlib import asynccontextmanager
from typing import AsyncIterator

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import configure, get_config
from app.core.database import init_db


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    cfg = get_config()
    cfg.ensure_dirs()
    init_db(cfg.db_path)
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="HoangTuoi Reup Backend",
        version="0.1.0-local",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router)
    return app


app = create_app()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="HoangTuoi Reup Local FastAPI Backend")
    parser.add_argument("--data-dir", default=None, help="Local data directory (SQLite DB, output, logs)")
    parser.add_argument("--job-storage-dir", default=None, help="Directory for job media storage")
    parser.add_argument("--cache-dir", default=None, help="Directory for pipeline cache")
    parser.add_argument("--host", default="127.0.0.1", help="Bind host")
    parser.add_argument("--port", type=int, default=63405, help="Bind port")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    cfg = configure(
        data_dir=args.data_dir,
        job_storage_dir=args.job_storage_dir,
        cache_dir=args.cache_dir,
        host=args.host,
        port=args.port,
    )
    init_db(cfg.db_path)
    uvicorn.run(app, host=cfg.host, port=cfg.port, log_level="info")


if __name__ == "__main__":
    main()
