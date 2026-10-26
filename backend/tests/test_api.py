import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db.storage import StorageEngine
from app.models.records import ActualRecord, ForecastRecord
from app.api.dependencies import get_storage


@pytest.fixture
def mock_storage(tmp_path):
    db_file = tmp_path / "api_test.db"
    storage = StorageEngine(db_path=db_file)

    # Seed 2 days of sample data
    # Day 1: 2026-01-01, Day 2: 2026-01-02
    actuals = [
        ActualRecord(
            start_time="2026-01-01T00:00:00Z",
            settlement_date="2026-01-01",
            settlement_period=1,
            generation_mw=12000.0,
        ),
        ActualRecord(
            start_time="2026-01-01T00:30:00Z",
            settlement_date="2026-01-01",
            settlement_period=2,
            generation_mw=12500.0,
        ),
        ActualRecord(
            start_time="2026-01-02T00:00:00Z",
            settlement_date="2026-01-02",
            settlement_period=1,
            generation_mw=13000.0,
        ),
    ]

    forecasts = [
        # For Day 1 (cutoff on 2025-12-31)
        ForecastRecord(
            start_time="2026-01-01T00:00:00Z",
            publish_time="2025-12-31T09:00:00Z",
            generation_mw=11800.0,
        ),
        ForecastRecord(
            start_time="2026-01-01T00:00:00Z",
            publish_time="2025-12-31T09:30:00Z",
            generation_mw=12200.0,
        ),
        ForecastRecord(
            start_time="2026-01-01T00:30:00Z",
            publish_time="2025-12-31T09:00:00Z",
            generation_mw=12400.0,
        ),
        # For Day 2 (cutoff on 2026-01-01)
        ForecastRecord(
            start_time="2026-01-02T00:00:00Z",
            publish_time="2026-01-01T09:00:00Z",
            generation_mw=13100.0,
        ),
    ]

    storage.save_actuals(actuals)
    storage.save_forecasts(forecasts)
    return storage


@pytest.mark.asyncio
async def test_get_presets_endpoint():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/config/presets")
        assert response.status_code == 200
        data = response.json()

        assert "presets" in data
        assert len(data["presets"]) == 3
        preset_ids = [p["id"] for p in data["presets"]]
        assert "epex_60" in preset_ids
        assert "nordpool" in preset_ids
        assert "epex_30" in preset_ids

        assert data["default_preset"] == "epex_60"
        assert data["default_cutoff_time"] == "09:20"
        assert data["default_date_range"]["start_date"] == "2026-01-01"
        assert data["default_date_range"]["end_date"] == "2026-01-31"


@pytest.mark.asyncio
async def test_get_forecasts_endpoint_default(mock_storage):
    app.dependency_overrides[get_storage] = lambda: mock_storage
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/forecasts?start_date=2026-01-01&end_date=2026-01-02")
            assert response.status_code == 200
            data = response.json()

            # Query check
            assert data["query"]["start_date"] == "2026-01-01"
            assert data["query"]["end_date"] == "2026-01-02"
            assert data["query"]["cutoff_time"] == "09:20"

            # Records check
            assert len(data["records"]) == 3
            # For 2026-01-01T00:00:00Z, cutoff 09:20 selects 09:00 forecast (11800), not 09:30
            r0 = data["records"][0]
            assert r0["start_time"] == "2026-01-01T00:00:00Z"
            assert r0["target_time"] == "2026-01-01T00:00:00Z"
            assert r0["actual_mw"] == 12000.0
            assert r0["forecast_mw"] == 11800.0
            assert r0["error_mw"] == 200.0
            assert r0["forecast_error_mw"] == 200.0
            assert r0["imbalance_type"] == "surplus"

            # Metrics check
            metrics = data["metrics"]
            assert metrics["total_periods"] == 3
            assert "mae_mw" in metrics
            assert "rmse_mw" in metrics
            assert "bias_mw" in metrics
            assert "cn_mae_percent" in metrics
            assert "risk_percentiles" in metrics
            assert "p10" in metrics["risk_percentiles"]

            # Top-level risk quantiles check
            assert "risk_quantiles" in data
            assert data["risk_quantiles"]["p50"] is not None

            # Diurnal profile check
            assert len(data["diurnal_profile"]) == 48
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_forecasts_with_nordpool_preset(mock_storage):
    app.dependency_overrides[get_storage] = lambda: mock_storage
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            # Nord Pool preset (09:50) allows the 09:30 snapshot
            response = await client.get(
                "/api/forecasts?start_date=2026-01-01&end_date=2026-01-01&preset=nordpool"
            )
            assert response.status_code == 200
            data = response.json()

            assert data["query"]["preset"] == "nordpool"
            assert data["query"]["cutoff_time"] == "09:50"

            r0 = data["records"][0]
            assert r0["publish_time"] == "2025-12-31T09:30:00Z"
            assert r0["forecast_mw"] == 12200.0
            assert r0["forecast_error_mw"] == -200.0
            assert r0["imbalance_type"] == "deficit"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_forecasts_invalid_date_range(mock_storage):
    app.dependency_overrides[get_storage] = lambda: mock_storage
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            # start_date after end_date
            response = await client.get(
                "/api/forecasts?start_date=2026-01-10&end_date=2026-01-05"
            )
            assert response.status_code == 400

            # invalid date format
            res_bad_date = await client.get(
                "/api/forecasts?start_date=invalid-date"
            )
            assert res_bad_date.status_code == 400

            # invalid cutoff format
            res_bad_cutoff = await client.get(
                "/api/forecasts?cutoff_time=99:99"
            )
            assert res_bad_cutoff.status_code == 400
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_real_january_2026_database():
    """Verify integration against the actual seeded data/elexon_cache.db if present."""
    from app.api.dependencies import get_default_db_path
    db_path = get_default_db_path()
    if not db_path.exists():
        pytest.skip("data/elexon_cache.db not found, skipping real db test")

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get(
            "/api/forecasts?start_date=2026-01-01&end_date=2026-01-31&preset=epex_60"
        )
        assert response.status_code == 200
        data = response.json()

        # Full January 2026 has 31 days * 48 periods = 1488 periods
        assert len(data["records"]) == 1488
        assert data["metrics"]["total_periods"] == 1488
        assert data["metrics"]["peak_capacity_mw"] == 17805.0
        assert data["metrics"]["mae_mw"] > 0.0
        assert data["metrics"]["rmse_mw"] > data["metrics"]["mae_mw"]
        assert data["metrics"]["cn_mae_percent"] > 0.0

        # Risk percentiles order
        rp = data["metrics"]["risk_percentiles"]
        assert rp["p10"] <= rp["p50"] <= rp["p90"]

        # Diurnal profile has all 48 settlement periods with 31 days each
        assert len(data["diurnal_profile"]) == 48
        for dp in data["diurnal_profile"]:
            assert dp["period_count"] == 31
            assert dp["avg_actual_mw"] > 0.0

