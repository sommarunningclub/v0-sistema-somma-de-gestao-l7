import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { sendTestEmail } from '@/lib/email/dispatch'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'email')
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  try {
    const { email } = (await req.json()) as { email?: string }
    if (!email) return NextResponse.json({ error: 'Informe um e-mail' }, { status: 400 })

    const result = await sendTestEmail(id, email)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[email-campaigns/test] POST exception:', err)
    return NextResponse.json({ error: 'Erro ao enviar e-mail de teste' }, { status: 500 })
  }
}
