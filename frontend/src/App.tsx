import { useState, useEffect } from 'react'
import { Container, Title, Text, Badge, Group, Stack, Card, Loader, Paper} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { IconWind, IconActivity } from '@tabler/icons-react'

interface HealthResponse {
  status: string
  service: string
}

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data: HealthResponse) => setHealth(data))
      .catch((err) => console.error('Failed to fetch health status', err))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <Group gap="xs">
            <IconWind size={32} color="#20c997" />
            <div>
              <Title order={2}>UK Wind Forecast & Procurement Portal</Title>
              <Text size="sm" c="dimmed">
                January 2026 Day-Ahead Procurement & Gate Closure Accuracy Analysis
              </Text>
            </div>
          </Group>
          <Badge
            color={health?.status === 'healthy' ? 'teal' : 'yellow'}
            variant="light"
            size="lg"
            leftSection={<IconActivity size={16} />}
          >
            {loading ? <Loader size="xs" /> : health?.status ?? 'connecting'}
          </Badge>
        </Group>

        <Card withBorder radius="md" p="md">
          <Group justify="space-between" align="center">
            <div>
              <Text fw={600}>Delivery Day</Text>
              <Text size="xs" c="dimmed">
                Configured with Mantine Dates for January 2026
              </Text>
            </div>
            <DatePickerInput
              placeholder="Pick delivery day"
              value={selectedDate}
              onChange={setSelectedDate}
              clearable
              w={240}
            />
          </Group>
        </Card>

        <Paper p="md" withBorder radius="md">
          <Text size="sm" c="dimmed">
            Backend ingestion pipeline initialized with Elexon BMRS FUELHH & WINDFOR datasets.
          </Text>
        </Paper>
      </Stack>
    </Container>
  )
}
