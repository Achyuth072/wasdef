import type { AlignedRecord } from '../types/api'

const CSV_HEADERS = [
  'Target Time (UTC)',
  'Settlement Date',
  'Settlement Period',
  'Actual Generation (MW)',
  'Day-Ahead Forecast (MW)',
  'Forecast Error (MW)',
  'Imbalance Position',
  'Publish Time (UTC)',
] as const

function escapeCsvField(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}

export function generateCsvContent(records: readonly AlignedRecord[]): string {
  const rows = records.map((r) => [
    escapeCsvField(r.target_time),
    escapeCsvField(r.settlement_date),
    r.settlement_period.toString(),
    r.actual_mw.toFixed(1),
    r.forecast_mw != null ? r.forecast_mw.toFixed(1) : '',
    r.error_mw != null ? r.error_mw.toFixed(1) : '',
    escapeCsvField(r.imbalance_type.toUpperCase()),
    escapeCsvField(r.publish_time ?? ''),
  ])

  const csvRows = [CSV_HEADERS.join(','), ...rows.map((row) => row.join(','))]
  return csvRows.join('\r\n')
}

export function downloadCsv(
  records: readonly AlignedRecord[],
  filename: string = 'wind_forecast_procurement_jan2026.csv',
): void {
  const csvData = generateCsvContent(records)
  const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
