import { Check, ChevronRight, LoaderCircle, Music2, X } from 'lucide-react'
import { useState } from 'react'

const STEPS = [
  {
    eyebrow: 'The tutorial track',
    title: 'START WITH DOWN SO BAD.',
    body: 'Every technique in this walkthrough uses Given Peace’s included track. You will detect its structure and create its stems yourself with the local engine.',
    action: 'Open the tutorial track',
  },
  {
    eyebrow: 'Original mix',
    title: 'HEAR THE FULL RECORD.',
    body: 'The main waveform is the complete mix. Use Play, click anywhere to seek, drag a selection, and turn on Loop to audition one phrase repeatedly.',
    action: 'Show the original mix',
  },
  {
    eyebrow: 'Musical structure',
    title: 'JUMP BY CHORD.',
    body: 'The chord under the playhead is highlighted. Every chord is also a navigation control, so you can move directly to a harmonic change.',
    action: 'Detect music & jump to a chord',
  },
  {
    eyebrow: 'Prepared stems',
    title: 'CREATE THE STEMS.',
    body: 'Run the six-stem model locally, then preview the vocal. Remixer also creates drums, bass, guitar, piano, other, and instrumental.',
    action: 'Separate & preview vocals',
  },
  {
    eyebrow: 'Your turn',
    title: 'MAKE A REMIX.',
    body: 'Choose a useful section, copy the mix or individual stems, paste the WAV files into your project, and make something nobody expected.',
    action: 'Finish tutorial',
  },
]

interface TutorialProps {
  step: number
  ready: boolean
  required: boolean
  onStepChange: (step: number) => void
  onUseTrack: () => void
  onOriginal: () => void
  onChord: () => Promise<boolean>
  onVocal: () => Promise<boolean>
  onComplete: () => void
  onClose: () => void
}

export function Tutorial({ step, ready, required, onStepChange, onUseTrack, onOriginal, onChord, onVocal, onComplete, onClose }: TutorialProps) {
  const [working, setWorking] = useState(false)
  const current = STEPS[Math.min(step, STEPS.length - 1)]
  const advance = async () => {
    setWorking(true)
    if (step === 0) onUseTrack()
    if (step === 1) onOriginal()
    if (step === 2 && !await onChord()) { setWorking(false); return }
    if (step === 3 && !await onVocal()) { setWorking(false); return }
    if (step === STEPS.length - 1) {
      onComplete()
      setWorking(false)
      return
    }
    onStepChange(step + 1)
    setWorking(false)
  }

  return (
    <div className="modal-backdrop tutorial-backdrop" role="presentation">
      <section className="tutorial-card modal-card" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
        <div className="tutorial-art"><span><Music2 size={34} /></span><strong>GIVEN PEACE</strong><small>DOWN SO BAD</small></div>
        <div className="tutorial-copy">
          <header className="modal-heading">
            <div><p className="eyebrow">Tutorial · {String(step + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}</p></div>
            <button className="icon-button" onClick={onClose} aria-label="Close tutorial"><X size={18} /></button>
          </header>
          <div className="tutorial-progress" aria-hidden="true">{STEPS.map((_, index) => <i key={index} className={index <= step ? 'active' : ''} />)}</div>
          <p className="eyebrow">{current.eyebrow}</p>
          <h1 id="tutorial-title">{current.title}</h1>
          <p className="tutorial-body">{current.body}</p>
          {!ready ? <div className="tutorial-preparing">Preparing the bundled tutorial project…</div> : null}
          <footer className="tutorial-actions">
            {step > 0 ? <button className="secondary-button" onClick={() => onStepChange(step - 1)}>Back</button> : <span />}
            <button className="primary-button" onClick={() => void advance()} disabled={!ready || working}>{working ? <LoaderCircle className="spin" size={15} /> : step === STEPS.length - 1 ? <Check size={15} /> : <ChevronRight size={15} />} {working ? (step === 2 ? 'Detecting structure…' : step === 3 ? 'Separating stems…' : 'Working…') : current.action}</button>
          </footer>
        </div>
      </section>
    </div>
  )
}
