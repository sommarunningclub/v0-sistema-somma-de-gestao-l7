// Limitador de taxa em memória, por instância. Como é por instância, o
// contador zera em cold start / redeploy — aceitável para o uso atual
// (proteção leve contra abuso nas rotas públicas de insiders).

interface Window {
  start: number
  count: number
}

const buckets = new Map<string, Window>()

function evictExpired(now: number, windowMs: number) {
  for (const [key, w] of buckets) {
    if (now - w.start >= windowMs) {
      buckets.delete(key)
    }
  }
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now()

  // Eviction oportunista: evita crescimento ilimitado do Map sem usar timers.
  evictExpired(now, windowMs)

  const existing = buckets.get(key)

  if (!existing || now - existing.start >= windowMs) {
    buckets.set(key, { start: now, count: 1 })
    return { allowed: true, retryAfterSeconds: 0 }
  }

  if (existing.count < limit) {
    existing.count += 1
    return { allowed: true, retryAfterSeconds: 0 }
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((existing.start + windowMs - now) / 1000))
  return { allowed: false, retryAfterSeconds }
}

export function clientKey(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim()
    if (first) return first
  }

  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp.trim()

  return 'unknown'
}
