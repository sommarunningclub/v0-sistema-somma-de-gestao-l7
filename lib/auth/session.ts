import { cookies } from 'next/headers'
import type { NextRequest, NextResponse } from 'next/server'
import type { ModulePermissions, SessionPayload } from './types'

export const SESSION_COOKIE = 'somma_session'
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7 // 7 dias

/*
 * Sem fallback para SUPABASE_SERVICE_ROLE_KEY: assinar sessão com a chave de
 * serviço acopla duas coisas que precisam girar em ritmos diferentes — rotar
 * a chave do banco derrubaria todas as sessões, e vazar o segredo de sessão
 * revelaria que a chave de serviço tem o mesmo valor. `SESSION_SECRET` é
 * obrigatória; a ausência dela é erro de configuração, não modo degradado.
 */
function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    throw new Error(
      'SESSION_SECRET não configurado. Defina a variável de ambiente (mínimo 32 caracteres aleatórios) antes de subir a aplicação.'
    )
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

/**
 * Emite a sessão COMPLETA (`mfa: true`). Só pode ser chamada depois da segunda
 * etapa — em /api/auth/mfa/verify — ou para reemitir uma sessão que já passou
 * por ela (refreshSessionCookie, que roda atrás de requireAuth). O login por
 * senha emite o token de etapa pendente, não este.
 */
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
    mfa: true,
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
    // Sem a segunda etapa não há sessão — vale também para cookies antigos.
    if (payload.mfa !== true) return null
    return payload
  } catch {
    return null
  }
}

/* ------------------------------------------------- etapa pendente (2FA) */

/**
 * Entre a senha certa e o código do autenticador existe um estado
 * intermediário: "a senha confere, falta a segunda etapa". Ele vive num cookie
 * próprio, curto e assinado, que NÃO é sessão — o middleware e as APIs não o
 * aceitam. Só as rotas /api/auth/mfa/* o leem.
 *
 * A assinatura usa um prefixo de domínio diferente da sessão: um token
 * pendente nunca valida como sessão, nem o contrário.
 *
 *   etapa 'cadastro'  a conta ainda não tem autenticador: mostrar o QR code
 *   etapa 'codigo'    a conta já tem: pedir o código de 6 dígitos
 */
export const MFA_PENDING_COOKIE = 'somma_mfa_pendente'
export const MFA_PENDING_MAX_AGE_SEC = 10 * 60
const MFA_PENDING_DOMINIO = 'mfa-pendente.'

export type EtapaMfa = 'cadastro' | 'codigo'
export type MfaPendente = { sub: string; etapa: EtapaMfa; exp: number }

export async function createMfaPendingToken(sub: string, etapa: EtapaMfa): Promise<string> {
  const payload: MfaPendente = {
    sub,
    etapa,
    exp: Math.floor(Date.now() / 1000) + MFA_PENDING_MAX_AGE_SEC,
  }
  const encoded = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
  const signature = await sign(MFA_PENDING_DOMINIO + encoded)
  return `${encoded}.${signature}`
}

export async function verifyMfaPendingToken(token: string): Promise<MfaPendente | null> {
  const [encoded, signature] = token.split('.')
  if (!encoded || !signature) return null
  if (!(await verifySignature(MFA_PENDING_DOMINIO + encoded, signature))) return null
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded))) as MfaPendente
    if (!payload.sub || !payload.exp) return null
    if (payload.etapa !== 'cadastro' && payload.etapa !== 'codigo') return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export async function getMfaPendingFromRequest(req: NextRequest): Promise<MfaPendente | null> {
  const token = req.cookies.get(MFA_PENDING_COOKIE)?.value
  if (!token) return null
  return verifyMfaPendingToken(token)
}

function mfaPendingCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // Strict: o cookie só existe dentro do fluxo de login do próprio painel.
    sameSite: 'strict' as const,
    path: '/api/auth',
    maxAge: MFA_PENDING_MAX_AGE_SEC,
  }
}

export function attachMfaPendingCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(MFA_PENDING_COOKIE, token, mfaPendingCookieOptions())
  return response
}

export function clearMfaPendingCookie(response: NextResponse): NextResponse {
  response.cookies.set(MFA_PENDING_COOKIE, '', { ...mfaPendingCookieOptions(), maxAge: 0 })
  return response
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
