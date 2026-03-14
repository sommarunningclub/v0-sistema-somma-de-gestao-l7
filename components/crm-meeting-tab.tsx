'use client'

import { useState } from 'react'
import {
  Calendar,
  Video,
  MapPin,
  Users,
  Link2,
  Check,
  AlertCircle,
  Loader2,
  X,
  Plus,
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

  const toDatetimeLocal = (iso: string | null): string => {
    if (!iso) return ''
    // Format for datetime-local input (YYYY-MM-DDTHH:mm)
    return new Date(iso).toISOString().slice(0, 16)
  }

  const fromDatetimeLocal = (local: string): string | null => {
    if (!local) return null
    return new Date(local).toISOString()
  }

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

      if (data.sync_warning) {
        setSaveError(`Reunião salva. Aviso Google Calendar: ${data.sync_warning}`)
      }

      onSaved?.(saved)
    } catch {
      setSaveError('Erro de conexão ao salvar reunião')
    } finally {
      setSaving(false)
    }
  }

  const needsDetails = meeting.status === 'agendado' || meeting.status === 'reagendado'
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

      {/* Date/Time */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-2">
            Início {needsDetails && <span className="text-red-400">*</span>}
          </label>
          <Input
            type="datetime-local"
            value={toDatetimeLocal(meeting.start_at)}
            onChange={(e) => update('start_at', fromDatetimeLocal(e.target.value))}
            className="bg-neutral-800 border-neutral-700 text-white text-sm h-11 sm:h-10 px-3.5 [color-scheme:dark]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-2">
            Término {needsDetails && <span className="text-red-400">*</span>}
          </label>
          <Input
            type="datetime-local"
            value={toDatetimeLocal(meeting.end_at)}
            onChange={(e) => update('end_at', fromDatetimeLocal(e.target.value))}
            className="bg-neutral-800 border-neutral-700 text-white text-sm h-11 sm:h-10 px-3.5 [color-scheme:dark]"
          />
        </div>
      </div>

      {/* Conditional: address or link */}
      {meeting.type === 'presencial' && (
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-2">
            <MapPin className="w-3 h-3 inline mr-1" />
            Endereço {needsDetails && <span className="text-red-400">*</span>}
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
            Link da reunião {needsDetails && <span className="text-red-400">*</span>}
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

      {/* Google Calendar sync status */}
      {meeting.google_sync_status && (
        <div
          className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
            meeting.google_sync_status === 'synced'
              ? 'bg-green-500/10 text-green-400'
              : meeting.google_sync_status === 'failed'
              ? 'bg-red-500/10 text-red-400'
              : 'bg-neutral-700/50 text-neutral-400'
          }`}
        >
          {meeting.google_sync_status === 'synced' && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
          {meeting.google_sync_status === 'failed' && (
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          )}
          <span>
            Google Calendar:{' '}
            {meeting.google_sync_status === 'synced'
              ? `Sincronizado${meeting.google_synced_at ? ` em ${new Date(meeting.google_synced_at).toLocaleString('pt-BR')}` : ''}`
              : meeting.google_sync_status === 'failed'
              ? 'Falha na sincronização'
              : meeting.google_sync_status === 'cancelled'
              ? 'Evento cancelado'
              : meeting.google_sync_status}
          </span>
        </div>
      )}

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

      {needsDetails && !meeting.google_event_id && hasLeadEmail && (
        <p className="text-xs text-neutral-500 text-center">
          Ao salvar, um convite será enviado via Google Calendar para os participantes.
        </p>
      )}
    </div>
  )
}
