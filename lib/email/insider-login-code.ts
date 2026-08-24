import { Resend } from 'resend'
import { COLORS, document, escapeHtml } from './templates/shared'
import { CODIGO_TTL_MS } from '@/lib/insider/login-code'

/**
 * E-mail transacional com o código de acesso do Insider.
 *
 * Diferente das campanhas de `dispatch.ts` em dois pontos deliberados:
 *
 * 1. NÃO consulta a lista de supressão. Descadastrar-se do marketing não pode
 *    impedir alguém de entrar na própria conta.
 * 2. NÃO leva rodapé de descadastro. É um e-mail de autenticação pedido pelo
 *    próprio destinatário, não comunicação de marketing.
 */

const ASSUNTO = 'Seu código de acesso — Somma Insider'

function corpo(codigo: string, nome: string | null): string {
  const saudacao = nome ? `Olá, ${escapeHtml(nome.split(' ')[0])}!` : 'Olá!'
  const minutos = Math.round(CODIGO_TTL_MS / 60_000)

  return document(
    `
    <p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:${COLORS.black};">${saudacao}</p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${COLORS.black};">
      Use o código abaixo para entrar no seu perfil de Insider.
    </p>
    <p style="margin:0 0 24px;text-align:center;">
      <span style="display:inline-block;padding:16px 28px;background-color:${COLORS.black};border-radius:8px;font-family:monospace;font-size:32px;letter-spacing:8px;color:${COLORS.white};">${escapeHtml(codigo)}</span>
    </p>
    <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:${COLORS.gray};">
      O código vale por ${minutos} minutos e só pode ser usado uma vez.
    </p>
    <p style="margin:0;font-size:14px;line-height:1.6;color:${COLORS.gray};">
      Se não foi você que pediu, ignore este e-mail — ninguém entra na sua conta sem o código.
    </p>`,
    ASSUNTO,
  )
}

export async function enviarCodigoLogin(
  email: string,
  codigo: string,
  nome: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM

  // Fail-closed: sem provedor configurado a rota não pode fingir que enviou,
  // ou o insider fica esperando um e-mail que nunca sai.
  if (!apiKey || !from) {
    return { ok: false, error: 'RESEND_API_KEY ou EMAIL_FROM não configurado' }
  }

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: ASSUNTO,
    html: corpo(codigo, nome),
  })

  if (error) {
    console.error('[insider/codigo] erro no envio:', error.message)
    return { ok: false, error: error.message }
  }

  return { ok: true }
}
