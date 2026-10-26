import type { ForecastsResponse, PresetsResponse } from '../types/api'

export async function fetchHealth(): Promise<{ status: string; service: string }> {
  const res = await fetch('/api/health')
  if (!res.ok) {
    throw new Error(`Health check failed with status: ${res.status}`)
  }
  return res.json()
}

export async function fetchPresets(): Promise<PresetsResponse> {
  const res = await fetch('/api/config/presets')
  if (!res.ok) {
    throw new Error(`Failed to load presets: ${res.statusText}`)
  }
  return res.json()
}

export interface FetchForecastParams {
  startDate: string
  endDate: string
  cutoffTime?: string
  preset?: string
}

export async function fetchForecasts(params: FetchForecastParams): Promise<ForecastsResponse> {
  const searchParams = new URLSearchParams()
  searchParams.set('start_date', params.startDate)
  searchParams.set('end_date', params.endDate)

  if (params.preset) {
    searchParams.set('preset', params.preset)
  }
  if (params.cutoffTime) {
    searchParams.set('cutoff_time', params.cutoffTime)
  }

  const res = await fetch(`/api/forecasts?${searchParams.toString()}`)
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}))
    throw new Error(errorBody.detail || `Forecast request failed: ${res.statusText}`)
  }
  return res.json()
}
