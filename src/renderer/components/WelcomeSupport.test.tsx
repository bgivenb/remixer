import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BEATPORT_URL, WelcomeSupport } from './WelcomeSupport'

describe('WelcomeSupport', () => {
  it('renders the approved welcome and Beatport destination', () => {
    const markup = renderToStaticMarkup(<WelcomeSupport onContinue={() => undefined} />)

    expect(markup).toContain('Thanks for using Remixer.')
    expect(markup).toContain('I don’t ask for donations.')
    expect(markup).toContain('encourages me to keep making cool tools like this.')
    expect(markup).toContain(`href="${BEATPORT_URL}"`)
    expect(markup.indexOf('Buy my music on Beatport')).toBeLessThan(markup.indexOf('Continue'))
  })
})
