"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Calendar, Clock, MapPin, Users, Plus, Edit3, Trash2, Copy,
  Lock, Unlock, CheckCircle2, RefreshCw, AlertTriangle, X,
  ChevronDown, ChevronUp, Search,
} from "lucide-react"
import type { EventoWithStats } from "@/lib/types/evento"

const STATUS_CONFIG = {
  aberto: { label: "Aberto", bg: "bg-green-500/15", text: "text-green-400", border: "border-green-500/30", icon: Unlock },
  bloqueado: { label: "Bloqueado", bg: "bg-yellow-500/15", text: "text-yellow-400", border: "border-yellow-500/30", icon: Lock },
  encerrado: { label: "Encerrado", bg: "bg-neutral-700/40", text: "text-neutral-400", border: "border-neutral-600/30", icon: CheckCircle2 },
} as const

function formatDateBR(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' })
}

function formatDatetimeBR(isoStr: string | null) {
  if (!isoStr) return '—'
  return new Date(isoStr).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function toDatetimeLocal(isoStr: string | null): string {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16)
}

const DEFAULT_FORM = {
  titulo: '',
  descricao: '',
  data_evento: '',
  horario_inicio: '07:00',
  local: 'Parque da Cidade — Brasília, DF',
  checkin_abertura: '',
  checkin_fechamento: '',
  checkin_status: 'bloqueado' as 'aberto' | 'bloqueado' | 'encerrado',
  pelotoes: ['4km', '6km', '8km'],
}

export default function EventosSommaPage({ onViewCheckins }: { onViewCheckins?: (eventoId: string) => void }) {
  const [eventos, setEventos] = useState<EventoWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Delete state
  const [confirmDelete, setConfirmDelete] = useState<EventoWithStats | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Toggle state
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Custom pelotão input
  const [newPelotao, setNewPelotao] = useState("")

  // Mobile expanded
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchEventos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/insider/eventos', { cache: 'no-store' })
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setEventos(json.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar eventos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchEventos() }, [fetchEventos])

  // Stats
  const totalEventos = eventos.length
  const abertos = eventos.filter(e => e.checkin_status === 'aberto').length
  const bloqueados = eventos.filter(e => e.checkin_status === 'bloqueado').length
  const encerrados = eventos.filter(e => e.checkin_status === 'encerrado').length

  // Filter
  const filtered = eventos.filter(e => {
    if (!searchTerm) return true
    const q = searchTerm.toLowerCase()
    return e.titulo.toLowerCase().includes(q) || e.local.toLowerCase().includes(q)
  })

  // Open modal for create
  const handleCreate = () => {
    setEditingId(null)
    setForm(DEFAULT_FORM)
    setSaveError(null)
    setModalOpen(true)
  }

  // Open modal for edit
  const handleEdit = (evento: EventoWithStats) => {
    setEditingId(evento.id)
    setForm({
      titulo: evento.titulo,
      descricao: evento.descricao || '',
      data_evento: evento.data_evento,
      horario_inicio: evento.horario_inicio || '07:00',
      local: evento.local || '',
      checkin_abertura: toDatetimeLocal(evento.checkin_abertura),
      checkin_fechamento: toDatetimeLocal(evento.checkin_fechamento),
      checkin_status: evento.checkin_status,
      pelotoes: evento.pelotoes || ['4km', '6km', '8km'],
    })
    setSaveError(null)
    setModalOpen(true)
  }

  // Duplicate event
  const handleDuplicate = (evento: EventoWithStats) => {
    const nextDate = new Date(evento.data_evento + 'T12:00:00')
    nextDate.setDate(nextDate.getDate() + 7)
    const nextDateStr = nextDate.toISOString().split('T')[0]

    // Increment edition number in title
    let newTitle = evento.titulo
    const edMatch = evento.titulo.match(/(Edição\s*#?)(\d+)/)
    if (edMatch) {
      const num = parseInt(edMatch[2]) + 1
      newTitle = evento.titulo.replace(/(Edição\s*#?)(\d+)/, `$1${String(num).padStart(2, '0')}`)
    }

    setEditingId(null)
    setForm({
      titulo: newTitle,
      descricao: evento.descricao || '',
      data_evento: nextDateStr,
      horario_inicio: evento.horario_inicio || '07:00',
      local: evento.local || '',
      checkin_abertura: '',
      checkin_fechamento: '',
      checkin_status: 'bloqueado',
      pelotoes: evento.pelotoes || ['4km', '6km', '8km'],
    })
    setSaveError(null)
    setModalOpen(true)
  }

  // Save (create or update)
  const handleSave = async () => {
    if (!form.titulo.trim() || !form.data_evento) {
      setSaveError('Título e data são obrigatórios')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const body = {
        titulo: form.titulo,
        descricao: form.descricao || undefined,
        data_evento: form.data_evento,
        horario_inicio: form.horario_inicio || '07:00',
        local: form.local || 'Parque da Cidade — Brasília, DF',
        checkin_abertura: form.checkin_abertura ? new Date(form.checkin_abertura).toISOString() : undefined,
        checkin_fechamento: form.checkin_fechamento ? new Date(form.checkin_fechamento).toISOString() : undefined,
        checkin_status: form.checkin_status,
        pelotoes: form.pelotoes,
      }

      const url = editingId ? `/api/insider/eventos/${editingId}` : '/api/insider/eventos'
      const method = editingId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao salvar')

      setModalOpen(false)
      fetchEventos()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  // Delete
  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/insider/eventos/${confirmDelete.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Falha ao deletar')
      setConfirmDelete(null)
      fetchEventos()
    } catch {
      alert('Erro ao deletar evento')
    } finally {
      setDeleting(false)
    }
  }

  // Quick toggle status
  const handleToggleStatus = async (evento: EventoWithStats) => {
    const newStatus = evento.checkin_status === 'aberto' ? 'bloqueado' : 'aberto'
    if (evento.checkin_status === 'encerrado') {
      if (!window.confirm('Este evento está encerrado. Deseja reabrir o check-in?')) return
    }
    setTogglingId(evento.id)
    try {
      const res = await fetch(`/api/insider/eventos/${evento.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkin_status: newStatus }),
      })
      if (!res.ok) throw new Error('Falha ao atualizar')
      setEventos(prev => prev.map(e => e.id === evento.id ? { ...e, checkin_status: newStatus } : e))
    } catch {
      alert('Erro ao alterar status')
    } finally {
      setTogglingId(null)
    }
  }

  // Pelotão management
  const addPelotao = () => {
    const val = newPelotao.trim()
    if (val && !form.pelotoes.includes(val)) {
      setForm(f => ({ ...f, pelotoes: [...f.pelotoes, val] }))
    }
    setNewPelotao("")
  }
  const removePelotao = (p: string) => {
    setForm(f => ({ ...f, pelotoes: f.pelotoes.filter(x => x !== p) }))
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2 tracking-wider">
              <Calendar className="w-5 h-5 text-orange-500" />
              EVENTOS SOMMA
            </h1>
            <p className="text-xs text-neutral-500 mt-1">Gerencie os eventos do Somma Running Club</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchEventos}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-sm text-neutral-300 hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
            <button
              onClick={handleCreate}
              className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Novo Evento
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold font-mono text-white">{totalEventos}</p>
            <p className="text-xs text-neutral-400 mt-1 uppercase tracking-wider">Total</p>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold font-mono text-green-400">{abertos}</p>
            <p className="text-xs text-neutral-400 mt-1 uppercase tracking-wider">Abertos</p>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold font-mono text-yellow-400">{bloqueados}</p>
            <p className="text-xs text-neutral-400 mt-1 uppercase tracking-wider">Bloqueados</p>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold font-mono text-neutral-500">{encerrados}</p>
            <p className="text-xs text-neutral-400 mt-1 uppercase tracking-wider">Encerrados</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar evento por título ou local..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 bg-neutral-900 border border-neutral-700 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500/50"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-16 text-neutral-400">
            <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-3 text-orange-500" />
            <p className="text-sm">Carregando eventos...</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-4 text-red-400 text-sm flex gap-3 items-start">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Erro ao carregar eventos</p>
              <p className="text-red-500 text-xs mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-16">
            <Calendar className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
            <p className="text-neutral-400 text-sm">
              {searchTerm ? `Nenhum resultado para "${searchTerm}"` : "Nenhum evento cadastrado"}
            </p>
            {!searchTerm && (
              <button onClick={handleCreate} className="mt-4 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg transition-colors">
                Criar primeiro evento
              </button>
            )}
          </div>
        )}

        {/* ── DESKTOP TABLE ── */}
        {!loading && !error && filtered.length > 0 && (
          <>
            <div className="hidden md:block">
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-800 bg-neutral-800/50">
                        <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Evento</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Data</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Status</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Agendamento</th>
                        <th className="text-center py-3 px-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Check-ins</th>
                        <th className="text-center py-3 px-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                      {filtered.map(evento => {
                        const sc = STATUS_CONFIG[evento.checkin_status]
                        const StatusIcon = sc.icon
                        return (
                          <tr key={evento.id} className="hover:bg-neutral-800/40 transition-colors">
                            <td className="py-3 px-4">
                              <p className="font-medium text-white">{evento.titulo}</p>
                              <p className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3" /> {evento.local}
                              </p>
                            </td>
                            <td className="py-3 px-4 text-neutral-300 text-xs whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                                {formatDateBR(evento.data_evento)}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1 text-neutral-500">
                                <Clock className="w-3.5 h-3.5" />
                                {evento.horario_inicio || '07:00'}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <button
                                onClick={() => handleToggleStatus(evento)}
                                disabled={togglingId === evento.id}
                                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50 border ${sc.bg} ${sc.text} ${sc.border} hover:opacity-80`}
                              >
                                {togglingId === evento.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <StatusIcon className="w-3.5 h-3.5" />
                                )}
                                {sc.label}
                              </button>
                            </td>
                            <td className="py-3 px-4 text-xs text-neutral-400">
                              <div>Abre: {formatDatetimeBR(evento.checkin_abertura)}</div>
                              <div>Fecha: {formatDatetimeBR(evento.checkin_fechamento)}</div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => onViewCheckins?.(evento.id)}
                                className="inline-flex items-center gap-1 text-sm font-mono font-bold text-orange-400 hover:text-orange-300 hover:underline transition-colors cursor-pointer"
                                title="Ver check-ins deste evento"
                              >
                                <Users className="w-3.5 h-3.5" />
                                {evento.checkin_count}
                              </button>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleEdit(evento)}
                                  className="p-1.5 rounded-lg text-neutral-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                                  title="Editar"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDuplicate(evento)}
                                  className="p-1.5 rounded-lg text-neutral-500 hover:text-purple-400 hover:bg-purple-500/10 transition-colors"
                                  title="Duplicar (+7 dias)"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setConfirmDelete(evento)}
                                  className="p-1.5 rounded-lg text-neutral-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                  title="Deletar"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-xs text-neutral-600 mt-2 text-right">{filtered.length} evento(s)</p>
            </div>

            {/* ── MOBILE LIST ── */}
            <div className="md:hidden space-y-3">
              {filtered.map(evento => {
                const sc = STATUS_CONFIG[evento.checkin_status]
                const StatusIcon = sc.icon
                const isExpanded = expandedId === evento.id
                return (
                  <div key={evento.id} className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : evento.id)}
                      className="w-full text-left p-4 flex items-start justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white text-sm truncate">{evento.titulo}</p>
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-neutral-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(evento.data_evento + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {evento.horario_inicio || '07:00'}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); onViewCheckins?.(evento.id) }}
                            className="flex items-center gap-1 text-orange-400 font-mono font-bold hover:text-orange-300 hover:underline transition-colors"
                          >
                            <Users className="w-3 h-3" />
                            {evento.checkin_count}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md ${sc.bg} ${sc.text}`}>
                          <StatusIcon className="w-3 h-3" />
                          {sc.label}
                        </span>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-neutral-500" /> : <ChevronDown className="w-4 h-4 text-neutral-500" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-0 space-y-3 border-t border-neutral-800">
                        <div className="grid grid-cols-2 gap-2 text-xs pt-3">
                          <div>
                            <p className="text-neutral-500 mb-0.5">Local</p>
                            <p className="text-neutral-300">{evento.local}</p>
                          </div>
                          <div>
                            <p className="text-neutral-500 mb-0.5">Pelotões</p>
                            <p className="text-neutral-300">{(evento.pelotoes || []).join(', ')}</p>
                          </div>
                          <div>
                            <p className="text-neutral-500 mb-0.5">Abre check-in</p>
                            <p className="text-neutral-300">{formatDatetimeBR(evento.checkin_abertura)}</p>
                          </div>
                          <div>
                            <p className="text-neutral-500 mb-0.5">Fecha check-in</p>
                            <p className="text-neutral-300">{formatDatetimeBR(evento.checkin_fechamento)}</p>
                          </div>
                        </div>
                        {evento.descricao && (
                          <p className="text-xs text-neutral-400 italic">{evento.descricao}</p>
                        )}
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => handleToggleStatus(evento)}
                            disabled={togglingId === evento.id}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
                              evento.checkin_status === 'aberto'
                                ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                                : 'bg-green-500/15 text-green-400 border-green-500/30'
                            }`}
                          >
                            {evento.checkin_status === 'aberto' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                            {evento.checkin_status === 'aberto' ? 'Bloquear' : 'Abrir'}
                          </button>
                          <button
                            onClick={() => handleEdit(evento)}
                            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDuplicate(evento)}
                            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-purple-500/15 text-purple-400 border border-purple-500/30 transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(evento)}
                            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/30 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ── CREATE/EDIT MODAL ── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal header */}
            <div className="sticky top-0 bg-neutral-900 border-b border-neutral-800 px-5 py-4 flex items-center justify-between z-10">
              <h2 className="text-white font-bold text-base">
                {editingId ? 'Editar Evento' : 'Novo Evento'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="p-2 text-neutral-500 hover:text-white transition-colors rounded-lg hover:bg-neutral-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <div className="p-5 space-y-4">
              {/* Título */}
              <div>
                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5 block">Título *</label>
                <input
                  type="text"
                  value={form.titulo}
                  onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                  placeholder="Ex: Somma Club — Edição #04 de Março"
                  className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500/50"
                />
              </div>

              {/* Data + Horário */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5 block">Data *</label>
                  <input
                    type="date"
                    value={form.data_evento}
                    onChange={e => setForm(f => ({ ...f, data_evento: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:border-orange-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5 block">Horário</label>
                  <input
                    type="time"
                    value={form.horario_inicio}
                    onChange={e => setForm(f => ({ ...f, horario_inicio: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:border-orange-500/50"
                  />
                </div>
              </div>

              {/* Local */}
              <div>
                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5 block">Local</label>
                <input
                  type="text"
                  value={form.local}
                  onChange={e => setForm(f => ({ ...f, local: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500/50"
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5 block">Descrição</label>
                <textarea
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  rows={2}
                  placeholder="Descrição opcional do evento..."
                  className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500/50 resize-none"
                />
              </div>

              {/* Pelotões */}
              <div>
                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5 block">Pelotões</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {form.pelotoes.map(p => (
                    <span key={p} className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-500/15 text-orange-400 border border-orange-500/30 rounded-full text-xs font-medium">
                      {p}
                      <button onClick={() => removePelotao(p)} className="hover:text-white transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPelotao}
                    onChange={e => setNewPelotao(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPelotao() }}}
                    placeholder="Adicionar pelotão..."
                    className="flex-1 px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500/50"
                  />
                  <button onClick={addPelotao} className="px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-300 hover:bg-neutral-700 transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-neutral-800 pt-4">
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Agendamento de Check-in</p>
              </div>

              {/* Abertura + Fechamento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-500 mb-1.5 block">Abertura automática</label>
                  <input
                    type="datetime-local"
                    value={form.checkin_abertura}
                    onChange={e => setForm(f => ({ ...f, checkin_abertura: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:border-orange-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-500 mb-1.5 block">Fechamento automático</label>
                  <input
                    type="datetime-local"
                    value={form.checkin_fechamento}
                    onChange={e => setForm(f => ({ ...f, checkin_fechamento: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:border-orange-500/50"
                  />
                </div>
              </div>

              {/* Status manual */}
              <div>
                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5 block">Status manual</label>
                <div className="flex gap-2">
                  {(['bloqueado', 'aberto', 'encerrado'] as const).map(status => {
                    const s = STATUS_CONFIG[status]
                    const Icon = s.icon
                    return (
                      <button
                        key={status}
                        onClick={() => setForm(f => ({ ...f, checkin_status: status }))}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-colors ${
                          form.checkin_status === status
                            ? `${s.bg} ${s.text} ${s.border}`
                            : 'bg-neutral-800 text-neutral-500 border-neutral-700 hover:border-neutral-600'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {s.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Save error */}
              {saveError && (
                <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-3 text-red-400 text-xs flex gap-2 items-center">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  {saveError}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-neutral-800 text-neutral-300 hover:bg-neutral-700 text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>{editingId ? 'Salvar' : 'Criar Evento'}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Deletar evento?</h3>
                <p className="text-xs text-neutral-400">Esta ação não pode ser desfeita.</p>
              </div>
            </div>

            <div className="bg-neutral-800 rounded-xl p-3 mb-5 space-y-1.5 text-sm">
              <p className="text-white font-medium">{confirmDelete.titulo}</p>
              <p className="text-neutral-400 text-xs">{formatDateBR(confirmDelete.data_evento)}</p>
              {confirmDelete.checkin_count > 0 && (
                <p className="text-orange-400 text-xs font-medium">{confirmDelete.checkin_count} check-in(s) vinculados</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-neutral-800 text-neutral-300 hover:bg-neutral-700 text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <><Trash2 className="w-4 h-4" /> Deletar</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
