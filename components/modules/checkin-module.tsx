"use client"

import { useState, useEffect, useCallback, useRef, useId } from "react"
import { apiFetch } from '@/lib/api-client'
import {
  RefreshCw, Download, CheckCircle2, XCircle,
  Users, Trash2, Shield, Percent,
  Calendar, ChevronDown, Pencil, CalendarX2,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  CardListSkeleton,
  EmptyState,
  FilterChip,
  MobileActionBar,
  NoResultsState,
  PageHeader,
  PageShell,
  ResponsiveModal,
  SearchInput,
  SegmentedControl,
  StatGrid,
  StatGridSkeleton,
  StatTile,
  StatusPill,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableFrame,
  TableSkeleton,
  Toolbar,
  FilterButton,
  confirmAction,
  notify,
  type StatusTone,
} from "@/components/somma"
import { useIsMobile } from "@/components/ui/use-mobile"
import { matchesTextSearch } from "@/lib/search-utils"
import { ErrorBanner } from '@/components/ui/error-banner'

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
  tipo?: string
}

interface EventoApiItem {
  id: string
  titulo: string
  data_evento: string
  checkin_status: string
  checkin_count?: number
}

const PELOTAO_OPTIONS = ['4km', '6km', '8km', 'Alfa', 'Bravo', 'Charlie', 'Delta'] as const

const PELOTAO_TONE: Record<string, StatusTone> = {
  '4km': 'success',
  '6km': 'warning',
  '8km': 'danger',
  Alfa: 'brand',
  Bravo: 'info',
  Charlie: 'info',
  Delta: 'success',
}

const CHECKIN_STATUS_TONE: Record<string, StatusTone> = {
  aberto: 'success',
  bloqueado: 'warning',
  encerrado: 'neutral',
}

const CHECKIN_STATUS_LABEL: Record<string, string> = {
  aberto: 'Aberto',
  bloqueado: 'Bloqueado',
  encerrado: 'Encerrado',
}

/**
 * Módulo montado pelo shell do painel a partir de `app/page.tsx`.
 * Vive fora de `app/` porque recebe props — arquivos `page.tsx` do App
 * Router só podem exportar o default e um conjunto fixo de metadados.
 */
export function CheckInModule({ initialEventoId }: { initialEventoId?: string | null }) {
  const [checkInData, setCheckInData] = useState<CheckInData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeFilter, setActiveFilter] = useState<"all" | "validated" | "not_validated">("all")
  const [selectedSexo, setSelectedSexo] = useState<string | null>(null)
  const [selectedPelotao, setSelectedPelotao] = useState<string | null>(null)
  const [selectedDia, setSelectedDia] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<CheckInData | null>(null)
  const [editForm, setEditForm] = useState<Partial<CheckInData>>({})
  const [savingEdit, setSavingEdit] = useState(false)
  /** Último resultado de validação — anunciado por leitor de tela. */
  const [liveMessage, setLiveMessage] = useState("")

  // Eventos integration
  const [eventos, setEventos] = useState<EventoOption[]>([])
  const [selectedEvento, setSelectedEvento] = useState<string | null>(null)
  const [loadingEventos, setLoadingEventos] = useState(true)
  const [eventoDropdownOpen, setEventoDropdownOpen] = useState(false)

  const selectedEventoData = eventos.find(e => e.id === selectedEvento)

  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc') // desc = mais recente, asc = primeiro inscrito

  const isMobile = useIsMobile()
  const searchRef = useRef<HTMLInputElement>(null)
  const eventMenuId = useId()
  const editIds = {
    nome: useId(),
    telefone: useId(),
    cpf: useId(),
    email: useId(),
    pelotao: useId(),
    sexo: useId(),
  }
  const filterIds = {
    sexo: useId(),
    pelotao: useId(),
    dia: useId(),
  }

  const uniquePelotoes = Array.from(new Set(checkInData.map(c => c.pelotao).filter(Boolean))) as string[]

  // Extract day (DD/MM/YYYY) from the "DD/MM/YYYY, HH:MM" format
  const extractDay = (data: string): string => data ? data.split(',')[0].trim() : ''
  const uniqueDias = Array.from(new Set(checkInData.map(c => extractDay(c.data)).filter(Boolean))).sort((a, b) => {
    // Sort chronologically: parse DD/MM/YYYY
    const [da, ma, ya] = a.split('/').map(Number)
    const [db, mb, yb] = b.split('/').map(Number)
    return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime()
  })
  const statsByDia = (dia: string) => checkInData.filter(c => extractDay(c.data) === dia).length

  const activeFilterCount = [selectedSexo !== null, selectedPelotao !== null, selectedDia !== null, activeFilter !== 'all'].filter(Boolean).length

  const pelotaoTone = (pelotao?: string): StatusTone => PELOTAO_TONE[pelotao ?? ''] ?? 'neutral'

  const getInitials = (nome?: string) =>
    (nome ?? 'X').split(' ').filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('')

  // Extract time from pre-formatted "DD/MM/YYYY, HH:MM" string
  const extractTime = (data: string): string => {
    if (!data) return '—'
    const parts = data.split(', ')
    return parts[1] || parts[0] || '—'
  }

  const clearAllFilters = useCallback(() => {
    setSearchTerm("")
    setActiveFilter("all")
    setSelectedSexo(null)
    setSelectedPelotao(null)
    setSelectedDia(null)
  }, [])

  // Reset scroll position on mount
  useEffect(() => {
    const container = document.getElementById('main-content-scroll')
    if (container) container.scrollTop = 0
  }, [])

  // Fetch events
  useEffect(() => {
    async function fetchEventos() {
      try {
        const res = await apiFetch('/api/insider/eventos', { cache: 'no-store' })
        if (!res.ok) throw new Error('Erro ao buscar eventos')
        const json = await res.json()
        const list: EventoOption[] = ((json.data || []) as EventoApiItem[]).map(e => ({
          id: e.id,
          titulo: e.titulo,
          data_evento: e.data_evento,
          checkin_status: e.checkin_status,
          checkin_count: e.checkin_count || 0,
        }))
        setEventos(list)
        // Escolha padrão: o evento com check-in aberto, senão o bloqueado mais
        // próximo. Um `initialEventoId` vindo do módulo Eventos sobrescreve
        // isto no efeito seguinte.
        const active = list.find(e => e.checkin_status === 'aberto')
          || list.find(e => e.checkin_status === 'bloqueado')
          || list[0]
        if (active) setSelectedEvento(active.id)
      } catch (err) {
        console.error('[v0] Error fetching eventos:', err)
      } finally {
        setLoadingEventos(false)
      }
    }
    fetchEventos()
  }, [])

  /**
   * Sincroniza o evento vindo de fora (o botão "ver check-ins" do módulo
   * Eventos). Fica num efeito próprio para reagir a mudanças de
   * `initialEventoId` sem disparar um novo fetch da lista de eventos.
   */
  useEffect(() => {
    if (initialEventoId && eventos.some(e => e.id === initialEventoId)) {
      setSelectedEvento(initialEventoId)
    }
  }, [initialEventoId, eventos])

  const fetchCheckInData = useCallback(async () => {
    if (!selectedEvento) return
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/checkin?evento_id=${selectedEvento}`, { cache: "no-store" })
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

  // Foco automático na busca só no desktop — no celular abriria o teclado sozinho.
  useEffect(() => {
    if (!isMobile && !loading && !loadingEventos && selectedEvento) {
      searchRef.current?.focus()
    }
  }, [isMobile, loading, loadingEventos, selectedEvento])

  // Fecha o seletor de evento com ESC.
  useEffect(() => {
    if (!eventoDropdownOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEventoDropdownOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [eventoDropdownOpen])

  const totalValidated = checkInData.filter(c => c.validated).length
  const totalPending = checkInData.filter(c => !c.validated).length
  const presencaPct = checkInData.length > 0
    ? Math.round((totalValidated / checkInData.length) * 100)
    : 0

  const handleToggleValidation = async (item: CheckInData) => {
    if (!item.id) return
    if (updatingId) return
    const nextValidated = !item.validated
    setUpdatingId(item.id)
    try {
      const res = await apiFetch(`/api/checkin/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ validacao_do_checkin: nextValidated }),
      })
      if (!res.ok) throw new Error("Falha ao atualizar")
      setCheckInData(prev =>
        prev.map(c => c.id === item.id ? { ...c, validated: nextValidated } : c)
      )
      const nome = item.nome || 'Participante'
      const message = nextValidated
        ? `${nome} — presença confirmada`
        : `${nome} — presença desfeita`
      setLiveMessage(message)
      if (nextValidated) notify.success(message)
      else notify.info(message)
    } catch {
      setLiveMessage(`Erro ao atualizar ${item.nome || 'participante'}`)
      notify.error("Erro ao atualizar validação", {
        description: "Tente novamente em instantes.",
      })
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDelete = async (item: CheckInData) => {
    if (!item.id) return
    const confirmed = await confirmAction({
      title: 'Deletar check-in?',
      description: 'Esta ação é irreversível e remove o registro do participante deste evento.',
      detail: `${item.nome || '—'} · ${formatCPF(item.cpf)}${item.pelotao ? ` · Pelotão ${item.pelotao}` : ''}`,
      tone: 'danger',
      confirmLabel: 'Deletar',
    })
    if (!confirmed) return

    setDeletingId(item.id)
    try {
      const res = await apiFetch(`/api/checkin/${item.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Falha ao deletar")
      setCheckInData(prev => prev.filter(c => c.id !== item.id))
      notify.success('Check-in deletado')
    } catch {
      notify.error("Erro ao deletar check-in")
    } finally {
      setDeletingId(null)
    }
  }

  const openEdit = (item: CheckInData) => {
    setEditingItem(item)
    setEditForm({
      nome: item.nome || '',
      telefone: item.telefone || '',
      email: item.email || '',
      cpf: item.cpf || '',
      pelotao: item.pelotao || '',
      sexo: item.sexo || '',
    })
  }

  const handleSaveEdit = async () => {
    if (!editingItem?.id) return
    setSavingEdit(true)
    try {
      const res = await apiFetch(`/api/checkin/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome_completo: editForm.nome,
          telefone: editForm.telefone,
          email: editForm.email,
          cpf: editForm.cpf,
          pelotao: editForm.pelotao,
          sexo: editForm.sexo,
        }),
      })
      if (!res.ok) throw new Error('Falha ao salvar')
      setCheckInData(prev =>
        prev.map(c => c.id === editingItem.id ? { ...c, ...editForm } : c)
      )
      setEditingItem(null)
      notify.success('Alterações salvas')
    } catch {
      notify.error('Erro ao salvar alterações')
    } finally {
      setSavingEdit(false)
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
    const matchesSearch = matchesTextSearch(searchTerm, [
      item.nome,
      item.cpf,
      item.telefone,
      item.pelotao,
      item.email,
    ])
    const matchesFilter =
      activeFilter === "all" ||
      (activeFilter === "validated" && item.validated) ||
      (activeFilter === "not_validated" && !item.validated)
    const matchesSexo = !selectedSexo || item.sexo === selectedSexo
    const matchesPelotao = !selectedPelotao || item.pelotao === selectedPelotao
    const matchesDia = !selectedDia || extractDay(item.data) === selectedDia
    return matchesSearch && matchesFilter && matchesSexo && matchesPelotao && matchesDia
  })

  // Sort: asc = primeiro inscrito (mais antigo), desc = mais recente
  const sorted = sortOrder === 'asc' ? [...filtered].reverse() : filtered

  // Inscription number map: based on original chronological order (oldest = #1)
  // checkInData comes from API sorted by data_hora_checkin DESC, so last = oldest = #1
  const inscriptionMap = new Map<string, number>()
  checkInData.forEach((item, i) => {
    if (item.id) inscriptionMap.set(item.id, checkInData.length - i)
  })

  const handleExport = () => {
    // Build filter label for filename
    const filterParts: string[] = []
    if (selectedDia) filterParts.push(selectedDia.replace(/\//g, '-'))
    if (selectedPelotao) filterParts.push(selectedPelotao)
    if (selectedSexo) filterParts.push(selectedSexo)
    if (activeFilter === 'validated') filterParts.push('validados')
    if (activeFilter === 'not_validated') filterParts.push('pendentes')
    const filterSuffix = filterParts.length > 0 ? `_${filterParts.join('_')}` : ''

    const rows = [
      ["#", "Pelotão", "Nome", "Sexo", "Telefone", "Email", "CPF", "Data/Hora", "Evento", "Validado"],
      ...sorted.map((item) => [
        String(item.id ? inscriptionMap.get(item.id) || '' : ''),
        item.pelotao || "",
        item.nome || "",
        item.sexo || "",
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
    a.download = `checkin_${selectedEventoData?.titulo?.replace(/[^a-zA-Z0-9]/g, '_') || 'export'}${filterSuffix}_${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.csv`
    a.click()
    notify.success(`${sorted.length} registro(s) exportado(s)`)
  }

  const statsBySexo = (sexo: string | undefined) => checkInData.filter(c => c.sexo === sexo).length
  const statsByPelotao = (pelotao: string | undefined) => checkInData.filter(c => c.pelotao === pelotao).length
  const uniqueSexos = Array.from(new Set(checkInData.map(c => c.sexo).filter(Boolean))).sort() as string[]

  const statusTone = (status: string): StatusTone => CHECKIN_STATUS_TONE[status] ?? 'neutral'
  const statusText = (status: string): string => CHECKIN_STATUS_LABEL[status] ?? status

  const selectClass =
    'ds-tap w-full appearance-none rounded-lg border border-line bg-surface-sunken px-3 pr-9 text-sm text-ink transition-colors hover:border-line-strong focus-visible:border-brand focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand lg:min-h-0 lg:h-10'

  const selectEvento = (id: string) => {
    setSelectedEvento(id)
    setEventoDropdownOpen(false)
    setExpandedId(null)
    clearAllFilters()
  }

  /* ───────────────────────── Seletor de evento ───────────────────────── */
  const eventSelector = (
    <div className="relative">
      <span id={`${eventMenuId}-label`} className="ds-eyebrow mb-1.5 block">
        Evento
      </span>
      <button
        type="button"
        onClick={() => setEventoDropdownOpen(open => !open)}
        aria-haspopup="listbox"
        aria-expanded={eventoDropdownOpen}
        aria-controls={eventMenuId}
        aria-labelledby={`${eventMenuId}-label`}
        className="ds-tap flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface-raised px-4 py-2.5 text-left transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <Calendar aria-hidden="true" className="h-4 w-4 shrink-0 text-brand" />
          {selectedEventoData ? (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink-strong">
                {selectedEventoData.titulo}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-ink-muted">
                <span>{formatEventDate(selectedEventoData.data_evento)}</span>
                <StatusPill tone={statusTone(selectedEventoData.checkin_status)}>
                  {statusText(selectedEventoData.checkin_status)}
                </StatusPill>
                <span className="font-mono tabular-nums">{selectedEventoData.checkin_count} check-ins</span>
              </span>
            </span>
          ) : (
            <span className="text-sm text-ink-muted">Selecione um evento</span>
          )}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-ink-subtle transition-transform ${eventoDropdownOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {eventoDropdownOpen ? (
        <>
          <div
            className="fixed inset-0 z-30"
            aria-hidden="true"
            onClick={() => setEventoDropdownOpen(false)}
          />
          <ul
            id={eventMenuId}
            role="listbox"
            aria-labelledby={`${eventMenuId}-label`}
            className="scroll-touch absolute inset-x-0 z-40 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-line bg-surface-raised shadow-overlay"
          >
            {eventos.map(evento => {
              const isSel = evento.id === selectedEvento
              return (
                <li key={evento.id} role="option" aria-selected={isSel}>
                  <button
                    type="button"
                    onClick={() => selectEvento(evento.id)}
                    className={`ds-tap flex w-full items-center justify-between gap-3 border-l-2 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-brand ${
                      isSel
                        ? 'border-brand bg-brand-soft'
                        : 'border-transparent hover:bg-surface-hover'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className={`block truncate text-sm font-medium ${isSel ? 'text-brand-strong' : 'text-ink-strong'}`}>
                        {evento.titulo}
                      </span>
                      <span className="mt-1 flex items-center gap-2 text-meta text-ink-muted">
                        {formatEventDate(evento.data_evento)}
                        <StatusPill tone={statusTone(evento.checkin_status)}>
                          {statusText(evento.checkin_status)}
                        </StatusPill>
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-mono text-sm tabular-nums text-ink">{evento.checkin_count}</span>
                      <span className="block text-micro text-ink-subtle">check-ins</span>
                    </span>
                  </button>
                </li>
              )
            })}
            {eventos.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-ink-muted">Nenhum evento</li>
            ) : null}
          </ul>
        </>
      ) : null}
    </div>
  )

  /* ───────────────────────── Chips de filtro ───────────────────────── */
  const filterChips = (
    <div className="flex flex-wrap items-center gap-2">
      {activeFilter !== 'all' ? (
        <FilterChip
          label="Status"
          value={activeFilter === 'validated' ? 'Presentes' : 'Ausentes'}
          onRemove={() => setActiveFilter('all')}
        />
      ) : null}
      {selectedSexo ? (
        <FilterChip label="Sexo" value={selectedSexo} onRemove={() => setSelectedSexo(null)} />
      ) : null}
      {selectedPelotao ? (
        <FilterChip label="Pelotão" value={selectedPelotao} onRemove={() => setSelectedPelotao(null)} />
      ) : null}
      {selectedDia ? (
        <FilterChip label="Dia" value={selectedDia} onRemove={() => setSelectedDia(null)} />
      ) : null}
    </div>
  )

  const sortControl = (
    <SegmentedControl
      label="Ordenação da lista"
      value={sortOrder}
      onChange={setSortOrder}
      options={[
        { value: 'desc', label: 'Mais recente' },
        { value: 'asc', label: 'Primeiro inscrito' },
      ]}
    />
  )

  /* ───────────────────────── Estados de conteúdo ───────────────────────── */
  const hasQuery = searchTerm.trim().length > 0

  const renderContent = () => {
    if (!selectedEvento) {
      return (
        <EmptyState
          icon={CalendarX2}
          title="Nenhum evento selecionado"
          description="Escolha um evento no seletor acima para começar a validar as presenças dos participantes."
        />
      )
    }

    if (loading) {
      return (
        <>
          <div className="lg:hidden">
            <CardListSkeleton count={6} />
          </div>
          <div className="hidden lg:block">
            <TableSkeleton rows={8} columns={7} />
          </div>
        </>
      )
    }

    if (error) {
      return <ErrorBanner message={error} onRetry={fetchCheckInData} />
    }

    if (checkInData.length === 0) {
      return (
        <EmptyState
          icon={Users}
          title="Nenhum participante inscrito"
          description={`Ainda não há check-ins registrados em ${selectedEventoData?.titulo ?? 'neste evento'}. Assim que alguém se inscrever, o nome aparece aqui.`}
          action={
            <Button variant="secondary" onClick={fetchCheckInData}>
              <RefreshCw aria-hidden="true" />
              Atualizar
            </Button>
          }
        />
      )
    }

    if (sorted.length === 0) {
      return (
        <NoResultsState
          query={hasQuery ? searchTerm : 'os filtros aplicados'}
          onClear={clearAllFilters}
        />
      )
    }

    return (
      <>
        {/* ── Mobile: lista de cards ── */}
        <ul className="space-y-2.5 lg:hidden">
          {sorted.map((item, idx) => {
            const rowKey = item.id || String(idx)
            const isUpdating = updatingId === item.id
            const isDeleting = deletingId === item.id
            const isExpanded = expandedId === rowKey
            const tone = pelotaoTone(item.pelotao)
            const nome = item.nome || '—'

            return (
              <li
                key={rowKey}
                className="animate-fade-in overflow-hidden rounded-xl border border-line bg-surface-raised"
              >
                <div className="flex items-stretch gap-2 p-3">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : rowKey)}
                    aria-expanded={isExpanded}
                    aria-controls={`detalhes-${rowKey}`}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface-sunken text-sm font-bold text-ink">
                      {getInitials(item.nome)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-1.5">
                        <span className="font-mono text-micro tabular-nums text-ink-subtle">
                          #{item.id ? inscriptionMap.get(item.id) || idx + 1 : idx + 1}
                        </span>
                        <span className="truncate text-sm font-semibold text-ink-strong">{nome}</span>
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        {item.pelotao ? (
                          <StatusPill tone={tone} dot={false}>{item.pelotao}</StatusPill>
                        ) : null}
                        <StatusPill tone={item.validated ? 'success' : 'warning'}>
                          {item.validated ? 'Presente' : 'Ausente'}
                        </StatusPill>
                        <span className="text-meta text-ink-muted">{extractTime(item.data)}</span>
                      </span>
                    </span>
                  </button>

                  <Button
                    variant={item.validated ? 'secondary' : 'default'}
                    onClick={() => handleToggleValidation(item)}
                    loading={isUpdating}
                    disabled={isDeleting || (!!updatingId && !isUpdating)}
                    aria-label={
                      item.validated
                        ? `Desfazer presença de ${nome}`
                        : `Confirmar presença de ${nome}`
                    }
                    className="h-auto min-h-[3.25rem] w-[5.5rem] shrink-0 flex-col gap-1 px-2"
                  >
                    {isUpdating ? null : item.validated
                      ? <CheckCircle2 aria-hidden="true" />
                      : <XCircle aria-hidden="true" />}
                    <span className="text-micro font-bold uppercase tracking-wide">
                      {item.validated ? 'Presente' : 'Marcar'}
                    </span>
                  </Button>
                </div>

                {isExpanded ? (
                  <div
                    id={`detalhes-${rowKey}`}
                    className="animate-rise-in border-t border-line-soft bg-surface-sunken px-4 py-3.5"
                  >
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                      <div className="min-w-0">
                        <dt className="ds-eyebrow">CPF</dt>
                        <dd className="mt-0.5 font-mono text-sm text-ink">{formatCPF(item.cpf)}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="ds-eyebrow">Telefone</dt>
                        <dd className="mt-0.5 font-mono text-sm text-ink">{item.telefone || '—'}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="ds-eyebrow">Sexo</dt>
                        <dd className="mt-0.5 text-sm capitalize text-ink">{item.sexo || '—'}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="ds-eyebrow">Inscrição</dt>
                        <dd className="mt-0.5 text-sm text-ink">{item.data || '—'}</dd>
                      </div>
                      {item.email ? (
                        <div className="col-span-2 min-w-0">
                          <dt className="ds-eyebrow">E-mail</dt>
                          <dd className="mt-0.5 truncate text-sm text-ink">{item.email}</dd>
                        </div>
                      ) : null}
                    </dl>

                    <div className="mt-4 flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => openEdit(item)}
                        disabled={isDeleting}
                        className="flex-1"
                      >
                        <Pencil aria-hidden="true" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDelete(item)}
                        loading={isDeleting}
                        aria-label={`Deletar check-in de ${nome}`}
                        className="text-danger hover:text-danger"
                      >
                        {isDeleting ? null : <Trash2 aria-hidden="true" />}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>

        {/* ── Desktop: tabela ── */}
        <div className="hidden lg:block">
          <TableFrame busy={loading}>
            <Table caption={`Participantes com check-in em ${selectedEventoData?.titulo ?? 'evento selecionado'}`}>
              <THead>
                <TH
                  sortable
                  direction={sortOrder}
                  onSort={() => setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'))}
                  width="72px"
                >
                  #
                </TH>
                <TH width="110px">Pelotão</TH>
                <TH>Nome</TH>
                <TH width="150px">Telefone</TH>
                <TH width="150px">CPF</TH>
                <TH width="170px">Data/Hora</TH>
                <TH width="150px">Presença</TH>
                <TH align="center" width="110px">Ações</TH>
              </THead>
              <TBody>
                {sorted.map((item, idx) => {
                  const isUpdating = updatingId === item.id
                  const isDeleting = deletingId === item.id
                  const nome = item.nome || '—'
                  return (
                    <TR key={item.id || idx}>
                      <TD className="font-mono text-xs tabular-nums text-ink-muted">
                        {item.id ? inscriptionMap.get(item.id) || idx + 1 : idx + 1}
                      </TD>
                      <TD>
                        {item.pelotao
                          ? <StatusPill tone={pelotaoTone(item.pelotao)} dot={false}>{item.pelotao}</StatusPill>
                          : <span className="text-ink-subtle">—</span>}
                      </TD>
                      <TD className="max-w-[220px]">
                        <p className="truncate font-medium text-ink-strong">{nome}</p>
                        {item.email ? (
                          <p className="truncate text-meta text-ink-muted">{item.email}</p>
                        ) : null}
                      </TD>
                      <TD className="font-mono text-xs text-ink-muted">{item.telefone || "—"}</TD>
                      <TD className="font-mono text-xs text-ink-muted">{formatCPF(item.cpf)}</TD>
                      <TD className="whitespace-nowrap text-meta text-ink-muted">{item.data || "—"}</TD>
                      <TD>
                        <Button
                          variant={item.validated ? 'subtle' : 'outline'}
                          size="sm"
                          onClick={() => handleToggleValidation(item)}
                          loading={isUpdating}
                          disabled={isDeleting || (!!updatingId && !isUpdating)}
                          aria-label={
                            item.validated
                              ? `Desfazer presença de ${nome}`
                              : `Confirmar presença de ${nome}`
                          }
                        >
                          {isUpdating ? null : item.validated
                            ? <CheckCircle2 aria-hidden="true" />
                            : <XCircle aria-hidden="true" />}
                          {item.validated ? 'Presente' : 'Ausente'}
                        </Button>
                      </TD>
                      <TD align="center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openEdit(item)}
                            aria-label={`Editar check-in de ${nome}`}
                          >
                            <Pencil aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDelete(item)}
                            loading={isDeleting}
                            aria-label={`Deletar check-in de ${nome}`}
                            className="text-ink-subtle hover:text-danger"
                          >
                            {isDeleting ? null : <Trash2 aria-hidden="true" />}
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
          </TableFrame>
          <p className="mt-2 text-right text-meta text-ink-muted">
            {sorted.length} registro(s){activeFilterCount > 0 || hasQuery ? ' (filtrado)' : ''}
          </p>
        </div>
      </>
    )
  }

  /* ───────────────────────── Loading inicial ───────────────────────── */
  if (loadingEventos) {
    return (
      <PageShell className="pb-40 lg:pb-10">
        <PageHeader
          eyebrow="Operação"
          title="Check-in"
          description="Carregando eventos disponíveis…"
        />
        <div className="space-y-5">
          <StatGridSkeleton />
          <CardListSkeleton count={5} />
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell className="pb-40 lg:pb-10">
      <PageHeader
        eyebrow="Operação"
        title="Check-in"
        description="Busque o participante e confirme a presença. Tudo é salvo na hora."
        meta={
          <>
            <span className="inline-flex items-center gap-1.5">
              <Shield aria-hidden="true" className="h-3.5 w-3.5 text-brand" />
              {checkInData.length} inscrito(s)
            </span>
            <span>{totalValidated} presente(s)</span>
            <span>{presencaPct}% de presença</span>
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="icon"
              onClick={fetchCheckInData}
              loading={loading}
              aria-label="Atualizar lista de check-ins"
            >
              {loading ? null : <RefreshCw aria-hidden="true" />}
            </Button>
            <Button
              variant="secondary"
              onClick={handleExport}
              disabled={sorted.length === 0}
              aria-label="Exportar check-ins filtrados em CSV"
            >
              <Download aria-hidden="true" />
              <span className="hidden sm:inline">Exportar CSV</span>
            </Button>
          </>
        }
      >
        {eventSelector}
      </PageHeader>

      {/* Resultado da última validação, para leitores de tela. */}
      <p role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </p>

      <div className="space-y-5">
        <StatGrid>
          <StatTile
            label="Inscritos"
            value={checkInData.length}
            icon={Users}
            hint="Total no evento"
            loading={loading}
            onClick={() => setActiveFilter('all')}
            tone={activeFilter === 'all' ? 'brand' : 'default'}
          />
          <StatTile
            label="Presentes"
            value={totalValidated}
            icon={CheckCircle2}
            hint="Check-in confirmado"
            loading={loading}
            onClick={() => setActiveFilter('validated')}
            tone={activeFilter === 'validated' ? 'brand' : 'default'}
          />
          <StatTile
            label="Ausentes"
            value={totalPending}
            icon={XCircle}
            hint="Aguardando validação"
            loading={loading}
            onClick={() => setActiveFilter('not_validated')}
            tone={activeFilter === 'not_validated' ? 'brand' : 'default'}
          />
          <StatTile
            label="Presença"
            value={`${presencaPct}%`}
            icon={Percent}
            hint={`${totalValidated} de ${checkInData.length}`}
            loading={loading}
          />
        </StatGrid>

        {/* Toolbar de desktop — no celular a busca vive na barra inferior. */}
        <Toolbar className="hidden lg:flex">
          <SearchInput
            ref={searchRef}
            value={searchTerm}
            onValueChange={setSearchTerm}
            placeholder="Nome, CPF, telefone, e-mail ou pelotão…"
            placeholderShort="Nome ou CPF"
            label="Buscar participante"
          />
          <FilterButton count={activeFilterCount} onClick={() => setFiltersOpen(true)} />
          {sortControl}
        </Toolbar>

        {activeFilterCount > 0 ? filterChips : null}

        {renderContent()}
      </div>

      {/* ── Barra inferior mobile: busca sempre ao alcance do polegar ── */}
      <MobileActionBar className="pb-safe">
        <SearchInput
          value={searchTerm}
          onValueChange={setSearchTerm}
          placeholder="Buscar participante…"
          label="Buscar participante"
          className="sm:max-w-none"
        />
        <FilterButton count={activeFilterCount} onClick={() => setFiltersOpen(true)} />
      </MobileActionBar>

      {/* ── Filtros ── */}
      <ResponsiveModal
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        title="Filtrar participantes"
        description={`${sorted.length} de ${checkInData.length} registro(s) visíveis`}
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setActiveFilter('all')
                setSelectedSexo(null)
                setSelectedPelotao(null)
                setSelectedDia(null)
                setSortOrder('desc')
              }}
              block
              className="sm:w-auto"
            >
              Limpar
            </Button>
            <Button onClick={() => setFiltersOpen(false)} block className="sm:w-auto">
              Aplicar
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <fieldset>
            <legend className="ds-eyebrow mb-2">Presença</legend>
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: 'all', label: 'Todos' },
                { key: 'validated', label: 'Presentes' },
                { key: 'not_validated', label: 'Ausentes' },
              ] as const).map(option => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setActiveFilter(option.key)}
                  aria-pressed={activeFilter === option.key}
                  className={`ds-tap rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    activeFilter === option.key
                      ? 'border-brand-border bg-brand-soft text-brand-strong'
                      : 'border-line bg-surface-sunken text-ink hover:border-line-strong'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          {uniqueSexos.length > 0 ? (
            <div>
              <label htmlFor={filterIds.sexo} className="ds-label mb-2 block">Sexo</label>
              <div className="relative">
                <select
                  id={filterIds.sexo}
                  value={selectedSexo || ''}
                  onChange={e => setSelectedSexo(e.target.value || null)}
                  className={`${selectClass} capitalize`}
                >
                  <option value="">Todos ({checkInData.length})</option>
                  {uniqueSexos.map(s => (
                    <option key={s} value={s}>{s} — {statsBySexo(s)} inscritos</option>
                  ))}
                </select>
                <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
              </div>
            </div>
          ) : null}

          {selectedEventoData?.tipo !== 'personalizado' && uniquePelotoes.length > 0 ? (
            <div>
              <label htmlFor={filterIds.pelotao} className="ds-label mb-2 block">Pelotão</label>
              <div className="relative">
                <select
                  id={filterIds.pelotao}
                  value={selectedPelotao || ''}
                  onChange={e => setSelectedPelotao(e.target.value || null)}
                  className={selectClass}
                >
                  <option value="">Todos ({checkInData.length})</option>
                  {uniquePelotoes.map(p => (
                    <option key={p} value={p}>{p} — {statsByPelotao(p)} inscritos</option>
                  ))}
                </select>
                <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
              </div>
            </div>
          ) : null}

          {uniqueDias.length > 1 ? (
            <div>
              <label htmlFor={filterIds.dia} className="ds-label mb-2 block">Dia de inscrição</label>
              <div className="relative">
                <select
                  id={filterIds.dia}
                  value={selectedDia || ''}
                  onChange={e => setSelectedDia(e.target.value || null)}
                  className={selectClass}
                >
                  <option value="">Todos os dias ({checkInData.length})</option>
                  {uniqueDias.map(d => (
                    <option key={d} value={d}>{d} — {statsByDia(d)} inscritos</option>
                  ))}
                </select>
                <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
              </div>
            </div>
          ) : null}

          <div className="lg:hidden">
            <span className="ds-eyebrow mb-2 block">Ordenar</span>
            {sortControl}
          </div>
        </div>
      </ResponsiveModal>

      {/* ── Edição ── */}
      <ResponsiveModal
        open={editingItem !== null}
        onOpenChange={open => { if (!open) setEditingItem(null) }}
        title="Editar check-in"
        description="As alterações são salvas no banco imediatamente."
        size="md"
        dismissible={!savingEdit}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setEditingItem(null)}
              disabled={savingEdit}
              block
              className="sm:w-auto"
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} loading={savingEdit} block className="sm:w-auto">
              Salvar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor={editIds.nome} className="ds-label mb-1.5 block">Nome completo</label>
            <Input
              id={editIds.nome}
              value={editForm.nome || ''}
              onChange={e => setEditForm(prev => ({ ...prev, nome: e.target.value }))}
              autoComplete="name"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={editIds.telefone} className="ds-label mb-1.5 block">Telefone</label>
              <Input
                id={editIds.telefone}
                type="tel"
                inputMode="tel"
                value={editForm.telefone || ''}
                onChange={e => setEditForm(prev => ({ ...prev, telefone: e.target.value }))}
                className="font-mono"
              />
            </div>
            <div>
              <label htmlFor={editIds.cpf} className="ds-label mb-1.5 block">CPF</label>
              <Input
                id={editIds.cpf}
                inputMode="numeric"
                value={editForm.cpf || ''}
                onChange={e => setEditForm(prev => ({ ...prev, cpf: e.target.value }))}
                className="font-mono"
              />
            </div>
          </div>

          <div>
            <label htmlFor={editIds.email} className="ds-label mb-1.5 block">E-mail</label>
            <Input
              id={editIds.email}
              type="email"
              inputMode="email"
              autoComplete="email"
              value={editForm.email || ''}
              onChange={e => setEditForm(prev => ({ ...prev, email: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {selectedEventoData?.tipo !== 'personalizado' ? (
              <div>
                <label htmlFor={editIds.pelotao} className="ds-label mb-1.5 block">Pelotão</label>
                <div className="relative">
                  <select
                    id={editIds.pelotao}
                    value={editForm.pelotao || ''}
                    onChange={e => setEditForm(prev => ({ ...prev, pelotao: e.target.value }))}
                    className={selectClass}
                  >
                    <option value="">— Sem pelotão —</option>
                    {PELOTAO_OPTIONS.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                </div>
              </div>
            ) : null}
            <div>
              <label htmlFor={editIds.sexo} className="ds-label mb-1.5 block">Sexo</label>
              <div className="relative">
                <select
                  id={editIds.sexo}
                  value={editForm.sexo || ''}
                  onChange={e => setEditForm(prev => ({ ...prev, sexo: e.target.value }))}
                  className={selectClass}
                >
                  <option value="">— Não informado —</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>
                <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
              </div>
            </div>
          </div>
        </div>
      </ResponsiveModal>
    </PageShell>
  )
}

