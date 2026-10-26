import os
import sys
from pathlib import Path

# Add backend directory to sys.path so app modules can be resolved
root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Configure default database path in Vercel environment
db_candidate = root_dir / "data" / "elexon_cache.db"
if db_candidate.exists():
    os.environ.setdefault("DATABASE_PATH", str(db_candidate))

from app.main import app  # noqa: E402
