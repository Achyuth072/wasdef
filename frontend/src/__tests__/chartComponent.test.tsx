import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Chart } from '@tanstack/react-charts'
import { defineChart, lineY } from '@tanstack/charts'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scalePoint } from '@tanstack/charts/scales/point'

describe('TanStack Chart Component', () => {
  it('renders SVG in the DOM', () => {
    const data = [
      { time: '00:00', actual: 12000 },
      { time: '00:30', actual: 12500 },
    ]

    const chart = defineChart({
      marks: [
        lineY(data, {
          x: 'time',
          y: 'actual',
          stroke: '#20c997',
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

    const { container } = render(
      <Chart definition={chart} height={300} ariaLabel="Test chart" />
    )
    expect(container).toBeDefined()
  })
})
