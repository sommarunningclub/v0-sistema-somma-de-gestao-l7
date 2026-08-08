'use client'

import { useId, useState } from 'react'
import { apiFetch } from '@/lib/api-client'
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  Clock,
  Link2,
  MapPin,
  Moon,
  Plus,
  Sun,
  Sunset,
  Users,
  Video,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SectionTitle, StatusPill, Well, notify, type StatusTone } from '@/components/somma'
import type { MeetingData, MeetingStatus, MeetingType } from '@/lib/services/crm'

/**
 * Aba de reunião do lead.
 *
 * Vive dentro do `ResponsiveModal` do lead — por isso não abre um modal próprio.
 * O feedback de salvar deixou de ser um banner artesanal e passou a usar o
 * canal único de `notify`.
 */

interface CRMMeetingTabProps {
  leadId: string
  leadEmail: string
  initialMeeting: MeetingData | null | undefined
  onSaved?: (meeting: MeetingData) => void
}

const STATUS_OPTIONS: { value: MeetingStatus; label: string; tone: StatusTone }[] = [
  { value: 'pendente', label: 'Pendente', tone: 'neutral' },
  { value: 'agendado', label: 'Agendado', tone: 'info' },
  { value: 'reagendado', label: 'Reagendado', tone: 'warning' },
  { value: 'cancelado', label: 'Cancelado', tone: 'danger' },
  { value: 'realizado', label: 'Realizado', tone: 'success' },
]

// Generate time slots every 15 minutes (07:00 – 22:00)
const TIME_SLOTS: string[] = []
for (let h = 7; h <= 22; h++) {
  for (const m of [0, 15, 30, 45]) {
    if (h === 22 && m > 0) break
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
}

const PERIOD_PRESETS = [
  { label: 'Manhã', Icon: Sun, time: '09:00' },
  { label: 'Tarde', Icon: Sunset, time: '14:00' },
  { label: 'Noite', Icon: Moon, time: '19:00' },
]

const DEFAULT_MEETING: MeetingData = {
  status: 'pendente',
  type: 'online',
  start_at: null,
  end_at: null,
  timezone: 'America/Sao_Paulo',
  notes: '',
  address: null,
  meeting_url: null,
  extra_attendees: [],
  google_event_id: null,
  google_sync_status: null,
  google_synced_at: null,
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const SELECT_CLASS =
  'ds-tap h-11 w-full min-w-0 flex-1 cursor-pointer appearance-none rounded-lg border border-line bg-surface-sunken px-3 text-base text-ink transition-colors hover:border-line-strong focus-visible:border-brand focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand lg:h-10 lg:min-h-0'

export function CRMMeetingTab({
  leadId,
  leadEmail,
  initialMeeting,
  onSaved,
}: CRMMeetingTabProps) {
  const fieldId = useId()
  const [meeting, setMeeting] = useState<MeetingData>(initialMeeting || DEFAULT_MEETING)
  const [saving, setSaving] = useState(false)
  const [newAttendee, setNewAttendee] = useState('')
  const [attendeeError, setAttendeeError] = useState('')

  const update = <K extends keyof MeetingData>(key: K, value: MeetingData[K]) => {
    setMeeting((prev) => ({ ...prev, [key]: value }))
  }

  const addAttendee = () => {
    const email = newAttendee.trim().toLowerCase()
    if (!email) return
    if (!EMAIL_RE.test(email)) {
      setAttendeeError('E-mail inválido')
      return
    }
    if (leadEmail && email === leadEmail.toLowerCase()) {
      setAttendeeError('Este e-mail já é o contato principal')
      return
    }
    if (meeting.extra_attendees.includes(email)) {
      setAttendeeError('E-mail já adicionado')
      return
    }
    setMeeting((prev) => ({ ...prev, extra_attendees: [...prev.extra_attendees, email] }))
    setNewAttendee('')
    setAttendeeError('')
  }

  const removeAttendee = (email: string) => {
    setMeeting((prev) => ({
      ...prev,
      extra_attendees: prev.extra_attendees.filter((e) => e !== email),
    }))
  }

  // ─── Date/Time helpers ────────────────────────────────────────────────────
  const toDatePart = (iso: string | null): string => {
    if (!iso) return ''
    return new Date(iso).toISOString().slice(0, 10)
  }

  const toTimePart = (iso: string | null): string => {
    if (!iso) return ''
    const d = new Date(iso)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const combineDateAndTime = (dateStr: string, timeStr: string): string | null => {
    if (!dateStr || !timeStr) return null
    return new Date(`${dateStr}T${timeStr}:00`).toISOString()
  }

  const currentDate = toDatePart(meeting.start_at) || toDatePart(meeting.end_at)
  const currentStartTime = toTimePart(meeting.start_at)
  const currentEndTime = toTimePart(meeting.end_at)

  const handleDateChange = (dateStr: string) => {
    const newStart = currentStartTime ? combineDateAndTime(dateStr, currentStartTime) : null
    const newEnd = currentEndTime ? combineDateAndTime(dateStr, currentEndTime) : null
    setMeeting(prev => ({ ...prev, start_at: newStart, end_at: newEnd }))
  }

  const handleStartTimeChange = (timeStr: string) => {
    const date = currentDate || new Date().toISOString().slice(0, 10)
    const newStart = combineDateAndTime(date, timeStr)
    // Auto-set date if not set
    if (!currentDate) {
      const newEnd = currentEndTime ? combineDateAndTime(date, currentEndTime) : null
      setMeeting(prev => ({ ...prev, start_at: newStart, end_at: newEnd }))
    } else {
      update('start_at', newStart)
    }
  }

  const handleEndTimeChange = (timeStr: string) => {
    const date = currentDate || new Date().toISOString().slice(0, 10)
    const newEnd = combineDateAndTime(date, timeStr)
    if (!currentDate) {
      const newStart = currentStartTime ? combineDateAndTime(date, currentStartTime) : null
      setMeeting(prev => ({ ...prev, start_at: newStart, end_at: newEnd }))
    } else {
      update('end_at', newEnd)
    }
  }

  const applyDuration = (minutes: number) => {
    const startTime = currentStartTime || '09:00'
    const date = currentDate || new Date().toISOString().slice(0, 10)
    if (!currentStartTime) {
      // Auto-set start if empty
      const newStart = combineDateAndTime(date, startTime)
      setMeeting(prev => ({ ...prev, start_at: newStart }))
    }
    const start = new Date(`${date}T${startTime}:00`)
    const end = new Date(start.getTime() + minutes * 60 * 1000)
    const endTime = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
    const newEnd = combineDateAndTime(date, endTime)
    update('end_at', newEnd)
  }

  const applyPreset = (time: string) => {
    const date = currentDate || new Date().toISOString().slice(0, 10)
    const newStart = combineDateAndTime(date, time)
    const start = new Date(`${date}T${time}:00`)
    const end = new Date(start.getTime() + 60 * 60 * 1000) // default 1h
    const endTime = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
    const newEnd = combineDateAndTime(date, endTime)
    setMeeting(prev => ({
      ...prev,
      start_at: newStart,
      end_at: newEnd,
    }))
  }

  // Calculate duration label
  const durationLabel = (() => {
    if (!meeting.start_at || !meeting.end_at) return null
    const diff = new Date(meeting.end_at).getTime() - new Date(meeting.start_at).getTime()
    if (diff <= 0) return null
    const mins = Math.round(diff / 60000)
    if (mins < 60) return `${mins}min`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `${h}h${m}min` : `${h}h`
  })()

  // Active duration for highlighting
  const activeDuration = (() => {
    if (!meeting.start_at || !meeting.end_at) return 0
    return Math.round((new Date(meeting.end_at).getTime() - new Date(meeting.start_at).getTime()) / 60000)
  })()

  const handleSave = async () => {
    setSaving(true)

    try {
      const res = await apiFetch(`/api/crm/${leadId}/meeting`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(meeting),
      })

      const data = await res.json()

      if (!res.ok) {
        notify.error(data.error || 'Erro ao salvar reunião')
        return
      }

      const saved = data.meeting as MeetingData
      setMeeting(saved)
      notify.success('Reunião salva')

      onSaved?.(saved)
    } catch {
      notify.error('Erro de conexão ao salvar reunião')
    } finally {
      setSaving(false)
    }
  }

  const hasLeadEmail = Boolean(leadEmail) && EMAIL_RE.test(leadEmail)

  return (
    <div className="space-y-6">
      <section>
        <SectionTitle
          title="Status da reunião"
          meta={
            <StatusPill
              tone={STATUS_OPTIONS.find((o) => o.value === meeting.status)?.tone ?? 'neutral'}
            >
              {STATUS_OPTIONS.find((o) => o.value === meeting.status)?.label ?? meeting.status}
            </StatusPill>
          }
        />
        <div role="radiogroup" aria-label="Status da reunião" className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((opt) => {
            const selected = meeting.status === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => update('status', opt.value)}
                className={`ds-tap rounded-lg border px-3 text-[0.8125rem] font-medium transition-colors ${
                  selected
                    ? 'border-brand-border bg-brand-soft text-brand-strong'
                    : 'border-line bg-surface-sunken text-ink-muted hover:border-line-strong hover:text-ink'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <SectionTitle title="Formato" />
        <div role="radiogroup" aria-label="Formato da reunião" className="grid grid-cols-2 gap-2">
          {(
            [
              { value: 'online' as MeetingType, label: 'Online', Icon: Video },
              { value: 'presencial' as MeetingType, label: 'Presencial', Icon: MapPin },
            ] as { value: MeetingType; label: string; Icon: React.ElementType }[]
          ).map(({ value, label, Icon }) => {
            const selected = meeting.type === value
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => update('type', value)}
                className={`ds-tap flex items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${
                  selected
                    ? 'border-brand-border bg-brand-soft text-brand-strong'
                    : 'border-line bg-surface-sunken text-ink-muted hover:border-line-strong hover:text-ink'
                }`}
              >
                <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                {label}
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <SectionTitle title="Data e horário" meta={durationLabel ?? undefined} />
        <Well className="space-y-3.5 p-3.5">
          <div className="flex gap-2">
            {PERIOD_PRESETS.map((preset) => {
              const selected = currentStartTime === preset.time
              return (
                <button
                  key={preset.label}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => applyPreset(preset.time)}
                  className={`ds-tap flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 text-[0.8125rem] font-medium transition-colors ${
                    selected
                      ? 'border-brand-border bg-brand-soft text-brand-strong'
                      : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink'
                  }`}
                >
                  <preset.Icon aria-hidden="true" className="h-3.5 w-3.5" />
                  {preset.label}
                </button>
              )
            })}
          </div>

          <div>
            <label htmlFor={`${fieldId}-date`} className="flex items-center gap-1.5 text-meta font-medium text-ink-muted">
              <Calendar aria-hidden="true" className="h-3.5 w-3.5" />
              Data
            </label>
            <Input
              id={`${fieldId}-date`}
              type="date"
              value={currentDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="mt-1.5 w-full"
            />
          </div>

          <div>
            <span className="flex items-center gap-1.5 text-meta font-medium text-ink-muted">
              <Clock aria-hidden="true" className="h-3.5 w-3.5" />
              Horário
            </span>
            <div className="mt-1.5 flex items-center gap-2">
              <label htmlFor={`${fieldId}-start`} className="sr-only">
                Horário de início
              </label>
              <select
                id={`${fieldId}-start`}
                value={currentStartTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">Início</option>
                {TIME_SLOTS.map((t) => (
                  <option key={`s-${t}`} value={t}>{t}</option>
                ))}
              </select>
              <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-subtle" />
              <label htmlFor={`${fieldId}-end`} className="sr-only">
                Horário de término
              </label>
              <select
                id={`${fieldId}-end`}
                value={currentEndTime}
                onChange={(e) => handleEndTimeChange(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">Término</option>
                {TIME_SLOTS.map((t) => (
                  <option key={`e-${t}`} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div role="group" aria-label="Duração rápida" className="flex flex-wrap gap-1.5">
            {[
              { label: '30min', mins: 30 },
              { label: '1h', mins: 60 },
              { label: '1h30', mins: 90 },
              { label: '2h', mins: 120 },
            ].map((d) => {
              const selected = activeDuration === d.mins
              return (
                <button
                  key={d.mins}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => applyDuration(d.mins)}
                  className={`rounded-md border px-2.5 py-1.5 text-meta font-medium transition-colors ${
                    selected
                      ? 'border-brand-border bg-brand-soft text-brand-strong'
                      : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink'
                  }`}
                >
                  {d.label}
                </button>
              )
            })}
          </div>
        </Well>
      </section>

      <section>
        <SectionTitle title={meeting.type === 'presencial' ? 'Local' : 'Acesso'} />
        {meeting.type === 'presencial' ? (
          <div>
            <label htmlFor={`${fieldId}-address`} className="flex items-center gap-1.5 text-meta font-medium text-ink-muted">
              <MapPin aria-hidden="true" className="h-3.5 w-3.5" />
              Endereço
            </label>
            <Input
              id={`${fieldId}-address`}
              className="mt-1.5"
              value={meeting.address || ''}
              onChange={(e) => update('address', e.target.value || null)}
              placeholder="Rua, número, bairro, cidade"
              type="text"
              autoComplete="street-address"
            />
          </div>
        ) : (
          <div>
            <label htmlFor={`${fieldId}-url`} className="flex items-center gap-1.5 text-meta font-medium text-ink-muted">
              <Link2 aria-hidden="true" className="h-3.5 w-3.5" />
              Link da reunião
            </label>
            <Input
              id={`${fieldId}-url`}
              className="mt-1.5"
              value={meeting.meeting_url || ''}
              onChange={(e) => update('meeting_url', e.target.value || null)}
              placeholder="https://meet.google.com/..."
              type="url"
              inputMode="url"
              autoComplete="url"
            />
          </div>
        )}
      </section>

      <section>
        <SectionTitle title="Pauta" />
        <label htmlFor={`${fieldId}-notes`} className="sr-only">
          Observações da reunião
        </label>
        <textarea
          id={`${fieldId}-notes`}
          value={meeting.notes || ''}
          onChange={(e) => update('notes', e.target.value)}
          placeholder="Pauta, objetivos, pontos a discutir..."
          rows={3}
          className="w-full resize-none rounded-lg border border-line bg-surface-sunken px-3.5 py-2.5 text-base text-ink transition-colors placeholder:text-ink-subtle hover:border-line-strong focus-visible:border-brand focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand"
        />
      </section>

      <section>
        <SectionTitle
          title="Participantes"
          meta={
            <span className="inline-flex items-center gap-1.5">
              <Users aria-hidden="true" className="h-3.5 w-3.5" />
              {meeting.extra_attendees.length + (hasLeadEmail ? 1 : 0)}
            </span>
          }
        />

        {hasLeadEmail ? (
          <Well className="mb-2 flex items-center gap-2 px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-meta text-ink">{leadEmail}</span>
            <span className="shrink-0 text-micro text-ink-subtle">principal</span>
          </Well>
        ) : (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-warning-border bg-warning-soft px-3 py-2">
            <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0 text-warning" />
            <p className="text-meta text-warning">
              Lead sem e-mail — o convite não será enviado automaticamente.
            </p>
          </div>
        )}

        {meeting.extra_attendees.length > 0 ? (
          <ul className="mb-2 space-y-2">
            {meeting.extra_attendees.map((attendeeEmail) => (
              <li key={attendeeEmail}>
                <Well className="flex items-center gap-2 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-meta text-ink">{attendeeEmail}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeAttendee(attendeeEmail)}
                    aria-label={`Remover ${attendeeEmail}`}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </Well>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex gap-2">
          <label htmlFor={`${fieldId}-attendee`} className="sr-only">
            Adicionar participante
          </label>
          <Input
            id={`${fieldId}-attendee`}
            value={newAttendee}
            onChange={(e) => {
              setNewAttendee(e.target.value)
              setAttendeeError('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addAttendee()
              }
            }}
            placeholder="convidado@email.com"
            type="email"
            inputMode="email"
            autoComplete="email"
            className="flex-1"
            aria-invalid={attendeeError ? true : undefined}
            aria-describedby={attendeeError ? `${fieldId}-attendee-error` : undefined}
          />
          <Button variant="secondary" size="icon" onClick={addAttendee} aria-label="Adicionar participante">
            <Plus aria-hidden="true" />
          </Button>
        </div>
        {attendeeError ? (
          <p id={`${fieldId}-attendee-error`} className="mt-1.5 text-meta text-danger">
            {attendeeError}
          </p>
        ) : null}
      </section>

      <Button block onClick={handleSave} loading={saving}>
        <Calendar aria-hidden="true" />
        Salvar reunião
      </Button>
    </div>
  )
}
