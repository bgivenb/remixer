import { ExternalLink } from 'lucide-react'

export const BEATPORT_URL = 'https://www.beatport.com/artist/given-peace/1153686'

interface WelcomeSupportProps {
  onContinue: () => void
}

export function WelcomeSupport({ onContinue }: WelcomeSupportProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="support-welcome modal-card" role="dialog" aria-modal="true" aria-labelledby="support-welcome-title" aria-describedby="support-welcome-copy">
        <div className="support-welcome-copy">
          <p className="eyebrow">Welcome</p>
          <h1 id="support-welcome-title">Thanks for using Remixer.</h1>
          <div id="support-welcome-copy">
            <p>I don’t ask for donations. If you’d like to support me, buy my music on Beatport.</p>
            <p>Every purchase supports Given Peace, helps keep Remixer free, and encourages me to keep making cool tools like this.</p>
          </div>
        </div>
        <div className="support-welcome-actions">
          <a className="secondary-button" href={BEATPORT_URL} target="_blank" rel="noreferrer">
            Buy my music on Beatport <ExternalLink size={15} />
          </a>
          <button className="primary-button" onClick={onContinue} autoFocus>Continue</button>
        </div>
      </section>
    </div>
  )
}
