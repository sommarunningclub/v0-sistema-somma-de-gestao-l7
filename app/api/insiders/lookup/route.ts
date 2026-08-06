import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/auth/api-auth'
import { isValidCpf } from '@/lib/insider/validation'
import { checkRateLimit, clientKey } from '@/lib/insider/rate-limit'
import {
  cpfCandidates,
  toInsiderPublic,
  INSIDER_PUBLIC_COLUMNS,
} from '@/lib/insider/insider-mapper'

export async function POST(req: NextRequest) {
  try {
    const rate = checkRateLimit(`lookup:${clientKey(req)}`, 10, 60_000)
    if (!rate.allowed) {
      console.warn('[insiders/lookup] rate limit exceeded')
      return NextResponse.json(
        { error: 'Muitas tentativas. Aguarde um instante e tente novamente.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
      )
    }

    const body = await req.json().catch(() => null)
    const cpf = typeof body?.cpf === 'string' ? body.cpf : ''

    if (!isValidCpf(cpf)) {
      return NextResponse.json({ error: 'CPF inválido.' }, { status: 400 })
    }

    const supabase = getAdminClient()

    const { data, error } = await supabase
      .from('dados_insiders')
      .select(INSIDER_PUBLIC_COLUMNS)
      .in('cpf', cpfCandidates(cpf))
      .limit(1)

    if (error) {
      console.error('[insiders/lookup] select error:', error)
      return NextResponse.json({ error: 'Erro ao consultar o cadastro.' }, { status: 500 })
    }

    const row = data?.[0]
    if (!row) {
      return NextResponse.json({ found: false })
    }

    const { data: credencial, error: credError } = await supabase
      .from('insider_credentials')
      .select('insider_id')
      .eq('insider_id', (row as { id: string }).id)
      .maybeSingle()

    if (credError) {
      console.error('[insiders/lookup] credential error:', credError)
    }

    return NextResponse.json({
      found: true,
      insider: toInsiderPublic(row as Record<string, unknown>, Boolean(credencial)),
    })
  } catch (err) {
    console.error('[insiders/lookup] unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
