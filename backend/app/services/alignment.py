from dataclasses import dataclass
from datetime import date, timedelta
from typing import Optional

from app.db.storage import StorageEngine
from app.models.records import ActualRecord, ForecastRecord
from app.models.schemas import ImbalancePosition


@dataclass(frozen=True)
class AlignedPeriod:
    start_time: str
    target_time: str
    settlement_date: str
    settlement_period: int
    actual_mw: float
    forecast_mw: Optional[float]
    publish_time: Optional[str]
    forecast_error_mw: Optional[float]
    imbalance_type: ImbalancePosition


def parse_and_validate_time(time_str: str) -> str:
    """
    Parse, validate, and normalize a time string (HH:MM or HH:MM:SS) to HH:MM:SS.
    Raises ValueError on invalid formats or range violations.
    """
    clean = time_str.strip()
    parts = clean.split(":")
    if len(parts) not in (2, 3):
        raise ValueError(f"Invalid time format: '{time_str}'. Expected HH:MM or HH:MM:SS.")

    hour = int(parts[0])
    minute = int(parts[1])
    sec = int(parts[2]) if len(parts) == 3 else 0

    if not (0 <= hour <= 23 and 0 <= minute <= 59 and 0 <= sec <= 59):
        raise ValueError(
            f"Invalid time value: '{time_str}'. Hours must be 0-23, minutes and seconds 0-59."
        )

    return f"{hour:02d}:{minute:02d}:{sec:02d}"


def normalize_cutoff_time(cutoff_time: str) -> str:
    """Normalize cutoff time string to HH:MM:SS, falling back safely on parse failure."""
    try:
        return parse_and_validate_time(cutoff_time)
    except ValueError:
        return cutoff_time.strip()


class AlignmentEngine:
    """
    Engine to match settlement periods with the latest day-ahead forecast snapshot
    published on or before the auction Gate Closure cutoff on D-1.
    """

    def __init__(self, storage: Optional[StorageEngine] = None):
        self.storage = storage

    def align_records(
        self,
        actuals: list[ActualRecord],
        forecasts: list[ForecastRecord],
        cutoff_time: str,
    ) -> list[AlignedPeriod]:
        """Align in-memory actual and forecast records using Gate Closure cutoff on D-1."""
        # Index forecasts by start_time
        forecasts_by_start: dict[str, list[ForecastRecord]] = {}
        for f in forecasts:
            forecasts_by_start.setdefault(f.start_time, []).append(f)

        norm_cutoff = normalize_cutoff_time(cutoff_time)
        aligned: list[AlignedPeriod] = []

        for act in actuals:
            delivery_date = date.fromisoformat(act.settlement_date)
            d_minus_1 = delivery_date - timedelta(days=1)
            cutoff_timestamp = f"{d_minus_1.isoformat()}T{norm_cutoff}Z"

            # Look for exact start_time forecasts first
            matching_forecasts = forecasts_by_start.get(act.start_time, [])

            # UK BMRS WINDFOR forecasts are published at hourly intervals (e.g. 00:00, 01:00),
            # covering the full hour. Each 1-hour window contains two 30-minute Settlement Periods:
            # SP 2H-1 (:00) and SP 2H (:30). If no distinct :30: forecast exists, fall back to
            # the forecast published for the start of that operational hour (:00:).
            if not matching_forecasts and ":30:" in act.start_time:
                hour_start = act.start_time.replace(":30:", ":00:")
                matching_forecasts = forecasts_by_start.get(hour_start, [])

            candidates = [
                fc
                for fc in matching_forecasts
                if fc.publish_time <= cutoff_timestamp
            ]

            if candidates:
                # Select the latest snapshot published on or before cutoff
                best = max(candidates, key=lambda fc: fc.publish_time)
                fc_mw = best.generation_mw
                pub_time = best.publish_time
                error_mw = round(act.generation_mw - fc_mw, 2)
                if error_mw < 0:
                    imbalance = ImbalancePosition.DEFICIT
                elif error_mw > 0:
                    imbalance = ImbalancePosition.SURPLUS
                else:
                    imbalance = ImbalancePosition.BALANCED
            else:
                fc_mw = None
                pub_time = None
                error_mw = None
                imbalance = ImbalancePosition.UNKNOWN

            aligned.append(
                AlignedPeriod(
                    start_time=act.start_time,
                    target_time=act.start_time,
                    settlement_date=act.settlement_date,
                    settlement_period=act.settlement_period,
                    actual_mw=act.generation_mw,
                    forecast_mw=fc_mw,
                    publish_time=pub_time,
                    forecast_error_mw=error_mw,
                    imbalance_type=imbalance,
                )
            )

        aligned.sort(key=lambda p: p.start_time)
        return aligned

    def align_from_storage(
        self,
        start_date: str,
        end_date: str,
        cutoff_time: str,
    ) -> list[AlignedPeriod]:
        """Query storage and align records for the specified settlement date range."""
        if self.storage is None:
            raise RuntimeError("StorageEngine instance required for align_from_storage")

        t_from = f"{start_date}T00:00:00Z"
        t_to = f"{end_date}T23:59:59Z"

        actuals = self.storage.get_actuals(start_time_from=t_from, start_time_to=t_to)
        actuals = [
            a
            for a in actuals
            if start_date <= a.settlement_date <= end_date
        ]

        forecasts = self.storage.get_forecasts(start_time_from=t_from, start_time_to=t_to)

        return self.align_records(actuals, forecasts, cutoff_time)
