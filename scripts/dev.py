import subprocess
import sys
import time
import os
import shutil
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


def detect_scrcpy_server_path() -> str | None:
    scrcpy_bin = shutil.which("scrcpy")
    if not scrcpy_bin:
        return None

    real_bin = Path(scrcpy_bin).resolve()
    candidates = [
        real_bin.parent.parent / "share" / "scrcpy" / "scrcpy-server",
        real_bin.parent.parent / "share" / "scrcpy" / "scrcpy-server.jar",
    ]

    for candidate in candidates:
        if candidate.exists():
            return str(candidate)

    return None


def detect_scrcpy_version() -> str | None:
    scrcpy_bin = shutil.which("scrcpy")
    if not scrcpy_bin:
        return None

    try:
        result = subprocess.run(
            [scrcpy_bin, "--version"],
            capture_output=True,
            text=True,
            check=False,
        )
    except Exception:
        return None

    output = (result.stdout or "") + "\n" + (result.stderr or "")
    for raw_line in output.splitlines():
        line = raw_line.strip()
        if not line.lower().startswith("scrcpy"):
            continue
        parts = line.split()
        if len(parts) >= 2:
            return parts[1].strip()

    return None


def stop_stale_backend(port: int, backend_dir: Path) -> None:
    try:
        result = subprocess.run(
            ["lsof", "-nP", f"-iTCP:{port}", "-sTCP:LISTEN", "-t"],
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError:
        return

    pids = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    if not pids:
        return

    candidates: list[str] = []

    for pid in pids:
        ps_result = subprocess.run(
            ["ps", "-p", pid, "-o", "pid=,command="],
            capture_output=True,
            text=True,
            check=False,
        )
        command = ps_result.stdout.strip()
        if not command:
            continue

        if "run.py" in command and "python" in command.lower():
            candidates.append(pid)

    if not candidates:
        log_line(
            f"backend port {port} is already in use by a non-backend process; "
            "stop it manually before running dev",
        )
        raise SystemExit(1)

    log_line(f"stopping stale backend listener on port {port}: {' '.join(candidates)}")
    subprocess.run(["kill", "-TERM", *candidates], check=False)

    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        check = subprocess.run(
            ["lsof", "-nP", f"-iTCP:{port}", "-sTCP:LISTEN", "-t"],
            capture_output=True,
            text=True,
            check=False,
        )
        remaining = [line.strip() for line in check.stdout.splitlines() if line.strip()]
        if not remaining:
            return
        time.sleep(0.2)

    subprocess.run(["kill", "-KILL", *candidates], check=False)


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
    backend_env["BACKEND_CORS_ORIGINS"] = "*"

    frontend_env = os.environ.copy()
    frontend_env["VITE_BACKEND_URL"] = "http://localhost:8000"
    frontend_env["VITE_API_URL"] = "http://localhost:8000"
    frontend_env["VITE_BACKEND_WS_URL"] = "ws://localhost:8000/ws/devices"
    frontend_env["VITE_DEVICE_WS_URL"] = "ws://localhost:8000/ws/devices"
    frontend_env["VITE_WS_URL"] = "ws://localhost:8000/ws/logs"
    frontend_env["VITE_STREAM_WS_URL"] = "ws://localhost:9100"
    frontend_env["VITE_STREAM_HTTP_URL"] = "http://localhost:9100"
    frontend_env["VITE_MEDIA_HTTP_URL"] = "http://localhost:9100"

    media_env = os.environ.copy()
    media_env["MEDIA_CORS_ORIGINS"] = "*"
    if "MEDIA_SCRCPY_SERVER_LOCAL_PATH" not in media_env:
        scrcpy_server_path = detect_scrcpy_server_path()
        if scrcpy_server_path:
            media_env["MEDIA_SCRCPY_SERVER_LOCAL_PATH"] = scrcpy_server_path
            log_line(f"media    using scrcpy-server={scrcpy_server_path}")
        else:
            log_line("media    warning: scrcpy-server binary not found; set MEDIA_SCRCPY_SERVER_LOCAL_PATH manually")

    detected_scrcpy_version = detect_scrcpy_version()
    current_scrcpy_version = media_env.get("MEDIA_SCRCPY_CLIENT_VERSION")
    if detected_scrcpy_version:
        if current_scrcpy_version and current_scrcpy_version != detected_scrcpy_version:
            log_line(
                "media    overriding MEDIA_SCRCPY_CLIENT_VERSION="
                f"{current_scrcpy_version} -> {detected_scrcpy_version}"
            )
        media_env["MEDIA_SCRCPY_CLIENT_VERSION"] = detected_scrcpy_version
        log_line(f"media    using scrcpy-client-version={detected_scrcpy_version}")
    elif current_scrcpy_version:
        log_line(f"media    using MEDIA_SCRCPY_CLIENT_VERSION={current_scrcpy_version}")

    stop_stale_backend(8000, backend_dir)

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
            except subprocess.TimeoutExpired:
                log_line(f"force killing {name} (pid={proc.pid})")
                proc.kill()
            except BaseException:
                if proc.poll() is None:
                    log_line(f"force killing {name} (pid={proc.pid})")
                    proc.kill()
        log_line("all processes stopped")


if __name__ == "__main__":
    main()
