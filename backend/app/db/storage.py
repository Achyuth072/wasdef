import sqlite3
from pathlib import Path
from typing import Optional

from app.models.records import ActualRecord, ForecastRecord


class StorageEngine:
    """SQLite-based persistent cache for Elexon actuals and forecasts."""

    def __init__(self, db_path: Path | str = "data/elexon_cache.db"):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._get_connection() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS actuals (
                    start_time TEXT PRIMARY KEY,
                    settlement_date TEXT NOT NULL,
                    settlement_period INTEGER NOT NULL,
                    generation_mw REAL NOT NULL
                );
                CREATE TABLE IF NOT EXISTS forecasts (
                    start_time TEXT NOT NULL,
                    publish_time TEXT NOT NULL,
                    generation_mw REAL NOT NULL,
                    PRIMARY KEY (start_time, publish_time)
                );
                CREATE INDEX IF NOT EXISTS idx_actuals_date ON actuals(settlement_date);
                CREATE INDEX IF NOT EXISTS idx_forecasts_start_pub ON forecasts(start_time, publish_time);
                """
            )

    def save_actuals(self, records: list[ActualRecord]) -> int:
        if not records:
            return 0
        with self._get_connection() as conn:
            cursor = conn.executemany(
                """
                INSERT INTO actuals (start_time, settlement_date, settlement_period, generation_mw)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(start_time) DO UPDATE SET
                    settlement_date=excluded.settlement_date,
                    settlement_period=excluded.settlement_period,
                    generation_mw=excluded.generation_mw
                """,
                [
                    (r.start_time, r.settlement_date, r.settlement_period, r.generation_mw)
                    for r in records
                ],
            )
            return cursor.rowcount

    def save_forecasts(self, records: list[ForecastRecord]) -> int:
        if not records:
            return 0
        with self._get_connection() as conn:
            cursor = conn.executemany(
                """
                INSERT INTO forecasts (start_time, publish_time, generation_mw)
                VALUES (?, ?, ?)
                ON CONFLICT(start_time, publish_time) DO UPDATE SET
                    generation_mw=excluded.generation_mw
                """,
                [(r.start_time, r.publish_time, r.generation_mw) for r in records],
            )
            return cursor.rowcount

    def get_actuals(
        self, start_time_from: Optional[str] = None, start_time_to: Optional[str] = None
    ) -> list[ActualRecord]:
        query = "SELECT start_time, settlement_date, settlement_period, generation_mw FROM actuals"
        params: list[str] = []
        conditions: list[str] = []
        if start_time_from:
            conditions.append("start_time >= ?")
            params.append(start_time_from)
        if start_time_to:
            conditions.append("start_time <= ?")
            params.append(start_time_to)

        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += " ORDER BY start_time ASC"

        with self._get_connection() as conn:
            rows = conn.execute(query, params).fetchall()
            return [
                ActualRecord(
                    start_time=row["start_time"],
                    settlement_date=row["settlement_date"],
                    settlement_period=row["settlement_period"],
                    generation_mw=row["generation_mw"],
                )
                for row in rows
            ]

    def get_forecasts(
        self, start_time_from: Optional[str] = None, start_time_to: Optional[str] = None
    ) -> list[ForecastRecord]:
        query = "SELECT start_time, publish_time, generation_mw FROM forecasts"
        params: list[str] = []
        conditions: list[str] = []
        if start_time_from:
            conditions.append("start_time >= ?")
            params.append(start_time_from)
        if start_time_to:
            conditions.append("start_time <= ?")
            params.append(start_time_to)

        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += " ORDER BY start_time ASC, publish_time ASC"

        with self._get_connection() as conn:
            rows = conn.execute(query, params).fetchall()
            return [
                ForecastRecord(
                    start_time=row["start_time"],
                    publish_time=row["publish_time"],
                    generation_mw=row["generation_mw"],
                )
                for row in rows
            ]
