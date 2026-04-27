from __future__ import annotations

import sqlite3
import time
from pathlib import Path


class DeviceLockService:
    def __init__(self, *, db_path: Path, locked_by: str = "execution_dispatcher") -> None:
        self._db_path = db_path
        self._locked_by = locked_by

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self._db_path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def is_locked(self, device_id: str) -> bool:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT 1 FROM device_locks WHERE device_id = ?",
                (device_id,),
            ).fetchone()
        return row is not None

    def acquire_lock(
        self,
        device_id: str,
        execution_id: str,
        *,
        locked_by: str | None = None,
    ) -> bool:
        timestamp = int(time.time())
        with self._connect() as connection:
            try:
                connection.execute(
                    """
                    INSERT INTO device_locks (
                        device_id,
                        execution_id,
                        locked_at,
                        locked_by,
                        created_at
                    ) VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        device_id,
                        execution_id,
                        timestamp,
                        locked_by or self._locked_by,
                        timestamp,
                    ),
                )
                connection.commit()
                return True
            except sqlite3.IntegrityError:
                connection.rollback()
                return False

    def release_lock(self, device_id: str) -> None:
        with self._connect() as connection:
            connection.execute(
                "DELETE FROM device_locks WHERE device_id = ?",
                (device_id,),
            )
            connection.commit()

    def release_by_execution(self, execution_id: str) -> None:
        with self._connect() as connection:
            connection.execute(
                "DELETE FROM device_locks WHERE execution_id = ?",
                (execution_id,),
            )
            connection.commit()

    def get_locked_devices(self) -> list[str]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT device_id FROM device_locks ORDER BY locked_at ASC",
            ).fetchall()
        return [str(row["device_id"]) for row in rows]

    def get_device_by_execution(self, execution_id: str) -> str | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT device_id FROM device_locks WHERE execution_id = ?",
                (execution_id,),
            ).fetchone()
        return str(row["device_id"]) if row else None
