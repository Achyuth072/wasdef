import { useMemo, useState } from 'react'
import { Card, Group, Stack, Text, Badge, Paper } from '@mantine/core'
import { Chart } from '@tanstack/react-charts'
import { defineChart, lineY } from '@tanstack/charts'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scalePoint } from '@tanstack/charts/scales/point'
import { tooltip } from '@tanstack/charts/tooltip'
import type { AlignedRecord } from '../../types/api'
import { formatTimelineLabel } from '../../utils/formatters'

interface TimeSeriesChartProps {
  records: AlignedRecord[]
  height?: number
  onHoverRecord?: (record: AlignedRecord | null) => void
  hoveredRecord?: AlignedRecord | null
}

interface ChartDatum {
  id: string
  label: string
  actual_mw: number
  forecast_mw: number
  record: AlignedRecord
}

export function TimeSeriesChart({
  records,
  height = 340,
  onHoverRecord,
  hoveredRecord: externalHoveredRecord,
}: TimeSeriesChartProps) {
  const [internalHovered, setInternalHovered] = useState<AlignedRecord | null>(null)
  const activeRecord = externalHoveredRecord ?? internalHovered ?? (records.length > 0 ? records[0] : null)

  const chartData = useMemo<ChartDatum[]>(() => {
    return records.map((r) => ({
      id: r.target_time,
      label: formatTimelineLabel(r.target_time, r.settlement_period),
      actual_mw: r.actual_mw,
      forecast_mw: r.forecast_mw ?? 0,
      record: r,
    }))
  }, [records])

  const definition = useMemo(() => {
    if (chartData.length === 0) return null

    return defineChart({
      marks: [
        lineY(chartData, {
          x: 'label',
          y: 'actual_mw',
          stroke: '#20c997',
          strokeWidth: 2.2,
        }),
        lineY(chartData, {
          x: 'label',
          y: 'forecast_mw',
          stroke: '#339af0',
          strokeWidth: 2,
          strokeDasharray: '4 3',
        }),
      ],
      scales: {
        x: {
          scale: () => scalePoint(),
          axis: {
            label: 'Delivery Timeline (UTC)',
          },
        },
        y: {
          scale: scaleLinear,
          nice: true,
          grid: true,
          axis: {
            label: 'Generation (MW)',
          },
        },
      },
      tooltip,
    })
  }, [chartData])

  if (records.length === 0 || !definition) {
    return (
      <Card withBorder radius="md" p="xl">
        <Text c="dimmed" ta="center">
          No forecast data available for selected filter range.
        </Text>
      </Card>
    )
  }

  return (
    <Card withBorder radius="md" p="md" shadow="sm">
      <Stack gap="sm">
        <Group justify="space-between" align="center" wrap="wrap">
          <div>
            <Group gap="xs" align="center">
              <Text fw={700} size="md">
                Actual Generation vs. Day-Ahead Forecast
              </Text>
              <Badge variant="outline" color="gray" size="xs">
                {records.length} Settlement Periods
              </Badge>
            </Group>
            <Text size="xs" c="dimmed">
              Aligned at selected Gate Closure snapshot across 30-minute Settlement Periods
            </Text>
          </div>

          <Group gap="md">
            <Group gap={6}>
              <div
                style={{
                  width: 14,
                  height: 3,
                  backgroundColor: '#20c997',
                  borderRadius: 2,
                }}
              />
              <Text size="xs" fw={600} c="teal">
                Actual Generation (MW)
              </Text>
            </Group>
            <Group gap={6}>
              <div
                style={{
                  width: 14,
                  height: 0,
                  borderTop: '2px dashed #339af0',
                }}
              />
              <Text size="xs" fw={600} c="blue">
                Day-Ahead Forecast (MW)
              </Text>
            </Group>
          </Group>
        </Group>

        {activeRecord && (
          <Paper p="xs" px="md" radius="sm" withBorder bg="var(--mantine-color-dark-7)">
            <Group justify="space-between" align="center" wrap="wrap" gap="xs">
              <Group gap="xs">
                <Text size="xs" fw={700} c="dimmed">
                  TARGET TIME:
                </Text>
                <Text size="xs" fw={600}>
                  {activeRecord.settlement_date} SP {activeRecord.settlement_period} (
                  {activeRecord.target_time.slice(11, 16)} UTC)
                </Text>
              </Group>

              <Group gap="md">
                <Group gap={4}>
                  <Text size="xs" c="dimmed">
                    Actual:
                  </Text>
                  <Text size="xs" fw={700} c="teal">
                    {activeRecord.actual_mw.toLocaleString()} MW
                  </Text>
                </Group>

                <Group gap={4}>
                  <Text size="xs" c="dimmed">
                    Forecast:
                  </Text>
                  <Text size="xs" fw={700} c="blue">
                    {activeRecord.forecast_mw != null
                      ? `${activeRecord.forecast_mw.toLocaleString()} MW`
                      : 'N/A'}
                  </Text>
                </Group>

                <Group gap={4}>
                  <Text size="xs" c="dimmed">
                    Forecast Error:
                  </Text>
                  <Text
                    size="xs"
                    fw={700}
                    c={(activeRecord.error_mw ?? 0) < 0 ? 'red.4' : 'teal.4'}
                  >
                    {(activeRecord.error_mw ?? 0) > 0 ? '+' : ''}
                    {activeRecord.error_mw?.toLocaleString()} MW
                  </Text>
                </Group>

                <Badge
                  size="xs"
                  color={activeRecord.imbalance_type === 'deficit' ? 'red' : 'teal'}
                  variant="filled"
                >
                  {activeRecord.imbalance_type === 'deficit'
                    ? 'Short (Deficit)'
                    : 'Long (Surplus)'}
                </Badge>
              </Group>
            </Group>
          </Paper>
        )}

        <div style={{ width: '100%', height }}>
          <Chart
            definition={definition}
            height={height}
            ariaLabel="Day-Ahead Wind Forecast vs Actual Metered Generation"
            onFocusChange={(point) => {
              const item = point?.datum as ChartDatum | undefined
              if (item) {
                setInternalHovered(item.record)
                onHoverRecord?.(item.record)
              }
            }}
          />
        </div>
      </Stack>
    </Card>
  )
}
