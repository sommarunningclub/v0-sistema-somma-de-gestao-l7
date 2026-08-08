import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, hashPassword } from '@/lib/auth/api-auth'
import { cpfCandidates } from '@/lib/insider/insider-mapper'
import { checkRateLimit, clientKey } from '@/lib/insider/rate-limit'
import { createInsiderToken, attachInsiderCookie } from '@/lib/auth/insider-session'
import { validateSenha } from '@/lib/insider/validation'

/** Mesma mensagem de `entrar`: o endpoint não pode revelar quem é Insider. */
const FALHA = 'CPF ou senha incorretos.'
const SENHA_MAX = 128

type CredencialEmbed = { senha_hash: string | null } | { senha_hash: string | null }[] | null | undefined

export async function POST(req: NextRequest) {
  try {
    const rate = checkRateLimit(`criar-senha:${clientKey(req)}`, 5, 60_000)
    if (!rate.allowed) {
      console.warn('[insiders/criar-senha] rate limit exceeded')
      return NextResponse.json(
        { error: 'Muitas tentativas. Aguarde um instante e tente novamente.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
      )
    }

    const body = await req.json().catch(() => null)
    const cpf = typeof body?.cpf === 'string' ? body.cpf : ''
    const senha = typeof body?.senha === 'string' ? body.senha : ''
    const senhaConfirmacao = typeof body?.senha_confirmacao === 'string' ? body.senha_confirmacao : ''

    const supabase = getAdminClient()

    // Uma única consulta, igual a `entrar`: CPF ausente e CPF com cadastro não
    // podem diferir em número de round-trips, senão o tempo de resposta vira
    // um oráculo de quem é Insider.
    const { data: linhas, error: findError } = await supabase
      .from('dados_insiders')
      .select('id, cpf, nome, insider_credentials(senha_hash)')
      .in('cpf', cpfCandidates(cpf))
      .limit(1)

    // Falha fechado: erro de consulta nunca vira "senha criada".
    if (findError) {
      console.error('[insiders/criar-senha] find error:', findError)
      return NextResponse.json({ error: 'Erro ao criar a senha.' }, { status: 500 })
    }

    const insider = linhas?.[0] ?? null
    const credencial = insider?.insider_credentials as CredencialEmbed
    const senhaHash = Array.isArray(credencial) ? credencial[0]?.senha_hash : credencial?.senha_hash

    // Esta rota só cria a primeira senha; trocar uma senha existente não é
    // trabalho dela — quem já tem credencial deve usar `entrar`.
    if (insider && senhaHash) {
      return NextResponse.json(
        { error: 'Este cadastro já tem senha. Use a opção de entrar.' },
        { status: 409 }
      )
    }

    const erroSenha =
      validateSenha(senha, senhaConfirmacao, true) ??
      (senha.length > SENHA_MAX ? 'A senha deve ter no máximo 128 caracteres.' : null)
    if (erroSenha) {
      return NextResponse.json({ error: erroSenha }, { status: 400 })
    }

    // Sem cadastro para o CPF: mesma falha genérica de `entrar`, para não
    // revelar que o CPF é desconhecido.
    if (!insider) {
      return NextResponse.json({ error: FALHA }, { status: 401 })
    }

    const senhaHashNova = await hashPassword(senha)
    const { error: insertError } = await supabase.from('insider_credentials').insert({
      insider_id: insider.id,
      senha_hash: senhaHashNova,
      atualizado_em: new Date().toISOString(),
    })

    if (insertError) {
      console.error('[insiders/criar-senha] insert error:', insertError)
      return NextResponse.json({ error: 'Erro ao criar a senha.' }, { status: 500 })
    }

    const token = await createInsiderToken({
      id: insider.id,
      cpf: insider.cpf,
      nome: insider.nome,
    })

    return attachInsiderCookie(NextResponse.json({ success: true }), token)
  } catch (err) {
    console.error('[insiders/criar-senha] unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
