import os
from pathlib import Path
from app.db.storage import StorageEngine

_STORAGE_INSTANCE = None


def get_default_db_path() -> Path:
    env_path = os.getenv("DATABASE_PATH")
    if env_path:
        return Path(env_path)

    # Check common production / local paths
    prod_path = Path("/app/data/elexon_cache.db")
    if prod_path.exists():
        return prod_path

    # Local repo root relative path
    repo_root = Path(__file__).resolve().parent.parent.parent.parent
    local_data = repo_root / "data" / "elexon_cache.db"
    if local_data.exists():
        return local_data

    # Fallback to current working directory or relative data path
    return Path("data/elexon_cache.db")


def get_storage() -> StorageEngine:
    global _STORAGE_INSTANCE
    if _STORAGE_INSTANCE is None:
        _STORAGE_INSTANCE = StorageEngine(db_path=get_default_db_path())
    return _STORAGE_INSTANCE
