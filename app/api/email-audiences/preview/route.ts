import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { AUDIENCE_SOURCES, resolveAudience } from '@/lib/email/audiences'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'email')
  if (auth instanceof NextResponse) return auth
  return NextResponse.json({ sources: Object.values(AUDIENCE_SOURCES) })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'email')
  if (auth instanceof NextResponse) return auth

  try {
    const audience = await req.json()
    const recipients = await resolveAudience(audience)

    const porBase: Record<string, number> = {}
    for (const r of recipients) porBase[r.sourceBase] = (porBase[r.sourceBase] ?? 0) + 1

    return NextResponse.json({ total: recipients.length, porBase })
  } catch (err) {
    console.error('[email-audiences/preview] POST exception:', err)
    return NextResponse.json({ error: 'Erro ao calcular a audiência' }, { status: 500 })
  }
}
