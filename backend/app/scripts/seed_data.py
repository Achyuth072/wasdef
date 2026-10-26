import argparse
import asyncio
import logging

from app.db.storage import StorageEngine
from app.services.ingestion import ElexonIngestionService

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("seed_data")


async def main(db_path: str = "data/elexon_cache.db", chunk_days: int = 1) -> None:
    logger.info("Starting ingestion of January 2026 datasets into %s...", db_path)
    storage = StorageEngine(db_path=db_path)
    service = ElexonIngestionService(storage=storage)

    result = await service.ingest_january_2026(
        start_date="2025-12-31T00:00:00Z",
        end_date="2026-02-01T23:59:59Z",
        chunk_days=chunk_days,
    )
    logger.info("Ingestion complete: %s", result)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed January 2026 Elexon datasets")
    parser.add_argument("--db", default="data/elexon_cache.db", help="Path to SQLite database")
    parser.add_argument("--chunk-days", type=int, default=1, help="Chunk size in days")
    args = parser.parse_args()

    asyncio.run(main(db_path=args.db, chunk_days=args.chunk_days))
