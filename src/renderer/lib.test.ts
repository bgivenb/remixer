import { describe, expect, it } from 'vitest'
import { bpmChoices, clampSelection, estimatedBars, formatDuration, formatTime, selectionIsFull, stemDisplayName } from './lib'
import { FEATURED_VIDEO, isFeaturedTrack, pinFeaturedTrack } from './featured'
import type { Track } from './types'

describe('renderer utilities', () => {
  it('formats transport time with milliseconds', () => {
    expect(formatTime(61.2344)).toBe('1:01.234')
    expect(formatDuration(61.4)).toBe('1:01')
  })

  it('clamps selections to the track', () => {
    expect(clampSelection({ start: -4, end: 99 }, 20)).toEqual({ start: 0, end: 20 })
    expect(clampSelection({ start: 15, end: 10 }, 20)).toEqual({ start: 15, end: 15 })
  })

  it('recognizes full selections and bar estimates', () => {
    expect(selectionIsFull({ start: 0, end: 30 }, 30)).toBe(true)
    expect(estimatedBars({ start: 0, end: 8 }, 120)).toBe(4)
  })

  it('formats stem names', () => {
    expect(stemDisplayName('lead_vocals')).toBe('Lead Vocals')
  })

  it('surfaces double-time when an older analysis only stored half-time', () => {
    expect(bpmChoices({ bpm: 73.83 } as never)).toEqual([147.66, 73.83])
  })

  it('recognizes and pins the permanent Given Peace example', () => {
    const ordinary = { id: 'ordinary', source_url: null } as Track
    const featured = { id: 'other-id', source_url: FEATURED_VIDEO.url } as Track
    expect(isFeaturedTrack(featured)).toBe(true)
    expect(pinFeaturedTrack([ordinary, featured])).toEqual([featured, ordinary])
  })
})
