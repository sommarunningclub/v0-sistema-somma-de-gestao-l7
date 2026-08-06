import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, verifyPassword } from '@/lib/auth/api-auth'
import { cpfCandidates } from '@/lib/insider/insider-mapper'
import { checkRateLimit, clientKey } from '@/lib/insider/rate-limit'
import { createInsiderToken, attachInsiderCookie } from '@/lib/auth/insider-session'

/** Mesma mensagem para todas as falhas: o endpoint não pode revelar quem é Insider. */
const FALHA = 'CPF ou senha incorretos.'
const HASH_DESCARTAVEL = '$2b$12$wlJXRTwSoU2ce5S6KmoHeOLcsJYIAnzo2.K.eccnhrsQ4Soi7neG6'
const SENHA_MAX = 128

type CredencialEmbed = { senha_hash: string | null } | { senha_hash: string | null }[] | null | undefined

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
    // Rejeita senhas absurdamente grandes antes de gastar bcrypt nelas, mas sem
    // sair pelo caminho rápido: o custo continua o mesmo dos demais 401s abaixo.
    const senhaValida = senha.length > 0 && senha.length <= SENHA_MAX

    const supabase = getAdminClient()

    // Uma única consulta em todo caminho de 401 — CPF que falha o checksum, CPF
    // ausente, CPF sem credencial ou senha errada não podem diferir em número de
    // round-trips, senão o tempo de resposta vira um oráculo de quem é Insider.
    const { data: linhas, error: findError } = await supabase
      .from('dados_insiders')
      .select('id, cpf, nome, insider_credentials(senha_hash)')
      .in('cpf', cpfCandidates(cpf))
      .limit(1)

    // Falha fechado: erro de consulta nunca vira "entrou".
    if (findError) {
      console.error('[insiders/entrar] find error:', findError)
      return NextResponse.json({ error: 'Erro ao entrar.' }, { status: 500 })
    }

    const insider = linhas?.[0] ?? null
    const credencial = insider?.insider_credentials as CredencialEmbed
    const senhaHash = Array.isArray(credencial) ? credencial[0]?.senha_hash : credencial?.senha_hash

    if (!insider || !senhaHash || !senhaValida) {
      // Paga o mesmo bcrypt do caminho feliz, para não vazar por timing. Se a senha
      // recebida for válida em tamanho, usa ela mesma; senão, um valor fixo — nunca
      // o texto gigante recebido, que reintroduziria o custo que queremos evitar.
      await verifyPassword(senhaValida ? senha : 'equalizador', HASH_DESCARTAVEL)
      return NextResponse.json({ error: FALHA }, { status: 401 })
    }

    const { valid } = await verifyPassword(senha, senhaHash)
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
