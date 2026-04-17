import subprocess
import sys
import time
from pathlib import Path


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    venv_python = root / ".venv" / "bin" / "python"
    python_exec = str(venv_python) if venv_python.exists() else sys.executable

    backend_cmd = [
        python_exec,
        "-m",
        "uvicorn",
        "app.main:app",
        "--reload",
        "--host",
        "0.0.0.0",
        "--port",
        "8000",
    ]
    frontend_cmd = [
        "npm",
        "run",
        "dev",
        "--",
        "--host",
        "0.0.0.0",
        "--port",
        "5173",
    ]
    media_cmd = [
        "node",
        "server.js",
    ]

    backend_proc = subprocess.Popen(backend_cmd, cwd=root / "backend")
    frontend_proc = subprocess.Popen(frontend_cmd, cwd=root / "frontend")
    media_proc = subprocess.Popen(media_cmd, cwd=root / "media-server")

    procs = [backend_proc, frontend_proc, media_proc]

    try:
        while True:
            time.sleep(0.5)
            for proc in procs:
                if proc.poll() is not None:
                    raise SystemExit(proc.returncode or 0)
    except KeyboardInterrupt:
        pass
    finally:
        for proc in procs:
            if proc.poll() is None:
                proc.terminate()
        for proc in procs:
            try:
                proc.wait(timeout=5)
            except Exception:
                proc.kill()


if __name__ == "__main__":
    main()
