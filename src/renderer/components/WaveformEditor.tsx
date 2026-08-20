import { useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'
import type { Region } from 'wavesurfer.js/dist/plugins/regions.esm.js'
import { MoveHorizontal, MousePointer2, Pause, Play, Repeat2, RotateCcw, ScanLine, ZoomIn, ZoomOut } from 'lucide-react'
import type { AnalysisResult, Selection } from '../types'
import { clampSelection, formatTime } from '../lib'

interface WaveformEditorProps {
  url: string
  peaks: number[][]
  duration: number
  selection: Selection
  onSelectionChange: (selection: Selection) => void
  onError: (message: string) => void
  analysis?: AnalysisResult | null
  previewLabel: string
  seekRequest?: { time: number; nonce: number } | null
  onTimeChange?: (time: number) => void
}

export function WaveformEditor({
  url,
  peaks,
  duration,
  selection,
  onSelectionChange,
  onError,
  analysis,
  previewLabel,
  seekRequest,
  onTimeChange,
}: WaveformEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const waveRef = useRef<WaveSurfer | null>(null)
  const regionRef = useRef<Region | null>(null)
  const updatingRef = useRef(false)
  const loopRef = useRef(true)
  const [playing, setPlaying] = useState(false)
  const [loop, setLoop] = useState(true)
  const [ready, setReady] = useState(false)
  const [selectionMode, setSelectionMode] = useState<'draw' | 'adjust'>('draw')
  const [time, setTime] = useState(0)
  const [zoom, setZoom] = useState(32)

  useEffect(() => {
    if (!containerRef.current) return
    const regions = RegionsPlugin.create()
    const wave = WaveSurfer.create({
      container: containerRef.current,
      url,
      peaks,
      duration,
      backend: 'MediaElement',
      height: 190,
      waveColor: '#5f5f5f',
      progressColor: '#ffffff',
      cursorColor: '#ffffff',
      cursorWidth: 1,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: false,
      minPxPerSec: zoom,
      plugins: [regions],
    })
    waveRef.current = wave
    let disableDragSelection = () => {}
    wave.on('ready', () => {
      const clamped = clampSelection(selection, wave.getDuration())
      updatingRef.current = true
      const initialRegion = regions.addRegion({
        start: clamped.start,
        end: clamped.end || wave.getDuration(),
        color: 'rgba(217, 255, 91, 0.13)',
        drag: false,
        resize: false,
      })
      regionRef.current = initialRegion
      if (initialRegion.element) initialRegion.element.style.pointerEvents = 'none'
      updatingRef.current = false
      disableDragSelection = regions.enableDragSelection({ color: 'rgba(217, 255, 91, 0.13)', drag: true, resize: true }, 3)
      setReady(true)
    })
    wave.on('play', () => setPlaying(true))
    wave.on('pause', () => setPlaying(false))
    wave.on('finish', () => setPlaying(false))
    wave.on('timeupdate', (value) => {
      setTime(value)
      onTimeChange?.(value)
    })
    wave.on('error', (waveError) => onError(`Audio preview failed: ${waveError instanceof Error ? waveError.message : String(waveError)}`))

    regions.on('region-created', (region) => {
      if (updatingRef.current || region === regionRef.current) return
      regionRef.current?.remove()
      regionRef.current = region
      region.setOptions({ drag: true, resize: true })
      if (region.element) region.element.style.pointerEvents = 'all'
      setSelectionMode('adjust')
      onSelectionChange({ start: region.start, end: region.end })
    })
    regions.on('region-updated', (region) => {
      if (!updatingRef.current) onSelectionChange({ start: region.start, end: region.end })
    })
    regions.on('region-out', (region) => {
      if (loopRef.current && region === regionRef.current) region.play(true)
    })

    return () => {
      disableDragSelection()
      wave.destroy()
      waveRef.current = null
      regionRef.current = null
    }
    // Recreate only when the preview source changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  useEffect(() => {
    loopRef.current = loop
  }, [loop])

  useEffect(() => {
    const region = regionRef.current
    if (!region) return
    const adjust = selectionMode === 'adjust'
    region.setOptions({ drag: adjust, resize: adjust })
    if (region.element) region.element.style.pointerEvents = adjust ? 'all' : 'none'
  }, [selectionMode])

  useEffect(() => {
    const wave = waveRef.current
    if (wave && wave.getDuration() > 0) wave.zoom(zoom)
  }, [zoom])

  useEffect(() => {
    const region = regionRef.current
    if (!region) return
    const clamped = clampSelection(selection, duration)
    if (Math.abs(region.start - clamped.start) < 0.005 && Math.abs(region.end - clamped.end) < 0.005) return
    updatingRef.current = true
    region.setOptions({ start: clamped.start, end: clamped.end })
    updatingRef.current = false
  }, [duration, selection])

  useEffect(() => {
    const wave = waveRef.current
    if (!wave || !ready || !seekRequest) return
    const nextTime = Math.max(0, Math.min(seekRequest.time, wave.getDuration()))
    wave.setTime(nextTime)
    setTime(nextTime)
    onTimeChange?.(nextTime)
  }, [onTimeChange, ready, seekRequest])

  const togglePlayback = async () => {
    const wave = waveRef.current
    if (!wave || !ready) return
    try {
      if (wave.isPlaying()) {
        wave.pause()
        return
      }
      const current = wave.getCurrentTime()
      if (current >= selection.start && current < selection.end) await wave.play(current, selection.end)
      else regionRef.current?.play(true)
    } catch (playError) {
      onError(`Unable to play audio: ${playError instanceof Error ? playError.message : String(playError)}`)
    }
  }

  const selectAll = () => {
    setSelectionMode('adjust')
    onSelectionChange({ start: 0, end: duration })
  }

  const restartSelection = () => {
    const wave = waveRef.current
    if (!wave || !ready) return
    wave.setTime(selection.start)
    setTime(selection.start)
  }

  const seekToChord = (start: number) => {
    const wave = waveRef.current
    if (!wave || !ready) return
    wave.setTime(start)
    setTime(start)
    onTimeChange?.(start)
  }

  return (
    <section className="wave-panel panel">
      <div className="wave-toolbar">
        <div className="transport-group">
          <button className="icon-button primary-icon" onClick={togglePlayback} disabled={!ready} aria-label={playing ? 'Pause' : 'Play selected audio'}>
            {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
          <span className="transport-time">{formatTime(time)}</span>
          <span className="muted">of {formatTime(duration)}</span>
        </div>
        <div className="preview-source"><ScanLine size={15} /> Previewing <strong>{previewLabel}</strong></div>
        <div className="wave-actions">
          <button className="small-button" onClick={restartSelection} disabled={!ready} title="Return to selection start"><RotateCcw size={14} /> Start</button>
          <button className={`small-button ${selectionMode === 'draw' ? 'active' : ''}`} onClick={() => setSelectionMode('draw')} title="Drag anywhere on the waveform to replace the selection">
            <MousePointer2 size={14} /> New selection
          </button>
          <button className={`small-button ${selectionMode === 'adjust' ? 'active' : ''}`} onClick={() => setSelectionMode('adjust')} title="Move the highlighted area or resize its edge handles">
            <MoveHorizontal size={14} /> Adjust
          </button>
          <button className={`small-button ${loop ? 'active' : ''}`} onClick={() => setLoop((value) => !value)}>
            <Repeat2 size={15} /> Loop
          </button>
          <button className="small-button" onClick={selectAll}>Select all</button>
          <button className="icon-button" onClick={() => setZoom((value) => Math.max(8, value - 12))} aria-label="Zoom out"><ZoomOut size={16} /></button>
          <button className="icon-button" onClick={() => setZoom((value) => Math.min(180, value + 12))} aria-label="Zoom in"><ZoomIn size={16} /></button>
        </div>
      </div>
      <div className="wave-scroll"><div ref={containerRef} className="waveform" /></div>
      <div className="wave-help">{selectionMode === 'draw' ? 'Drag across the waveform to draw a new selection.' : 'Drag the highlighted center to move it, or drag either bright edge to resize.'}</div>
      {analysis?.chords.segments.length ? (
        <div className="chord-timeline" aria-label="Detected chord timeline">
          {analysis.chords.segments.map((segment, index) => {
            const left = (segment.start / duration) * 100
            const width = ((segment.end - segment.start) / duration) * 100
            return (
              <button
                key={`${segment.label}-${index}`}
                className={`chord-block ${time >= segment.start && time < segment.end ? 'active' : ''}`}
                style={{ left: `${left}%`, width: `${Math.max(width, 0.7)}%` }}
                title={`${segment.label} · ${Math.round(segment.confidence * 100)}%`}
                onClick={() => seekToChord(segment.start)}
                aria-label={`Seek to ${segment.label} at ${formatTime(segment.start)}`}
              >
                {segment.label}
              </button>
            )
          })}
        </div>
      ) : null}
      <div className="selection-readout">
        <span>Selection</span>
        <label>Start <input type="number" step="0.001" min="0" max={duration} value={selection.start.toFixed(3)} onChange={(event) => onSelectionChange(clampSelection({ start: Number(event.target.value), end: selection.end }, duration))} /></label>
        <label>End <input type="number" step="0.001" min="0" max={duration} value={selection.end.toFixed(3)} onChange={(event) => onSelectionChange(clampSelection({ start: selection.start, end: Number(event.target.value) }, duration))} /></label>
        <span className="selection-length">{formatTime(selection.end - selection.start)} selected</span>
      </div>
    </section>
  )
}
