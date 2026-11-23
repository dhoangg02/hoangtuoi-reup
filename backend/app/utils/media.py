from __future__ import annotations

import shutil
import subprocess
from pathlib import Path
from typing import Any


def detect_binary(name: str) -> dict[str, Any]:
    found = shutil.which(name)
    if not found:
        return {"available": False, "path": None, "version": None}
    version = None
    try:
        proc = subprocess.run(
            [found, "-version"],
            capture_output=True,
            text=True,
            timeout=3,
            check=False,
        )
        first_line = (proc.stdout or proc.stderr or "").splitlines()
        version = first_line[0] if first_line else None
    except Exception:
        version = None
    return {"available": True, "path": found, "version": version}


def check_dir_status(path: Path) -> dict[str, Any]:
    exists = path.exists()
    writable = False
    if exists and path.is_dir():
        probe = path / ".write_probe"
        try:
            probe.write_text("ok", encoding="utf-8")
            probe.unlink(missing_ok=True)
            writable = True
        except Exception:
            writable = False
    return {"path": str(path), "exists": exists, "writable": writable}
