import { describe, it, expect } from 'vitest'
import { resolveHeatmapRange, buildCells } from '../../src/lib/useHeatmap.js'

const key = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

describe('resolveHeatmapRange 12w', () => {
  it('spans exactly 12 weeks, Monday to Sunday', () => {
    const { start, end, year } = resolveHeatmapRange('12w', new Date(2026, 4, 13))
    expect(year).toBeNull()
    expect(start.getDay()).toBe(1)
    expect(end.getDay()).toBe(0)
    expect(Math.round((end - start) / 86400000) + 1).toBe(84)
  })

  it('ends on the current Sunday when today is mid-week', () => {
    const { end } = resolveHeatmapRange('12w', new Date(2026, 4, 13))
    expect(key(end)).toBe('2026-05-17')
  })

  it('ends today when today is Sunday', () => {
    const { end } = resolveHeatmapRange('12w', new Date(2026, 4, 17, 15, 30))
    expect(key(end)).toBe('2026-05-17')
  })

  it('ends the next Sunday when today is Monday', () => {
    const { end } = resolveHeatmapRange('12w', new Date(2026, 4, 11))
    expect(key(end)).toBe('2026-05-17')
  })

  it('crosses the year boundary', () => {
    const { start, end } = resolveHeatmapRange('12w', new Date(2026, 0, 7))
    expect(key(end)).toBe('2026-01-11')
    expect(start.getFullYear()).toBe(2025)
    expect(key(start)).toBe('2025-10-20')
  })
})

describe('resolveHeatmapRange year', () => {
  it('pads to full Monday-Sunday weeks around the year', () => {
    const { start, end, year } = resolveHeatmapRange(2026)
    expect(year).toBe(2026)
    expect(key(start)).toBe('2025-12-29')
    expect(key(end)).toBe('2027-01-03')
  })

  it('does not pad the start when Jan 1 is a Monday', () => {
    const { start, end } = resolveHeatmapRange(2018)
    expect(key(start)).toBe('2018-01-01')
    expect(key(end)).toBe('2019-01-06')
  })

  it('always covers whole weeks', () => {
    for (const y of [2020, 2021, 2024, 2025, 2026]) {
      const { start, end } = resolveHeatmapRange(y)
      const days = Math.round((end - start) / 86400000) + 1
      expect(days % 7).toBe(0)
    }
  })

  it('accepts the year as a string', () => {
    expect(resolveHeatmapRange('2026').year).toBe(2026)
  })
})

describe('buildCells', () => {
  const today = new Date(2026, 4, 13, 10)
  const { start, end, year } = resolveHeatmapRange('12w', today)

  it('returns one cell per day, inclusive of both ends', () => {
    const cells = buildCells([], start, end, today, year)
    expect(cells).toHaveLength(84)
    expect(cells[0].dateKey).toBe(key(start))
    expect(cells[83].dateKey).toBe(key(end))
  })

  it('keeps a session on the Sunday of the final week', () => {
    const sunday = new Date(2026, 4, 17, 9)
    const futureToday = new Date(2026, 4, 18)
    const cells = buildCells(
      [{ startedAt: sunday.toISOString() }],
      start,
      end,
      futureToday,
      year,
    )
    const last = cells[cells.length - 1]
    expect(last.dateKey).toBe('2026-05-17')
    expect(last.count).toBe(1)
  })

  it('keeps a session on the first Monday of the window', () => {
    const cells = buildCells(
      [{ startedAt: new Date(start.getTime() + 3600000).toISOString() }],
      start,
      end,
      today,
      year,
    )
    expect(cells[0].count).toBe(1)
  })

  it('zeroes the count on future days', () => {
    const future = new Date(2026, 4, 15, 9)
    const cells = buildCells(
      [{ startedAt: future.toISOString() }],
      start,
      end,
      today,
      year,
    )
    const cell = cells.find((c) => c.dateKey === '2026-05-15')
    expect(cell.isFuture).toBe(true)
    expect(cell.count).toBe(0)
  })

  it('flags today and not tomorrow as future', () => {
    const cells = buildCells([], start, end, today, year)
    const todayCell = cells.find((c) => c.dateKey === '2026-05-13')
    expect(todayCell.isToday).toBe(true)
    expect(todayCell.isFuture).toBe(false)
    expect(cells.find((c) => c.dateKey === '2026-05-14').isFuture).toBe(true)
  })

  it('counts several sessions on the same day', () => {
    const day = new Date(2026, 4, 12)
    const sessions = [8, 18].map((h) => ({
      startedAt: new Date(2026, 4, 12, h).toISOString(),
    }))
    const cells = buildCells(sessions, start, end, today, year)
    expect(cells.find((c) => c.dateKey === key(day)).count).toBe(2)
  })

  it('keeps the highest intensity of the day', () => {
    const sessions = [
      { startedAt: new Date(2026, 4, 12, 8).toISOString(), intensity: 0.3 },
      { startedAt: new Date(2026, 4, 12, 18).toISOString(), intensity: 0.9 },
    ]
    const cells = buildCells(sessions, start, end, today, year)
    expect(cells.find((c) => c.dateKey === '2026-05-12').intensity).toBe(0.9)
  })

  it('leaves intensity null when sessions have none', () => {
    const cells = buildCells(
      [{ startedAt: new Date(2026, 4, 12, 8).toISOString() }],
      start,
      end,
      today,
      year,
    )
    expect(cells.find((c) => c.dateKey === '2026-05-12').intensity).toBeNull()
  })

  it('marks padding days from adjacent years as outside in a year view', () => {
    const range = resolveHeatmapRange(2026, new Date(2026, 5, 1))
    const cells = buildCells(
      [{ startedAt: new Date(2025, 11, 30, 9).toISOString() }],
      range.start,
      range.end,
      new Date(2026, 5, 1),
      range.year,
    )
    const dec30 = cells.find((c) => c.dateKey === '2025-12-30')
    expect(dec30.isOutside).toBe(true)
    expect(dec30.count).toBe(0)
    expect(cells.find((c) => c.dateKey === '2026-01-01').isOutside).toBe(false)
  })

  it('never marks outside in the 12w view', () => {
    const cells = buildCells([], start, end, today, null)
    expect(cells.every((c) => !c.isOutside)).toBe(true)
  })

  it('counts Dec 31 and Jan 1 sessions on their own days', () => {
    const t = new Date(2027, 5, 1)
    const range = resolveHeatmapRange(2026, t)
    const cells = buildCells(
      [
        { startedAt: new Date(2026, 11, 31, 23, 30).toISOString() },
        { startedAt: new Date(2026, 0, 1, 0, 30).toISOString() },
      ],
      range.start,
      range.end,
      t,
      range.year,
    )
    expect(cells.find((c) => c.dateKey === '2026-12-31').count).toBe(1)
    expect(cells.find((c) => c.dateKey === '2026-01-01').count).toBe(1)
  })
})
