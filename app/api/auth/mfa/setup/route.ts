import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { getAdminClient } from '@/lib/auth/api-auth'
import { iniciarCadastro } from '@/lib/auth/mfa'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { getMfaPendingFromRequest } from '@/lib/auth/session'
import { formatarSegredoParaDigitar, otpauthUri } from '@/lib/auth/totp'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * POST /api/auth/mfa/setup — cadastro do Google Authenticator.
 *
 * Só funciona com o cookie da etapa pendente em 'cadastro', ou seja: logo
 * depois da senha certa, para uma conta que ainda não tem autenticador.
 * Devolve o QR code (e o segredo para digitar à mão); a sessão só sai em
 * /api/auth/mfa/verify, quando a pessoa provar que escaneou digitando um
 * código.
 */
export async function POST(req: NextRequest) {
  try {
    const pendente = await getMfaPendingFromRequest(req)
    if (!pendente || pendente.etapa !== 'cadastro') {
      return NextResponse.json(
        { error: 'Sessão de login expirada. Entre com e-mail e senha de novo.' },
        { status: 401 }
      )
    }

    const limite = checkRateLimit(`mfa:setup:${pendente.sub}`, 10, 60_000)
    if (!limite.allowed) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Aguarde um instante e tente novamente.' },
        { status: 429, headers: { 'Retry-After': String(limite.retryAfterSeconds) } }
      )
    }

    const { data: usuario, error } = await getAdminClient()
      .from('users')
      .select('email, is_active')
      .eq('id', pendente.sub)
      .single()
    if (error || !usuario || !usuario.is_active) {
      return NextResponse.json({ error: 'Usuário inválido ou desativado.' }, { status: 403 })
    }

    const cadastro = await iniciarCadastro(pendente.sub)
    if ('jaConfirmado' in cadastro) {
      return NextResponse.json(
        { error: 'Esta conta já tem o Google Authenticator. Entre de novo e digite o código.' },
        { status: 409 }
      )
    }

    const uri = otpauthUri(usuario.email, cadastro.segredo)
    const qr = await QRCode.toDataURL(uri, { margin: 1, width: 240, errorCorrectionLevel: 'M' })

    return NextResponse.json(
      { qr, segredo: formatarSegredoParaDigitar(cadastro.segredo), conta: usuario.email },
      // O segredo não pode parar em cache de navegador nem de proxy.
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[auth/mfa/setup] Error:', err)
    return NextResponse.json({ error: 'Erro ao preparar o Google Authenticator.' }, { status: 500 })
  }
}
