import { useState, useMemo } from 'react'
import {
  Card,
  Table,
  Group,
  Stack,
  Text,
  TextInput,
  Select,
  Button,
  Badge,
  Pagination,
  ScrollArea,
  Collapse,
} from '@mantine/core'
import {
  IconSearch,
  IconDownload,
  IconArrowsSort,
  IconSortAscending,
  IconSortDescending,
  IconChevronDown,
  IconChevronUp,
} from '@tabler/icons-react'
import type { AlignedRecord } from '../types/api'
import { downloadCsv } from '../utils/csvExport'
import { formatMw, formatUtcIso } from '../utils/formatters'

interface DataTableProps {
  records: AlignedRecord[]
  filename?: string
  defaultOpen?: boolean
}

type SortField =
  | 'target_time'
  | 'settlement_period'
  | 'actual_mw'
  | 'forecast_mw'
  | 'error_mw'
  | 'imbalance_type'

type SortDirection = 'asc' | 'desc'

const STATUS_OPTIONS = [
  { label: 'All Positions', value: 'all' },
  { label: 'Deficit Only', value: 'deficit' },
  { label: 'Surplus Only', value: 'surplus' },
]

const PAGE_SIZE_OPTIONS = [
  { label: '25 rows', value: '25' },
  { label: '50 rows', value: '50' },
  { label: '100 rows', value: '100' },
]

export function DataTable({
  records,
  filename = 'wind_forecast_procurement_jan2026.csv',
  defaultOpen = true,
}: DataTableProps) {
  const [opened, setOpened] = useState(defaultOpen)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('target_time')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<string>('25')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase()
    return records.filter((r) => {
      if (statusFilter !== 'all' && r.imbalance_type !== statusFilter) {
        return false
      }
      if (!q) return true
      return (
        r.target_time.toLowerCase().includes(q) ||
        r.settlement_date.toLowerCase().includes(q) ||
        r.settlement_period.toString().includes(q) ||
        `sp ${r.settlement_period}`.includes(q) ||
        `sp${r.settlement_period}`.includes(q) ||
        r.imbalance_type.toLowerCase().includes(q) ||
        (r.publish_time && r.publish_time.toLowerCase().includes(q))
      )
    })
  }, [records, search, statusFilter])

  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case 'target_time':
          comparison = a.target_time.localeCompare(b.target_time)
          break
        case 'settlement_period':
          comparison = a.settlement_period - b.settlement_period
          break
        case 'actual_mw':
          comparison = a.actual_mw - b.actual_mw
          break
        case 'forecast_mw':
          comparison = (a.forecast_mw ?? 0) - (b.forecast_mw ?? 0)
          break
        case 'error_mw':
          comparison = (a.error_mw ?? 0) - (b.error_mw ?? 0)
          break
        case 'imbalance_type':
          comparison = a.imbalance_type.localeCompare(b.imbalance_type)
          break
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [filteredRecords, sortField, sortDirection])

  const numPageSize = parseInt(pageSize, 10) || 25
  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / numPageSize))
  const paginatedRecords = useMemo(() => {
    const start = (page - 1) * numPageSize
    return sortedRecords.slice(start, start + numPageSize)
  }, [sortedRecords, page, numPageSize])

  const handleExportCsv = () => {
    downloadCsv(sortedRecords, filename)
  }

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <IconArrowsSort size={14} style={{ opacity: 0.3 }} />
    }
    return sortDirection === 'asc' ? (
      <IconSortAscending size={14} color="#20c997" />
    ) : (
      <IconSortDescending size={14} color="#20c997" />
    )
  }

  return (
    <Card withBorder radius="md" p="md" shadow="sm">
      <Stack gap="md">
        <Group justify="space-between" align="center" wrap="wrap">
          <Group gap="xs" align="center">
            <Button
              variant="subtle"
              color="gray"
              size="compact-sm"
              onClick={() => setOpened((o) => !o)}
              rightSection={opened ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
              p={0}
            >
              <Text fw={700} size="md">
                Settlement Period Data Table
              </Text>
            </Button>
            <Badge variant="light" color="teal" size="xs">
              {filteredRecords.length.toLocaleString()} matching records
            </Badge>
          </Group>

          <Group gap="sm" wrap="wrap">
            <TextInput
              placeholder="Search date, SP..."
              leftSection={<IconSearch size={14} />}
              value={search}
              onChange={(e) => {
                setSearch(e.currentTarget.value)
                setPage(1)
              }}
              size="xs"
              w={180}
            />

            <Select
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val || 'all')
                setPage(1)
              }}
              data={STATUS_OPTIONS}
              size="xs"
              w={140}
            />

            <Select
              value={pageSize}
              onChange={(val) => {
                setPageSize(val || '25')
                setPage(1)
              }}
              data={PAGE_SIZE_OPTIONS}
              size="xs"
              w={100}
            />

            <Button
              leftSection={<IconDownload size={14} />}
              onClick={handleExportCsv}
              size="xs"
              color="teal"
              variant="outline"
            >
              Export CSV
            </Button>
          </Group>
        </Group>

        <Collapse expanded={opened}>
          <Stack gap="md" mt="xs">
            <ScrollArea>
              <Table striped highlightOnHover withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('target_time')}
                    >
                      <Group justify="space-between" gap="xs">
                        <Text size="xs" fw={700}>
                          Target Time (UTC)
                        </Text>
                        {renderSortIcon('target_time')}
                      </Group>
                    </Table.Th>
                    <Table.Th
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('settlement_period')}
                    >
                      <Group justify="space-between" gap="xs">
                        <Text size="xs" fw={700}>
                          SP
                        </Text>
                        {renderSortIcon('settlement_period')}
                      </Group>
                    </Table.Th>
                    <Table.Th
                      style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}
                      onClick={() => handleSort('actual_mw')}
                    >
                      <Group justify="flex-end" gap="xs">
                        <Text size="xs" fw={700}>
                          Actual Generation (MW)
                        </Text>
                        {renderSortIcon('actual_mw')}
                      </Group>
                    </Table.Th>
                    <Table.Th
                      style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}
                      onClick={() => handleSort('forecast_mw')}
                    >
                      <Group justify="flex-end" gap="xs">
                        <Text size="xs" fw={700}>
                          Day-Ahead Forecast (MW)
                        </Text>
                        {renderSortIcon('forecast_mw')}
                      </Group>
                    </Table.Th>
                    <Table.Th
                      style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}
                      onClick={() => handleSort('error_mw')}
                    >
                      <Group justify="flex-end" gap="xs">
                        <Text size="xs" fw={700}>
                          Forecast Error (MW)
                        </Text>
                        {renderSortIcon('error_mw')}
                      </Group>
                    </Table.Th>
                    <Table.Th
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('imbalance_type')}
                    >
                      <Group justify="space-between" gap="xs">
                        <Text size="xs" fw={700}>
                          Imbalance Position
                        </Text>
                        {renderSortIcon('imbalance_type')}
                      </Group>
                    </Table.Th>
                    <Table.Th>
                      <Text size="xs" fw={700}>
                        Publish Time (UTC)
                      </Text>
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {paginatedRecords.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={7}>
                        <Text ta="center" c="dimmed" py="md">
                          No matching settlement records found.
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    paginatedRecords.map((r) => {
                      const isDeficit = (r.error_mw ?? 0) < 0
                      const formattedErr =
                        r.error_mw != null
                          ? `${r.error_mw > 0 ? '+' : ''}${formatMw(r.error_mw)}`
                          : '—'
                      return (
                        <Table.Tr key={`${r.target_time}-${r.settlement_period}`}>
                          <Table.Td>
                            <Text size="xs" ff="monospace">
                              {formatUtcIso(r.target_time)}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge size="xs" variant="outline" color="gray">
                              SP {r.settlement_period}
                            </Badge>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Text size="xs" fw={600} c="teal">
                              {formatMw(r.actual_mw)}
                            </Text>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Text size="xs" fw={600} c="blue">
                              {formatMw(r.forecast_mw)}
                            </Text>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Text size="xs" fw={700} c={isDeficit ? 'red.4' : 'teal.4'}>
                              {formattedErr}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge size="xs" color={isDeficit ? 'red' : 'teal'} variant="filled">
                              {r.imbalance_type.toUpperCase()}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs" c="dimmed" ff="monospace">
                              {formatUtcIso(r.publish_time)}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      )
                    })
                  )}
                </Table.Tbody>
              </Table>
            </ScrollArea>

            <Group justify="space-between" align="center" wrap="wrap">
              <Text size="xs" c="dimmed">
                Showing {(page - 1) * numPageSize + 1}–
                {Math.min(page * numPageSize, sortedRecords.length)} of{' '}
                {sortedRecords.length.toLocaleString()} records
              </Text>

              <Pagination
                value={page}
                onChange={setPage}
                total={totalPages}
                size="sm"
                color="teal"
              />
            </Group>
          </Stack>
        </Collapse>
      </Stack>
    </Card>
  )
}
