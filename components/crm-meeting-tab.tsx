'use client'

import { useState } from 'react'
import {
  Calendar,
  Clock,
  Video,
  MapPin,
  Users,
  Link2,
  Check,
  AlertCircle,
  Loader2,
  X,
  Plus,
  ArrowRight,
  Sun,
  Sunset,
  Moon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { MeetingData, MeetingStatus, MeetingType } from '@/lib/services/crm'

interface CRMMeetingTabProps {
  leadId: string
  leadEmail: string
  initialMeeting: MeetingData | null | undefined
  onSaved?: (meeting: MeetingData) => void
}

const STATUS_OPTIONS: { value: MeetingStatus; label: string; color: string }[] = [
  { value: 'pendente', label: 'Pendente', color: 'bg-neutral-600' },
  { value: 'agendado', label: 'Agendado', color: 'bg-cyan-600' },
  { value: 'reagendado', label: 'Reagendado', color: 'bg-yellow-600' },
  { value: 'cancelado', label: 'Cancelado', color: 'bg-red-600' },
  { value: 'realizado', label: 'Realizado', color: 'bg-green-600' },
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
  { label: 'Manhã', Icon: Sun, time: '09:00', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  { label: 'Tarde', Icon: Sunset, time: '14:00', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  { label: 'Noite', Icon: Moon, time: '19:00', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
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

export function CRMMeetingTab({
  leadId,
  leadEmail,
  initialMeeting,
  onSaved,
}: CRMMeetingTabProps) {
  const [meeting, setMeeting] = useState<MeetingData>(initialMeeting || DEFAULT_MEETING)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [newAttendee, setNewAttendee] = useState('')
  const [attendeeError, setAttendeeError] = useState('')

  const update = <K extends keyof MeetingData>(key: K, value: MeetingData[K]) => {
    setMeeting((prev) => ({ ...prev, [key]: value }))
    setSaveSuccess(false)
    setSaveError(null)
  }

  const addAttendee = () => {
    const email = newAttendee.trim().toLowerCase()
    if (!email) return
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
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
    setSaveSuccess(false)
    setSaveError(null)
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
    setSaveSuccess(false)
    setSaveError(null)
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
    setSaveError(null)
    setSaveSuccess(false)

    try {
      const res = await fetch(`/api/crm/${leadId}/meeting`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(meeting),
      })

      const data = await res.json()

      if (!res.ok) {
        setSaveError(data.error || 'Erro ao salvar reunião')
        return
      }

      const saved = data.meeting as MeetingData
      setMeeting(saved)
      setSaveSuccess(true)

      onSaved?.(saved)
    } catch {
      setSaveError('Erro de conexão ao salvar reunião')
    } finally {
      setSaving(false)
    }
  }

  const hasLeadEmail = leadEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadEmail)

  return (
    <div className="space-y-4">
      {/* Status */}
      <div>
        <label className="block text-xs font-medium text-neutral-400 mb-2">Status</label>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => update('status', opt.value)}
              className={`text-xs px-3 py-2 rounded-lg font-medium border-2 transition-all min-h-[36px] ${
                meeting.status === opt.value
                  ? `${opt.color} text-white border-transparent`
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:border-neutral-500'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Type */}
      <div>
        <label className="block text-xs font-medium text-neutral-400 mb-2">Tipo</label>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { value: 'online' as MeetingType, label: 'Online', Icon: Video },
              { value: 'presencial' as MeetingType, label: 'Presencial', Icon: MapPin },
            ] as { value: MeetingType; label: string; Icon: React.ElementType }[]
          ).map(({ value, label, Icon }) => (
            <button
              key={value}
              onClick={() => update('type', value)}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 transition-all min-h-[44px] text-sm font-medium ${
                meeting.type === value
                  ? 'bg-cyan-600 text-white border-transparent'
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:border-neutral-500'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Date & Time - Redesigned */}
      <div className="bg-neutral-800/50 border border-neutral-700/50 rounded-xl p-3.5 space-y-3">
        {/* Period presets */}
        <div className="flex gap-2">
          {PERIOD_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => applyPreset(preset.time)}
              className={`flex-1 flex items-center justify-center gap-1.5 text-xs px-2 py-2 rounded-lg border font-medium transition-all ${
                currentStartTime === preset.time
                  ? preset.color + ' border-current'
                  : 'bg-neutral-900 border-neutral-700 text-neutral-500 hover:text-neutral-300 hover:border-neutral-600'
              }`}
            >
              <preset.Icon className="w-3.5 h-3.5" />
              {preset.label}
            </button>
          ))}
        </div>

        {/* Date */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-400 mb-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Data
          </label>
          <Input
            type="date"
            value={currentDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="bg-neutral-900 border-neutral-700 text-white text-sm h-11 sm:h-10 px-3.5 [color-scheme:dark] w-full"
          />
        </div>

        {/* Time selects */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-400 mb-1.5">
            <Clock className="w-3.5 h-3.5" />
            Horário
          </label>
          <div className="flex items-center gap-2">
            <select
              value={currentStartTime}
              onChange={(e) => handleStartTimeChange(e.target.value)}
              className="flex-1 bg-neutral-900 border border-neutral-700 text-white text-sm h-11 sm:h-10 px-3 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-colors"
            >
              <option value="" className="text-neutral-500">Início</option>
              {TIME_SLOTS.map((t) => (
                <option key={`s-${t}`} value={t}>{t}</option>
              ))}
            </select>
            <ArrowRight className="w-4 h-4 text-neutral-600 flex-shrink-0" />
            <select
              value={currentEndTime}
              onChange={(e) => handleEndTimeChange(e.target.value)}
              className="flex-1 bg-neutral-900 border border-neutral-700 text-white text-sm h-11 sm:h-10 px-3 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-colors"
            >
              <option value="" className="text-neutral-500">Término</option>
              {TIME_SLOTS.map((t) => (
                <option key={`e-${t}`} value={t}>{t}</option>
              ))}
            </select>
            {durationLabel && (
              <span className="text-xs text-cyan-400 font-medium bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-2.5 py-1.5 flex-shrink-0 whitespace-nowrap">
                {durationLabel}
              </span>
            )}
          </div>
        </div>

        {/* Quick duration chips */}
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: '30min', mins: 30 },
            { label: '1h', mins: 60 },
            { label: '1h30', mins: 90 },
            { label: '2h', mins: 120 },
          ].map((d) => (
            <button
              key={d.mins}
              onClick={() => applyDuration(d.mins)}
              className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all border ${
                activeDuration === d.mins
                  ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400'
                  : 'border-neutral-700 bg-neutral-900 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conditional: address or link */}
      {meeting.type === 'presencial' && (
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-2">
            <MapPin className="w-3 h-3 inline mr-1" />
            Endereço
          </label>
          <Input
            value={meeting.address || ''}
            onChange={(e) => update('address', e.target.value || null)}
            placeholder="Rua, número, bairro, cidade"
            className="bg-neutral-800 border-neutral-700 text-white text-sm h-11 sm:h-10 px-3.5"
          />
        </div>
      )}

      {meeting.type === 'online' && (
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-2">
            <Link2 className="w-3 h-3 inline mr-1" />
            Link da reunião
          </label>
          <Input
            value={meeting.meeting_url || ''}
            onChange={(e) => update('meeting_url', e.target.value || null)}
            placeholder="https://meet.google.com/..."
            className="bg-neutral-800 border-neutral-700 text-white text-sm h-11 sm:h-10 px-3.5"
          />
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-neutral-400 mb-2">Observações</label>
        <textarea
          value={meeting.notes || ''}
          onChange={(e) => update('notes', e.target.value)}
          placeholder="Pauta, objetivos, pontos a discutir..."
          rows={3}
          className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3.5 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-colors"
        />
      </div>

      {/* Attendees */}
      <div>
        <label className="block text-xs font-medium text-neutral-400 mb-2">
          <Users className="w-3 h-3 inline mr-1" />
          Participantes
        </label>

        {/* Lead primary email (read-only) */}
        {hasLeadEmail ? (
          <div className="flex items-center gap-2 bg-neutral-800/50 border border-neutral-700/50 rounded-lg px-3 py-2 mb-2">
            <span className="text-xs text-neutral-400 flex-1 truncate">{leadEmail}</span>
            <span className="text-xs text-neutral-600 flex-shrink-0">principal</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 mb-2">
            <AlertCircle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
            <span className="text-xs text-yellow-400">Lead sem e-mail — convite não será enviado automaticamente</span>
          </div>
        )}

        {/* Extra attendees */}
        {meeting.extra_attendees.map((email) => (
          <div
            key={email}
            className="flex items-center gap-2 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 mb-2"
          >
            <span className="text-xs text-neutral-300 flex-1 truncate">{email}</span>
            <button
              onClick={() => removeAttendee(email)}
              className="text-neutral-500 hover:text-red-400 transition-colors flex-shrink-0 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {/* Add attendee */}
        <div className="flex gap-2">
          <Input
            value={newAttendee}
            onChange={(e) => {
              setNewAttendee(e.target.value)
              setAttendeeError('')
            }}
            onKeyDown={(e) => e.key === 'Enter' && addAttendee()}
            placeholder="convidado@email.com"
            className="bg-neutral-800 border-neutral-700 text-white text-sm flex-1 h-10 px-3.5"
          />
          <Button
            onClick={addAttendee}
            size="sm"
            className="bg-neutral-700 hover:bg-neutral-600 text-white min-h-[40px] flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {attendeeError && <p className="text-xs text-red-400 mt-1">{attendeeError}</p>}
      </div>


      {/* Feedback */}
      {saveError && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">{saveError}</p>
        </div>
      )}

      {saveSuccess && !saveError && (
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2.5">
          <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
          <p className="text-xs text-green-300">Reunião salva com sucesso</p>
        </div>
      )}

      {/* Save button */}
      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-cyan-600 hover:bg-cyan-700 text-white min-h-[44px] font-medium"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Salvando...
          </>
        ) : (
          <>
            <Calendar className="w-4 h-4 mr-2" />
            Salvar Reunião
          </>
        )}
      </Button>

    </div>
  )
}
