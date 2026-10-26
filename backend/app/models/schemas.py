from enum import Enum
from typing import Optional
from pydantic import BaseModel


class ImbalancePosition(str, Enum):
    DEFICIT = "deficit"
    SURPLUS = "surplus"
    BALANCED = "balanced"
    UNKNOWN = "unknown"


class PresetItem(BaseModel):
    id: str
    name: str
    cutoff_time: str
    description: str


class DateRange(BaseModel):
    start_date: str
    end_date: str


class PresetsResponse(BaseModel):
    presets: list[PresetItem]
    default_preset: str
    default_cutoff_time: str
    default_date_range: DateRange


class RiskPercentilesResponse(BaseModel):
    p10: float
    p50: float
    p90: float


class AccuracyMetricsResponse(BaseModel):
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
    risk_percentiles: RiskPercentilesResponse


class DiurnalPeriodResponse(BaseModel):
    settlement_period: int
    period_count: int
    avg_actual_mw: float
    avg_forecast_mw: float
    avg_error_mw: float
    mae_mw: float
    rmse_mw: float


class AlignedRecordResponse(BaseModel):
    target_time: str
    start_time: str
    settlement_date: str
    settlement_period: int
    actual_mw: float
    forecast_mw: Optional[float]
    publish_time: Optional[str]
    error_mw: Optional[float]
    forecast_error_mw: Optional[float]
    imbalance_type: ImbalancePosition


class ForecastQueryParams(BaseModel):
    start_date: str
    end_date: str
    cutoff_time: str
    preset: Optional[str] = None


class ForecastsResponse(BaseModel):
    query: ForecastQueryParams
    metrics: AccuracyMetricsResponse
    risk_quantiles: RiskPercentilesResponse
    diurnal_profile: list[DiurnalPeriodResponse]
    records: list[AlignedRecordResponse]
