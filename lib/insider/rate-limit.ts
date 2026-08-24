// Reexporta o limitador compartilhado de `@/lib/auth/rate-limit`, que também
// atende o login do admin. Mantido como módulo próprio para não quebrar os
// imports existentes das rotas de insider.
export {
  checkRateLimit,
  clientKey,
  setRateLimitStore,
  type RateLimitResult,
  type RateLimitStore,
} from '@/lib/auth/rate-limit'
