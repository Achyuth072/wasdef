import { describe, it, expect } from 'vitest'
import { generateCsvContent } from '../utils/csvExport'
import type { AlignedRecord } from '../types/api'

describe('CSV export', () => {
  it('generates proper CSV content with header and rows', () => {
    const records: AlignedRecord[] = [
      {
        target_time: '2026-01-01T00:00:00Z',
        start_time: '2026-01-01T00:00:00Z',
        settlement_date: '2026-01-01',
        settlement_period: 1,
        actual_mw: 14500,
        forecast_mw: 15200,
        publish_time: '2025-12-31T08:00:00Z',
        error_mw: -700,
        forecast_error_mw: -700,
        imbalance_type: 'deficit',
      },
    ]

    const csv = generateCsvContent(records)
    const lines = csv.split('\r\n')
    expect(lines.length).toBe(2)
    expect(lines[0]).toContain('Target Time (UTC)')
    expect(lines[0]).toContain('Forecast Error (MW)')
    expect(lines[0]).toContain('Imbalance Position')
    expect(lines[1]).toContain('2026-01-01T00:00:00Z,2026-01-01,1,14500.0,15200.0,-700.0,DEFICIT')
  })
})
