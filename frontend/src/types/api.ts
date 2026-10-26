export type ImbalancePosition = 'deficit' | 'surplus' | 'balanced' | 'unknown'

export interface PresetItem {
  id: string
  name: string
  cutoff_time: string
  description: string
}

export interface DateRange {
  start_date: string
  end_date: string
}

export interface PresetsResponse {
  presets: PresetItem[]
  default_preset: string
  default_cutoff_time: string
  default_date_range: DateRange
}

export interface RiskPercentiles {
  p10: number
  p50: number
  p90: number
}

export interface AccuracyMetrics {
  mae_mw: number
  rmse_mw: number
  bias_mw: number
  cn_mae_percent: number
  peak_capacity_mw: number
  total_periods: number
  deficit_periods: number
  surplus_periods: number
  balanced_periods: number
  total_deficit_mw: number
  total_deficit_mwh: number
  risk_percentiles: RiskPercentiles
}

export interface DiurnalPeriod {
  settlement_period: number
  period_count: number
  avg_actual_mw: number
  avg_forecast_mw: number
  avg_error_mw: number
  mae_mw: number
  rmse_mw: number
}

export interface AlignedRecord {
  target_time: string
  start_time: string
  settlement_date: string
  settlement_period: number
  actual_mw: number
  forecast_mw: number | null
  publish_time: string | null
  error_mw: number | null
  forecast_error_mw: number | null
  imbalance_type: ImbalancePosition
}

export interface ForecastQueryParams {
  start_date: string
  end_date: string
  cutoff_time: string
  preset?: string | null
}

export interface ForecastsResponse {
  query: ForecastQueryParams
  metrics: AccuracyMetrics
  risk_quantiles: RiskPercentiles
  diurnal_profile: DiurnalPeriod[]
  records: AlignedRecord[]
}
