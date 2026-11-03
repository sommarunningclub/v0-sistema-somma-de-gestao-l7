import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/auth/api-auth'
import { conferirCodigo } from '@/lib/auth/mfa'
import { checkRateLimit, clientKey } from '@/lib/auth/rate-limit'
import {
  attachSessionCookie,
  clearMfaPendingCookie,
  createSessionToken,
  getMfaPendingFromRequest,
} from '@/lib/auth/session'
import { normalizarCodigoTotp, TOTP_DIGITOS } from '@/lib/auth/totp'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * POST /api/auth/mfa/verify — segunda etapa do login.
 *
 * Recebe o código de 6 dígitos do Google Authenticator. Vale para as duas
 * situações da etapa pendente:
 *   'cadastro'  primeiro código depois de escanear o QR — confirma o app
 *   'codigo'    login de quem já tem o app cadastrado
 *
 * Conferiu: emite a sessão completa (a única coisa que o middleware aceita) e
 * apaga o cookie da etapa pendente.
 *
 * Força bruta: 5 tentativas por minuto por conta e o cookie pendente vale
 * 10 minutos — e para chegar aqui já foi preciso acertar a senha.
 */
export async function POST(req: NextRequest) {
  try {
    const pendente = await getMfaPendingFromRequest(req)
    if (!pendente) {
      return NextResponse.json(
        { error: 'Sessão de login expirada. Entre com e-mail e senha de novo.', code: 'expirado' },
        { status: 401 }
      )
    }

    const porConta = checkRateLimit(`mfa:verify:${pendente.sub}`, 5, 60_000)
    const porIp = checkRateLimit(`mfa:verify:ip:${clientKey(req)}`, 20, 60_000)
    if (!porConta.allowed || !porIp.allowed) {
      const espera = Math.max(
        porConta.allowed ? 0 : porConta.retryAfterSeconds,
        porIp.allowed ? 0 : porIp.retryAfterSeconds
      )
      return NextResponse.json(
        { error: 'Muitas tentativas. Aguarde um instante e tente novamente.' },
        { status: 429, headers: { 'Retry-After': String(espera) } }
      )
    }

    const body = await req.json().catch(() => null)
    const codigo = normalizarCodigoTotp(body?.codigo)
    if (codigo.length !== TOTP_DIGITOS) {
      return NextResponse.json({ error: 'Digite os 6 dígitos do Google Authenticator.' }, { status: 400 })
    }

    const resultado = await conferirCodigo(pendente.sub, pendente.etapa, codigo)
    if (resultado === 'estado_mudou') {
      return NextResponse.json(
        { error: 'O cadastro do autenticador mudou. Entre com e-mail e senha de novo.', code: 'expirado' },
        { status: 409 }
      )
    }
    if (resultado !== 'ok') {
      return NextResponse.json(
        { error: 'Código inválido. Confira o horário do celular e digite o código que está na tela agora.' },
        { status: 401 }
      )
    }

    // Relido na hora: a conta pode ter sido desativada entre a senha e o código.
    const { data: user, error } = await getAdminClient()
      .from('users')
      .select('id, email, full_name, role, is_active, permissions')
      .eq('id', pendente.sub)
      .single()
    if (error || !user || !user.is_active) {
      return NextResponse.json({ error: 'Usuário desativado. Contate o administrador.' }, { status: 403 })
    }

    const token = await createSessionToken({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      permissions: user.permissions,
    })

    const response = NextResponse.json({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      permissions: user.permissions,
    })
    clearMfaPendingCookie(response)
    return attachSessionCookie(response, token)
  } catch (err) {
    console.error('[auth/mfa/verify] Error:', err)
    return NextResponse.json({ error: 'Erro ao conferir o código.' }, { status: 500 })
  }
}
