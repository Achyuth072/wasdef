import json
from pathlib import Path
import pytest
import httpx

from app.services.elexon_client import (
    parse_fuelhh_wind_records,
    parse_windfor_records,
    ElexonClient,
)
from app.db.storage import StorageEngine
from app.services.ingestion import ElexonIngestionService


FIXTURES_DIR = Path(__file__).parent / "fixtures"


def test_parse_fuelhh_wind_records():
    with open(FIXTURES_DIR / "fuelhh_sample.json") as f:
        raw_data = json.load(f)

    records = parse_fuelhh_wind_records(raw_data)
    # The fixture has 4 records, exactly 2 are WIND
    assert len(records) == 2
    assert records[0].settlement_period == 1
    assert records[0].generation_mw == 13756.0
    assert records[0].start_time == "2026-01-01T00:00:00Z"
    assert records[0].settlement_date == "2026-01-01"

    assert records[1].settlement_period == 2
    assert records[1].generation_mw == 13873.0
    assert records[1].start_time == "2026-01-01T00:30:00Z"


def test_parse_windfor_records():
    with open(FIXTURES_DIR / "windfor_sample.json") as f:
        raw_data = json.load(f)

    records = parse_windfor_records(raw_data)
    assert len(records) == 3
    assert records[0].start_time == "2026-01-01T00:00:00Z"
    assert records[0].publish_time == "2025-12-31T09:00:00Z"
    assert records[0].generation_mw == 13500.0


def test_storage_engine_sqlite_persistence(tmp_path):
    db_path = tmp_path / "test_cache.db"
    storage = StorageEngine(db_path=db_path)

    with open(FIXTURES_DIR / "fuelhh_sample.json") as f:
        actuals = parse_fuelhh_wind_records(json.load(f))
    with open(FIXTURES_DIR / "windfor_sample.json") as f:
        forecasts = parse_windfor_records(json.load(f))

    count_act = storage.save_actuals(actuals)
    assert count_act == 2

    count_fc = storage.save_forecasts(forecasts)
    assert count_fc == 3

    # Query back
    stored_actuals = storage.get_actuals("2026-01-01T00:00:00Z", "2026-01-01T01:00:00Z")
    assert len(stored_actuals) == 2

    stored_forecasts = storage.get_forecasts("2026-01-01T00:00:00Z", "2026-01-01T01:00:00Z")
    assert len(stored_forecasts) == 3


@pytest.mark.asyncio
async def test_ingestion_service_with_mock_client(tmp_path):
    db_path = tmp_path / "test_cache.db"
    storage = StorageEngine(db_path=db_path)

    with open(FIXTURES_DIR / "fuelhh_sample.json") as f:
        fuelhh_json = json.load(f)
    with open(FIXTURES_DIR / "windfor_sample.json") as f:
        windfor_json = json.load(f)

    def handler(request: httpx.Request):
        url = str(request.url)
        if "FUELHH" in url:
            return httpx.Response(200, json=fuelhh_json)
        elif "WINDFOR" in url:
            return httpx.Response(200, json=windfor_json)
        return httpx.Response(404)

    mock_transport = httpx.MockTransport(handler)
    mock_http_client = httpx.AsyncClient(transport=mock_transport)

    elexon_client = ElexonClient(client=mock_http_client)
    service = ElexonIngestionService(client=elexon_client, storage=storage)

    res_act = await service.fetch_and_store_actuals(
        from_dt="2026-01-01T00:00:00Z",
        to_dt="2026-01-01T01:00:00Z"
    )
    assert res_act == 2

    res_fc = await service.fetch_and_store_forecasts(
        from_dt="2025-12-31T00:00:00Z",
        to_dt="2026-01-01T12:00:00Z"
    )
    assert res_fc == 3


def test_parse_fuelhh_edge_cases():
    """Verify handling of zero generation, low generation, missing fields, and non-wind records."""
    raw_payload = [
        {"dataset": "FUELHH", "startTime": "2026-01-01T00:00:00Z", "fuelType": "WIND", "generation": 0.0},
        {"dataset": "FUELHH", "startTime": "2026-01-01T00:30:00Z", "fuelType": "WIND", "generation": 0.5},
        {"dataset": "FUELHH", "startTime": None, "fuelType": "WIND", "generation": 100.0},
        {"dataset": "FUELHH", "startTime": "2026-01-01T01:00:00Z", "fuelType": "WIND", "generation": None},
        {"dataset": "FUELHH", "startTime": "2026-01-01T01:30:00Z", "fuelType": "COAL", "generation": 500.0},
    ]
    records = parse_fuelhh_wind_records(raw_payload)
    assert len(records) == 2
    assert records[0].generation_mw == 0.0
    assert records[1].generation_mw == 0.5


def test_parse_windfor_edge_cases():
    """Verify handling of missing timestamps, null generation, and identical publish times."""
    raw_payload = [
        {"dataset": "WINDFOR", "publishTime": "2025-12-31T09:00:00Z", "startTime": "2026-01-01T00:00:00Z", "generation": 12000},
        # Identical publish and start time (duplicate revision)
        {"dataset": "WINDFOR", "publishTime": "2025-12-31T09:00:00Z", "startTime": "2026-01-01T00:00:00Z", "generation": 12500},
        {"dataset": "WINDFOR", "publishTime": None, "startTime": "2026-01-01T00:00:00Z", "generation": 10000},
        {"dataset": "WINDFOR", "publishTime": "2025-12-31T09:00:00Z", "startTime": None, "generation": 10000},
        {"dataset": "WINDFOR", "publishTime": "2025-12-31T09:00:00Z", "startTime": "2026-01-01T01:00:00Z", "generation": None},
    ]
    records = parse_windfor_records(raw_payload)
    assert len(records) == 2
    assert records[0].generation_mw == 12000
    assert records[1].generation_mw == 12500

