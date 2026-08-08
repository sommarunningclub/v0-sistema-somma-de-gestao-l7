import { cookies } from 'next/headers'
import type { NextRequest, NextResponse } from 'next/server'

export const INSIDER_SESSION_COOKIE = 'somma_insider_session'
export const INSIDER_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30 // 30 dias

export type InsiderSession = {
  sub: string
  cpf: string
  nome: string
  typ: 'insider'
  exp: number
}

/**
 * Chave derivada com sufixo ':insider'. O admin assina com o segredo puro,
 * então um token de admin é criptograficamente inválido aqui — separar só o
 * nome do cookie não bastaria.
 */
function getInsiderSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) {
    throw new Error('SESSION_SECRET não configurado')
  }
  return `${secret}:insider`
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((b) => { binary += String.fromCharCode(b) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function sign(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getInsiderSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return toBase64Url(new Uint8Array(signature))
}

async function verifySignature(data: string, signature: string): Promise<boolean> {
  const expected = await sign(data)
  if (expected.length !== signature.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return diff === 0
}

export async function createInsiderToken(insider: {
  id: string
  cpf: string
  nome: string
}): Promise<string> {
  const payload: InsiderSession = {
    sub: insider.id,
    cpf: insider.cpf,
    nome: insider.nome,
    typ: 'insider',
    exp: Math.floor(Date.now() / 1000) + INSIDER_SESSION_MAX_AGE_SEC,
  }
  const encoded = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
  const signature = await sign(encoded)
  return `${encoded}.${signature}`
}

export async function verifyInsiderToken(token: string): Promise<InsiderSession | null> {
  if (!token) return null
  const [encoded, signature] = token.split('.')
  if (!encoded || !signature) return null

  const valid = await verifySignature(encoded, signature)
  if (!valid) return null

  try {
    const json = new TextDecoder().decode(fromBase64Url(encoded))
    const payload = JSON.parse(json) as InsiderSession
    if (payload.typ !== 'insider') return null
    if (!payload.sub || !payload.exp) return null
    if (typeof payload.nome !== 'string' || typeof payload.cpf !== 'string') return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export function insiderCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: INSIDER_SESSION_MAX_AGE_SEC,
  }
}

export function attachInsiderCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(INSIDER_SESSION_COOKIE, token, insiderCookieOptions())
  return response
}

export function clearInsiderCookie(response: NextResponse): NextResponse {
  response.cookies.set(INSIDER_SESSION_COOKIE, '', { ...insiderCookieOptions(), maxAge: 0 })
  return response
}

export async function getInsiderFromRequest(req: NextRequest): Promise<InsiderSession | null> {
  const token = req.cookies.get(INSIDER_SESSION_COOKIE)?.value
  if (!token) return null
  return verifyInsiderToken(token)
}

export async function getInsiderFromCookies(): Promise<InsiderSession | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(INSIDER_SESSION_COOKIE)?.value
  if (!token) return null
  return verifyInsiderToken(token)
}
