import { cookies } from 'next/headers'
import type { NextRequest, NextResponse } from 'next/server'
import type { ModulePermissions, SessionPayload } from './types'

export const SESSION_COOKIE = 'somma_session'
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7 // 7 dias

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) {
    throw new Error('SESSION_SECRET não configurado')
  }
  return secret
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
    new TextEncoder().encode(getSessionSecret()),
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

export async function createSessionToken(user: {
  id: string
  email: string
  full_name: string
  role: string
  permissions: ModulePermissions | null
}): Promise<string> {
  const payload: SessionPayload = {
    sub: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    permissions: user.permissions,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC,
  }
  const encoded = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
  const signature = await sign(encoded)
  return `${encoded}.${signature}`
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  const [encoded, signature] = token.split('.')
  if (!encoded || !signature) return null

  const valid = await verifySignature(encoded, signature)
  if (!valid) return null

  try {
    const json = new TextDecoder().decode(fromBase64Url(encoded))
    const payload = JSON.parse(json) as SessionPayload
    if (!payload.sub || !payload.exp) return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE_SEC,
  }
}

export function attachSessionCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions())
  return response
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 })
  return response
}

export async function getSessionFromRequest(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return null
  return verifySessionToken(token)
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null
  return verifySessionToken(token)
}

export function hasModulePermission(
  session: SessionPayload,
  module: keyof ModulePermissions
): boolean {
  if (session.role === 'admin') return true
  return session.permissions?.[module] === true
}
