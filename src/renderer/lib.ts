import type { AnalysisResult, Selection } from './types'

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00.000'
  const safe = Math.max(0, seconds)
  const minutes = Math.floor(safe / 60)
  const remainder = safe - minutes * 60
  return `${minutes}:${remainder.toFixed(3).padStart(6, '0')}`
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(total / 60)
  const remainder = total % 60
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

export function clampSelection(selection: Selection, duration: number): Selection {
  const start = Math.max(0, Math.min(duration, selection.start))
  const end = Math.max(start, Math.min(duration, selection.end))
  return { start, end }
}

export function selectionIsFull(selection: Selection, duration: number): boolean {
  return selection.start <= 0.001 && Math.abs(selection.end - duration) <= 0.01
}

export function confidenceLabel(value: number): string {
  if (value >= 0.72) return 'High confidence'
  if (value >= 0.45) return 'Medium confidence'
  return 'Low confidence'
}

export function stemDisplayName(name: string): string {
  return name.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function estimatedBars(selection: Selection, bpm?: number): number | null {
  if (!bpm || bpm <= 0) return null
  return ((selection.end - selection.start) * bpm) / 60 / 4
}

export function bpmChoices(analysis?: AnalysisResult | null): number[] {
  if (!analysis || !Number.isFinite(analysis.bpm) || analysis.bpm <= 0) return []
  const supplied = analysis.bpm_candidates?.filter((value) => Number.isFinite(value) && value > 0) || []
  const generated = analysis.bpm < 90 && analysis.bpm * 2 <= 190
    ? [analysis.bpm * 2, analysis.bpm]
    : [analysis.bpm]
  const ordered = supplied.length ? supplied : generated
  return ordered.filter((value, index) => ordered.findIndex((candidate) => Math.abs(candidate - value) < 0.02) === index)
}
