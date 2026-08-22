import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Tutorial } from './Tutorial'

describe('Tutorial', () => {
  it('can be closed even when the walkthrough is incomplete', () => {
    const markup = renderToStaticMarkup(
      <Tutorial
        step={0}
        ready
        required
        onStepChange={() => undefined}
        onUseTrack={() => undefined}
        onOriginal={() => undefined}
        onChord={async () => true}
        onVocal={async () => true}
        onComplete={() => undefined}
        onClose={() => undefined}
      />,
    )

    expect(markup).toContain('aria-label="Close tutorial"')
  })
})
