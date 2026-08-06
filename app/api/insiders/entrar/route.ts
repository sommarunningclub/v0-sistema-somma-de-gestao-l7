import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, verifyPassword } from '@/lib/auth/api-auth'
import { isValidCpf } from '@/lib/insider/validation'
import { cpfCandidates } from '@/lib/insider/insider-mapper'
import { checkRateLimit, clientKey } from '@/lib/insider/rate-limit'
import { createInsiderToken, attachInsiderCookie } from '@/lib/auth/insider-session'

/** Mesma mensagem para todas as falhas: o endpoint não pode revelar quem é Insider. */
const FALHA = 'CPF ou senha incorretos.'
const HASH_DESCARTAVEL = '$2b$12$wlJXRTwSoU2ce5S6KmoHeOLcsJYIAnzo2.K.eccnhrsQ4Soi7neG6'

export async function POST(req: NextRequest) {
  try {
    const rate = checkRateLimit(`entrar:${clientKey(req)}`, 5, 60_000)
    if (!rate.allowed) {
      console.warn('[insiders/entrar] rate limit exceeded')
      return NextResponse.json(
        { error: 'Muitas tentativas. Aguarde um instante e tente novamente.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
      )
    }

    const body = await req.json().catch(() => null)
    const cpf = typeof body?.cpf === 'string' ? body.cpf : ''
    const senha = typeof body?.senha === 'string' ? body.senha : ''

    if (!isValidCpf(cpf) || !senha) {
      await verifyPassword('equalizador', HASH_DESCARTAVEL)
      return NextResponse.json({ error: FALHA }, { status: 401 })
    }

    const supabase = getAdminClient()

    const { data: linhas, error: findError } = await supabase
      .from('dados_insiders')
      .select('id, cpf, nome')
      .in('cpf', cpfCandidates(cpf))
      .limit(1)

    if (findError) {
      console.error('[insiders/entrar] find error:', findError)
      return NextResponse.json({ error: 'Erro ao entrar.' }, { status: 500 })
    }

    const insider = linhas?.[0] ?? null

    if (!insider) {
      // Paga o mesmo custo do caminho com credencial, para não vazar por timing.
      await verifyPassword(senha, HASH_DESCARTAVEL)
      return NextResponse.json({ error: FALHA }, { status: 401 })
    }

    const { data: credencial, error: credError } = await supabase
      .from('insider_credentials')
      .select('senha_hash')
      .eq('insider_id', insider.id)
      .maybeSingle()

    // Falha fechado: erro de consulta nunca vira "entrou".
    if (credError) {
      console.error('[insiders/entrar] credential error:', credError)
      return NextResponse.json({ error: 'Erro ao entrar.' }, { status: 500 })
    }

    if (!credencial?.senha_hash) {
      await verifyPassword(senha, HASH_DESCARTAVEL)
      return NextResponse.json({ error: FALHA }, { status: 401 })
    }

    const { valid } = await verifyPassword(senha, credencial.senha_hash)
    if (!valid) {
      return NextResponse.json({ error: FALHA }, { status: 401 })
    }

    const token = await createInsiderToken({
      id: insider.id,
      cpf: insider.cpf,
      nome: insider.nome,
    })

    return attachInsiderCookie(NextResponse.json({ success: true }), token)
  } catch (err) {
    console.error('[insiders/entrar] unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
