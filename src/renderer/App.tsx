import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AudioLines,
  Clipboard,
  ClipboardCopy,
  Cpu,
  Download,
  FileAudio,
  FolderOpen,
  Gauge,
  GraduationCap,
  HelpCircle,
  History,
  KeyRound,
  LoaderCircle,
  Music2,
  RotateCcw,
  Scissors,
  Settings,
  Sparkles,
  Square,
  WandSparkles,
} from 'lucide-react'
import { EngineSetup } from './components/EngineSetup'
import { StemRack } from './components/StemRack'
import { WaveformEditor } from './components/WaveformEditor'
import { YouTubeBrowser } from './components/YouTubeBrowser'
import { HelpCenter } from './components/HelpCenter'
import { Tutorial } from './components/Tutorial'
import { StorageSettings } from './components/StorageSettings'
import { WelcomeSupport } from './components/WelcomeSupport'
import type { AnalysisResult, EngineStatus, KeyResult, ProgressState, Selection, StemSet, StorageStatus, Track, WaveformData, WorkerMessage, YouTubeVideo } from './types'
import { bpmChoices, confidenceLabel, estimatedBars, formatDuration, selectionIsFull } from './lib'
import { FEATURED_VIDEO, isFeaturedTrack, pinFeaturedTrack } from './featured'

const CAMELOT_MAJOR = ['8B', '3B', '10B', '5B', '12B', '7B', '2B', '9B', '4B', '11B', '6B', '1B']
const CAMELOT_MINOR = ['5A', '12A', '7A', '2A', '9A', '4A', '11A', '6A', '1A', '8A', '3A', '10A']
const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const ALL_WORKING_KEYS: KeyResult[] = PITCH_NAMES.flatMap((tonic, index) => ([
  { label: `${tonic} Major`, tonic, mode: 'major', confidence: 0, camelot: CAMELOT_MAJOR[index] },
  { label: `${tonic} Minor`, tonic, mode: 'minor', confidence: 0, camelot: CAMELOT_MINOR[index] },
]))

function App() {
  const [engine, setEngine] = useState<EngineStatus | null>(null)
  const [installing, setInstalling] = useState(false)
  const [installLog, setInstallLog] = useState('')
  const [recentTracks, setRecentTracks] = useState<Track[]>([])
  const [libraryLoaded, setLibraryLoaded] = useState(false)
  const [track, setTrack] = useState<Track | null>(null)
  const [url, setUrl] = useState('')
  const [selection, setSelection] = useState<Selection>({ start: 0, end: 0 })
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [activeStemSet, setActiveStemSet] = useState<StemSet | null>(null)
  const [previewPath, setPreviewPath] = useState<string | null>(null)
  const [previewLabel, setPreviewLabel] = useState('Original mix')
  const [mediaUrl, setMediaUrl] = useState('')
  const [waveformData, setWaveformData] = useState<WaveformData | null>(null)
  const [selectedBpm, setSelectedBpm] = useState<number | null>(null)
  const [selectedKey, setSelectedKey] = useState<KeyResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')
  const [playbackTime, setPlaybackTime] = useState(0)
  const [seekRequest, setSeekRequest] = useState<{ time: number; nonce: number } | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [tutorialOpen, setTutorialOpen] = useState(() => window.localStorage.getItem('remixer:tutorial-complete') !== '1')
  const [tutorialStep, setTutorialStep] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [welcomeOpen, setWelcomeOpen] = useState(true)
  const [storage, setStorage] = useState<StorageStatus | null>(null)
  const [storageBusy, setStorageBusy] = useState(false)
  const featuredBootStarted = useRef(false)

  const refreshTracks = useCallback(async () => {
    const tracks = await window.remixer.runWorker<Track[]>({ command: 'list_tracks' })
    const pinnedTracks = pinFeaturedTrack(tracks)
    setRecentTracks(pinnedTracks)
    setLibraryLoaded(true)
    return pinnedTracks
  }, [])

  const checkEngine = useCallback(async () => {
    const status = await window.remixer.getEngineStatus()
    setEngine(status)
    if (status.ready) {
      await window.remixer.runWorker<Track | null>({ command: 'ensure_tutorial' })
      await window.remixer.runWorker<StorageStatus>({ command: 'cleanup_storage' })
      await refreshTracks()
    }
  }, [refreshTracks])

  useEffect(() => {
    void checkEngine()
    const removeWorkerListener = window.remixer.onWorkerMessage((message: WorkerMessage) => {
      if (message.type === 'progress') {
        setProgress({ stage: message.stage || 'working', progress: message.progress || 0, message: message.message || 'Working…' })
      } else if (message.type === 'log' && message.message) {
        setProgress((current) => current ? { ...current, message: message.message || current.message } : current)
      }
    })
    const removeInstallListener = window.remixer.onInstallMessage((message) => {
      setInstallLog((current) => `${current}${message}`.slice(-12_000))
    })
    return () => {
      removeWorkerListener()
      removeInstallListener()
    }
  }, [checkEngine])

  useEffect(() => {
    if (!previewPath) {
      setMediaUrl('')
      setWaveformData(null)
      return
    }
    let active = true
    setMediaUrl('')
    setWaveformData(null)
    void Promise.all([
      window.remixer.mediaUrl(previewPath),
      window.remixer.runWorker<WaveformData>({ command: 'waveform', path: previewPath, points: 6000 }),
    ]).then(([value, waveform]) => {
      if (active) {
        setMediaUrl(value)
        setWaveformData(waveform)
      }
    }).catch((waveformError) => {
      if (active) setError(`Unable to prepare audio preview: ${waveformError instanceof Error ? waveformError.message : String(waveformError)}`)
    })
    return () => { active = false }
  }, [previewPath])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const runTask = async <T,>(work: () => Promise<T>): Promise<T | null> => {
    setBusy(true)
    setError('')
    setProgress({ stage: 'starting', progress: 0.01, message: 'Starting…' })
    try {
      return await work()
    } catch (taskError) {
      setError(taskError instanceof Error ? taskError.message : String(taskError))
      return null
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  const openTrack = useCallback((nextTrack: Track) => {
    setTrack(nextTrack)
    setAnalysis(nextTrack.analysis || null)
    setActiveStemSet(nextTrack.stem_sets.full || nextTrack.stem_sets.vocals || null)
    setSelectedBpm(bpmChoices(nextTrack.analysis)[0] || null)
    setSelectedKey(nextTrack.analysis?.key || null)
    const saved = nextTrack.analysis?.selection
    setSelection(saved || { start: 0, end: Math.min(nextTrack.duration, 30) })
    setPreviewPath(nextTrack.working_path)
    setPreviewLabel('Original mix')
    setPlaybackTime(0)
    setSeekRequest(null)
    setError('')
  }, [])

  const selectTrack = async (nextTrack: Track) => {
    if (!nextTrack.offloaded) {
      openTrack(nextTrack)
      return
    }
    const restored = await runTask(() => window.remixer.runWorker<Track>({ command: 'restore_track', track_dir: nextTrack.track_dir }))
    if (restored) {
      openTrack(restored)
      await refreshTracks()
      setToast('Project audio restored; analysis was preserved')
    }
  }

  const installEngine = async () => {
    setInstalling(true)
    setInstallLog('')
    setError('')
    try {
      await window.remixer.installEngine()
      await checkEngine()
    } catch (installError) {
      setEngine((current) => ({ ...(current || { installed: false, ready: false, python: null }), error: installError instanceof Error ? installError.message : String(installError) }))
    } finally {
      setInstalling(false)
    }
  }

  const importFile = async () => {
    const file = await window.remixer.chooseAudioFile()
    if (!file) return
    const imported = await runTask(() => window.remixer.runWorker<Track>({ command: 'import', path: file }))
    if (imported) {
      openTrack(imported)
      await refreshTracks()
    }
  }

  const downloadTrack = async (requestedUrl = url) => {
    const sourceUrl = requestedUrl.trim()
    if (!sourceUrl) {
      setError('Paste a YouTube video URL first.')
      return
    }
    setUrl(sourceUrl)
    const downloaded = await runTask(() => window.remixer.runWorker<Track>({ command: 'download', url: sourceUrl }))
    if (downloaded) {
      openTrack(downloaded)
      await refreshTracks()
    }
  }

  useEffect(() => {
    if (!engine?.ready || !libraryLoaded || featuredBootStarted.current) return
    featuredBootStarted.current = true
    setUrl(FEATURED_VIDEO.url)
    const existingFeaturedTrack = recentTracks.find(isFeaturedTrack)
    if (existingFeaturedTrack) {
      openTrack(existingFeaturedTrack)
      return
    }
    void downloadTrack(FEATURED_VIDEO.url)
  }, [engine?.ready, libraryLoaded, recentTracks, openTrack])

  const analyze = async () => {
    if (!track) return
    const result = await runTask(() => window.remixer.runWorker<AnalysisResult>({
      command: 'analyze',
      track_dir: track.track_dir,
      start: selection.start,
      end: selection.end,
    }))
    if (result) {
      setAnalysis(result)
      setSelectedBpm(bpmChoices(result)[0] || result.bpm)
      setSelectedKey(result.key)
      setTrack((current) => current ? { ...current, analysis: result } : current)
      setToast('Key, BPM, and chords detected')
      await refreshTracks()
    }
  }

  const separate = async (mode: 'full' | 'vocals') => {
    if (!track) return
    const result = await runTask(() => window.remixer.runWorker<StemSet>({ command: 'separate', track_dir: track.track_dir, mode }))
    if (result) {
      setActiveStemSet(result)
      setTrack((current) => current ? { ...current, stem_sets: { ...current.stem_sets, [mode]: result } } : current)
      setToast(mode === 'full' ? 'Six stems are ready' : 'HQ vocals are ready')
      await refreshTracks()
      await window.remixer.runWorker<StorageStatus>({ command: 'cleanup_storage', protected_track_dir: track.track_dir })
    }
  }

  const renderSelection = async (files: Record<string, string>) => {
    if (!track) return null
    return await runTask(() => window.remixer.runWorker<{ paths: Record<string, string>; directory: string }>({
      command: 'render_clips',
      track_dir: track.track_dir,
      files,
      start: selection.start,
      end: selection.end,
      bpm: selectedBpm || analysis?.bpm,
      key: selectedKey?.label || analysis?.key.label,
    }))
  }

  const copyFullFiles = async (files: string[], label: string) => {
    try {
      await window.remixer.copyFiles(files)
      setToast(`${label} copied as ${files.length === 1 ? 'a WAV file' : `${files.length} WAV files`}`)
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : String(copyError))
    }
  }

  const copySelectionFiles = async (files: Record<string, string>, label: string) => {
    const rendered = await renderSelection(files)
    if (!rendered) return
    await copyFullFiles(Object.values(rendered.paths), label)
  }

  const stemEntries = activeStemSet ? Object.entries(activeStemSet.paths) : []
  const featuredTrack = recentTracks.find(isFeaturedTrack)
  const otherRecentTracks = recentTracks.filter((item) => !isFeaturedTrack(item))
  const tempoOptions = bpmChoices(analysis)
  const detectedKeyOptions = analysis
    ? [analysis.key, ...(analysis.key.alternatives || [])].filter((candidate, index, values) => (
      values.findIndex((value) => value.label === candidate.label) === index
    ))
    : []
  const workingKeyOptions = [...detectedKeyOptions, ...ALL_WORKING_KEYS].filter((candidate, index, values) => (
    values.findIndex((value) => value.label === candidate.label) === index
  ))
  const bars = estimatedBars(selection, selectedBpm || analysis?.bpm)
  const chordText = analysis?.chords.progression.join('  →  ') || ''
  const compute = engine?.details?.separation
  const computeLabel = compute?.backend === 'mlx'
    ? 'Apple Silicon GPU'
    : engine?.details?.cuda.device || (compute?.device === 'mps' ? 'Apple GPU via MPS' : 'Local engine')
  const computeDetail = compute ? `${compute.backend.toUpperCase()} · ${compute.device.toUpperCase()}` : 'CPU'
  const fileDestination = engine?.platform === 'darwin' ? 'Finder' : 'Explorer'

  const cycleTempo = () => {
    if (tempoOptions.length < 2) return
    const index = Math.max(0, tempoOptions.findIndex((value) => Math.abs(value - (selectedBpm || 0)) < 0.02))
    setSelectedBpm(tempoOptions[(index + 1) % tempoOptions.length])
  }

  const copyChordText = async () => {
    if (!chordText) return
    await window.remixer.copyText(chordText)
    setToast('Chord progression copied')
  }

  const useYouTubeVideo = (video: YouTubeVideo) => {
    void downloadTrack(video.url)
  }

  const startTutorial = () => {
    setHelpOpen(false)
    setTutorialStep(0)
    setTutorialOpen(true)
    if (featuredTrack) openTrack(featuredTrack)
    else void downloadTrack(FEATURED_VIDEO.url)
  }

  const tutorialTrackReady = Boolean(featuredTrack && !featuredTrack.offloaded)
  const tutorialRequired = window.localStorage.getItem('remixer:tutorial-complete') !== '1'
  const useTutorialTrack = () => { if (featuredTrack) openTrack(featuredTrack) }
  const showTutorialOriginal = () => {
    if (!featuredTrack) return
    openTrack(featuredTrack)
    setPreviewPath(featuredTrack.working_path)
    setPreviewLabel('Original mix')
  }
  const jumpTutorialChord = async (): Promise<boolean> => {
    if (!featuredTrack) return false
    openTrack(featuredTrack)
    const result = await runTask(() => window.remixer.runWorker<AnalysisResult>({ command: 'analyze', track_dir: featuredTrack.track_dir, start: 0, end: featuredTrack.duration }))
    if (!result) return false
    setAnalysis(result)
    setSelectedBpm(bpmChoices(result)[0] || result.bpm)
    setSelectedKey(result.key)
    setTrack((current) => current ? { ...current, analysis: result } : current)
    const chord = result.chords.segments.find((segment) => segment.start > 1) || result.chords.segments[0]
    if (chord) seekToChord(chord.start)
    await refreshTracks()
    return true
  }
  const previewTutorialVocal = async (): Promise<boolean> => {
    if (!featuredTrack) return false
    openTrack(featuredTrack)
    const result = await runTask(() => window.remixer.runWorker<StemSet>({ command: 'separate', track_dir: featuredTrack.track_dir, mode: 'full' }))
    if (!result) return false
    setActiveStemSet(result)
    setTrack((current) => current ? { ...current, stem_sets: { ...current.stem_sets, full: result } } : current)
    const vocal = result.paths.vocals
    if (vocal) {
      setPreviewPath(vocal)
      setPreviewLabel('Vocals')
    }
    await refreshTracks()
    return true
  }
  const completeTutorial = () => {
    window.localStorage.setItem('remixer:tutorial-complete', '1')
    setTutorialOpen(false)
    setToast('Tutorial complete — make it yours')
  }

  const openSettings = async () => {
    setSettingsOpen(true)
    try {
      setStorage(await window.remixer.runWorker<StorageStatus>({ command: 'storage_status' }))
    } catch (storageError) {
      setError(storageError instanceof Error ? storageError.message : String(storageError))
      setSettingsOpen(false)
    }
  }

  const updateStorage = async (request: Record<string, unknown>) => {
    setStorageBusy(true)
    try {
      const status = await window.remixer.runWorker<StorageStatus>({ ...request, protected_track_dir: track?.track_dir })
      setStorage(status)
      await refreshTracks()
      if (status.cleaned_bytes) setToast(`Offloaded ${(status.cleaned_bytes / 1024 / 1024).toFixed(0)} MB; history retained`)
    } catch (storageError) {
      setError(storageError instanceof Error ? storageError.message : String(storageError))
    } finally {
      setStorageBusy(false)
    }
  }

  const seekToChord = (time: number) => {
    setSeekRequest({ time, nonce: Date.now() })
    setPlaybackTime(time)
  }

  if (!engine?.ready) {
    return <EngineSetup status={engine} installing={installing} installLog={installLog} onInstall={() => void installEngine()} />
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand"><span className="brand-mark"><AudioLines size={21} /></span><div><strong>REMIXER</strong><span>Prepare. Separate. Create.</span></div></div>
        <div className="header-actions"><button onClick={startTutorial}><GraduationCap size={14} /> Tutorial</button><button onClick={() => setHelpOpen(true)}><HelpCircle size={14} /> Help</button><button onClick={() => void openSettings()}><Settings size={14} /> Settings</button><div className="engine-pill"><span className="status-dot" /><Cpu size={14} /> {computeLabel}<span>{engine.details?.cuda.vram_gb ? `${engine.details.cuda.vram_gb} GB` : computeDetail}</span></div></div>
      </header>

      <main className="workspace-shell">
        <aside className="library-panel">
          <div className="library-heading"><History size={16} /><span>Recent tracks</span></div>
          <div className="recent-list">
            <button className={`recent-track pinned ${featuredTrack && track?.track_dir === featuredTrack.track_dir ? 'active' : ''}`} onClick={() => featuredTrack ? openTrack(featuredTrack) : void downloadTrack(FEATURED_VIDEO.url)} disabled={busy && !featuredTrack}>
              <span className="recent-icon"><Music2 size={16} /></span>
              <span><em className="recent-pin">Default · Given Peace</em><strong>{FEATURED_VIDEO.title}</strong><small>{featuredTrack?.analysis ? `${bpmChoices(featuredTrack.analysis).slice(0, 2).map((value) => value.toFixed(1)).join('/')} BPM · ${featuredTrack.analysis.key.label}` : featuredTrack ? formatDuration(featuredTrack.duration) : 'Click to download the example'}</small></span>
            </button>
            {otherRecentTracks.map((item) => (
              <button key={`${item.track_dir}-${item.updated_at}`} className={`recent-track ${track?.track_dir === item.track_dir ? 'active' : ''}`} onClick={() => void selectTrack(item)}>
                <span className="recent-icon"><Music2 size={16} /></span>
                <span>{item.offloaded ? <em className="recent-pin">Offloaded · analysis saved</em> : null}<strong>{item.title}</strong><small>{item.analysis ? `${bpmChoices(item.analysis).slice(0, 2).map((value) => value.toFixed(1)).join('/')} BPM · ${item.analysis.key.label}` : formatDuration(item.duration)}</small></span>
              </button>
            ))}
          </div>
        </aside>

        <div className="main-column">
          <section className="intake-panel panel">
            <div className="url-field"><Download size={18} /><input value={url} onChange={(event) => setUrl(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void downloadTrack() }} placeholder="Paste a YouTube video URL…" disabled={busy} /></div>
            <button className="primary-button intake-download" onClick={() => void downloadTrack()} disabled={busy || !url.trim()}><Download size={16} /> Download</button>
            <span className="or-divider">or</span>
            <button className="secondary-button" onClick={() => void importFile()} disabled={busy}><FileAudio size={16} /> Import audio</button>
          </section>

          <YouTubeBrowser disabled={busy} onUseVideo={useYouTubeVideo} />

          {error ? <div className="error-banner"><span>{error}</span><button onClick={() => setError('')}>×</button></div> : null}
          {busy && progress ? (
            <div className="progress-panel panel">
              <LoaderCircle className="spin" size={18} />
              <div><strong>{progress.message}</strong><span>{progress.stage}</span></div>
              <div className="progress-track"><i style={{ width: `${Math.max(4, progress.progress * 100)}%` }} /></div>
              <button className="small-button danger" onClick={() => void window.remixer.stopWorker()}><Square size={13} fill="currentColor" /> Stop</button>
            </div>
          ) : null}

          {track ? (
            <>
              <section className="track-heading">
                <div>
                  <p className="eyebrow">Current track</p>
                  <h1>{track.title}</h1>
                  <div className="track-meta"><span>{track.artist || (track.source_kind === 'url' ? 'YouTube' : 'Local audio')}</span><i /> <span>{formatDuration(track.duration)}</span><i /> <span>{(track.sample_rate / 1000).toFixed(1)} kHz</span></div>
                </div>
                <div className="track-heading-actions">
                  <button className="secondary-button" onClick={() => { setPreviewPath(track.working_path); setPreviewLabel('Original mix') }}><RotateCcw size={15} /> Original mix</button>
                  <button className="small-button" onClick={() => void window.remixer.showItem(track.working_path)}><FolderOpen size={15} /> Files</button>
                </div>
              </section>

              <section className="analysis-grid">
                <article className="metric-card panel"><span className="metric-icon lime"><Gauge size={20} /></span><div><p>BPM</p><strong>{selectedBpm ? selectedBpm.toFixed(1) : '—'}</strong>{analysis ? (tempoOptions.length > 1 ? <button className="metric-choice" onClick={cycleTempo}>Use {tempoOptions.find((value) => Math.abs(value - (selectedBpm || 0)) >= 0.02)?.toFixed(1)} instead</button> : <small>{confidenceLabel(analysis.bpm_confidence)}</small>) : <small>Not analyzed</small>}</div></article>
                <article className="metric-card panel"><span className="metric-icon violet"><KeyRound size={20} /></span><div><p>KEY</p><strong>{selectedKey?.label || '—'}</strong>{selectedKey?.camelot ? <select className="metric-select" aria-label="Working key" value={selectedKey.label} onChange={(event) => setSelectedKey(workingKeyOptions.find((candidate) => candidate.label === event.target.value) || selectedKey)}>{workingKeyOptions.map((candidate, index) => <option key={candidate.label} value={candidate.label}>{candidate.camelot} · {candidate.label}{index === 0 ? ' · detected' : index < detectedKeyOptions.length ? ' · alternative' : ''}</option>)}</select> : <small>Not analyzed</small>}</div></article>
                <article className="metric-card panel selection-metric"><span className="metric-icon blue"><Scissors size={20} /></span><div><p>SELECTION</p><strong>{bars ? `${bars.toFixed(bars < 10 ? 1 : 0)} bars` : `${(selection.end - selection.start).toFixed(1)} sec`}</strong><small>Used for chord analysis and copied clips</small></div></article>
                <button className="analyze-button" onClick={() => void analyze()} disabled={busy}><WandSparkles size={18} /> Detect key, BPM & chords</button>
              </section>

              {mediaUrl && waveformData ? <WaveformEditor url={mediaUrl} peaks={waveformData.peaks} duration={waveformData.duration || track.duration} selection={selection} onSelectionChange={setSelection} onError={setError} analysis={analysis} previewLabel={previewLabel} seekRequest={seekRequest} onTimeChange={setPlaybackTime} /> : <section className="wave-panel panel waveform-loading"><LoaderCircle className="spin" size={18} /> Preparing instant waveform…</section>}

              <section className="panel progression-panel">
                <div className="section-heading compact"><div><p className="eyebrow">Selected segment</p><h2>Chord progression</h2></div>{chordText ? <button className="small-button" onClick={() => void copyChordText()}><ClipboardCopy size={14} /> Copy chords</button> : null}</div>
                {chordText ? <div className="chord-progression">{analysis!.chords.segments.map((segment, index) => <button className={playbackTime >= segment.start && playbackTime < segment.end ? 'active' : ''} key={`${segment.label}-${segment.start}-${index}`} onClick={() => seekToChord(segment.start)} title={`Jump to ${formatDuration(segment.start)}`}>{segment.label}<small>{formatDuration(segment.start)}</small></button>)}</div> : <p className="empty-copy">Select the useful part of the waveform, preview it, then run detection.</p>}
              </section>

              <section className="copy-source-panel panel">
                <div><p className="eyebrow">Original mix</p><h2>Copy audio to clipboard</h2><span>Paste the WAV into {fileDestination} or a compatible destination.</span></div>
                <div className="copy-actions">
                  <button className="secondary-button" onClick={() => void copyFullFiles([track.working_path], 'Full mix')}><ClipboardCopy size={16} /> Copy full track</button>
                  <button className="primary-button" onClick={() => void copySelectionFiles({ mix: track.working_path }, 'Mix selection')} disabled={selection.end <= selection.start}><Clipboard size={16} /> Copy selection</button>
                </div>
              </section>

              <section className="separation-panel panel">
                <div className="section-heading"><div><p className="eyebrow">AI separation</p><h2>Choose an extraction mode</h2></div><Sparkles size={23} className="lime-text" /></div>
                <div className="model-options">
                  <button className={`model-card ${activeStemSet?.mode === 'full' ? 'selected' : ''}`} onClick={() => void separate('full')} disabled={busy}>
                    <span className="model-tag">Recommended</span><strong>Six stems</strong><p>Vocals, drums, bass, guitar, piano, and other.</p><small>BS-RoFormer SW Fixed · first use downloads ~699 MB</small>
                  </button>
                  <button className={`model-card ${activeStemSet?.mode === 'vocals' ? 'selected' : ''}`} onClick={() => void separate('vocals')} disabled={busy}>
                    <span className="model-tag violet-tag">Specialist</span><strong>HQ vocals</strong><p>Focused vocal and instrumental extraction for remixing.</p><small>BS-RoFormer Leap XE · first use downloads ~268 MB</small>
                  </button>
                </div>
              </section>

              {activeStemSet ? (
                <StemRack
                  stemSet={activeStemSet}
                  selection={selection}
                  onPreview={(stem, file) => { setPreviewPath(file); setPreviewLabel(stem) }}
                  onCopyFull={(stem, file) => void copyFullFiles([file], stem)}
                  onCopySelection={(stem, file) => void copySelectionFiles({ [stem]: file }, `${stem} selection`)}
                  onCopyAll={(selected) => {
                    if (selected) void copySelectionFiles(Object.fromEntries(stemEntries), 'Stem selections')
                    else void copyFullFiles(stemEntries.map(([, file]) => file), 'Full stems')
                  }}
                  onShow={(file) => void window.remixer.showItem(file)}
                />
              ) : null}
            </>
          ) : (
            <section className="welcome-panel panel"><span className="welcome-mark"><Sparkles size={31} /></span><p className="eyebrow">Ready when you are</p><h1>Turn a track into something you can work with.</h1><p>Paste a video URL or import audio. Remixer keeps the best source, finds the musical structure, separates stems locally, and puts Ableton-ready WAVs on your clipboard.</p></section>
          )}
        </div>
      </main>
      {toast ? <div className="toast"><Clipboard size={16} /> {toast}</div> : null}
      {welcomeOpen && !tutorialOpen ? <WelcomeSupport onContinue={() => setWelcomeOpen(false)} /> : null}
      {helpOpen ? <HelpCenter onClose={() => setHelpOpen(false)} onStartTutorial={startTutorial} /> : null}
      {tutorialOpen ? <Tutorial step={tutorialStep} ready={tutorialTrackReady} required={tutorialRequired} onStepChange={setTutorialStep} onUseTrack={useTutorialTrack} onOriginal={showTutorialOriginal} onChord={jumpTutorialChord} onVocal={previewTutorialVocal} onComplete={completeTutorial} onClose={() => setTutorialOpen(false)} /> : null}
      {settingsOpen && storage ? <StorageSettings status={storage} busy={storageBusy} activeTrackDir={track?.track_dir} onClose={() => setSettingsOpen(false)} onLimit={(limitMb) => void updateStorage({ command: 'set_storage_limit', limit_mb: limitMb })} onCleanup={() => void updateStorage({ command: 'cleanup_storage', force: true })} onOffload={(trackDir) => void updateStorage({ command: 'offload_project', track_dir: trackDir })} /> : null}
    </div>
  )
}

export default App
