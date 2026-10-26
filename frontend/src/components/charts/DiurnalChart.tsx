import { useMemo, useState } from 'react'
import { Card, Group, Stack, Text, Badge, SegmentedControl, Paper } from '@mantine/core'
import { Chart } from '@tanstack/react-charts'
import { defineChart, barY, lineY } from '@tanstack/charts'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scaleBand } from '@tanstack/charts/scales/band'
import { scalePoint } from '@tanstack/charts/scales/point'
import { tooltip } from '@tanstack/charts/tooltip'
import type { DiurnalPeriod } from '../../types/api'

interface DiurnalChartProps {
  diurnalProfile: DiurnalPeriod[]
  height?: number
}

const VIEW_MODE_OPTIONS = [
  { label: 'MAE Profile', value: 'mae' },
  { label: 'Avg Actual vs Fcst', value: 'generation' },
]

function formatMins(m: number): string {
  const hh = Math.floor(m / 60)
    .toString()
    .padStart(2, '0')
  const mm = (m % 60).toString().padStart(2, '0')
  return `${hh}:${mm}`
}

function spToTimeRange(sp: number): string {
  return `${formatMins((sp - 1) * 30)}–${formatMins(sp * 30)}`
}

function getPeriodColor(sp: number): string {
  // Morning ramp: SP 13-18 (06:00 - 09:00)
  if (sp >= 13 && sp <= 18) {
    return '#f59f00' // Yellow / Amber
  }
  // Evening peak: SP 33-38 (16:00 - 19:00)
  if (sp >= 33 && sp <= 38) {
    return '#fa5252' // Coral / Red
  }
  return '#20c997' // Teal
}

export function DiurnalChart({ diurnalProfile, height = 280 }: DiurnalChartProps) {
  const [viewMode, setViewMode] = useState<'mae' | 'generation'>('mae')
  const [focusedPeriod, setFocusedPeriod] = useState<DiurnalPeriod | null>(null)

  // Find worst error period with O(N) scan
  const worstPeriod = useMemo(() => {
    if (!diurnalProfile || diurnalProfile.length === 0) return null
    return diurnalProfile.reduce(
      (max, curr) => (curr.mae_mw > max.mae_mw ? curr : max),
      diurnalProfile[0],
    )
  }, [diurnalProfile])

  const chartData = useMemo(() => {
    return diurnalProfile.map((d) => ({
      id: `SP-${d.settlement_period}`,
      label: `SP ${d.settlement_period}`,
      sp: d.settlement_period,
      mae_mw: d.mae_mw,
      avg_actual_mw: d.avg_actual_mw,
      avg_forecast_mw: d.avg_forecast_mw,
      avg_error_mw: d.avg_error_mw,
      color: getPeriodColor(d.settlement_period),
      timeRange: spToTimeRange(d.settlement_period),
      period: d,
    }))
  }, [diurnalProfile])

  const maeDefinition = useMemo(() => {
    if (chartData.length === 0) return null

    return defineChart({
      marks: [
        barY(chartData, {
          x: 'label',
          y: 'mae_mw',
          fill: (d) => d.color,
          maxThickness: 16,
        }),
      ],
      scales: {
        x: {
          scale: () => scaleBand().padding(0.15),
          axis: {
            label: 'Settlement Period (SP 1–48)',
          },
        },
        y: {
          scale: scaleLinear,
          nice: true,
          grid: true,
          axis: {
            label: 'MAE (MW)',
          },
        },
      },
      tooltip,
    })
  }, [chartData])

  const genDefinition = useMemo(() => {
    if (chartData.length === 0) return null

    return defineChart({
      marks: [
        lineY(chartData, {
          x: 'label',
          y: 'avg_actual_mw',
          stroke: '#20c997',
          strokeWidth: 2.2,
        }),
        lineY(chartData, {
          x: 'label',
          y: 'avg_forecast_mw',
          stroke: '#339af0',
          strokeWidth: 2,
          strokeDasharray: '4 3',
        }),
      ],
      scales: {
        x: {
          scale: () => scalePoint(),
          axis: {
            label: 'Settlement Period (SP 1–48)',
          },
        },
        y: {
          scale: scaleLinear,
          nice: true,
          grid: true,
          axis: {
            label: 'Average Output (MW)',
          },
        },
      },
      tooltip,
    })
  }, [chartData])

  if (diurnalProfile.length === 0) {
    return null
  }

  const activeDefinition = viewMode === 'mae' ? maeDefinition : genDefinition

  return (
    <Card withBorder radius="md" p="md" shadow="sm">
      <Stack gap="sm">
        <Group justify="space-between" align="center" wrap="wrap">
          <div>
            <Group gap="xs" align="center">
              <Text fw={700} size="md">
                Diurnal Accuracy Profile (48 Settlement Periods)
              </Text>
              {worstPeriod && (
                <Badge color="red" variant="light" size="xs">
                  Peak Error: SP {worstPeriod.settlement_period} ({spToTimeRange(worstPeriod.settlement_period)}) – {worstPeriod.mae_mw.toFixed(0)} MW MAE
                </Badge>
              )}
            </Group>
            <Text size="xs" c="dimmed">
              Recurring time-of-day accuracy variations across the UK physical electricity market
            </Text>
          </div>

          <Group gap="sm">
            <Group gap={6} visibleFrom="sm">
              <Badge color="yellow" variant="dot" size="xs">
                Morning Ramp (SP 13–18)
              </Badge>
              <Badge color="red" variant="dot" size="xs">
                Evening Peak (SP 33–38)
              </Badge>
            </Group>

            <SegmentedControl
              size="xs"
              value={viewMode}
              onChange={(val) => setViewMode(val as 'mae' | 'generation')}
              data={VIEW_MODE_OPTIONS}
              color="teal"
            />
          </Group>
        </Group>

        {/* Focused Period Summary */}
        {focusedPeriod && (
          <Paper p="xs" px="md" radius="sm" withBorder bg="var(--mantine-color-dark-7)">
            <Group justify="space-between" align="center" wrap="wrap" gap="xs">
              <Text size="xs" fw={700} c="dimmed">
                SP {focusedPeriod.settlement_period} ({spToTimeRange(focusedPeriod.settlement_period)} UTC)
              </Text>
              <Group gap="md">
                <Text size="xs">
                  <Text span c="dimmed">
                    MAE:{' '}
                  </Text>
                  <strong>{focusedPeriod.mae_mw.toFixed(1)} MW</strong>
                </Text>
                <Text size="xs">
                  <Text span c="dimmed">
                    RMSE:{' '}
                  </Text>
                  <strong>{focusedPeriod.rmse_mw.toFixed(1)} MW</strong>
                </Text>
                <Text size="xs">
                  <Text span c="dimmed">
                    Avg Actual:{' '}
                  </Text>
                  <strong style={{ color: '#20c997' }}>
                    {focusedPeriod.avg_actual_mw.toFixed(0)} MW
                  </strong>
                </Text>
                <Text size="xs">
                  <Text span c="dimmed">
                    Avg Fcst:{' '}
                  </Text>
                  <strong style={{ color: '#339af0' }}>
                    {focusedPeriod.avg_forecast_mw.toFixed(0)} MW
                  </strong>
                </Text>
              </Group>
            </Group>
          </Paper>
        )}

        {activeDefinition && (
          <div style={{ width: '100%', height }}>
            <Chart
              definition={activeDefinition}
              height={height}
              ariaLabel="48 Settlement Period diurnal error profile"
              onFocusChange={(point) => {
                if (point?.datum) {
                  const item = point.datum as { period: DiurnalPeriod }
                  setFocusedPeriod(item.period)
                }
              }}
            />
          </div>
        )}
      </Stack>
    </Card>
  )
}
