import { checkRateLimit, clientKey } from '../rate-limit'

describe('checkRateLimit', () => {
  it('allows requests under the limit', () => {
    const key = `test-under-${Math.random()}`
    for (let i = 0; i < 3; i++) {
      const result = checkRateLimit(key, 5, 60_000)
      expect(result.allowed).toBe(true)
    }
  })

  it('denies the request that exceeds the limit', () => {
    const key = `test-exceed-${Math.random()}`
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true)
    }
    const result = checkRateLimit(key, 3, 60_000)
    expect(result.allowed).toBe(false)
    expect(result.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('gives a different key an independent budget', () => {
    const keyA = `test-independent-a-${Math.random()}`
    const keyB = `test-independent-b-${Math.random()}`
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(keyA, 3, 60_000).allowed).toBe(true)
    }
    expect(checkRateLimit(keyA, 3, 60_000).allowed).toBe(false)
    // keyB has never been used, so it should still be allowed.
    expect(checkRateLimit(keyB, 3, 60_000).allowed).toBe(true)
  })

  it('resets the budget after the window elapses', async () => {
    const key = `test-reset-${Math.random()}`
    const windowMs = 50
    expect(checkRateLimit(key, 1, windowMs).allowed).toBe(true)
    expect(checkRateLimit(key, 1, windowMs).allowed).toBe(false)

    await new Promise((resolve) => setTimeout(resolve, windowMs + 20))

    expect(checkRateLimit(key, 1, windowMs).allowed).toBe(true)
  })
})

function fakeRequest(headers: Record<string, string>): Request {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  } as unknown as Request
}

describe('clientKey', () => {
  it('picks the first entry of a comma-separated x-forwarded-for', () => {
    const req = fakeRequest({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.10.11.12' })
    expect(clientKey(req)).toBe('1.2.3.4')
  })

  it('trims whitespace around the first x-forwarded-for entry', () => {
    const req = fakeRequest({ 'x-forwarded-for': '  1.2.3.4  ,5.6.7.8' })
    expect(clientKey(req)).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const req = fakeRequest({ 'x-real-ip': '9.9.9.9' })
    expect(clientKey(req)).toBe('9.9.9.9')
  })

  it('falls back to "unknown" when no headers are present', () => {
    const req = fakeRequest({})
    expect(clientKey(req)).toBe('unknown')
  })
})
