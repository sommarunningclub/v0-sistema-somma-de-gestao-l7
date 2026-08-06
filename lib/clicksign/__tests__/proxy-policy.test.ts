import { isClicksignEndpointAllowed } from '../proxy-policy'

describe('clicksign proxy-policy', () => {
  it('allows only diagnostico for now', () => {
    expect(isClicksignEndpointAllowed('GET', '/diagnostico')).toBe(true)
  })

  it('blocks generic clicksign access', () => {
    expect(isClicksignEndpointAllowed('GET', '/envelopes')).toBe(false)
    expect(isClicksignEndpointAllowed('POST', '/envelopes')).toBe(false)
    expect(isClicksignEndpointAllowed('DELETE', '/documents/abc')).toBe(false)
  })
})
