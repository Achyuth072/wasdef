import { useState, useEffect } from 'react'
import {
  Card,
  Group,
  Stack,
  Text,
  Badge,
  Button,
  SegmentedControl,
  Slider,
  TextInput,
  ActionIcon,
  Tooltip,
  Divider,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import {
  IconCalendar,
  IconClock,
  IconRefresh,
  IconAdjustments,
} from '@tabler/icons-react'
import type { PresetItem } from '../types/api'

interface ControlBarProps {
  presets: PresetItem[]
  selectedPreset: string
  cutoffTime: string
  startDate: string
  endDate: string
  loading: boolean
  onPresetChange: (presetId: string) => void
  onCutoffChange: (cutoff: string) => void
  onDateRangeChange: (start: string, end: string) => void
  onRefresh: () => void
}

const QUICK_DATES = [
  { label: 'Full Jan 2026', start: '2026-01-01', end: '2026-01-31' },
  { label: 'Week 1 (1–7)', start: '2026-01-01', end: '2026-01-07' },
  { label: 'Week 2 (8–14)', start: '2026-01-08', end: '2026-01-14' },
  { label: 'Week 3 (15–21)', start: '2026-01-15', end: '2026-01-21' },
  { label: 'Week 4 (22–28)', start: '2026-01-22', end: '2026-01-28' },
  { label: 'Storm Spell (10–13)', start: '2026-01-10', end: '2026-01-13' },
  { label: 'Calm Spell (20–22)', start: '2026-01-20', end: '2026-01-22' },
] as const

const SLIDER_MARKS = [
  { value: 560, label: '09:20 EPEX' },
  { value: 590, label: '09:50 NordPool' },
  { value: 870, label: '14:30 30m' },
  { value: 1080, label: '18:00 EOD' },
]

function timeStringToMinutes(timeStr: string): number {
  const parts = timeStr.split(':')
  if (parts.length !== 2) return 560
  const hours = parseInt(parts[0], 10) || 0
  const mins = parseInt(parts[1], 10) || 0
  return hours * 60 + mins
}

function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

export function ControlBar({
  presets,
  selectedPreset,
  cutoffTime,
  startDate,
  endDate,
  loading,
  onPresetChange,
  onCutoffChange,
  onDateRangeChange,
  onRefresh,
}: ControlBarProps) {
  const [dateRange, setDateRange] = useState<[string | null, string | null]>([
    startDate,
    endDate,
  ])
  const [showSlider, setShowSlider] = useState<boolean>(false)

  // Keep local date range synchronized when props change
  useEffect(() => {
    setDateRange([startDate, endDate])
  }, [startDate, endDate])

  const handleDateChange = (val: [string | null, string | null]) => {
    setDateRange(val)
    if (val[0] && val[1]) {
      onDateRangeChange(val[0], val[1])
    }
  }

  const handlePresetSelect = (presetId: string) => {
    if (presetId === 'custom') {
      onPresetChange('custom')
      setShowSlider(true)
      return
    }
    const found = presets.find((p) => p.id === presetId)
    if (found) {
      onPresetChange(presetId)
      onCutoffChange(found.cutoff_time)
    }
  }

  const handleSliderChange = (minutes: number) => {
    onCutoffChange(minutesToTimeString(minutes))
    if (selectedPreset !== 'custom') {
      onPresetChange('custom')
    }
  }

  const presetOptions = [
    ...presets.map((p) => ({
      label: `${p.name} (${p.cutoff_time})`,
      value: p.id,
    })),
    { label: 'Custom Cutoff', value: 'custom' },
  ]

  const cutoffMinutes = timeStringToMinutes(cutoffTime)

  return (
    <Card withBorder radius="md" p="md" shadow="sm">
      <Stack gap="md">
        <Group justify="space-between" align="center" wrap="wrap">
          <Group gap="md" wrap="wrap" align="center">
            {/* Delivery Date Range Picker */}
            <div>
              <Group gap={6} mb={4}>
                <IconCalendar size={16} color="#20c997" />
                <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                  Delivery Date Range
                </Text>
              </Group>
              <DatePickerInput
                type="range"
                value={dateRange}
                onChange={handleDateChange}
                minDate="2026-01-01"
                maxDate="2026-01-31"
                placeholder="Pick date range"
                w={250}
                size="sm"
                allowSingleDateInRange={false}
              />
            </div>

            <Divider orientation="vertical" />

            {/* Auction Cutoff / Gate Closure Presets */}
            <div>
              <Group gap={6} mb={4}>
                <IconClock size={16} color="#339af0" />
                <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                  Market Gate Closure (D-1 Cutoff)
                </Text>
              </Group>
              <SegmentedControl
                data={presetOptions}
                value={selectedPreset}
                onChange={handlePresetSelect}
                size="sm"
                color="teal"
              />
            </div>

            {/* Cutoff Time Indicator / Input */}
            <div>
              <Group gap={6} mb={4}>
                <IconAdjustments size={16} color="#fab005" />
                <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                  Cutoff Time
                </Text>
              </Group>
              <Group gap="xs">
                <TextInput
                  value={cutoffTime}
                  onChange={(e) => {
                    onCutoffChange(e.currentTarget.value)
                    if (selectedPreset !== 'custom') onPresetChange('custom')
                  }}
                  w={90}
                  size="sm"
                  placeholder="HH:MM"
                />
                <Tooltip label={showSlider ? 'Hide cutoff slider' : 'Show cutoff slider'}>
                  <ActionIcon
                    variant={showSlider ? 'filled' : 'light'}
                    color="teal"
                    size="lg"
                    onClick={() => setShowSlider((prev) => !prev)}
                  >
                    <IconAdjustments size={18} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </div>
          </Group>

          {/* Action / Sync Button */}
          <Group gap="xs">
            <Button
              leftSection={<IconRefresh size={16} />}
              loading={loading}
              onClick={onRefresh}
              color="teal"
              variant="light"
            >
              Recalculate
            </Button>
          </Group>
        </Group>

        {/* Custom Cutoff Slider Scrubbing */}
        {showSlider && (
          <Card withBorder radius="sm" p="sm" pb="xl" bg="var(--mantine-color-dark-7)">
            <Group justify="space-between" mb="sm">
              <Text size="xs" fw={600} c="teal">
                Scrub Cutoff Time on D-1: <strong>{cutoffTime} GMT</strong>
              </Text>
              <Badge size="xs" variant="outline" color="teal">
                {cutoffMinutes} minutes from midnight
              </Badge>
            </Group>
            <Slider
              value={cutoffMinutes}
              onChange={handleSliderChange}
              min={360}
              max={1320}
              step={10}
              marks={SLIDER_MARKS}
              color="teal"
              label={minutesToTimeString}
              mb="md"
              styles={{
                markLabel: {
                  fontSize: '0.72rem',
                  marginTop: 6,
                },
              }}
            />
          </Card>
        )}

        {/* Quick Date Presets Row */}
        <Group gap="xs" wrap="wrap">
          <Text size="xs" c="dimmed" fw={600}>
            Quick Presets:
          </Text>
          {QUICK_DATES.map((q) => {
            const isSelected = startDate === q.start && endDate === q.end
            return (
              <Badge
                key={q.label}
                variant={isSelected ? 'filled' : 'outline'}
                color={isSelected ? 'teal' : 'gray'}
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => onDateRangeChange(q.start, q.end)}
              >
                {q.label}
              </Badge>
            )
          })}
        </Group>
      </Stack>
    </Card>
  )
}
