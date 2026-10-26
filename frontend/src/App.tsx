import { useState, useEffect, useCallback } from 'react'
import {
  Container,
  Stack,
  Alert,
  Loader,
  Center,
  Text,
  Group,
  Paper,
  Tabs,
  SimpleGrid,
  Badge,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconChartLine,
  IconChartBar,
  IconTable,
} from '@tabler/icons-react'

import type { ForecastsResponse, PresetItem, AlignedRecord } from './types/api'
import { fetchHealth, fetchPresets, fetchForecasts } from './api/client'
import { Header } from './components/Header'
import { ControlBar } from './components/ControlBar'
import { KpiCards } from './components/KpiCards'
import { RiskBar } from './components/RiskBar'
import { TimeSeriesChart } from './components/charts/TimeSeriesChart'
import { ImbalanceChart } from './components/charts/ImbalanceChart'
import { DiurnalChart } from './components/charts/DiurnalChart'
import { DataTable } from './components/DataTable'

export default function App() {
  const [healthStatus, setHealthStatus] = useState<string>('connecting')
  const [presets, setPresets] = useState<PresetItem[]>([])
  const [selectedPreset, setSelectedPreset] = useState<string>('epex_60')
  const [cutoffTime, setCutoffTime] = useState<string>('09:20')
  const [startDate, setStartDate] = useState<string>('2026-01-01')
  const [endDate, setEndDate] = useState<string>('2026-01-31')

  const [forecastData, setForecastData] = useState<ForecastsResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [hoveredRecord, setHoveredRecord] = useState<AlignedRecord | null>(null)
  const [activeTab, setActiveTab] = useState<string | null>('overview')

  useEffect(() => {
    async function init() {
      try {
        const [healthRes, presetsRes] = await Promise.all([
          fetchHealth().catch(() => ({ status: 'offline', service: 'wind-forecast-portal' })),
          fetchPresets().catch(() => null),
        ])

        setHealthStatus(healthRes.status)

        if (presetsRes) {
          setPresets(presetsRes.presets)
          setSelectedPreset(presetsRes.default_preset)
          setCutoffTime(presetsRes.default_cutoff_time)
          if (presetsRes.default_date_range) {
            setStartDate(presetsRes.default_date_range.start_date)
            setEndDate(presetsRes.default_date_range.end_date)
          }
        }
      } catch (err: unknown) {
        console.error('Portal initialization failed:', err)
      }
    }
    init()
  }, [])

  const loadForecastData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchForecasts({
        startDate,
        endDate,
        cutoffTime: selectedPreset === 'custom' ? cutoffTime : undefined,
        preset: selectedPreset !== 'custom' ? selectedPreset : undefined,
      })
      setForecastData(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve forecast data from API.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, selectedPreset, cutoffTime])

  useEffect(() => {
    loadForecastData()
  }, [loadForecastData])

  const handleDateRangeChange = (start: string, end: string) => {
    setStartDate(start)
    setEndDate(end)
  }

  return (
    <Container fluid px={{ base: 'md', md: 'xl' }} py="lg">
      <Stack gap="md">
        <Header
          healthStatus={healthStatus}
          loading={loading}
          totalRecords={forecastData?.records.length}
        />

        <ControlBar
          presets={presets}
          selectedPreset={selectedPreset}
          cutoffTime={cutoffTime}
          startDate={startDate}
          endDate={endDate}
          loading={loading}
          onPresetChange={setSelectedPreset}
          onCutoffChange={setCutoffTime}
          onDateRangeChange={handleDateRangeChange}
          onRefresh={loadForecastData}
        />

        {error && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Data Query Error"
            color="red"
            variant="filled"
          >
            {error}
          </Alert>
        )}

        {loading && !forecastData && (
          <Center py="xl">
            <Stack align="center" gap="xs">
              <Loader color="teal" size="lg" />
              <Text size="sm" c="dimmed">
                Aligning January 2026 Day-Ahead snapshots from Elexon BMRS...
              </Text>
            </Stack>
          </Center>
        )}

        {forecastData && (
          <Stack gap="md">
            <KpiCards metrics={forecastData.metrics} />

            <Tabs
              value={activeTab}
              onChange={setActiveTab}
              color="teal"
              variant="outline"
              radius="md"
            >
              <Tabs.List mb="md">
                <Tabs.Tab value="overview" leftSection={<IconChartLine size={16} />}>
                  Generation & Forecast
                </Tabs.Tab>
                <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>
                  Imbalance & Diurnal Analytics
                </Tabs.Tab>
                <Tabs.Tab
                  value="table"
                  leftSection={<IconTable size={16} />}
                  rightSection={
                    <Badge size="xs" variant="light" color="teal">
                      {forecastData.records.length}
                    </Badge>
                  }
                >
                  Settlement Records
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="overview">
                <Stack gap="md">
                  <RiskBar
                    riskQuantiles={forecastData.risk_quantiles}
                    deficitPeriods={forecastData.metrics.deficit_periods}
                    surplusPeriods={forecastData.metrics.surplus_periods}
                    totalPeriods={forecastData.metrics.total_periods}
                  />
                  <TimeSeriesChart
                    records={forecastData.records}
                    hoveredRecord={hoveredRecord}
                    onHoverRecord={setHoveredRecord}
                  />
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="analytics">
                <Stack gap="md">
                  <RiskBar
                    riskQuantiles={forecastData.risk_quantiles}
                    deficitPeriods={forecastData.metrics.deficit_periods}
                    surplusPeriods={forecastData.metrics.surplus_periods}
                    totalPeriods={forecastData.metrics.total_periods}
                  />
                  <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
                    <ImbalanceChart
                      records={forecastData.records}
                      hoveredRecord={hoveredRecord}
                      onHoverRecord={setHoveredRecord}
                    />
                    <DiurnalChart diurnalProfile={forecastData.diurnal_profile} />
                  </SimpleGrid>
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="table">
                <DataTable records={forecastData.records} defaultOpen={true} />
              </Tabs.Panel>
            </Tabs>
          </Stack>
        )}

        <Paper p="sm" withBorder radius="md" bg="var(--mantine-color-dark-8)">
          <Group justify="space-between" align="center" wrap="wrap">
            <Text size="xs" c="dimmed">
              GB Wind Forecast & Day-Ahead Procurement Portal • Physical Electricity Market January 2026
            </Text>
            <Text size="xs" c="dimmed">
              Elexon BMRS FUELHH & WINDFOR streams • Built for Power Traders & Utilities
            </Text>
          </Group>
        </Paper>
      </Stack>
    </Container>
  )
}
