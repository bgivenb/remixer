export interface EngineStatus {
  installed: boolean
  ready: boolean
  python: string | null
  error?: string
  details?: {
    python: string
    ready: boolean
    ffmpeg: string | null
    ffprobe: string | null
    cuda: { available: boolean; device: string | null; vram_gb: number | null }
    packages: Record<string, boolean>
  }
}

export interface Selection {
  start: number
  end: number
}

export interface KeyResult {
  label: string
  tonic: string | null
  mode: string | null
  confidence: number
  camelot: string | null
  mode_ambiguous?: boolean
  alternatives?: KeyResult[]
}

export interface ChordSegment {
  label: string
  start: number
  end: number
  confidence: number
}

export interface AnalysisResult {
  bpm: number
  bpm_candidates?: number[]
  raw_bpm?: number
  bpm_confidence: number
  beats: number[]
  key: KeyResult
  chords: {
    progression: string[]
    segments: ChordSegment[]
    confidence: number
  }
  selection: Selection
  analyzed_at: string
  analysis_version?: number
}

export interface WaveformData {
  peaks: number[][]
  duration: number
  points: number
}

export interface StemSet {
  mode: string
  model: string
  device: string
  paths: Record<string, string>
  created_at: string
}

export interface Track {
  id: string
  title: string
  artist?: string | null
  source_kind: 'local' | 'url'
  source_url?: string | null
  source_path: string
  working_path: string
  track_dir: string
  thumbnail_path?: string | null
  duration: number
  sample_rate: number
  channels: number
  created_at: string
  updated_at: string
  analysis?: AnalysisResult | null
  stem_sets: Record<string, StemSet>
}

export interface WorkerMessage {
  type: 'ready' | 'progress' | 'result' | 'error' | 'log'
  request_id?: string
  stage?: string
  progress?: number
  message?: string
  error?: string
}

export interface ProgressState {
  stage: string
  progress: number
  message: string
}
