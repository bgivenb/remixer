import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import givenPeaceFavicon from '../../assets/given-peace-favicon.base64?raw'

describe('Given Peace branding', () => {
  it('uses the exact favicon declared by givenpeace.com', () => {
    const png = Buffer.from(givenPeaceFavicon.trim(), 'base64')

    expect(createHash('sha256').update(png).digest('hex')).toBe('de165817dd3665ccb43f7afbe3400a80bd2595a97cf0be4079320333040c50b7')
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  })
})
