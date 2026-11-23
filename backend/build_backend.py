from __future__ import annotations

import subprocess
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
DIST_OUT = PROJECT_ROOT / "dist" / "backend"


def main() -> None:
    DIST_OUT.mkdir(parents=True, exist_ok=True)
    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--clean",
        "--distpath",
        str(DIST_OUT),
        "--workpath",
        str(BACKEND_DIR / "build"),
        str(BACKEND_DIR / "hoangtuoi-reup-backend.spec"),
    ]
    print("[HoangTuoiReup] Building backend:", " ".join(cmd))
    subprocess.run(cmd, cwd=BACKEND_DIR, check=True)
    exe = DIST_OUT / (
        "hoangtuoi-reup-backend.exe" if sys.platform == "win32" else "hoangtuoi-reup-backend"
    )
    if not exe.exists():
        raise FileNotFoundError(f"Expected built backend binary at {exe}")
    print("[HoangTuoiReup] Built backend successfully:", exe)


if __name__ == "__main__":
    main()
