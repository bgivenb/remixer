import { BookOpen, ExternalLink, X } from 'lucide-react'

interface HelpCenterProps {
  onClose: () => void
  onStartTutorial: () => void
}

export function HelpCenter({ onClose, onStartTutorial }: HelpCenterProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="help-center modal-card" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <header className="modal-heading">
          <div><p className="eyebrow">Remixer guide</p><h1 id="help-title">Help</h1></div>
          <button className="icon-button" onClick={onClose} aria-label="Close help"><X size={18} /></button>
        </header>
        <div className="help-grid">
          <article><span>01</span><h2>Bring in a track</h2><p>Search YouTube inside Remixer, paste an authorized video URL, or import a local audio file. Down So Bad is always pinned as the ready-made example.</p></article>
          <article><span>02</span><h2>Choose the moment</h2><p>Drag on the waveform in New selection mode. Use Adjust to move the region or resize either edge. Loop it until the musical phrase feels right.</p></article>
          <article><span>03</span><h2>Read the music</h2><p>Detect BPM, key, and chords. The current chord turns black; click any chord in the progression or timeline to jump to that exact moment.</p></article>
          <article><span>04</span><h2>Separate stems</h2><p>Six stems creates vocals, drums, bass, guitar, piano, other, and instrumental. HQ vocals creates a specialist vocal/instrumental pair.</p></article>
          <article><span>05</span><h2>Move to your DAW</h2><p>Copy a full WAV or only the selected bars. Paste into Finder or Explorer, then drag into Ableton Live. Files opens the exact output location.</p></article>
          <article><span>06</span><h2>When something stalls</h2><p>Confirm FFmpeg and the local engine are installed. First use of a separation model downloads its weights; later sessions reuse the local cache.</p></article>
        </div>
        <footer className="modal-footer">
          <button className="primary-button" onClick={onStartTutorial}><BookOpen size={15} /> Run the Down So Bad tutorial</button>
          <a className="secondary-button help-link" href="https://www.givenpeace.com/" target="_blank" rel="noreferrer">Given Peace <ExternalLink size={14} /></a>
        </footer>
      </section>
    </div>
  )
}
