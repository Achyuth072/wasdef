import logging
from datetime import datetime, timedelta
from typing import Optional

from app.db.storage import StorageEngine
from app.services.elexon_client import ElexonClient

logger = logging.getLogger(__name__)


class ElexonIngestionService:
    """Service to coordinate fetching Elexon BMRS streams and persisting to local storage."""

    def __init__(
        self,
        client: Optional[ElexonClient] = None,
        storage: Optional[StorageEngine] = None,
    ):
        self.client = client or ElexonClient()
        self.storage = storage or StorageEngine()

    async def fetch_and_store_actuals(self, from_dt: str, to_dt: str) -> int:
        """Fetch FUELHH actual wind generation records and persist them."""
        logger.info("Fetching FUELHH wind actuals from %s to %s", from_dt, to_dt)
        records = await self.client.fetch_fuelhh_stream(from_dt, to_dt)
        saved_count = self.storage.save_actuals(records)
        logger.info("Saved %d FUELHH wind actuals", saved_count)
        return len(records)

    async def fetch_and_store_forecasts(self, from_dt: str, to_dt: str) -> int:
        """Fetch WINDFOR forecast generation records and persist them."""
        logger.info("Fetching WINDFOR forecasts from %s to %s", from_dt, to_dt)
        records = await self.client.fetch_windfor_stream(from_dt, to_dt)
        saved_count = self.storage.save_forecasts(records)
        logger.info("Saved %d WINDFOR forecasts", saved_count)
        return len(records)

    async def ingest_january_2026(
        self,
        start_date: str = "2025-12-30T00:00:00Z",
        end_date: str = "2026-02-01T23:59:59Z",
        chunk_days: int = 1,
    ) -> dict[str, int]:
        """Ingest all data covering January 2026 with boundary buffers in manageable day chunks."""
        start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))

        current = start
        total_actuals = 0
        total_forecasts = 0

        while current < end:
            next_chunk = min(current + timedelta(days=chunk_days), end)
            from_str = current.strftime("%Y-%m-%dT%H:%M:%SZ")
            to_str = next_chunk.strftime("%Y-%m-%dT%H:%M:%SZ")

            total_actuals += await self.fetch_and_store_actuals(from_str, to_str)
            total_forecasts += await self.fetch_and_store_forecasts(from_str, to_str)

            current = next_chunk

        return {
            "total_actuals": total_actuals,
            "total_forecasts": total_forecasts,
        }
