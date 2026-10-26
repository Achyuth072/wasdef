import pytest
from app.models.records import ActualRecord, ForecastRecord
from app.models.schemas import ImbalancePosition
from app.services.presets import PRESETS, resolve_cutoff_time
from app.services.alignment import AlignmentEngine, parse_and_validate_time


def test_presets_configuration():
    assert "epex_60" in PRESETS
    assert "nordpool" in PRESETS
    assert "epex_30" in PRESETS

    assert PRESETS["epex_60"].cutoff_time == "09:20"
    assert PRESETS["nordpool"].cutoff_time == "09:50"
    assert PRESETS["epex_30"].cutoff_time == "14:30"
    assert PRESETS["epex_60"].name == "EPEX Day-Ahead 60m"

    assert resolve_cutoff_time(preset_id="nordpool") == "09:50"
    assert resolve_cutoff_time(preset_id="epex_60", custom_cutoff="11:00") == "11:00"
    assert resolve_cutoff_time(custom_cutoff="12:30") == "12:30"
    assert resolve_cutoff_time() == "09:20"


def test_parse_and_validate_time():
    assert parse_and_validate_time("09:20") == "09:20:00"
    assert parse_and_validate_time("14:30:15") == "14:30:15"
    with pytest.raises(ValueError):
        parse_and_validate_time("25:00")
    with pytest.raises(ValueError):
        parse_and_validate_time("bad-time")


def test_alignment_selects_latest_forecast_before_cutoff():
    """
    For Delivery Day 2026-01-02 SP 1 (start 2026-01-02T00:00:00Z):
    Cutoff is on 2026-01-01 at 09:20 GMT (2026-01-01T09:20:00Z).
    Forecasts published at:
    - 2026-01-01T06:00:00Z (valid, 1000 MW)
    - 2026-01-01T09:00:00Z (valid, latest <= 09:20, 1200 MW)
    - 2026-01-01T09:30:00Z (invalid, after 09:20 cutoff, 1500 MW)
    - 2026-01-02T02:00:00Z (invalid, intraday on delivery day, 1800 MW)
    """
    actuals = [
        ActualRecord(
            start_time="2026-01-02T00:00:00Z",
            settlement_date="2026-01-02",
            settlement_period=1,
            generation_mw=1100.0,
        )
    ]
    forecasts = [
        ForecastRecord(
            start_time="2026-01-02T00:00:00Z",
            publish_time="2026-01-01T06:00:00Z",
            generation_mw=1000.0,
        ),
        ForecastRecord(
            start_time="2026-01-02T00:00:00Z",
            publish_time="2026-01-01T09:00:00Z",
            generation_mw=1200.0,
        ),
        ForecastRecord(
            start_time="2026-01-02T00:00:00Z",
            publish_time="2026-01-01T09:30:00Z",
            generation_mw=1500.0,
        ),
        ForecastRecord(
            start_time="2026-01-02T00:00:00Z",
            publish_time="2026-01-02T02:00:00Z",
            generation_mw=1800.0,
        ),
    ]

    engine = AlignmentEngine()
    aligned = engine.align_records(actuals, forecasts, cutoff_time="09:20")

    assert len(aligned) == 1
    period = aligned[0]
    assert period.start_time == "2026-01-02T00:00:00Z"
    assert period.target_time == "2026-01-02T00:00:00Z"
    assert period.settlement_date == "2026-01-02"
    assert period.settlement_period == 1
    assert period.actual_mw == 1100.0
    assert period.forecast_mw == 1200.0
    assert period.publish_time == "2026-01-01T09:00:00Z"
    # Signed error: Actual - Forecast = 1100 - 1200 = -100 (deficit)
    assert period.forecast_error_mw == -100.0
    assert period.imbalance_type == ImbalancePosition.DEFICIT


def test_alignment_preset_change_changes_selected_snapshot():
    """
    With EPEX 09:20: selects 09:00 snapshot.
    With Nord Pool 09:50: selects 09:30 snapshot.
    """
    actuals = [
        ActualRecord(
            start_time="2026-01-02T00:00:00Z",
            settlement_date="2026-01-02",
            settlement_period=1,
            generation_mw=1400.0,
        )
    ]
    forecasts = [
        ForecastRecord(
            start_time="2026-01-02T00:00:00Z",
            publish_time="2026-01-01T09:00:00Z",
            generation_mw=1200.0,
        ),
        ForecastRecord(
            start_time="2026-01-02T00:00:00Z",
            publish_time="2026-01-01T09:30:00Z",
            generation_mw=1350.0,
        ),
    ]

    engine = AlignmentEngine()

    epex_aligned = engine.align_records(actuals, forecasts, cutoff_time="09:20")
    assert epex_aligned[0].forecast_mw == 1200.0
    assert epex_aligned[0].publish_time == "2026-01-01T09:00:00Z"
    assert epex_aligned[0].forecast_error_mw == 200.0  # 1400 - 1200 (surplus)
    assert epex_aligned[0].imbalance_type == ImbalancePosition.SURPLUS

    nordpool_aligned = engine.align_records(actuals, forecasts, cutoff_time="09:50")
    assert nordpool_aligned[0].forecast_mw == 1350.0
    assert nordpool_aligned[0].publish_time == "2026-01-01T09:30:00Z"
    assert nordpool_aligned[0].forecast_error_mw == 50.0  # 1400 - 1350 (surplus)


def test_alignment_multi_day_date_boundaries():
    """
    Checks that day D1 cutoff is on D1-1, and day D2 cutoff is on D2-1.
    """
    actuals = [
        ActualRecord(
            start_time="2026-01-02T12:00:00Z",
            settlement_date="2026-01-02",
            settlement_period=25,
            generation_mw=5000.0,
        ),
        ActualRecord(
            start_time="2026-01-03T12:00:00Z",
            settlement_date="2026-01-03",
            settlement_period=25,
            generation_mw=6000.0,
        ),
    ]
    forecasts = [
        # For Day 2 (cutoff 2026-01-01 09:20)
        ForecastRecord(
            start_time="2026-01-02T12:00:00Z",
            publish_time="2026-01-01T08:00:00Z",
            generation_mw=4800.0,
        ),
        # For Day 3 (cutoff 2026-01-02 09:20)
        ForecastRecord(
            start_time="2026-01-03T12:00:00Z",
            publish_time="2026-01-02T08:30:00Z",
            generation_mw=5900.0,
        ),
    ]

    engine = AlignmentEngine()
    aligned = engine.align_records(actuals, forecasts, cutoff_time="09:20")
    assert len(aligned) == 2
    assert aligned[0].forecast_mw == 4800.0
    assert aligned[1].forecast_mw == 5900.0


def test_alignment_handles_missing_forecasts_cleanly():
    """If no forecast exists prior to cutoff, forecast_mw is None or period is marked unaligned."""
    actuals = [
        ActualRecord(
            start_time="2026-01-02T00:00:00Z",
            settlement_date="2026-01-02",
            settlement_period=1,
            generation_mw=2000.0,
        )
    ]
    forecasts = [
        # Published after cutoff
        ForecastRecord(
            start_time="2026-01-02T00:00:00Z",
            publish_time="2026-01-01T10:00:00Z",
            generation_mw=1900.0,
        )
    ]

    engine = AlignmentEngine()
    aligned = engine.align_records(actuals, forecasts, cutoff_time="09:20")
    assert len(aligned) == 1
    assert aligned[0].forecast_mw is None
    assert aligned[0].publish_time is None
    assert aligned[0].forecast_error_mw is None
    assert aligned[0].imbalance_type == ImbalancePosition.UNKNOWN
