/*
 * Limitador de taxa compartilhado (login admin + rotas públicas de insider).
 *
 * LIMITAÇÃO CONHECIDA: o contador vive na memória da instância. Em serverless
 * multi-instância (Vercel) cada instância tem o próprio balde, então o limite
 * efetivo é `limite × instâncias ativas`, e um cold start / redeploy zera tudo.
 * Serve como freio contra força bruta trivial, não como garantia rígida.
 *
 * Para trocar por um store externo (Redis/Upstash) basta implementar
 * `RateLimitStore` e injetar em `setRateLimitStore` — nada mais no app precisa
 * mudar. Nenhuma dependência nova foi adicionada enquanto não houver Redis
 * provisionado no projeto.
 */

export interface RateLimitResult {
  allowed: boolean
  retryAfterSeconds: number
}

export interface RateLimitStore {
  hit(key: string, limit: number, windowMs: number): RateLimitResult
}

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

const memoryStore: RateLimitStore = {
  hit(key, limit, windowMs) {
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
  },
}

let store: RateLimitStore = memoryStore

/** Ponto de injeção para um store distribuído. */
export function setRateLimitStore(next: RateLimitStore | null): void {
  store = next ?? memoryStore
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  return store.hit(key, limit, windowMs)
}

/**
 * IP do cliente. Prioriza os cabeçalhos que a plataforma (Vercel) escreve e
 * sobrescreve — `x-forwarded-for` é o único que o cliente pode forjar, e por
 * isso fica por último.
 */
export function clientKey(req: Request): string {
  const vercelForwarded = req.headers.get('x-vercel-forwarded-for')
  if (vercelForwarded) {
    const first = vercelForwarded.split(',')[0]?.trim()
    if (first) return first
  }

  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp.trim()

  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim()
    if (first) return first
  }

  return 'unknown'
}
