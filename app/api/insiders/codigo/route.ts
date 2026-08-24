import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, hashPassword } from '@/lib/auth/api-auth'
import { cpfCandidates } from '@/lib/insider/insider-mapper'
import { isValidCpf } from '@/lib/insider/validation'
import { checkRateLimit, clientKey } from '@/lib/insider/rate-limit'
import { isSameOrigin } from '@/lib/auth/same-origin'
import { enviarCodigoLogin } from '@/lib/email/insider-login-code'
import { expiraEm, gerarCodigo, mascararEmail } from '@/lib/insider/login-code'

/**
 * POST /api/insiders/codigo — pede um código de acesso por e-mail.
 *
 * A rota é pública, então a resposta é sempre a mesma independentemente de o
 * CPF existir, ter e-mail cadastrado ou o envio ter falhado: qualquer
 * diferença aqui transformaria o endpoint num verificador de "esse CPF é
 * Insider?". O `enviado_para` só aparece quando há de fato um envio, e ainda
 * assim mascarado — quem digitou o CPF precisa saber em que caixa procurar,
 * mas não pode extrair o e-mail de ninguém.
 */
const RESPOSTA_GENERICA = {
  ok: true,
  mensagem: 'Se este CPF tiver cadastro com e-mail, o código foi enviado.',
}

export async function POST(req: NextRequest) {
  try {
    // Dois baldes: por IP contra varredura ampla, por CPF para que ninguém
    // use o endpoint para inundar a caixa de outra pessoa.
    const rate = checkRateLimit(`codigo:${clientKey(req)}`, 5, 60_000)
    if (!rate.allowed) {
      console.warn('[insiders/codigo] rate limit por IP excedido')
      return NextResponse.json(
        { error: 'Muitas tentativas. Aguarde um instante e tente novamente.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
      )
    }

    if (!isSameOrigin(req)) {
      console.warn('[insiders/codigo] origem recusada')
      return NextResponse.json({ error: 'Requisição inválida.' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    const cpf = typeof body?.cpf === 'string' ? body.cpf : ''

    if (!isValidCpf(cpf)) {
      return NextResponse.json({ error: 'CPF inválido.' }, { status: 400 })
    }

    const porCpf = checkRateLimit(`codigo:cpf:${cpf.replace(/\D/g, '')}`, 3, 10 * 60_000)
    if (!porCpf.allowed) {
      console.warn('[insiders/codigo] rate limit por CPF excedido')
      return NextResponse.json(
        { error: 'Muitos códigos pedidos para este CPF. Aguarde alguns minutos.' },
        { status: 429, headers: { 'Retry-After': String(porCpf.retryAfterSeconds) } }
      )
    }

    const supabase = getAdminClient()

    const { data: linhas, error: findError } = await supabase
      .from('dados_insiders')
      .select('id, nome, email, ativo')
      .in('cpf', cpfCandidates(cpf))
      .limit(1)

    // Falha fechado: erro de consulta não vira "código enviado".
    if (findError) {
      console.error('[insiders/codigo] find error:', findError)
      return NextResponse.json({ error: 'Erro ao enviar o código.' }, { status: 500 })
    }

    const insider = linhas?.[0] ?? null
    const email = typeof insider?.email === 'string' ? insider.email.trim() : ''

    if (!insider || insider.ativo === false || !email) {
      return NextResponse.json(RESPOSTA_GENERICA)
    }

    // Faxina oportunista: sem cron, a tabela cresceria para sempre.
    await supabase
      .from('insider_login_codes')
      .delete()
      .lt('expira_em', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    // Pedir um código novo invalida os anteriores — senão vários códigos
    // vivos ao mesmo tempo multiplicariam as chances de acerto às cegas.
    await supabase
      .from('insider_login_codes')
      .delete()
      .eq('insider_id', insider.id)
      .is('consumido_em', null)

    const codigo = gerarCodigo()
    const { error: insertError } = await supabase.from('insider_login_codes').insert({
      insider_id: insider.id,
      codigo_hash: await hashPassword(codigo),
      expira_em: expiraEm().toISOString(),
    })

    if (insertError) {
      console.error('[insiders/codigo] insert error:', insertError)
      return NextResponse.json({ error: 'Erro ao enviar o código.' }, { status: 500 })
    }

    const envio = await enviarCodigoLogin(email, codigo, insider.nome ?? null)
    if (!envio.ok) {
      // O código já está gravado, mas ninguém recebeu: apaga para não deixar
      // um código válido pendurado que só o banco conhece.
      await supabase.from('insider_login_codes').delete().eq('insider_id', insider.id).is('consumido_em', null)
      console.error('[insiders/codigo] falha no envio:', envio.error)
      return NextResponse.json({ error: 'Não foi possível enviar o e-mail agora.' }, { status: 502 })
    }

    return NextResponse.json({ ...RESPOSTA_GENERICA, enviado_para: mascararEmail(email) })
  } catch (err) {
    console.error('[insiders/codigo] unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
