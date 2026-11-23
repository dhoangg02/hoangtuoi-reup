from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field

JobStatus = Literal["queued", "running", "completed", "failed", "cancelled"]


class JobCreate(BaseModel):
    title: str = ""
    url: str = ""
    options: dict[str, Any] = Field(default_factory=dict)


class JobPatch(BaseModel):
    title: str | None = None
    url: str | None = None
    options: dict[str, Any] | None = None


class JobRecord(BaseModel):
    id: str
    title: str
    url: str
    status: JobStatus
    stage: str
    progress: int
    options: dict[str, Any] = Field(default_factory=dict)
    output_path: str = ""
    error_message: str = ""
    created_at: str
    updated_at: str


class ChannelCreate(BaseModel):
    name: str
    url: str = ""
    platform: str = "local"


class ChannelRecord(BaseModel):
    id: str
    name: str
    url: str
    platform: str
    created_at: str


class SeriesCreate(BaseModel):
    name: str
    description: str = ""


class SeriesRecord(BaseModel):
    id: str
    name: str
    description: str
    episodes: list[str] = Field(default_factory=list)
    created_at: str


class WatermarkCreate(BaseModel):
    name: str
    config: dict[str, Any] = Field(default_factory=dict)


class WatermarkRecord(BaseModel):
    id: str
    name: str
    config: dict[str, Any] = Field(default_factory=dict)
    created_at: str
