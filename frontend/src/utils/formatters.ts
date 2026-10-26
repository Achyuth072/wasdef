export function formatTimelineLabel(targetTime: string, settlementPeriod: number): string {
  try {
    const d = new Date(targetTime)
    const m = (d.getUTCMonth() + 1).toString().padStart(2, '0')
    const day = d.getUTCDate().toString().padStart(2, '0')
    const hh = d.getUTCHours().toString().padStart(2, '0')
    const mm = d.getUTCMinutes().toString().padStart(2, '0')
    return `${m}/${day} ${hh}:${mm}`
  } catch {
    return `SP ${settlementPeriod}`
  }
}

export function formatMw(val: number | null | undefined, fractionDigits: number = 1): string {
  if (val == null) return '—'
  return val.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

export function formatUtcIso(isoString: string | null | undefined): string {
  if (!isoString) return '—'
  return isoString.replace('T', ' ').replace('Z', '')
}
