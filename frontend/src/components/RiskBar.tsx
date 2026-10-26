import { Paper, Group, Text, Badge, Tooltip } from '@mantine/core'
import { IconShieldCheck } from '@tabler/icons-react'
import type { RiskPercentiles } from '../types/api'

interface RiskBarProps {
  riskQuantiles?: RiskPercentiles
  deficitPeriods: number
  surplusPeriods: number
  totalPeriods: number
}

export function RiskBar({
  riskQuantiles,
  deficitPeriods,
  surplusPeriods,
  totalPeriods,
}: RiskBarProps) {
  if (!riskQuantiles) return null

  const divisor = totalPeriods || 1
  const deficitPct = ((deficitPeriods / divisor) * 100).toFixed(0)
  const surplusPct = ((surplusPeriods / divisor) * 100).toFixed(0)

  return (
    <Paper p="xs" px="md" radius="md" withBorder bg="var(--mantine-color-dark-8)">
      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <Group gap="sm" align="center">
          <IconShieldCheck size={18} color="#20c997" />
          <Text size="xs" fw={700} c="dimmed" tt="uppercase">
            Procurement Risk Bounds (Error Quantiles):
          </Text>
          <Tooltip label="10th Percentile: 10% of periods have errors below this value (severe deficit shortfall risk)">
            <Badge variant="outline" color="red" size="sm">
              P10 Shortfall: {riskQuantiles.p10.toFixed(1)} MW
            </Badge>
          </Tooltip>
          <Tooltip label="50th Percentile (Median forecast error)">
            <Badge variant="outline" color="cyan" size="sm">
              P50 Median: {riskQuantiles.p50.toFixed(1)} MW
            </Badge>
          </Tooltip>
          <Tooltip label="90th Percentile: 90% of periods have errors below this value (wind generation surplus)">
            <Badge variant="outline" color="teal" size="sm">
              P90 Surplus: {riskQuantiles.p90.toFixed(1)} MW
            </Badge>
          </Tooltip>
        </Group>

        <Group gap="xs" align="center">
          <Badge color="red" variant="light" size="sm">
            Deficit Periods: {deficitPeriods} ({deficitPct}%)
          </Badge>
          <Badge color="teal" variant="light" size="sm">
            Surplus Periods: {surplusPeriods} ({surplusPct}%)
          </Badge>
        </Group>
      </Group>
    </Paper>
  )
}
