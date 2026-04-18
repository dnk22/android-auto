import subprocess
import sys
import time
import os
from pathlib import Path
from typing import Sequence


def pick_js_runner(project_dir: Path) -> str:
    if (project_dir / "yarn.lock").exists():
        return "yarn"
    return "npm"


def fmt_cmd(parts: Sequence[str]) -> str:
    return " ".join(parts)


def log_line(message: str) -> None:
    print(f"[dev] {message}", flush=True)


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    venv_python = root / ".venv" / "bin" / "python"
    python_exec = str(venv_python) if venv_python.exists() else sys.executable

    backend_dir = root / "backend"
    frontend_dir = root / "frontend"
    media_dir = root / "media-server"

    frontend_runner = pick_js_runner(frontend_dir)
    media_runner = pick_js_runner(media_dir)

    backend_cmd = [
        python_exec,
        "run.py",
    ]
    if frontend_runner == "yarn":
        frontend_cmd = [frontend_runner, "dev", "--host", "0.0.0.0", "--port", "5173"]
    else:
        frontend_cmd = [
            frontend_runner,
            "run",
            "dev",
            "--",
            "--host",
            "0.0.0.0",
            "--port",
            "5173",
        ]

    if media_runner == "yarn":
        media_cmd = [media_runner, "dev"]
    else:
        media_cmd = [media_runner, "run", "dev"]

    backend_env = os.environ.copy()
    backend_env.setdefault("BACKEND_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")

    frontend_env = os.environ.copy()
    frontend_env.setdefault("VITE_BACKEND_URL", "/api")
    frontend_env.setdefault("VITE_API_URL", "/api")
    frontend_env.setdefault("VITE_WS_URL", "/ws/logs")
    frontend_env.setdefault("VITE_DEVICE_WS_URL", "/ws/devices")
    frontend_env.setdefault("VITE_STREAM_WS_URL", "/media")
    frontend_env.setdefault("VITE_STREAM_HTTP_URL", "/media")
    frontend_env.setdefault("VITE_MEDIA_HTTP_URL", "/media")

    media_env = os.environ.copy()
    media_env.setdefault("MEDIA_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")

    log_line("starting processes")
    log_line(f"backend  cwd={backend_dir} cmd={fmt_cmd(backend_cmd)}")
    log_line(f"frontend cwd={frontend_dir} cmd={fmt_cmd(frontend_cmd)}")
    log_line(f"media    cwd={media_dir} cmd={fmt_cmd(media_cmd)}")

    backend_proc = subprocess.Popen(backend_cmd, cwd=backend_dir, env=backend_env)
    frontend_proc = subprocess.Popen(frontend_cmd, cwd=frontend_dir, env=frontend_env)
    media_proc = subprocess.Popen(media_cmd, cwd=media_dir, env=media_env)

    procs = [
        ("backend", backend_proc),
        ("frontend", frontend_proc),
        ("media", media_proc),
    ]

    try:
        while True:
            time.sleep(0.5)
            for name, proc in procs:
                if proc.poll() is not None:
                    log_line(f"{name} exited with code {proc.returncode}")
                    raise SystemExit(proc.returncode or 0)
    except KeyboardInterrupt:
        log_line("received Ctrl+C, stopping all processes")
        pass
    finally:
        for name, proc in procs:
            if proc.poll() is None:
                log_line(f"terminating {name} (pid={proc.pid})")
                proc.terminate()
        for name, proc in procs:
            try:
                proc.wait(timeout=5)
            except Exception:
                log_line(f"force killing {name} (pid={proc.pid})")
                proc.kill()
        log_line("all processes stopped")


if __name__ == "__main__":
    main()
