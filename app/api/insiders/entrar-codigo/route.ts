import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, verifyPassword } from '@/lib/auth/api-auth'
import { cpfCandidates } from '@/lib/insider/insider-mapper'
import { checkRateLimit, clientKey } from '@/lib/insider/rate-limit'
import { createInsiderToken, attachInsiderCookie } from '@/lib/auth/insider-session'
import { isSameOrigin } from '@/lib/auth/same-origin'
import { MAX_TENTATIVAS, formatoValido, normalizarCodigo } from '@/lib/insider/login-code'

/**
 * POST /api/insiders/entrar-codigo — troca o código de 6 dígitos por sessão.
 *
 * Espelha app/api/insiders/entrar/route.ts: mensagem única para toda falha e
 * um bcrypt pago em todos os caminhos de 401, para que o tempo de resposta
 * não revele se o CPF existe, se há código vigente ou se ele expirou.
 */
const FALHA = 'Código inválido ou expirado.'
const HASH_DESCARTAVEL = '$2b$12$wlJXRTwSoU2ce5S6KmoHeOLcsJYIAnzo2.K.eccnhrsQ4Soi7neG6'

export async function POST(req: NextRequest) {
  try {
    const rate = checkRateLimit(`entrar-codigo:${clientKey(req)}`, 10, 60_000)
    if (!rate.allowed) {
      console.warn('[insiders/entrar-codigo] rate limit excedido')
      return NextResponse.json(
        { error: 'Muitas tentativas. Aguarde um instante e tente novamente.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
      )
    }

    if (!isSameOrigin(req)) {
      console.warn('[insiders/entrar-codigo] origem recusada')
      return NextResponse.json({ error: 'Requisição inválida.' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    const cpf = typeof body?.cpf === 'string' ? body.cpf : ''
    const codigo = normalizarCodigo(body?.codigo)

    const supabase = getAdminClient()

    const { data: linhas, error: findError } = await supabase
      .from('dados_insiders')
      .select('id, cpf, nome, ativo')
      .in('cpf', cpfCandidates(cpf))
      .limit(1)

    if (findError) {
      console.error('[insiders/entrar-codigo] find error:', findError)
      return NextResponse.json({ error: 'Erro ao entrar.' }, { status: 500 })
    }

    const insider = linhas?.[0] ?? null

    if (!insider || insider.ativo === false || !formatoValido(codigo)) {
      await verifyPassword('equalizador', HASH_DESCARTAVEL)
      return NextResponse.json({ error: FALHA }, { status: 401 })
    }

    const { data: registros, error: codigoError } = await supabase
      .from('insider_login_codes')
      .select('id, codigo_hash, expira_em, tentativas')
      .eq('insider_id', insider.id)
      .is('consumido_em', null)
      .order('criado_em', { ascending: false })
      .limit(1)

    if (codigoError) {
      console.error('[insiders/entrar-codigo] select code error:', codigoError)
      return NextResponse.json({ error: 'Erro ao entrar.' }, { status: 500 })
    }

    const registro = registros?.[0] ?? null
    const expirado = registro ? new Date(registro.expira_em).getTime() < Date.now() : true
    const estourou = registro ? registro.tentativas >= MAX_TENTATIVAS : false

    if (!registro || expirado || estourou) {
      await verifyPassword('equalizador', HASH_DESCARTAVEL)
      // Um código estourado ou vencido não deve continuar ocupando o lugar do
      // próximo pedido.
      if (registro && (expirado || estourou)) {
        await supabase.from('insider_login_codes').delete().eq('id', registro.id)
      }
      return NextResponse.json({ error: FALHA }, { status: 401 })
    }

    const { valid } = await verifyPassword(codigo, registro.codigo_hash)

    if (!valid) {
      // Incrementa ANTES de responder: é o contador que fecha a janela de
      // força bruta sobre um código específico.
      await supabase
        .from('insider_login_codes')
        .update({ tentativas: registro.tentativas + 1 })
        .eq('id', registro.id)
      return NextResponse.json({ error: FALHA }, { status: 401 })
    }

    // Uso único. Marcar consumido antes de emitir o cookie evita que dois
    // envios simultâneos do mesmo código gerem duas sessões.
    const { data: consumido, error: consumoError } = await supabase
      .from('insider_login_codes')
      .update({ consumido_em: new Date().toISOString() })
      .eq('id', registro.id)
      .is('consumido_em', null)
      .select('id')

    if (consumoError || !consumido?.length) {
      return NextResponse.json({ error: FALHA }, { status: 401 })
    }

    const token = await createInsiderToken({
      id: insider.id,
      cpf: insider.cpf,
      nome: insider.nome,
    })

    return attachInsiderCookie(NextResponse.json({ success: true }), token)
  } catch (err) {
    console.error('[insiders/entrar-codigo] unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
