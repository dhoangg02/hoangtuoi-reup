from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass
class AppConfig:
    data_dir: Path
    job_storage_dir: Path
    cache_dir: Path
    host: str = "127.0.0.1"
    port: int = 63405
    version: str = "0.1.0-local"

    @property
    def db_path(self) -> Path:
        return self.data_dir / "hoangtuoi-reup.db"

    @property
    def output_dir(self) -> Path:
        return self.data_dir / "output"

    @property
    def logs_dir(self) -> Path:
        return self.data_dir / "logs"

    def ensure_dirs(self) -> None:
        for d in (
            self.data_dir,
            self.job_storage_dir,
            self.cache_dir,
            self.output_dir,
            self.logs_dir,
        ):
            d.mkdir(parents=True, exist_ok=True)


_config: AppConfig | None = None


def configure(
    data_dir: str | Path | None = None,
    job_storage_dir: str | Path | None = None,
    cache_dir: str | Path | None = None,
    host: str = "127.0.0.1",
    port: int = 63405,
) -> AppConfig:
    global _config
    base_data = Path(data_dir or os.environ.get("HOANGTUOI_DATA_DIR") or "./data").resolve()
    jobs_dir = Path(job_storage_dir).resolve() if job_storage_dir else base_data / "jobs"
    c_dir = Path(cache_dir).resolve() if cache_dir else base_data / "job-cache"
    _config = AppConfig(
        data_dir=base_data,
        job_storage_dir=jobs_dir,
        cache_dir=c_dir,
        host=host,
        port=port,
    )
    _config.ensure_dirs()
    return _config


def get_config() -> AppConfig:
    global _config
    if _config is None:
        return configure()
    return _config
