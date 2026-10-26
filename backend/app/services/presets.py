from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class GateClosurePreset:
    id: str
    name: str
    cutoff_time: str  # "HH:MM" GMT/UTC
    description: str


PRESETS: dict[str, GateClosurePreset] = {
    "epex_60": GateClosurePreset(
        id="epex_60",
        name="EPEX Day-Ahead 60m",
        cutoff_time="09:20",
        description="EPEX SPOT UK Day-Ahead hourly auction gate closure (09:20 GMT on D-1)",
    ),
    "nordpool": GateClosurePreset(
        id="nordpool",
        name="Nord Pool N2EX",
        cutoff_time="09:50",
        description="Nord Pool Day-Ahead auction gate closure (09:50 GMT on D-1)",
    ),
    "epex_30": GateClosurePreset(
        id="epex_30",
        name="EPEX Day-Ahead 30m",
        cutoff_time="14:30",
        description="EPEX SPOT UK Day-Ahead half-hourly auction gate closure (14:30 GMT on D-1)",
    ),
}

DEFAULT_PRESET_ID = "epex_60"
DEFAULT_CUTOFF_TIME = "09:20"


def resolve_cutoff_time(
    preset_id: Optional[str] = None, custom_cutoff: Optional[str] = None
) -> str:
    """
    Resolve the operational Gate Closure cutoff time (HH:MM string).
    If custom_cutoff is given, it takes priority.
    Else if preset_id is valid, use its cutoff.
    Otherwise default to DEFAULT_CUTOFF_TIME.
    """
    if custom_cutoff:
        return custom_cutoff.strip()
    if preset_id and preset_id in PRESETS:
        return PRESETS[preset_id].cutoff_time
    return DEFAULT_CUTOFF_TIME
