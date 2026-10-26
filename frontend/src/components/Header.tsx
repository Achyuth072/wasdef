import { Group, Title, Text, Badge, Paper, Tooltip } from '@mantine/core'
import { IconWind, IconActivity, IconBolt } from '@tabler/icons-react'

interface HeaderProps {
  healthStatus?: string
  loading?: boolean
  totalRecords?: number
}

export function Header({ healthStatus = 'healthy', loading, totalRecords }: HeaderProps) {
  const isHealthy = healthStatus === 'healthy'
  const statusLabel = loading ? 'Updating...' : isHealthy ? 'System Online' : healthStatus

  return (
    <Paper p="md" radius="md" withBorder style={{ backgroundColor: 'rgba(13, 27, 42, 0.7)' }}>
      <Group justify="space-between" align="center" wrap="wrap" gap="md">
        <Group gap="sm">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              borderRadius: 8,
              background: 'linear-gradient(135deg, rgba(32, 201, 151, 0.2) 0%, rgba(51, 154, 240, 0.2) 100%)',
              border: '1px solid rgba(32, 201, 151, 0.4)',
            }}
          >
            <IconWind size={28} color="#20c997" />
          </div>
          <div>
            <Group gap="xs" align="center">
              <Title order={2} style={{ letterSpacing: '-0.02em', fontWeight: 700 }}>
                GB Wind Forecast & Procurement Portal
              </Title>
              <Badge color="teal" variant="light" size="sm">
                January 2026
              </Badge>
              <Badge color="cyan" variant="outline" size="sm">
                Elexon BMRS
              </Badge>
            </Group>
            <Text size="sm" c="dimmed">
              Day-Ahead Auction Cutoff & Gate Closure Accuracy Analysis for UK Power Traders
            </Text>
          </div>
        </Group>

        <Group gap="sm">
          {totalRecords !== undefined && (
            <Tooltip label="Evaluated 30-minute UK Settlement Periods">
              <Badge variant="subtle" color="gray" leftSection={<IconBolt size={14} />}>
                {totalRecords} Settlement Periods
              </Badge>
            </Tooltip>
          )}

          <Badge
            color={isHealthy ? 'teal' : 'yellow'}
            variant="light"
            size="md"
            leftSection={<IconActivity size={14} />}
          >
            {statusLabel}
          </Badge>
        </Group>
      </Group>
    </Paper>
  )
}
