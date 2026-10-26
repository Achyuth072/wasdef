from dataclasses import dataclass
import math
from typing import Optional

from app.services.alignment import AlignedPeriod

# Peak national wind generation recorded during January 2026 Elexon settlement periods
JANUARY_2026_PEAK_CAPACITY_MW: float = 17805.0


@dataclass(frozen=True)
class RiskPercentiles:
    p10: float
    p50: float
    p90: float


@dataclass(frozen=True)
class AccuracyMetrics:
    mae_mw: float
    rmse_mw: float
    bias_mw: float
    cn_mae_percent: float
    peak_capacity_mw: float
    total_periods: int
    deficit_periods: int
    surplus_periods: int
    balanced_periods: int
    total_deficit_mw: float
    total_deficit_mwh: float
    risk_percentiles: RiskPercentiles


@dataclass(frozen=True)
class DiurnalPeriodMetric:
    settlement_period: int
    period_count: int
    avg_actual_mw: float
    avg_forecast_mw: float
    avg_error_mw: float
    mae_mw: float
    rmse_mw: float


def compute_percentile(data: list[float], percentile: float) -> float:
    """Compute percentile using linear interpolation (standard numpy method)."""
    if not data:
        return 0.0
    sorted_data = sorted(data)
    n = len(sorted_data)
    if n == 1:
        return sorted_data[0]

    # Rank bounded in [0, n - 1]
    rank = max(0.0, min(100.0, percentile)) / 100.0 * (n - 1)
    lower = int(rank)
    upper = min(lower + 1, n - 1)
    weight = rank - lower
    return round(sorted_data[lower] * (1.0 - weight) + sorted_data[upper] * weight, 2)


class MetricsCalculator:
    """Calculator for quantitative wind forecast accuracy, risk percentiles, and diurnal error."""

    def __init__(self, default_peak_capacity: float = JANUARY_2026_PEAK_CAPACITY_MW):
        self.default_peak_capacity = default_peak_capacity

    def compute_metrics(
        self,
        periods: list[AlignedPeriod],
        peak_capacity_override: Optional[float] = None,
    ) -> AccuracyMetrics:
        # Filter for periods that have both actual and forecast
        valid_periods = [
            p
            for p in periods
            if p.forecast_error_mw is not None and p.forecast_mw is not None
        ]

        if not valid_periods:
            return AccuracyMetrics(
                mae_mw=0.0,
                rmse_mw=0.0,
                bias_mw=0.0,
                cn_mae_percent=0.0,
                peak_capacity_mw=0.0,
                total_periods=0,
                deficit_periods=0,
                surplus_periods=0,
                balanced_periods=0,
                total_deficit_mw=0.0,
                total_deficit_mwh=0.0,
                risk_percentiles=RiskPercentiles(p10=0.0, p50=0.0, p90=0.0),
            )

        n = len(valid_periods)
        errors = [p.forecast_error_mw for p in valid_periods if p.forecast_error_mw is not None]
        abs_errors = [abs(e) for e in errors]
        squared_errors = [e**2 for e in errors]

        mae = sum(abs_errors) / n
        rmse = math.sqrt(sum(squared_errors) / n)
        bias = sum(errors) / n

        # Baseline peak capacity: explicit override, or January 2026 benchmark
        if peak_capacity_override is not None:
            peak_capacity = peak_capacity_override
        else:
            max_observed = max(p.actual_mw for p in valid_periods)
            peak_capacity = max(self.default_peak_capacity, max_observed)

        # Capacity-normalized MAE (cnMAE % = MAE / Peak Capacity * 100)
        cn_mae_pct = (mae / peak_capacity * 100.0) if peak_capacity > 0 else 0.0

        deficit_periods = sum(1 for e in errors if e < 0)
        surplus_periods = sum(1 for e in errors if e > 0)
        balanced_periods = sum(1 for e in errors if e == 0)

        # Total Deficit volume (sum of absolute shortfalls where Actual < Forecast)
        total_deficit_mw = sum(abs(e) for e in errors if e < 0)
        # Each settlement period is 30 minutes = 0.5 hours
        total_deficit_mwh = total_deficit_mw * 0.5

        p10 = compute_percentile(errors, 10.0)
        p50 = compute_percentile(errors, 50.0)
        p90 = compute_percentile(errors, 90.0)

        return AccuracyMetrics(
            mae_mw=round(mae, 2),
            rmse_mw=round(rmse, 2),
            bias_mw=round(bias, 2),
            cn_mae_percent=round(cn_mae_pct, 2),
            peak_capacity_mw=round(peak_capacity, 2),
            total_periods=n,
            deficit_periods=deficit_periods,
            surplus_periods=surplus_periods,
            balanced_periods=balanced_periods,
            total_deficit_mw=round(total_deficit_mw, 2),
            total_deficit_mwh=round(total_deficit_mwh, 2),
            risk_percentiles=RiskPercentiles(p10=p10, p50=p50, p90=p90),
        )

    def compute_diurnal_profile(
        self, periods: list[AlignedPeriod]
    ) -> list[DiurnalPeriodMetric]:
        """Compute 48-period diurnal accuracy profile grouped by Settlement Period (1 to 48)."""
        sp_groups: dict[int, list[AlignedPeriod]] = {sp: [] for sp in range(1, 49)}

        for p in periods:
            if 1 <= p.settlement_period <= 48:
                sp_groups[p.settlement_period].append(p)

        diurnal_metrics: list[DiurnalPeriodMetric] = []

        for sp in range(1, 49):
            group = sp_groups[sp]
            valid = [
                p
                for p in group
                if p.forecast_error_mw is not None and p.forecast_mw is not None
            ]

            if not valid:
                diurnal_metrics.append(
                    DiurnalPeriodMetric(
                        settlement_period=sp,
                        period_count=0,
                        avg_actual_mw=0.0,
                        avg_forecast_mw=0.0,
                        avg_error_mw=0.0,
                        mae_mw=0.0,
                        rmse_mw=0.0,
                    )
                )
            else:
                period_count = len(valid)
                avg_act = sum(p.actual_mw for p in valid) / period_count
                avg_fc = (
                    sum(p.forecast_mw for p in valid if p.forecast_mw is not None)
                    / period_count
                )
                errors = [
                    p.forecast_error_mw
                    for p in valid
                    if p.forecast_error_mw is not None
                ]
                avg_err = sum(errors) / period_count
                mae = sum(abs(e) for e in errors) / period_count
                rmse = math.sqrt(sum(e**2 for e in errors) / period_count)

                diurnal_metrics.append(
                    DiurnalPeriodMetric(
                        settlement_period=sp,
                        period_count=period_count,
                        avg_actual_mw=round(avg_act, 2),
                        avg_forecast_mw=round(avg_fc, 2),
                        avg_error_mw=round(avg_err, 2),
                        mae_mw=round(mae, 2),
                        rmse_mw=round(rmse, 2),
                    )
                )

        return diurnal_metrics
