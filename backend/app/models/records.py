from dataclasses import dataclass


@dataclass(frozen=True)
class ActualRecord:
    start_time: str  # ISO 8601 UTC
    settlement_date: str  # YYYY-MM-DD
    settlement_period: int
    generation_mw: float


@dataclass(frozen=True)
class ForecastRecord:
    start_time: str  # ISO 8601 UTC
    publish_time: str  # ISO 8601 UTC
    generation_mw: float
