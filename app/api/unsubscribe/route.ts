import { NextRequest, NextResponse } from 'next/server'
import { addSuppression } from '@/lib/email/suppression'
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe-token'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getSecret(): string {
  return process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

function page(title: string, message: string): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${title}</title></head>
<body style="margin:0;font-family:Helvetica,Arial,sans-serif;background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;">
  <div style="max-width:420px;padding:32px;text-align:center;">
    <h1 style="font-size:22px;margin:0 0 12px;">${title}</h1>
    <p style="font-size:15px;line-height:1.6;color:#a3a3a3;margin:0;">${message}</p>
  </div>
</body>
</html>`
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

async function handle(token: string | null): Promise<boolean> {
  if (!token) return false
  const payload = verifyUnsubscribeToken(token, getSecret())
  if (!payload) return false
  return addSuppression(payload.email, 'unsubscribe', payload.campaignId)
}

export async function GET(req: NextRequest) {
  const ok = await handle(req.nextUrl.searchParams.get('t'))
  return ok
    ? page('Pronto', 'Você não receberá mais e-mails do Somma Running Club.')
    : page('Link inválido', 'Este link de descadastro expirou ou está incorreto.')
}

// One-click do Gmail e do Outlook.
export async function POST(req: NextRequest) {
  await handle(req.nextUrl.searchParams.get('t'))
  return NextResponse.json({ ok: true })
}
