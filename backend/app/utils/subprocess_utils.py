from __future__ import annotations

import subprocess


class CommandExecutionError(RuntimeError):
    def __init__(self, *, command: list[str], returncode: int | None, stderr: str) -> None:
        self.command = command
        self.returncode = returncode
        self.stderr = stderr
        message = f"Command failed ({returncode}): {' '.join(command)}"
        if stderr:
            message = f"{message}: {stderr}"
        super().__init__(message)


def run_command(cmd: list[str], timeout: int = 30) -> subprocess.CompletedProcess[str]:
    try:
        completed = subprocess.run(
            cmd,
            capture_output=True,
            check=False,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as exc:
        stderr = exc.stderr if isinstance(exc.stderr, str) else ""
        raise CommandExecutionError(
            command=cmd,
            returncode=None,
            stderr=stderr or f"command timed out after {timeout}s",
        ) from exc
    except OSError as exc:
        raise CommandExecutionError(
            command=cmd,
            returncode=None,
            stderr=str(exc),
        ) from exc

    if completed.returncode != 0:
        raise CommandExecutionError(
            command=cmd,
            returncode=completed.returncode,
            stderr=completed.stderr.strip(),
        )

    return completed
