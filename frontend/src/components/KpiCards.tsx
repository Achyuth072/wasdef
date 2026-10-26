import { SimpleGrid, Card, Group, Text, Badge, ThemeIcon } from '@mantine/core'
import {
  IconTrendingDown,
  IconTrendingUp,
  IconFlame,
  IconActivity,
  IconChartBar,
  IconScale,
  IconBolt,
} from '@tabler/icons-react'
import type { AccuracyMetrics } from '../types/api'

interface KpiCardsProps {
  metrics: AccuracyMetrics | null
}

export function KpiCards({ metrics }: KpiCardsProps) {
  if (!metrics) return null

  const isOverforecast = metrics.bias_mw < 0
  const deficitPct =
    metrics.total_periods > 0
      ? ((metrics.deficit_periods / metrics.total_periods) * 100).toFixed(1)
      : '0'
  const formattedBias = `${metrics.bias_mw > 0 ? '+' : ''}${metrics.bias_mw.toFixed(1)}`

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 6 }} spacing="md">
      <Card withBorder radius="md" p="md" shadow="xs">
        <Group justify="space-between" align="flex-start" mb="xs">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            Mean Absolute Error (MAE)
          </Text>
          <ThemeIcon color="cyan" variant="light" size="sm" radius="md">
            <IconActivity size={16} />
          </ThemeIcon>
        </Group>
        <Group align="baseline" gap="xs">
          <Text size="xl" fw={800} style={{ letterSpacing: '-0.02em' }}>
            {metrics.mae_mw.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          </Text>
          <Text size="sm" fw={600} c="dimmed">
            MW
          </Text>
        </Group>
        <Text size="xs" c="dimmed" mt={4}>
          Expected average volume misforecast per Settlement Period
        </Text>
      </Card>

      <Card withBorder radius="md" p="md" shadow="xs">
        <Group justify="space-between" align="flex-start" mb="xs">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            Root Mean Square (RMSE)
          </Text>
          <ThemeIcon color="indigo" variant="light" size="sm" radius="md">
            <IconChartBar size={16} />
          </ThemeIcon>
        </Group>
        <Group align="baseline" gap="xs">
          <Text size="xl" fw={800} style={{ letterSpacing: '-0.02em' }}>
            {metrics.rmse_mw.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          </Text>
          <Text size="sm" fw={600} c="dimmed">
            MW
          </Text>
        </Group>
        <Text size="xs" c="dimmed" mt={4}>
          Penalizes large tail errors triggering severe imbalance penalties
        </Text>
      </Card>

      <Card withBorder radius="md" p="md" shadow="xs">
        <Group justify="space-between" align="flex-start" mb="xs">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            Capacity-Normalized MAE
          </Text>
          <ThemeIcon color="teal" variant="light" size="sm" radius="md">
            <IconScale size={16} />
          </ThemeIcon>
        </Group>
        <Group align="baseline" gap="xs">
          <Text size="xl" fw={800} c="teal" style={{ letterSpacing: '-0.02em' }}>
            {metrics.cn_mae_percent.toFixed(2)}%
          </Text>
        </Group>
        <Text size="xs" c="dimmed" mt={4}>
          cnMAE benchmark normalized against peak January capacity
        </Text>
      </Card>

      <Card withBorder radius="md" p="md" shadow="xs">
        <Group justify="space-between" align="flex-start" mb="xs">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            System Forecast Bias
          </Text>
          <ThemeIcon color={isOverforecast ? 'red' : 'teal'} variant="light" size="sm" radius="md">
            {isOverforecast ? <IconTrendingDown size={16} /> : <IconTrendingUp size={16} />}
          </ThemeIcon>
        </Group>
        <Group align="baseline" gap="xs">
          <Text
            size="xl"
            fw={800}
            c={isOverforecast ? 'red.4' : 'teal.4'}
            style={{ letterSpacing: '-0.02em' }}
          >
            {formattedBias}
          </Text>
          <Text size="sm" fw={600} c="dimmed">
            MW
          </Text>
        </Group>
        <Group gap="xs" mt={4}>
          <Badge size="xs" color={isOverforecast ? 'red' : 'teal'} variant="filled">
            {isOverforecast ? 'Short Bias (Overforecast)' : 'Long Bias (Underforecast)'}
          </Badge>
        </Group>
      </Card>

      <Card withBorder radius="md" p="md" shadow="xs">
        <Group justify="space-between" align="flex-start" mb="xs">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            Total Deficit Volume
          </Text>
          <ThemeIcon color="orange" variant="light" size="sm" radius="md">
            <IconFlame size={16} />
          </ThemeIcon>
        </Group>
        <Group align="baseline" gap="xs">
          <Text size="xl" fw={800} c="orange.4" style={{ letterSpacing: '-0.02em' }}>
            {Math.round(metrics.total_deficit_mwh).toLocaleString()}
          </Text>
          <Text size="sm" fw={600} c="dimmed">
            MWh
          </Text>
        </Group>
        <Group gap="xs" mt={4}>
          <Badge size="xs" color="orange" variant="light">
            {deficitPct}% ({metrics.deficit_periods}/{metrics.total_periods} SPs)
          </Badge>
          <Text size="xs" c="dimmed">
            Thermal Procurement needed
          </Text>
        </Group>
      </Card>

      <Card withBorder radius="md" p="md" shadow="xs">
        <Group justify="space-between" align="flex-start" mb="xs">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            Peak Wind Generation
          </Text>
          <ThemeIcon color="green" variant="light" size="sm" radius="md">
            <IconBolt size={16} />
          </ThemeIcon>
        </Group>
        <Group align="baseline" gap="xs">
          <Text size="xl" fw={800} c="green.4" style={{ letterSpacing: '-0.02em' }}>
            {Math.round(metrics.peak_capacity_mw).toLocaleString()}
          </Text>
          <Text size="sm" fw={600} c="dimmed">
            MW
          </Text>
        </Group>
        <Text size="xs" c="dimmed" mt={4}>
          Maximum observed national wind generation in period
        </Text>
      </Card>
    </SimpleGrid>
  )
}
