from typing import Any, Optional
import httpx

from app.models.records import ActualRecord, ForecastRecord

BMRS_BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"


def parse_fuelhh_wind_records(items: list[dict[str, Any]]) -> list[ActualRecord]:
    """Parse raw FUELHH stream payload and extract WIND actual generation records."""
    records: list[ActualRecord] = []
    for item in items:
        # Filter strictly for wind generation
        if item.get("fuelType", "").upper() != "WIND":
            continue

        start_time = item.get("startTime")
        gen = item.get("generation")
        if start_time is None or gen is None:
            continue

        records.append(
            ActualRecord(
                start_time=str(start_time),
                settlement_date=str(item.get("settlementDate") or ""),
                settlement_period=int(item.get("settlementPeriod") or 0),
                generation_mw=float(gen),
            )
        )
    return records


def parse_windfor_records(items: list[dict[str, Any]]) -> list[ForecastRecord]:
    """Parse raw WINDFOR stream payload and extract forecast records."""
    records: list[ForecastRecord] = []
    for item in items:
        start_time = item.get("startTime")
        publish_time = item.get("publishTime")
        gen = item.get("generation")

        if start_time is None or publish_time is None or gen is None:
            continue

        records.append(
            ForecastRecord(
                start_time=str(start_time),
                publish_time=str(publish_time),
                generation_mw=float(gen),
            )
        )
    return records


class ElexonClient:
    """Async client for interacting with Elexon BMRS API streams."""

    def __init__(
        self,
        base_url: str = BMRS_BASE_URL,
        client: Optional[httpx.AsyncClient] = None,
        timeout: float = 60.0,
    ):
        self.base_url = base_url.rstrip("/")
        self._client = client
        self._timeout = timeout

    async def _fetch_stream(
        self, dataset: str, publish_from: str, publish_to: str
    ) -> list[dict[str, Any]]:
        """Fetch raw JSON stream from BMRS for a dataset and time window."""
        url = f"{self.base_url}/datasets/{dataset}/stream"
        params = {
            "publishDateTimeFrom": publish_from,
            "publishDateTimeTo": publish_to,
        }
        if self._client is not None:
            response = await self._client.get(url, params=params)
            response.raise_for_status()
            data: list[dict[str, Any]] = response.json()
            return data

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            return data

    async def fetch_fuelhh_stream(
        self,
        publish_from: str,
        publish_to: str,
    ) -> list[ActualRecord]:
        """Fetch FUELHH stream for a time range and parse wind records."""
        data = await self._fetch_stream("FUELHH", publish_from, publish_to)
        return parse_fuelhh_wind_records(data)

    async def fetch_windfor_stream(
        self,
        publish_from: str,
        publish_to: str,
    ) -> list[ForecastRecord]:
        """Fetch WINDFOR stream for a time range and parse forecast records."""
        data = await self._fetch_stream("WINDFOR", publish_from, publish_to)
        return parse_windfor_records(data)
