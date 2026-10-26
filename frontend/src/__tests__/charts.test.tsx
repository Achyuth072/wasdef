import { describe, it, expect } from 'vitest'
import { defineChart, lineY, barY, ruleY } from '@tanstack/charts'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scaleBand } from '@tanstack/charts/scales/band'
import { scalePoint } from '@tanstack/charts/scales/point'

describe('TanStack Charts definition', () => {
  it('defines a dual line chart properly', () => {
    const data = [
      { time: '00:00', actual: 12000, forecast: 11500 },
      { time: '00:30', actual: 12500, forecast: 13000 },
    ]

    const chart = defineChart({
      marks: [
        lineY(data, {
          x: 'time',
          y: 'actual',
          stroke: '#20c997',
        }),
        lineY(data, {
          x: 'time',
          y: 'forecast',
          stroke: '#339af0',
        }),
      ],
      scales: {
        x: {
          scale: () => scalePoint(),
        },
        y: {
          scale: scaleLinear,
          nice: true,
        },
      },
    })

    expect(chart).toBeDefined()
    expect(chart.marks.length).toBe(2)
  })

  it('defines an imbalance bar chart properly', () => {
    const data = [
      { time: '00:00', error: -500, color: '#fa5252' },
      { time: '00:30', error: 600, color: '#12b886' },
    ]

    const chart = defineChart({
      marks: [
        ruleY([0], { stroke: '#868e96', strokeDasharray: '4 4' }),
        barY(data, {
          x: 'time',
          y: 'error',
          fill: (d: { color: string }) => d.color,
        }),
      ],
      scales: {
        x: {
          scale: () => scaleBand().padding(0.2),
        },
        y: {
          scale: scaleLinear,
          nice: true,
        },
      },
    })

    expect(chart).toBeDefined()
    expect(chart.marks.length).toBe(2)
  })
})
