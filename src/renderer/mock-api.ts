import type { AnalysisResult, StemSet, Track, WaveformData, WorkerMessage } from './types'

function toneUrl(duration = 12, sampleRate = 8000): string {
  const sampleCount = duration * sampleRate
  const bytes = new ArrayBuffer(44 + sampleCount * 2)
  const view = new DataView(bytes)
  const text = (offset: number, value: string) => [...value].forEach((letter, index) => view.setUint8(offset + index, letter.charCodeAt(0)))
  text(0, 'RIFF')
  view.setUint32(4, 36 + sampleCount * 2, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, sampleCount * 2, true)
  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate
    const envelope = 0.55 + 0.45 * Math.sin(Math.PI * 2 * time * 2)
    const value = Math.sin(Math.PI * 2 * (220 + Math.sin(time * 0.4) * 80) * time) * envelope
    view.setInt16(44 + index * 2, Math.round(value * 11_000), true)
  }
  return URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }))
}

const audioUrl = toneUrl()
const waveform: WaveformData = {
  duration: 12,
  points: 2400,
  peaks: [Array.from({ length: 2400 }, (_, index) => Math.sin(index * 0.23) * (0.25 + 0.7 * Math.abs(Math.sin(index * 0.017))))],
}
const analysis: AnalysisResult = {
  bpm: 124,
  bpm_candidates: [124, 62],
  bpm_confidence: 0.86,
  beats: Array.from({ length: 25 }, (_, index) => index * (60 / 124)),
  key: { label: 'A Minor', tonic: 'A', mode: 'minor', confidence: 0.78, camelot: '8A', alternatives: [{ label: 'C Major', tonic: 'C', mode: 'major', confidence: 0.61, camelot: '8B' }] },
  chords: {
    progression: ['Am', 'F', 'C', 'G'],
    confidence: 0.71,
    segments: [
      { label: 'Am', start: 0, end: 3, confidence: 0.8 },
      { label: 'F', start: 3, end: 6, confidence: 0.71 },
      { label: 'C', start: 6, end: 9, confidence: 0.76 },
      { label: 'G', start: 9, end: 12, confidence: 0.67 },
    ],
  },
  selection: { start: 0, end: 12 },
  analyzed_at: new Date().toISOString(),
}
const stems: StemSet = {
  mode: 'full',
  model: 'roformer-model-bs-roformer-sw-by-jarredou',
  device: 'cuda:0',
  paths: Object.fromEntries(['vocals', 'drums', 'bass', 'guitar', 'piano', 'other', 'instrumental'].map((stem) => [stem, `mock://${stem}.wav`])),
  created_at: new Date().toISOString(),
}
const track: Track = {
  id: 'visual-demo',
  title: 'Midnight Rework',
  artist: 'Local preview',
  source_kind: 'local',
  source_path: 'mock://source.wav',
  working_path: 'mock://working.wav',
  track_dir: 'mock://track',
  duration: 12,
  sample_rate: 44100,
  channels: 2,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  analysis,
  stem_sets: { full: stems },
}

export function installBrowserMock(): void {
  if (window.remixer) return
  window.remixer = {
    getEngineStatus: async () => ({
      installed: true,
      ready: true,
      python: 'mock',
      details: {
        python: '3.11', ready: true, ffmpeg: 'mock', ffprobe: 'mock',
        cuda: { available: true, device: 'NVIDIA GeForce RTX 3080', vram_gb: 10 },
        packages: {},
      },
    }),
    installEngine: async () => ({ ok: true }),
    chooseAudioFile: async () => null,
    runWorker: async <T,>(request: Record<string, unknown>) => {
      if (request.command === 'list_tracks') return [track] as T
      if (request.command === 'waveform') return waveform as T
      if (request.command === 'analyze') return analysis as T
      if (request.command === 'separate') return stems as T
      if (request.command === 'render_clips') return { paths: request.files || {}, directory: 'mock://clips' } as T
      return track as T
    },
    stopWorker: async () => ({ ok: true }),
    copyFiles: async (files) => ({ ok: true, count: files.length }),
    copyText: async () => ({ ok: true }),
    showItem: async () => undefined,
    openPath: async () => '',
    mediaUrl: async () => audioUrl,
    onWorkerMessage: (_callback: (message: WorkerMessage) => void) => () => undefined,
    onInstallMessage: () => () => undefined,
  }
}
