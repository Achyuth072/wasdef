from fastapi import APIRouter
from app.models.schemas import PresetsResponse, PresetItem, DateRange
from app.services.presets import PRESETS, DEFAULT_PRESET_ID, DEFAULT_CUTOFF_TIME

router = APIRouter(prefix="/api/config", tags=["config"])


@router.get("/presets", response_model=PresetsResponse)
async def get_presets() -> PresetsResponse:
    preset_items = [
        PresetItem(
            id=p.id,
            name=p.name,
            cutoff_time=p.cutoff_time,
            description=p.description,
        )
        for p in PRESETS.values()
    ]

    return PresetsResponse(
        presets=preset_items,
        default_preset=DEFAULT_PRESET_ID,
        default_cutoff_time=DEFAULT_CUTOFF_TIME,
        default_date_range=DateRange(
            start_date="2026-01-01",
            end_date="2026-01-31",
        ),
    )
