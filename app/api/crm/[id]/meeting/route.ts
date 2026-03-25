import { NextRequest, NextResponse } from 'next/server'
import { getLeadById, updateLead } from '@/lib/services/crm'
import type { MeetingData } from '@/lib/services/crm'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const lead = await getLeadById(id)
  if (!lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
  return NextResponse.json(lead.meeting || null)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const lead = await getLeadById(id)
    if (!lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })

    const body = (await req.json()) as MeetingData

    // ─── Validation ───────────────────────────────────────────────────────────
    if (body.start_at && body.end_at && new Date(body.end_at) <= new Date(body.start_at)) {
      return NextResponse.json(
        { error: 'Horário de término deve ser após o início' },
        { status: 400 }
      )
    }

    // Validate extra attendee emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const invalidEmails = (body.extra_attendees || []).filter((e) => !emailRegex.test(e))
    if (invalidEmails.length > 0) {
      return NextResponse.json(
        { error: `E-mails inválidos: ${invalidEmails.join(', ')}` },
        { status: 400 }
      )
    }

    const meeting: MeetingData = {
      ...body,
      extra_attendees: body.extra_attendees || [],
      timezone: body.timezone || 'America/Sao_Paulo',
    }

    // ─── Persist ─────────────────────────────────────────────────────────────
    const updated = await updateLead(id, { meeting })
    if (!updated) {
      return NextResponse.json({ error: 'Erro ao salvar reunião' }, { status: 500 })
    }

    return NextResponse.json({ meeting: updated.meeting })
  } catch (err) {
    console.error('[v0] Meeting PUT error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
