import { NextRequest, NextResponse } from 'next/server'
import { getLeadById, updateLead } from '@/lib/services/crm'
import type { MeetingData } from '@/lib/services/crm'
import {
  isGoogleCalendarConfigured,
  createCalendarEvent,
  updateCalendarEvent,
  cancelCalendarEvent,
} from '@/lib/services/google-calendar'

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
    const needsDetails = body.status === 'agendado' || body.status === 'reagendado'

    if (needsDetails) {
      if (!body.start_at || !body.end_at) {
        return NextResponse.json(
          { error: 'Data e hora de início e término são obrigatórios para reunião agendada' },
          { status: 400 }
        )
      }
      if (new Date(body.end_at) <= new Date(body.start_at)) {
        return NextResponse.json(
          { error: 'Horário de término deve ser após o início' },
          { status: 400 }
        )
      }
      if (body.type === 'presencial' && !body.address?.trim()) {
        return NextResponse.json(
          { error: 'Endereço é obrigatório para reunião presencial agendada' },
          { status: 400 }
        )
      }
      if (body.type === 'online' && !body.meeting_url?.trim()) {
        return NextResponse.json(
          { error: 'Link da reunião é obrigatório para reunião online agendada' },
          { status: 400 }
        )
      }
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

    let meeting: MeetingData = {
      ...body,
      extra_attendees: body.extra_attendees || [],
      timezone: body.timezone || 'America/Sao_Paulo',
    }
    let syncWarning: string | null = null

    // ─── Google Calendar sync ─────────────────────────────────────────────────
    if (isGoogleCalendarConfigured()) {
      try {
        if (needsDetails && body.start_at && body.end_at) {
          const attendees = [
            ...(lead.email ? [{ email: lead.email }] : []),
            ...(body.extra_attendees || []).filter(Boolean).map((e) => ({ email: e })),
          ]

          const summary = `Reunião com ${lead.name}${lead.company_name ? ` - ${lead.company_name}` : ''}`
          const location =
            body.type === 'presencial'
              ? (body.address ?? undefined)
              : (body.meeting_url ?? undefined)
          const descriptionParts: string[] = []
          if (body.type === 'online' && body.meeting_url)
            descriptionParts.push(`Link: ${body.meeting_url}`)
          if (body.notes) descriptionParts.push(body.notes)
          const description = descriptionParts.join('\n\n')

          const eventInput = {
            summary,
            description,
            start: { dateTime: body.start_at, timeZone: meeting.timezone },
            end: { dateTime: body.end_at, timeZone: meeting.timezone },
            location,
            attendees,
          }

          if (meeting.google_event_id) {
            await updateCalendarEvent(meeting.google_event_id, eventInput)
          } else {
            const eventId = await createCalendarEvent(eventInput)
            meeting = { ...meeting, google_event_id: eventId }
          }

          meeting = {
            ...meeting,
            google_sync_status: 'synced',
            google_synced_at: new Date().toISOString(),
          }
        } else if (body.status === 'cancelado' && meeting.google_event_id) {
          await cancelCalendarEvent(meeting.google_event_id)
          meeting = {
            ...meeting,
            google_sync_status: 'cancelled',
            google_synced_at: new Date().toISOString(),
          }
        }
      } catch (err) {
        console.error('[v0] Google Calendar sync error:', err)
        syncWarning = err instanceof Error ? err.message : 'Erro de sincronização com Google Calendar'
        meeting = { ...meeting, google_sync_status: 'failed' }
      }
    }

    // ─── Persist ─────────────────────────────────────────────────────────────
    const updated = await updateLead(id, { meeting })
    if (!updated) {
      return NextResponse.json({ error: 'Erro ao salvar reunião' }, { status: 500 })
    }

    return NextResponse.json({
      meeting: updated.meeting,
      sync_warning: syncWarning,
    })
  } catch (err) {
    console.error('[v0] Meeting PUT error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
