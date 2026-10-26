import { useMemo } from 'react'
import { Card, Group, Stack, Text, Badge, Paper } from '@mantine/core'
import { Chart } from '@tanstack/react-charts'
import { defineChart, barY, ruleY } from '@tanstack/charts'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scaleBand } from '@tanstack/charts/scales/band'
import { tooltip } from '@tanstack/charts/tooltip'
import type { AlignedRecord } from '../../types/api'
import { formatTimelineLabel } from '../../utils/formatters'

interface ImbalanceChartProps {
  records: AlignedRecord[]
  height?: number
  onHoverRecord?: (record: AlignedRecord | null) => void
  hoveredRecord?: AlignedRecord | null
}

interface ImbalanceDatum {
  id: string
  label: string
  error_mw: number
  color: string
  record: AlignedRecord
}

export function ImbalanceChart({
  records,
  height = 240,
  onHoverRecord,
  hoveredRecord,
}: ImbalanceChartProps) {
  const chartData = useMemo<ImbalanceDatum[]>(() => {
    return records.map((r) => {
      const err = r.error_mw ?? 0
      const isDeficit = err < 0
      return {
        id: r.target_time,
        label: formatTimelineLabel(r.target_time, r.settlement_period),
        error_mw: err,
        color: isDeficit ? '#fa5252' : '#20c997',
        record: r,
      }
    })
  }, [records])

  const definition = useMemo(() => {
    if (chartData.length === 0) return null

    return defineChart({
      marks: [
        ruleY([0], { stroke: '#495057', strokeDasharray: '3 3', strokeWidth: 1.5 }),
        barY(chartData, {
          x: 'label',
          y: 'error_mw',
          fill: (d: ImbalanceDatum) => d.color,
          maxThickness: 24,
        }),
      ],
      scales: {
        x: {
          scale: () => scaleBand().padding(0.1),
          axis: {
            label: 'Settlement Period',
          },
        },
        y: {
          scale: scaleLinear,
          nice: true,
          grid: true,
          axis: {
            label: 'Forecast Error (MW)',
          },
        },
      },
      tooltip,
    })
  }, [chartData])

  if (records.length === 0 || !definition) {
    return null
  }

  return (
    <Card withBorder radius="md" p="md" shadow="sm">
      <Stack gap="sm">
        <Group justify="space-between" align="center" wrap="wrap">
          <div>
            <Group gap="xs" align="center">
              <Text fw={700} size="md">
                Imbalance Position (Actual Generation − Day-Ahead Forecast)
              </Text>
              <Badge variant="outline" color="red" size="xs">
                Thermal Procurement Risk
              </Badge>
            </Group>
            <Text size="xs" c="dimmed">
              Negative values indicate generation deficit where Thermal Procurement must be contracted
            </Text>
          </div>

          <Group gap="md">
            <Group gap={6}>
              <div
                style={{
                  width: 12,
                  height: 12,
                  backgroundColor: '#fa5252',
                  borderRadius: 2,
                }}
              />
              <Text size="xs" fw={600} c="red">
                Deficit (Short Position)
              </Text>
            </Group>
            <Group gap={6}>
              <div
                style={{
                  width: 12,
                  height: 12,
                  backgroundColor: '#20c997',
                  borderRadius: 2,
                }}
              />
              <Text size="xs" fw={600} c="teal">
                Surplus (Long Position)
              </Text>
            </Group>
          </Group>
        </Group>

        {hoveredRecord && (
          <Paper p="xs" px="md" radius="sm" withBorder bg="var(--mantine-color-dark-7)">
            <Group justify="space-between" align="center" wrap="wrap" gap="xs">
              <Text size="xs" fw={600}>
                Synchronized Target: {hoveredRecord.settlement_date} SP {hoveredRecord.settlement_period}
              </Text>
              <Group gap="md">
                <Text size="xs">
                  Error:{' '}
                  <strong style={{ color: (hoveredRecord.error_mw ?? 0) < 0 ? '#fa5252' : '#20c997' }}>
                    {(hoveredRecord.error_mw ?? 0) > 0 ? '+' : ''}
                    {hoveredRecord.error_mw?.toFixed(1)} MW
                  </strong>
                </Text>
                <Badge
                  size="xs"
                  color={hoveredRecord.imbalance_type === 'deficit' ? 'red' : 'teal'}
                  variant="light"
                >
                  {hoveredRecord.imbalance_type === 'deficit'
                    ? 'Thermal Procurement Required'
                    : 'System Long'}
                </Badge>
              </Group>
            </Group>
          </Paper>
        )}

        <div style={{ width: '100%', height }}>
          <Chart
            definition={definition}
            height={height}
            ariaLabel="Settlement Period Imbalance Bar Chart"
            onFocusChange={(point) => {
              const item = point?.datum as ImbalanceDatum | undefined
              if (item) {
                onHoverRecord?.(item.record)
              }
            }}
          />
        </div>
      </Stack>
    </Card>
  )
}
