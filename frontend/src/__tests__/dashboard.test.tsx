import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { KpiCards } from '../components/KpiCards'
import { ControlBar } from '../components/ControlBar'
import { DataTable } from '../components/DataTable'
import { Header } from '../components/Header'
import type { AccuracyMetrics, AlignedRecord, PresetItem } from '../types/api'

const mockMetrics: AccuracyMetrics = {
  mae_mw: 2450.5,
  rmse_mw: 3120.8,
  bias_mw: -850.2,
  cn_mae_percent: 14.85,
  peak_capacity_mw: 16500.0,
  total_periods: 48,
  deficit_periods: 32,
  surplus_periods: 16,
  balanced_periods: 0,
  total_deficit_mw: 78400.0,
  total_deficit_mwh: 39200.0,
  risk_percentiles: {
    p10: -3200.0,
    p50: -750.0,
    p90: 1400.0,
  },
}

const mockPresets: PresetItem[] = [
  {
    id: 'epex_60',
    name: 'EPEX Day-Ahead 60m',
    cutoff_time: '09:20',
    description: 'EPEX SPOT UK Day-Ahead hourly auction gate closure',
  },
  {
    id: 'nordpool',
    name: 'Nord Pool N2EX',
    cutoff_time: '09:50',
    description: 'Nord Pool Day-Ahead auction gate closure',
  },
]

const mockRecords: AlignedRecord[] = [
  {
    target_time: '2026-01-01T00:00:00Z',
    start_time: '2026-01-01T00:00:00Z',
    settlement_date: '2026-01-01',
    settlement_period: 1,
    actual_mw: 12400.0,
    forecast_mw: 14000.0,
    publish_time: '2025-12-31T08:00:00Z',
    error_mw: -1600.0,
    forecast_error_mw: -1600.0,
    imbalance_type: 'deficit',
  },
  {
    target_time: '2026-01-01T00:30:00Z',
    start_time: '2026-01-01T00:30:00Z',
    settlement_date: '2026-01-01',
    settlement_period: 2,
    actual_mw: 13500.0,
    forecast_mw: 13000.0,
    publish_time: '2025-12-31T08:00:00Z',
    error_mw: 500.0,
    forecast_error_mw: 500.0,
    imbalance_type: 'surplus',
  },
]

function renderWithMantine(ui: React.ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>)
}

describe('Header component', () => {
  it('renders application title and badge info', () => {
    renderWithMantine(
      <Header healthStatus="healthy" totalRecords={1488} />
    )
    expect(screen.getByText(/GB Wind Forecast & Procurement Portal/i)).toBeInTheDocument()
    expect(screen.getByText(/1488 Settlement Periods/i)).toBeInTheDocument()
    expect(screen.getByText(/System Online/i)).toBeInTheDocument()
  })
})

describe('KpiCards component', () => {
  it('renders all key accuracy metrics accurately', () => {
    renderWithMantine(<KpiCards metrics={mockMetrics} />)
    expect(screen.getByText('2,450.5')).toBeInTheDocument()
    expect(screen.getByText('3,120.8')).toBeInTheDocument()
    expect(screen.getByText('14.85%')).toBeInTheDocument()
    expect(screen.getByText('-850.2')).toBeInTheDocument()
    expect(screen.getByText('39,200')).toBeInTheDocument()
    expect(screen.getByText('16,500')).toBeInTheDocument()
    expect(screen.getByText(/Short Bias/i)).toBeInTheDocument()
    expect(screen.getByText(/Thermal Procurement/i)).toBeInTheDocument()
  })
})

describe('ControlBar component', () => {
  it('renders preset options and triggers callbacks', () => {
    const onPresetChange = vi.fn()
    const onCutoffChange = vi.fn()
    const onDateRangeChange = vi.fn()
    const onRefresh = vi.fn()

    renderWithMantine(
      <ControlBar
        presets={mockPresets}
        selectedPreset="epex_60"
        cutoffTime="09:20"
        startDate="2026-01-01"
        endDate="2026-01-31"
        loading={false}
        onPresetChange={onPresetChange}
        onCutoffChange={onCutoffChange}
        onDateRangeChange={onDateRangeChange}
        onRefresh={onRefresh}
      />
    )

    const recalcButton = screen.getByRole('button', { name: /Recalculate/i })
    fireEvent.click(recalcButton)
    expect(onRefresh).toHaveBeenCalledTimes(1)

    const week1Badge = screen.getByText('Week 1 (1–7)')
    fireEvent.click(week1Badge)
    expect(onDateRangeChange).toHaveBeenCalledWith('2026-01-01', '2026-01-07')
  })
})

describe('DataTable component', () => {
  it('renders settlement interval rows and handles filtering', () => {
    renderWithMantine(<DataTable records={mockRecords} />)

    expect(screen.getByText('12,400.0')).toBeInTheDocument()
    expect(screen.getByText('13,500.0')).toBeInTheDocument()
    expect(screen.getByText('-1,600.0')).toBeInTheDocument()
    expect(screen.getByText('+500.0')).toBeInTheDocument()
    expect(screen.getByText('DEFICIT')).toBeInTheDocument()
    expect(screen.getByText('SURPLUS')).toBeInTheDocument()

    const searchInput = screen.getByPlaceholderText(/Search date, SP/i)
    fireEvent.change(searchInput, { target: { value: 'SP 2' } })
    expect(screen.queryByText('12,400.0')).not.toBeInTheDocument()
    expect(screen.getByText('13,500.0')).toBeInTheDocument()
  })
})
