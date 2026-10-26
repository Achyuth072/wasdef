import math
import pytest
from app.models.schemas import ImbalancePosition
from app.services.alignment import AlignedPeriod
from app.services.metrics import (
    MetricsCalculator,
    compute_percentile,
    JANUARY_2026_PEAK_CAPACITY_MW,
)


def test_compute_percentile_known_values():
    # Symmetric 5-item array: [10, 20, 30, 40, 50]
    data = [10.0, 20.0, 30.0, 40.0, 50.0]
    assert compute_percentile(data, 50.0) == 30.0
    assert compute_percentile(data, 0.0) == 10.0
    assert compute_percentile(data, 100.0) == 50.0
    assert compute_percentile(data, 10.0) == 14.0
    assert compute_percentile(data, 90.0) == 46.0

    # Single item
    assert compute_percentile([42.0], 50.0) == 42.0
    # Empty
    assert compute_percentile([], 50.0) == 0.0


def test_metrics_calculator_known_numerical_dataset():
    """
    Dataset of 4 periods:
    1: Actual 100, Forecast 120 -> Error -20 (deficit 20)
    2: Actual 200, Forecast 190 -> Error +10 (surplus)
    3: Actual 300, Forecast 300 -> Error   0 (balanced)
    4: Actual 400, Forecast 450 -> Error -50 (deficit 50)

    Errors: [-20, 10, 0, -50]
    Abs Errors: [20, 10, 0, 50] -> sum = 80, MAE = 80 / 4 = 20.0
    Squared Errors: [400, 100, 0, 2500] -> sum = 3000, RMSE = sqrt(3000 / 4) = sqrt(750) ≈ 27.386 -> 27.39
    Bias = sum([-20, 10, 0, -50]) / 4 = -60 / 4 = -15.0
    Peak capacity override = 400.0 -> cnMAE % = 20.0 / 400.0 * 100 = 5.0%
    Deficit count: 2 (periods 1 and 4)
    Surplus count: 1 (period 2)
    Balanced count: 1 (period 3)
    Total Deficit MW: 70.0 MW
    Total Deficit MWh: 70.0 * 0.5 = 35.0 MWh
    """
    periods = [
        AlignedPeriod(
            start_time="2026-01-01T00:00:00Z",
            target_time="2026-01-01T00:00:00Z",
            settlement_date="2026-01-01",
            settlement_period=1,
            actual_mw=100.0,
            forecast_mw=120.0,
            publish_time="2025-12-31T09:00:00Z",
            forecast_error_mw=-20.0,
            imbalance_type=ImbalancePosition.DEFICIT,
        ),
        AlignedPeriod(
            start_time="2026-01-01T00:30:00Z",
            target_time="2026-01-01T00:30:00Z",
            settlement_date="2026-01-01",
            settlement_period=2,
            actual_mw=200.0,
            forecast_mw=190.0,
            publish_time="2025-12-31T09:00:00Z",
            forecast_error_mw=10.0,
            imbalance_type=ImbalancePosition.SURPLUS,
        ),
        AlignedPeriod(
            start_time="2026-01-01T01:00:00Z",
            target_time="2026-01-01T01:00:00Z",
            settlement_date="2026-01-01",
            settlement_period=3,
            actual_mw=300.0,
            forecast_mw=300.0,
            publish_time="2025-12-31T09:00:00Z",
            forecast_error_mw=0.0,
            imbalance_type=ImbalancePosition.BALANCED,
        ),
        AlignedPeriod(
            start_time="2026-01-01T01:30:00Z",
            target_time="2026-01-01T01:30:00Z",
            settlement_date="2026-01-01",
            settlement_period=4,
            actual_mw=400.0,
            forecast_mw=450.0,
            publish_time="2025-12-31T09:00:00Z",
            forecast_error_mw=-50.0,
            imbalance_type=ImbalancePosition.DEFICIT,
        ),
    ]

    calc = MetricsCalculator()
    metrics = calc.compute_metrics(periods, peak_capacity_override=400.0)

    assert metrics.mae_mw == 20.0
    assert metrics.rmse_mw == round(math.sqrt(750), 2)
    assert metrics.bias_mw == -15.0
    assert metrics.peak_capacity_mw == 400.0
    assert math.isclose(metrics.cn_mae_percent, 5.0, rel_tol=1e-4)
    assert metrics.total_periods == 4
    assert metrics.deficit_periods == 2
    assert metrics.surplus_periods == 1
    assert metrics.balanced_periods == 1
    assert metrics.total_deficit_mw == 70.0
    assert metrics.total_deficit_mwh == 35.0

    # Risk percentiles on sorted errors: [-50, -20, 0, 10]
    assert metrics.risk_percentiles.p50 == -10.0
    assert math.isclose(metrics.risk_percentiles.p10, -41.0, rel_tol=1e-4)
    assert math.isclose(metrics.risk_percentiles.p90, 7.0, rel_tol=1e-4)

    # Without override, default peak capacity uses JANUARY_2026_PEAK_CAPACITY_MW
    default_metrics = calc.compute_metrics(periods)
    assert default_metrics.peak_capacity_mw == JANUARY_2026_PEAK_CAPACITY_MW
    assert default_metrics.cn_mae_percent == round(20.0 / JANUARY_2026_PEAK_CAPACITY_MW * 100.0, 2)


def test_metrics_calculator_zero_division_resilience():
    calc = MetricsCalculator()

    # Empty list
    empty_metrics = calc.compute_metrics([])
    assert empty_metrics.mae_mw == 0.0
    assert empty_metrics.rmse_mw == 0.0
    assert empty_metrics.bias_mw == 0.0
    assert empty_metrics.cn_mae_percent == 0.0
    assert empty_metrics.total_periods == 0
    assert empty_metrics.peak_capacity_mw == 0.0

    # All zero generation
    zero_period = AlignedPeriod(
        start_time="2026-01-01T00:00:00Z",
        target_time="2026-01-01T00:00:00Z",
        settlement_date="2026-01-01",
        settlement_period=1,
        actual_mw=0.0,
        forecast_mw=0.0,
        publish_time="2025-12-31T09:00:00Z",
        forecast_error_mw=0.0,
        imbalance_type=ImbalancePosition.BALANCED,
    )
    zero_metrics = calc.compute_metrics([zero_period], peak_capacity_override=0.0)
    assert zero_metrics.cn_mae_percent == 0.0


def test_metrics_diurnal_profile_generation():
    """Verify grouping across 48 Settlement Periods."""
    periods = [
        AlignedPeriod(
            start_time="2026-01-01T00:00:00Z",
            target_time="2026-01-01T00:00:00Z",
            settlement_date="2026-01-01",
            settlement_period=1,
            actual_mw=100.0,
            forecast_mw=150.0,
            publish_time="2025-12-31T09:00:00Z",
            forecast_error_mw=-50.0,
            imbalance_type=ImbalancePosition.DEFICIT,
        ),
        AlignedPeriod(
            start_time="2026-01-01T00:30:00Z",
            target_time="2026-01-01T00:30:00Z",
            settlement_date="2026-01-01",
            settlement_period=2,
            actual_mw=200.0,
            forecast_mw=180.0,
            publish_time="2025-12-31T09:00:00Z",
            forecast_error_mw=20.0,
            imbalance_type=ImbalancePosition.SURPLUS,
        ),
        AlignedPeriod(
            start_time="2026-01-02T00:00:00Z",
            target_time="2026-01-02T00:00:00Z",
            settlement_date="2026-01-02",
            settlement_period=1,
            actual_mw=120.0,
            forecast_mw=140.0,
            publish_time="2026-01-01T09:00:00Z",
            forecast_error_mw=-20.0,
            imbalance_type=ImbalancePosition.DEFICIT,
        ),
        AlignedPeriod(
            start_time="2026-01-02T00:30:00Z",
            target_time="2026-01-02T00:30:00Z",
            settlement_date="2026-01-02",
            settlement_period=2,
            actual_mw=220.0,
            forecast_mw=210.0,
            publish_time="2026-01-01T09:00:00Z",
            forecast_error_mw=10.0,
            imbalance_type=ImbalancePosition.SURPLUS,
        ),
    ]

    calc = MetricsCalculator()
    diurnal = calc.compute_diurnal_profile(periods)

    assert len(diurnal) == 48

    sp1 = next(p for p in diurnal if p.settlement_period == 1)
    assert sp1.period_count == 2
    assert sp1.avg_actual_mw == 110.0
    assert sp1.avg_forecast_mw == 145.0
    assert sp1.avg_error_mw == -35.0
    assert sp1.mae_mw == 35.0
    assert math.isclose(sp1.rmse_mw, math.sqrt(1450), rel_tol=1e-3)

    sp2 = next(p for p in diurnal if p.settlement_period == 2)
    assert sp2.period_count == 2
    assert sp2.avg_actual_mw == 210.0
    assert sp2.avg_forecast_mw == 195.0
    assert sp2.avg_error_mw == 15.0
    assert sp2.mae_mw == 15.0

    sp3 = next(p for p in diurnal if p.settlement_period == 3)
    assert sp3.period_count == 0
    assert sp3.avg_actual_mw == 0.0
    assert sp3.avg_forecast_mw == 0.0
    assert sp3.mae_mw == 0.0
