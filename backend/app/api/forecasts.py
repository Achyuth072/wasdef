from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.dependencies import get_storage
from app.db.storage import StorageEngine
from app.models.schemas import (
    AccuracyMetricsResponse,
    AlignedRecordResponse,
    DiurnalPeriodResponse,
    ForecastQueryParams,
    ForecastsResponse,
    RiskPercentilesResponse,
)
from app.services.alignment import AlignmentEngine, parse_and_validate_time
from app.services.metrics import MetricsCalculator
from app.services.presets import resolve_cutoff_time

router = APIRouter(prefix="/api", tags=["forecasts"])


def validate_date(date_str: str, param_name: str) -> date:
    try:
        return date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {param_name} format: '{date_str}'. Expected YYYY-MM-DD.",
        )


@router.get("/forecasts", response_model=ForecastsResponse)
async def get_forecasts(
    start_date: str = Query("2026-01-01", description="Start date (YYYY-MM-DD)"),
    end_date: str = Query("2026-01-31", description="End date (YYYY-MM-DD)"),
    cutoff_time: Optional[str] = Query(
        None, description="Custom Gate Closure cutoff time (HH:MM GMT)"
    ),
    preset: Optional[str] = Query(
        None, description="Market preset ID (e.g. epex_60, nordpool, epex_30)"
    ),
    storage: StorageEngine = Depends(get_storage),
) -> ForecastsResponse:
    d_start = validate_date(start_date, "start_date")
    d_end = validate_date(end_date, "end_date")

    if d_start > d_end:
        raise HTTPException(
            status_code=400,
            detail=f"start_date ({start_date}) must be less than or equal to end_date ({end_date}).",
        )

    active_cutoff = resolve_cutoff_time(preset_id=preset, custom_cutoff=cutoff_time)
    try:
        parse_and_validate_time(active_cutoff)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    alignment_engine = AlignmentEngine(storage=storage)
    aligned_periods = alignment_engine.align_from_storage(
        start_date=start_date,
        end_date=end_date,
        cutoff_time=active_cutoff,
    )

    metrics_calc = MetricsCalculator()
    metrics = metrics_calc.compute_metrics(aligned_periods)
    diurnal_profile = metrics_calc.compute_diurnal_profile(aligned_periods)

    record_responses = [
        AlignedRecordResponse(
            target_time=p.target_time,
            start_time=p.start_time,
            settlement_date=p.settlement_date,
            settlement_period=p.settlement_period,
            actual_mw=p.actual_mw,
            forecast_mw=p.forecast_mw,
            publish_time=p.publish_time,
            error_mw=p.forecast_error_mw,
            forecast_error_mw=p.forecast_error_mw,
            imbalance_type=p.imbalance_type,
        )
        for p in aligned_periods
    ]

    diurnal_responses = [
        DiurnalPeriodResponse(
            settlement_period=dp.settlement_period,
            period_count=dp.period_count,
            avg_actual_mw=dp.avg_actual_mw,
            avg_forecast_mw=dp.avg_forecast_mw,
            avg_error_mw=dp.avg_error_mw,
            mae_mw=dp.mae_mw,
            rmse_mw=dp.rmse_mw,
        )
        for dp in diurnal_profile
    ]

    risk_quantiles_response = RiskPercentilesResponse(
        p10=metrics.risk_percentiles.p10,
        p50=metrics.risk_percentiles.p50,
        p90=metrics.risk_percentiles.p90,
    )

    metrics_response = AccuracyMetricsResponse(
        mae_mw=metrics.mae_mw,
        rmse_mw=metrics.rmse_mw,
        bias_mw=metrics.bias_mw,
        cn_mae_percent=metrics.cn_mae_percent,
        peak_capacity_mw=metrics.peak_capacity_mw,
        total_periods=metrics.total_periods,
        deficit_periods=metrics.deficit_periods,
        surplus_periods=metrics.surplus_periods,
        balanced_periods=metrics.balanced_periods,
        total_deficit_mw=metrics.total_deficit_mw,
        total_deficit_mwh=metrics.total_deficit_mwh,
        risk_percentiles=risk_quantiles_response,
    )

    return ForecastsResponse(
        query=ForecastQueryParams(
            start_date=start_date,
            end_date=end_date,
            cutoff_time=active_cutoff,
            preset=preset,
        ),
        metrics=metrics_response,
        risk_quantiles=risk_quantiles_response,
        diurnal_profile=diurnal_responses,
        records=record_responses,
    )
