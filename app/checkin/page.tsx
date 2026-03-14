"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Search, RefreshCw, Download, CheckCircle2, XCircle,
  Users, Trash2, AlertTriangle, X, Shield,
  CheckCircle, FilterX, Loader2, SlidersHorizontal,
  Calendar, ChevronDown, Eye,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { MobileBottomSheet } from "@/components/mobile/mobile-bottom-sheet"

interface CheckInData {
  id?: string
  nome?: string
  telefone?: string
  email?: string
  cpf: string
  pelotao?: string
  sexo?: string
  data: string
  event?: string
  event_date?: string
  event_time?: string
  validated?: boolean
  validated_at?: string | null
}

interface EventoOption {
  id: string
  titulo: string
  data_evento: string
  checkin_status: string
  checkin_count: number
}

export default function CheckInPage({ initialEventoId }: { initialEventoId?: string | null }) {
  const [checkInData, setCheckInData] = useState<CheckInData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeFilter, setActiveFilter] = useState<"all" | "validated" | "not_validated">("all")
  const [selectedSexo, setSelectedSexo] = useState<string | null>(null)
  const [selectedPelotao, setSelectedPelotao] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<CheckInData | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Eventos integration
  const [eventos, setEventos] = useState<EventoOption[]>([])
  const [selectedEvento, setSelectedEvento] = useState<string | null>(null)
  const [loadingEventos, setLoadingEventos] = useState(true)
  const [eventoDropdownOpen, setEventoDropdownOpen] = useState(false)

  const selectedEventoData = eventos.find(e => e.id === selectedEvento)

  // Mobile filters
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const uniquePelotoes = Array.from(new Set(checkInData.map(c => c.pelotao).filter(Boolean))) as string[]
  const activeFilterCount = [selectedSexo !== null, selectedPelotao !== null, activeFilter !== 'all'].filter(Boolean).length

  const pelotaoBadge = (pelotao?: string): { bg: string; text: string } => {
    const map: Record<string, { bg: string; text: string }> = {
      '4km':    { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
      '6km':    { bg: 'bg-amber-500/15',   text: 'text-amber-400' },
      '8km':    { bg: 'bg-red-500/15',     text: 'text-red-400' },
      'Alfa':   { bg: 'bg-orange-500/15',  text: 'text-orange-400' },
      'Bravo':  { bg: 'bg-blue-500/15',    text: 'text-blue-400' },
      'Charlie':{ bg: 'bg-purple-500/15',  text: 'text-purple-400' },
      'Delta':  { bg: 'bg-green-500/15',   text: 'text-green-400' },
    }
    return map[pelotao ?? ''] ?? { bg: 'bg-neutral-700/50', text: 'text-neutral-400' }
  }

  const getInitials = (nome?: string) =>
    (nome ?? 'X').split(' ').filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('')

  // Extract time from pre-formatted "DD/MM/YYYY, HH:MM" string
  const extractTime = (data: string): string => {
    if (!data) return '—'
    const parts = data.split(', ')
    return parts[1] || parts[0] || '—'
  }

  // Fetch events
  useEffect(() => {
    async function fetchEventos() {
      try {
        const res = await fetch('/api/insider/eventos', { cache: 'no-store' })
        if (!res.ok) throw new Error('Erro ao buscar eventos')
        const json = await res.json()
        const list: EventoOption[] = (json.data || []).map((e: any) => ({
          id: e.id,
          titulo: e.titulo,
          data_evento: e.data_evento,
          checkin_status: e.checkin_status,
          checkin_count: e.checkin_count || 0,
        }))
        setEventos(list)
        if (initialEventoId && list.some(e => e.id === initialEventoId)) {
          setSelectedEvento(initialEventoId)
        } else {
          const active = list.find(e => e.checkin_status === 'aberto')
            || list.find(e => e.checkin_status === 'bloqueado')
            || list[0]
          if (active) setSelectedEvento(active.id)
        }
      } catch (err) {
        console.error('[v0] Error fetching eventos:', err)
      } finally {
        setLoadingEventos(false)
      }
    }
    fetchEventos()
  }, [])

  const fetchCheckInData = useCallback(async () => {
    if (!selectedEvento) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/checkin?evento_id=${selectedEvento}`, { cache: "no-store" })
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setCheckInData(json.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados")
    } finally {
      setLoading(false)
    }
  }, [selectedEvento])

  useEffect(() => { fetchCheckInData() }, [fetchCheckInData])

  const totalValidated = checkInData.filter(c => c.validated).length
  const totalPending = checkInData.filter(c => !c.validated).length

  const handleToggleValidation = async (item: CheckInData) => {
    if (!item.id) return
    setUpdatingId(item.id)
    try {
      const res = await fetch(`/api/checkin/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ validacao_do_checkin: !item.validated }),
      })
      if (!res.ok) throw new Error("Falha ao atualizar")
      setCheckInData(prev =>
        prev.map(c => c.id === item.id ? { ...c, validated: !item.validated } : c)
      )
    } catch {
      alert("Erro ao atualizar validação")
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete?.id) return
    setDeletingId(confirmDelete.id)
    try {
      const res = await fetch(`/api/checkin/${confirmDelete.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Falha ao deletar")
      setCheckInData(prev => prev.filter(c => c.id !== confirmDelete.id))
      setConfirmDelete(null)
    } catch {
      alert("Erro ao deletar check-in")
    } finally {
      setDeletingId(null)
    }
  }

  const formatCPF = (cpf: string) => {
    const d = (cpf || "").replace(/\D/g, "")
    if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
    return cpf || ""
  }

  const formatEventDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number)
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
  }

  const filtered = checkInData.filter(item => {
    const q = searchTerm.toLowerCase()
    const matchesSearch = !q ||
      (item.nome || "").toLowerCase().includes(q) ||
      (item.cpf || "").includes(q) ||
      (item.telefone || "").includes(q) ||
      (item.pelotao || "").toLowerCase().includes(q) ||
      (item.email || "").toLowerCase().includes(q)
    const matchesFilter =
      activeFilter === "all" ||
      (activeFilter === "validated" && item.validated) ||
      (activeFilter === "not_validated" && !item.validated)
    const matchesSexo = !selectedSexo || item.sexo === selectedSexo
    const matchesPelotao = !selectedPelotao || item.pelotao === selectedPelotao
    return matchesSearch && matchesFilter && matchesSexo && matchesPelotao
  })

  const handleExport = () => {
    const rows = [
      ["Pelotão", "Nome", "Telefone", "Email", "CPF", "Data/Hora", "Evento", "Validado"],
      ...filtered.map(item => [
        item.pelotao || "",
        item.nome || "",
        item.telefone || "",
        item.email || "",
        formatCPF(item.cpf),
        item.data || "",
        item.event || "",
        item.validated ? "Sim" : "Não",
      ]),
    ]
    const csv = "data:text/csv;charset=utf-8," + encodeURIComponent(
      rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n")
    )
    const a = document.createElement("a")
    a.href = csv
    a.download = `checkin_${selectedEventoData?.titulo?.replace(/[^a-zA-Z0-9]/g, '_') || 'export'}_${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.csv`
    a.click()
  }

  const statsBySexo = (sexo: string | undefined) => checkInData.filter(c => c.sexo === sexo).length
  const statsByPelotao = (pelotao: string | undefined) => checkInData.filter(c => c.pelotao === pelotao).length
  const uniqueSexos = Array.from(new Set(checkInData.map(c => c.sexo).filter(Boolean))).sort() as string[]

  const statusLabel = (status: string) => {
    const map: Record<string, { label: string; color: string }> = {
      aberto:    { label: 'Aberto',    color: 'text-green-400' },
      bloqueado: { label: 'Bloqueado', color: 'text-yellow-400' },
      encerrado: { label: 'Encerrado', color: 'text-neutral-500' },
    }
    return map[status] || { label: status, color: 'text-neutral-400' }
  }

  // Shared event selector
  const EventSelector = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="relative">
      <button
        onClick={() => setEventoDropdownOpen(!eventoDropdownOpen)}
        className={`w-full flex items-center justify-between gap-2 rounded-xl border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 transition-colors ${mobile ? 'px-3 py-2.5' : 'px-4 py-3'}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Calendar className="w-4 h-4 flex-shrink-0 text-orange-500" />
          {selectedEventoData ? (
            <div className="text-left min-w-0">
              <p className={`text-white font-medium truncate ${mobile ? 'text-xs' : 'text-sm'}`}>{selectedEventoData.titulo}</p>
              <p className="text-neutral-500 text-xs">
                {formatEventDate(selectedEventoData.data_evento)} · <span className={statusLabel(selectedEventoData.checkin_status).color}>{statusLabel(selectedEventoData.checkin_status).label}</span> · {selectedEventoData.checkin_count} check-ins
              </p>
            </div>
          ) : (
            <span className={`text-neutral-400 ${mobile ? 'text-xs' : 'text-sm'}`}>Selecione um evento</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-neutral-500 flex-shrink-0 transition-transform ${eventoDropdownOpen ? 'rotate-180' : ''}`} />
      </button>
      {eventoDropdownOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setEventoDropdownOpen(false)} />
          <div className="absolute left-0 right-0 z-40 mt-1 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto text-sm">
            {eventos.map(evento => {
              const st = statusLabel(evento.checkin_status)
              const isSel = evento.id === selectedEvento
              return (
                <button
                  key={evento.id}
                  onClick={() => {
                    setSelectedEvento(evento.id)
                    setEventoDropdownOpen(false)
                    setSearchTerm("")
                    setActiveFilter("all")
                    setSelectedSexo(null)
                    setSelectedPelotao(null)
                  }}
                  className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 transition-colors border-l-2 ${isSel ? 'bg-orange-500/10 border-orange-500' : 'hover:bg-neutral-800 border-transparent'}`}
                >
                  <div className="min-w-0">
                    <p className={`font-medium truncate ${isSel ? 'text-orange-400' : 'text-white'}`}>{evento.titulo}</p>
                    <p className="text-neutral-500 text-xs mt-0.5">{formatEventDate(evento.data_evento)} · <span className={st.color}>{st.label}</span></p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-neutral-400 font-mono text-xs">{evento.checkin_count}</p>
                    <p className="text-neutral-600 text-[10px]">check-ins</p>
                  </div>
                </button>
              )
            })}
            {eventos.length === 0 && <div className="px-4 py-6 text-center text-neutral-500 text-sm">Nenhum evento</div>}
          </div>
        </>
      )}
    </div>
  )

  if (loadingEventos) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-orange-500" />
      </div>
    )
  }

  return (
    <div className="bg-neutral-950 text-white" style={{ minHeight: '100dvh' }}>

      {/* ══════════════════════════════════════════
          MOBILE VIEW
      ══════════════════════════════════════════ */}
      <div className="md:hidden flex flex-col" style={{ height: '100dvh' }}>

        {/* ── Sticky header ── */}
        <div className="sticky top-14 z-20 bg-neutral-950 border-b border-neutral-800/60">

          {/* Row 1: Title + actions */}
          <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-bold text-white tracking-wide">Check-in</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={fetchCheckInData}
                disabled={loading}
                className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white transition-colors disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setMobileFiltersOpen(true)}
                className="relative p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white transition-colors"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{activeFilterCount}</span>
                )}
              </button>
              <button
                onClick={handleExport}
                disabled={filtered.length === 0}
                className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white transition-colors disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Row 2: Event selector */}
          <div className="px-4 pb-2">
            <EventSelector mobile />
          </div>

          {/* Row 3: Stats strip */}
          <div className="grid grid-cols-3 divide-x divide-neutral-800 border-t border-neutral-800">
            {[
              { label: 'Total', value: checkInData.length, active: activeFilter === 'all', onClick: () => setActiveFilter('all'), color: 'text-white' },
              { label: 'Validados', value: totalValidated, active: activeFilter === 'validated', onClick: () => setActiveFilter('validated'), color: 'text-emerald-400' },
              { label: 'Pendentes', value: totalPending, active: activeFilter === 'not_validated', onClick: () => setActiveFilter('not_validated'), color: 'text-amber-400' },
            ].map(s => (
              <button
                key={s.label}
                onClick={s.onClick}
                className={`py-2.5 text-center transition-colors ${s.active ? 'bg-neutral-800/70' : 'hover:bg-neutral-900'}`}
              >
                <p className={`text-base font-bold font-mono leading-none ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-neutral-500 mt-0.5 uppercase tracking-wider">{s.label}</p>
              </button>
            ))}
          </div>

          {/* Row 4: Search */}
          <div className="px-4 py-2 border-t border-neutral-800/60">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Nome, CPF, pelotão…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-orange-500/40 transition-colors"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Scrollable list ── */}
        <div className="flex-1 overflow-y-auto">

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-orange-500 mb-3" />
              <p className="text-neutral-500 text-xs">Carregando…</p>
            </div>
          )}

          {/* Empty */}
          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              {activeFilterCount > 0 || searchTerm ? (
                <>
                  <FilterX className="w-8 h-8 text-neutral-700 mb-3" />
                  <p className="text-neutral-400 text-sm font-medium mb-4">Nenhum resultado</p>
                  <button
                    onClick={() => { setSearchTerm(""); setActiveFilter("all"); setSelectedSexo(null); setSelectedPelotao(null) }}
                    className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-300 hover:bg-neutral-700 transition-colors"
                  >
                    Limpar filtros
                  </button>
                </>
              ) : (
                <>
                  <Users className="w-8 h-8 text-neutral-700 mb-3" />
                  <p className="text-neutral-400 text-sm">Nenhum check-in neste evento</p>
                </>
              )}
            </div>
          )}

          {/* Check-in cards */}
          {!loading && filtered.length > 0 && (
            <div className="divide-y divide-neutral-800/60">
              {filtered.map((item, idx) => {
                const isUpdating = updatingId === item.id
                const isExpanded = expandedId === (item.id || String(idx))
                const badge = pelotaoBadge(item.pelotao)
                const time = extractTime(item.data)

                return (
                  <div key={item.id || idx} className={`transition-colors ${isUpdating ? 'opacity-60' : ''}`}>

                    {/* Main row */}
                    <div
                      className="flex items-center gap-3 px-4 py-3.5 active:bg-neutral-900/50"
                      onClick={() => setExpandedId(isExpanded ? null : (item.id || String(idx)))}
                    >
                      {/* Avatar */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${badge.bg} ${badge.text}`}>
                        {getInitials(item.nome)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold leading-tight truncate">{item.nome || '—'}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {item.pelotao && (
                            <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${badge.bg} ${badge.text}`}>
                              {item.pelotao}
                            </span>
                          )}
                          <span className="text-neutral-500 text-[11px]">{time}</span>
                        </div>
                      </div>

                      {/* Validation button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleValidation(item) }}
                        disabled={isUpdating}
                        className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50 ${
                          item.validated
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:border-orange-500/50 hover:text-orange-400'
                        }`}
                      >
                        {isUpdating
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : item.validated
                            ? <><CheckCircle className="w-3.5 h-3.5" /> OK</>
                            : <><CheckCircle className="w-3.5 h-3.5" /> Validar</>
                        }
                      </button>
                    </div>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="px-4 pb-4 bg-neutral-900/40 border-t border-neutral-800/50">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-3 text-xs">
                          <div>
                            <p className="text-neutral-600 uppercase tracking-wider text-[10px] mb-1">CPF</p>
                            <p className="text-neutral-200 font-mono">{formatCPF(item.cpf)}</p>
                          </div>
                          <div>
                            <p className="text-neutral-600 uppercase tracking-wider text-[10px] mb-1">Telefone</p>
                            <p className="text-neutral-200 font-mono">{item.telefone || '—'}</p>
                          </div>
                          <div>
                            <p className="text-neutral-600 uppercase tracking-wider text-[10px] mb-1">Sexo</p>
                            <p className="text-neutral-200 capitalize">{item.sexo || '—'}</p>
                          </div>
                          <div>
                            <p className="text-neutral-600 uppercase tracking-wider text-[10px] mb-1">Check-in</p>
                            <p className="text-neutral-200">{item.data || '—'}</p>
                          </div>
                          {item.email && (
                            <div className="col-span-2">
                              <p className="text-neutral-600 uppercase tracking-wider text-[10px] mb-1">Email</p>
                              <p className="text-neutral-200 truncate">{item.email}</p>
                            </div>
                          )}
                        </div>

                        {/* Action row */}
                        <div className="flex gap-2 mt-4">
                          <button
                            onClick={() => handleToggleValidation(item)}
                            disabled={isUpdating}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 ${
                              item.validated
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            {item.validated ? 'Desfazer validação' : 'Confirmar presença'}
                          </button>
                          <button
                            onClick={() => setConfirmDelete(item)}
                            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 transition-colors hover:bg-red-500/20"
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
          )}

          {/* Bottom padding */}
          <div className="h-8" />
        </div>

        {/* ── Filters bottom sheet ── */}
        <MobileBottomSheet isOpen={mobileFiltersOpen} onClose={() => setMobileFiltersOpen(false)} title="Filtrar" height="auto">
          <div className="space-y-5 pb-2">
            <div>
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2.5">Pelotão</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setSelectedPelotao(null)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedPelotao === null ? 'bg-orange-500 text-white' : 'bg-neutral-800 text-neutral-300 border border-neutral-700'}`}>Todos</button>
                {uniquePelotoes.map(p => (
                  <button key={p} onClick={() => setSelectedPelotao(p)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedPelotao === p ? 'bg-orange-500 text-white' : 'bg-neutral-800 text-neutral-300 border border-neutral-700'}`}>{p}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2.5">Status</p>
              <div className="flex flex-wrap gap-2">
                {([{ key: 'all', label: 'Todos' }, { key: 'validated', label: 'Validados' }, { key: 'not_validated', label: 'Pendentes' }] as const).map(o => (
                  <button key={o.key} onClick={() => setActiveFilter(o.key)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${activeFilter === o.key ? 'bg-orange-500 text-white' : 'bg-neutral-800 text-neutral-300 border border-neutral-700'}`}>{o.label}</button>
                ))}
              </div>
            </div>
            <button onClick={() => setMobileFiltersOpen(false)} className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition-colors">
              Aplicar
            </button>
          </div>
        </MobileBottomSheet>
      </div>

      {/* ══════════════════════════════════════════
          DESKTOP VIEW
      ══════════════════════════════════════════ */}
      <div className="hidden md:block">
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-xl font-bold text-white flex items-center gap-2 tracking-wider">
              <Shield className="w-5 h-5 text-orange-500" />
              CHECK-IN SOMMA
            </h1>
            <div className="flex gap-2">
              <button onClick={fetchCheckInData} disabled={loading} className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-sm text-neutral-300 hover:bg-neutral-800 transition-colors disabled:opacity-50">
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Atualizar</span>
              </button>
              <button onClick={handleExport} disabled={filtered.length === 0} className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-sm text-neutral-300 hover:bg-neutral-800 transition-colors disabled:opacity-50">
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Exportar CSV</span>
              </button>
            </div>
          </div>

          <EventSelector />

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total',      value: checkInData.length, filter: 'all' as const,           color: 'text-white',       activeClasses: 'bg-orange-500/15 border-orange-500/50' },
              { label: 'Validados',  value: totalValidated,     filter: 'validated' as const,     color: 'text-green-400',   activeClasses: 'bg-green-500/15 border-green-500/50' },
              { label: 'Pendentes',  value: totalPending,       filter: 'not_validated' as const, color: 'text-orange-400',  activeClasses: 'bg-red-500/15 border-red-500/50' },
            ].map(s => (
              <div key={s.label} onClick={() => setActiveFilter(s.filter)} className={`cursor-pointer rounded-xl p-4 text-center border transition-colors ${activeFilter === s.filter ? s.activeClasses : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700'}`}>
                <p className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</p>
                <p className="text-xs text-neutral-400 mt-1 uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
            <Input placeholder="Buscar por nome, CPF, pelotão, telefone ou email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 pr-9 bg-neutral-900 border-neutral-700 text-white placeholder-neutral-500 text-sm" />
            {searchTerm && <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"><X className="w-3.5 h-3.5" /></button>}
          </div>

          {(uniqueSexos.length > 0 || uniquePelotoes.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {uniqueSexos.length > 0 && (
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Por Sexo</h3>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setSelectedSexo(null)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedSexo === null ? "bg-orange-500 text-white" : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"}`}>Todos ({checkInData.length})</button>
                    {uniqueSexos.map(sexo => <button key={sexo} onClick={() => setSelectedSexo(sexo)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedSexo === sexo ? "bg-blue-500 text-white" : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"}`}>{sexo} ({statsBySexo(sexo)})</button>)}
                  </div>
                </div>
              )}
              {uniquePelotoes.length > 0 && (
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Por Pelotão</h3>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setSelectedPelotao(null)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedPelotao === null ? "bg-orange-500 text-white" : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"}`}>Todos ({checkInData.length})</button>
                    {uniquePelotoes.map(p => <button key={p} onClick={() => setSelectedPelotao(p)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedPelotao === p ? "bg-purple-500 text-white" : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"}`}>{p} ({statsByPelotao(p)})</button>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {loading && <div className="text-center py-16"><RefreshCw className="w-7 h-7 animate-spin mx-auto mb-3 text-orange-500" /><p className="text-neutral-400 text-sm">Carregando...</p></div>}
          {!loading && error && <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-4 text-red-400 text-sm flex gap-3 items-start"><AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /><div><p className="font-medium">Erro ao carregar dados</p><p className="text-red-500 text-xs mt-0.5">{error}</p></div></div>}
          {!loading && !error && filtered.length === 0 && <div className="text-center py-16"><Users className="w-10 h-10 text-neutral-700 mx-auto mb-3" /><p className="text-neutral-400 text-sm">{searchTerm ? `Nenhum resultado para "${searchTerm}"` : "Nenhum check-in neste evento"}</p></div>}

          {!loading && !error && filtered.length > 0 && (
            <div>
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-800 bg-neutral-800/50">
                        {["Pelotão","Nome","Telefone","CPF","Data/Hora","Validação","Ações"].map((h, i) => (
                          <th key={h} className={`py-3 px-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider ${i === 6 ? 'text-center' : 'text-left'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                      {filtered.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-neutral-800/40 transition-colors">
                          <td className="py-3 px-4">
                            {item.pelotao ? <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 font-mono text-xs font-semibold">{item.pelotao}</Badge> : <span className="text-neutral-600 text-xs">—</span>}
                          </td>
                          <td className="py-3 px-4 font-medium text-white max-w-[180px]">
                            <p className="truncate">{item.nome || "—"}</p>
                            {item.email && <p className="text-xs text-neutral-500 truncate">{item.email}</p>}
                          </td>
                          <td className="py-3 px-4 text-neutral-300 font-mono text-xs">{item.telefone || "—"}</td>
                          <td className="py-3 px-4 text-neutral-300 font-mono text-xs">{formatCPF(item.cpf)}</td>
                          <td className="py-3 px-4 text-neutral-400 text-xs whitespace-nowrap">{item.data || "—"}</td>
                          <td className="py-3 px-4">
                            <button onClick={() => handleToggleValidation(item)} disabled={updatingId === item.id} className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${item.validated ? "bg-green-500/15 text-green-400 hover:bg-green-500/25" : "bg-neutral-800 text-neutral-500 hover:bg-neutral-700 hover:text-white"}`}>
                              {item.validated ? <><CheckCircle2 className="w-3.5 h-3.5" /> Validado</> : <><XCircle className="w-3.5 h-3.5" /> Pendente</>}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button onClick={() => setConfirmDelete(item)} className="p-1.5 rounded-lg text-neutral-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-xs text-neutral-600 mt-2 text-right">{filtered.length} registro(s)</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Delete confirmation modal ── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Deletar check-in?</h3>
                <p className="text-xs text-neutral-400">Ação irreversível.</p>
              </div>
            </div>
            <div className="bg-neutral-800 rounded-xl p-3 mb-5 space-y-1 text-sm">
              <p className="text-white font-medium">{confirmDelete.nome || "—"}</p>
              <p className="text-neutral-400 font-mono text-xs">{formatCPF(confirmDelete.cpf)}</p>
              {confirmDelete.pelotao && <p className="text-orange-400 text-xs">Pelotão: {confirmDelete.pelotao}</p>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} disabled={!!deletingId} className="flex-1 py-2.5 rounded-xl bg-neutral-800 text-neutral-300 hover:bg-neutral-700 text-sm font-medium transition-colors disabled:opacity-50">Cancelar</button>
              <button onClick={handleDelete} disabled={!!deletingId} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {deletingId ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4" /> Deletar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
