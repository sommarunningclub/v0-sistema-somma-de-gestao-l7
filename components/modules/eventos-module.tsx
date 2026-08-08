"use client"

import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react"
import { apiFetch } from '@/lib/api-client'
import {
  Calendar, CalendarPlus, Clock, MapPin, Users, Plus, Edit3, Trash2, Copy,
  Lock, Unlock, CheckCircle2, RefreshCw, X, CalendarDays,
} from "lucide-react"
import type { EventoWithStats } from "@/lib/types/evento"
import { matchesTextSearch } from "@/lib/search-utils"
import { ErrorBanner } from '@/components/ui/error-banner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  CardListSkeleton,
  EmptyState,
  FilterChip,
  MobileRecordCard,
  NoResultsState,
  PageHeader,
  PageShell,
  ResponsiveModal,
  SearchInput,
  SectionTitle,
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
  confirmAction,
  notify,
  type SortDirection,
  type StatusTone,
} from '@/components/somma'

type CheckinStatus = 'aberto' | 'bloqueado' | 'encerrado'

const STATUS_CONFIG: Record<CheckinStatus, { label: string; tone: StatusTone; icon: typeof Lock }> = {
  aberto: { label: 'Aberto', tone: 'success', icon: Unlock },
  bloqueado: { label: 'Bloqueado', tone: 'warning', icon: Lock },
  encerrado: { label: 'Encerrado', tone: 'neutral', icon: CheckCircle2 },
}

const STATUS_ORDER: CheckinStatus[] = ['bloqueado', 'aberto', 'encerrado']

type StatusFiltro = 'todos' | CheckinStatus
type PeriodoFiltro = 'todos' | 'proximos' | 'passados'

const PERIODO_LABEL: Record<PeriodoFiltro, string> = {
  todos: 'Todos',
  proximos: 'A partir de hoje',
  passados: 'Já realizados',
}

function formatDateBR(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' })
}

function formatDateShort(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
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

function hojeISO(): string {
  const d = new Date()
  const offset = d.getTimezoneOffset()
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10)
}

const DEFAULT_FORM = {
  titulo: '',
  descricao: '',
  data_evento: '',
  horario_inicio: '07:00',
  local: 'Parque da Cidade — Brasília, DF',
  local_url: '',
  tipo: 'corrida' as 'corrida' | 'personalizado',
  checkin_abertura: '',
  checkin_fechamento: '',
  checkin_status: 'bloqueado' as CheckinStatus,
  pelotoes: ['4km', '6km', '8km'],
}

const FIELD_CLASS = [
  'w-full rounded-lg border border-line bg-surface-sunken px-3.5 py-2.5 text-base text-ink',
  'transition-colors placeholder:text-ink-subtle hover:border-line-strong',
  'focus-visible:border-brand focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand',
  'aria-[invalid=true]:border-danger',
].join(' ')

function Field({
  label,
  htmlFor,
  hint,
  error,
  errorId,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  error?: string
  errorId?: string
  children: ReactNode
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-1.5 block text-meta font-medium text-ink-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-meta font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={errorId} className="mt-1.5 text-meta text-ink-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Módulo montado pelo shell do painel a partir de `app/page.tsx`.
 * Vive fora de `app/` porque recebe props — arquivos `page.tsx` do App
 * Router só podem exportar o default e um conjunto fixo de metadados.
 */
export function EventosModule({ onViewCheckins }: { onViewCheckins?: (eventoId: string) => void }) {
  const [eventos, setEventos] = useState<EventoWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('todos')
  const [periodoFiltro, setPeriodoFiltro] = useState<PeriodoFiltro>('todos')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ titulo?: string; data_evento?: string }>({})

  // Toggle state
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Custom pelotão input
  const [newPelotao, setNewPelotao] = useState("")

  const uid = useId()
  const id = (name: string) => `${uid}-${name}`

  const fetchEventos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/api/insider/eventos', { cache: 'no-store' })
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

  const hoje = hojeISO()

  const filtered = useMemo(() => {
    const list = eventos.filter(e => {
      if (!matchesTextSearch(searchTerm, [e.titulo, e.local])) return false
      if (statusFiltro !== 'todos' && e.checkin_status !== statusFiltro) return false
      if (periodoFiltro === 'proximos' && e.data_evento < hoje) return false
      if (periodoFiltro === 'passados' && e.data_evento >= hoje) return false
      return true
    })

    return list.sort((a, b) => {
      const cmp = a.data_evento.localeCompare(b.data_evento)
      return sortDirection === 'asc' ? cmp : -cmp
    })
  }, [eventos, searchTerm, statusFiltro, periodoFiltro, hoje, sortDirection])

  const filtrosAtivos = (statusFiltro !== 'todos' ? 1 : 0) + (periodoFiltro !== 'todos' ? 1 : 0)

  const limparTudo = () => {
    setSearchTerm('')
    setStatusFiltro('todos')
    setPeriodoFiltro('todos')
  }

  // Open modal for create
  const handleCreate = () => {
    setEditingId(null)
    setForm(DEFAULT_FORM)
    setSaveError(null)
    setFieldErrors({})
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
      local_url: evento.local_url || '',
      tipo: evento.tipo || 'corrida',
      checkin_abertura: toDatetimeLocal(evento.checkin_abertura),
      checkin_fechamento: toDatetimeLocal(evento.checkin_fechamento),
      checkin_status: evento.checkin_status,
      pelotoes: evento.pelotoes || ['4km', '6km', '8km'],
    })
    setSaveError(null)
    setFieldErrors({})
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
      local_url: evento.local_url || '',
      tipo: evento.tipo || 'corrida',
      checkin_abertura: '',
      checkin_fechamento: '',
      checkin_status: 'bloqueado',
      pelotoes: evento.pelotoes || ['4km', '6km', '8km'],
    })
    setSaveError(null)
    setFieldErrors({})
    setModalOpen(true)
  }

  // Save (create or update)
  const handleSave = async () => {
    const errors: { titulo?: string; data_evento?: string } = {}
    if (!form.titulo.trim()) errors.titulo = 'Informe o título do evento.'
    if (!form.data_evento) errors.data_evento = 'Escolha a data do evento.'

    if (errors.titulo || errors.data_evento) {
      setFieldErrors(errors)
      setSaveError('Revise os campos destacados para continuar.')
      return
    }

    setFieldErrors({})
    setSaving(true)
    setSaveError(null)
    try {
      const body = {
        titulo: form.titulo,
        descricao: form.descricao || undefined,
        data_evento: form.data_evento,
        horario_inicio: form.horario_inicio || '07:00',
        local: form.local || 'Parque da Cidade — Brasília, DF',
        local_url: form.local_url || undefined,
        tipo: form.tipo,
        checkin_abertura: form.checkin_abertura ? new Date(form.checkin_abertura).toISOString() : undefined,
        checkin_fechamento: form.checkin_fechamento ? new Date(form.checkin_fechamento).toISOString() : undefined,
        checkin_status: form.checkin_status,
        pelotoes: form.tipo === 'personalizado' ? [] : form.pelotoes,
      }

      const url = editingId ? `/api/insider/eventos/${editingId}` : '/api/insider/eventos'
      const method = editingId ? 'PUT' : 'POST'

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao salvar')

      setModalOpen(false)
      notify.success(editingId ? 'Evento atualizado.' : 'Evento criado.', {
        description: form.titulo,
      })
      fetchEventos()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  // Delete
  const handleDelete = async (evento: EventoWithStats) => {
    const ok = await confirmAction({
      title: 'Excluir este evento?',
      description:
        evento.checkin_count > 0
          ? 'Os check-ins vinculados a este evento também deixam de aparecer no painel. Esta ação não pode ser desfeita.'
          : 'Esta ação não pode ser desfeita.',
      detail: (
        <>
          <span className="block font-medium text-ink-strong">{evento.titulo}</span>
          <span className="block text-ink-muted">{formatDateBR(evento.data_evento)}</span>
          {evento.checkin_count > 0 ? (
            <span className="mt-1 block font-medium text-brand-strong">
              {evento.checkin_count} check-in(s) vinculados
            </span>
          ) : null}
        </>
      ),
      tone: 'danger',
      confirmLabel: 'Excluir evento',
    })
    if (!ok) return

    try {
      const res = await apiFetch(`/api/insider/eventos/${evento.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Falha ao deletar')
      notify.success('Evento excluído.', { description: evento.titulo })
      fetchEventos()
    } catch {
      notify.error('Não foi possível excluir o evento.')
    }
  }

  // Quick toggle status
  const handleToggleStatus = async (evento: EventoWithStats) => {
    const newStatus: CheckinStatus = evento.checkin_status === 'aberto' ? 'bloqueado' : 'aberto'
    if (evento.checkin_status === 'encerrado') {
      const ok = await confirmAction({
        title: 'Reabrir o check-in?',
        description: 'Este evento está encerrado. Reabrir permite novos check-ins imediatamente.',
        detail: evento.titulo,
        confirmLabel: 'Reabrir check-in',
      })
      if (!ok) return
    }
    setTogglingId(evento.id)
    try {
      const res = await apiFetch(`/api/insider/eventos/${evento.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkin_status: newStatus }),
      })
      if (!res.ok) throw new Error('Falha ao atualizar')
      setEventos(prev => prev.map(e => e.id === evento.id ? { ...e, checkin_status: newStatus } : e))
      notify.success(
        newStatus === 'aberto' ? 'Check-in aberto.' : 'Check-in bloqueado.',
        { description: evento.titulo },
      )
    } catch {
      notify.error('Não foi possível alterar o status do check-in.')
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

  const buscaOuFiltro = searchTerm.trim().length > 0 || filtrosAtivos > 0

  const renderStatusPill = (evento: EventoWithStats) => {
    const sc = STATUS_CONFIG[evento.checkin_status]
    const Icon = sc.icon
    return (
      <StatusPill tone={sc.tone} dot={false}>
        <Icon aria-hidden="true" className="h-3 w-3" />
        {sc.label}
      </StatusPill>
    )
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Operação"
        title="Eventos Somma"
        description="Cadastre os treinos, controle a janela de check-in e acompanhe a presença de cada edição."
        meta={
          loading ? null : (
            <>
              <span>
                <span className="font-mono tabular-nums text-ink">{filtered.length}</span> de{' '}
                <span className="font-mono tabular-nums text-ink">{totalEventos}</span> eventos
              </span>
              <span aria-hidden="true">·</span>
              <span>
                <span className="font-mono tabular-nums text-ink">{abertos}</span> com check-in aberto
              </span>
            </>
          )
        }
        actions={
          <Button variant="secondary" size="sm" onClick={fetchEventos} disabled={loading}>
            <RefreshCw className={loading ? 'animate-spin' : undefined} aria-hidden="true" />
            <span className="hidden sm:inline">Atualizar</span>
            <span className="sr-only sm:hidden">Atualizar lista</span>
          </Button>
        }
        primaryAction={
          <Button onClick={handleCreate}>
            <Plus aria-hidden="true" />
            Novo evento
          </Button>
        }
      >
        <div className="space-y-3">
          <Toolbar>
            <SearchInput
              value={searchTerm}
              onValueChange={setSearchTerm}
              placeholder="Buscar por título ou local..."
              label="Buscar eventos"
            />
            <div className="scroll-touch no-scrollbar -mx-1 flex w-full items-center gap-2 overflow-x-auto px-1 sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0">
              <SegmentedControl<StatusFiltro>
                label="Filtrar por status do check-in"
                value={statusFiltro}
                onChange={setStatusFiltro}
                options={[
                  { value: 'todos', label: 'Todos' },
                  { value: 'aberto', label: 'Abertos' },
                  { value: 'bloqueado', label: 'Bloqueados' },
                  { value: 'encerrado', label: 'Encerrados' },
                ]}
              />
              <SegmentedControl<PeriodoFiltro>
                label="Filtrar por período"
                value={periodoFiltro}
                onChange={setPeriodoFiltro}
                options={[
                  { value: 'todos', label: 'Sempre' },
                  { value: 'proximos', label: 'Próximos' },
                  { value: 'passados', label: 'Passados' },
                ]}
              />
            </div>
          </Toolbar>

          {filtrosAtivos > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {statusFiltro !== 'todos' ? (
                <FilterChip
                  label="Status"
                  value={STATUS_CONFIG[statusFiltro].label}
                  onRemove={() => setStatusFiltro('todos')}
                />
              ) : null}
              {periodoFiltro !== 'todos' ? (
                <FilterChip
                  label="Período"
                  value={PERIODO_LABEL[periodoFiltro]}
                  onRemove={() => setPeriodoFiltro('todos')}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </PageHeader>

      <div className="space-y-5">
        {loading ? (
          <StatGridSkeleton />
        ) : (
          <StatGrid>
            <StatTile
              label="Total"
              value={totalEventos}
              icon={Calendar}
              hint="Eventos cadastrados"
              onClick={() => setStatusFiltro('todos')}
            />
            <StatTile
              label="Abertos"
              value={abertos}
              icon={Unlock}
              tone="brand"
              hint="Check-in liberado"
              onClick={() => setStatusFiltro('aberto')}
            />
            <StatTile
              label="Bloqueados"
              value={bloqueados}
              icon={Lock}
              hint="Aguardando liberação"
              onClick={() => setStatusFiltro('bloqueado')}
            />
            <StatTile
              label="Encerrados"
              value={encerrados}
              icon={CheckCircle2}
              hint="Sem novos check-ins"
              onClick={() => setStatusFiltro('encerrado')}
            />
          </StatGrid>
        )}

        {!loading && error ? <ErrorBanner message={error} onRetry={fetchEventos} /> : null}

        {loading ? (
          <>
            <div className="hidden md:block">
              <TableSkeleton rows={6} columns={6} />
            </div>
            <div className="md:hidden">
              <CardListSkeleton count={4} />
            </div>
          </>
        ) : error ? null : filtered.length === 0 ? (
          buscaOuFiltro ? (
            <NoResultsState query={searchTerm || 'os filtros aplicados'} onClear={limparTudo} />
          ) : (
            <EmptyState
              icon={CalendarPlus}
              title="Nenhum evento cadastrado"
              description="Crie o primeiro treino para liberar o check-in dos insiders e montar a escala do dia."
              action={
                <Button onClick={handleCreate}>
                  <Plus aria-hidden="true" />
                  Criar primeiro evento
                </Button>
              }
            />
          )
        ) : (
          <>
            {/* ── DESKTOP ── */}
            <div className="hidden md:block">
              <TableFrame>
                <Table caption="Eventos do Somma Running Club, com data, status do check-in, janela de agendamento e total de presenças.">
                  <THead>
                    <TH>Evento</TH>
                    <TH
                      sortable
                      direction={sortDirection}
                      onSort={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                    >
                      Data
                    </TH>
                    <TH>Status do check-in</TH>
                    <TH>Agendamento</TH>
                    <TH align="center">Check-ins</TH>
                    <TH align="right">Ações</TH>
                  </THead>
                  <TBody>
                    {filtered.map(evento => {
                      const sc = STATUS_CONFIG[evento.checkin_status]
                      const StatusIcon = sc.icon
                      const proximoStatus = evento.checkin_status === 'aberto' ? 'bloquear' : 'abrir'
                      return (
                        <TR key={evento.id} className="hover:bg-surface-hover">
                          <TD>
                            <p className="font-medium text-ink-strong">{evento.titulo}</p>
                            <p className="mt-0.5 flex items-center gap-1 text-meta text-ink-muted">
                              <MapPin aria-hidden="true" className="h-3 w-3 shrink-0" />
                              <span className="truncate">{evento.local}</span>
                            </p>
                          </TD>
                          <TD className="whitespace-nowrap">
                            <span className="flex items-center gap-1.5 text-[0.8125rem] text-ink">
                              <Calendar aria-hidden="true" className="h-3.5 w-3.5 text-ink-subtle" />
                              {formatDateBR(evento.data_evento)}
                            </span>
                            <span className="mt-1 flex items-center gap-1.5 text-meta text-ink-muted">
                              <Clock aria-hidden="true" className="h-3.5 w-3.5" />
                              {evento.horario_inicio || '07:00'}
                            </span>
                          </TD>
                          <TD>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(evento)}
                              disabled={togglingId === evento.id}
                              aria-label={`Status: ${sc.label}. ${proximoStatus === 'abrir' ? 'Abrir' : 'Bloquear'} check-in de ${evento.titulo}`}
                              className="inline-flex items-center rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:opacity-50"
                            >
                              <StatusPill tone={sc.tone} dot={false} size="md">
                                {togglingId === evento.id ? (
                                  <RefreshCw aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <StatusIcon aria-hidden="true" className="h-3.5 w-3.5" />
                                )}
                                {sc.label}
                              </StatusPill>
                            </button>
                          </TD>
                          <TD className="text-meta text-ink-muted">
                            <div>Abre: {formatDatetimeBR(evento.checkin_abertura)}</div>
                            <div>Fecha: {formatDatetimeBR(evento.checkin_fechamento)}</div>
                          </TD>
                          <TD align="center">
                            <Button
                              variant="subtle"
                              size="sm"
                              onClick={() => onViewCheckins?.(evento.id)}
                              aria-label={`Ver ${evento.checkin_count} check-in(s) de ${evento.titulo}`}
                            >
                              <Users aria-hidden="true" />
                              <span className="font-mono tabular-nums">{evento.checkin_count}</span>
                              <span className="hidden xl:inline">check-ins</span>
                            </Button>
                          </TD>
                          <TD align="right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handleEdit(evento)}
                                aria-label={`Editar ${evento.titulo}`}
                                title="Editar"
                              >
                                <Edit3 aria-hidden="true" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handleDuplicate(evento)}
                                aria-label={`Duplicar ${evento.titulo} para a semana seguinte`}
                                title="Duplicar (+7 dias)"
                              >
                                <Copy aria-hidden="true" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handleDelete(evento)}
                                aria-label={`Excluir ${evento.titulo}`}
                                title="Excluir"
                                className="hover:bg-danger-soft hover:text-danger"
                              >
                                <Trash2 aria-hidden="true" />
                              </Button>
                            </div>
                          </TD>
                        </TR>
                      )
                    })}
                  </TBody>
                </Table>
              </TableFrame>
            </div>

            {/* ── MOBILE ── */}
            <ul className="space-y-3 md:hidden">
              {filtered.map(evento => (
                <li key={evento.id}>
                  <MobileRecordCard
                    title={evento.titulo}
                    subtitle={evento.local}
                    status={renderStatusPill(evento)}
                    fields={[
                      { label: 'Data', value: formatDateShort(evento.data_evento) },
                      { label: 'Horário', value: evento.horario_inicio || '07:00' },
                      {
                        label: 'Pelotões',
                        value: (evento.pelotoes || []).length > 0 ? (evento.pelotoes || []).join(' · ') : '—',
                      },
                      {
                        label: 'Janela de check-in',
                        value:
                          evento.checkin_abertura || evento.checkin_fechamento
                            ? `${formatDatetimeBR(evento.checkin_abertura)} → ${formatDatetimeBR(evento.checkin_fechamento)}`
                            : 'Manual',
                      },
                    ]}
                    actions={
                      <div className="flex w-full flex-wrap items-center gap-2">
                        <Button
                          variant="subtle"
                          size="sm"
                          className="flex-1"
                          onClick={() => onViewCheckins?.(evento.id)}
                          aria-label={`Ver ${evento.checkin_count} check-in(s) de ${evento.titulo}`}
                        >
                          <Users aria-hidden="true" />
                          <span className="font-mono tabular-nums">{evento.checkin_count}</span>
                          check-ins
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="flex-1"
                          loading={togglingId === evento.id}
                          onClick={() => handleToggleStatus(evento)}
                          aria-label={`${evento.checkin_status === 'aberto' ? 'Bloquear' : 'Abrir'} check-in de ${evento.titulo}`}
                        >
                          {togglingId === evento.id ? null : evento.checkin_status === 'aberto' ? (
                            <Lock aria-hidden="true" />
                          ) : (
                            <Unlock aria-hidden="true" />
                          )}
                          {evento.checkin_status === 'aberto' ? 'Bloquear' : 'Abrir'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(evento)}
                          aria-label={`Editar ${evento.titulo}`}
                        >
                          <Edit3 aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDuplicate(evento)}
                          aria-label={`Duplicar ${evento.titulo} para a semana seguinte`}
                        >
                          <Copy aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(evento)}
                          aria-label={`Excluir ${evento.titulo}`}
                          className="hover:bg-danger-soft hover:text-danger"
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                    }
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>


      {/* ── CRIAR / EDITAR ── */}
      <ResponsiveModal
        open={modalOpen}
        onOpenChange={(open) => {
          if (!open && !saving) setModalOpen(false)
        }}
        dismissible={!saving}
        size="lg"
        title={editingId ? 'Editar evento' : 'Novo evento'}
        description={
          editingId
            ? 'As alterações valem imediatamente para o check-in e para a escala.'
            : 'O evento aparece no check-in dos insiders assim que o status estiver aberto.'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving} block className="sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={handleSave} loading={saving} block className="sm:w-auto">
              {editingId ? 'Salvar alterações' : 'Criar evento'}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <section>
            <SectionTitle as="h3" title="Dados do evento" className="mb-3" />

            <div className="space-y-4">
              <fieldset>
                <legend className="mb-1.5 text-meta font-medium text-ink-muted">Tipo de evento</legend>
                <div className="flex gap-2">
                  {(['corrida', 'personalizado'] as const).map(tipo => (
                    <button
                      key={tipo}
                      type="button"
                      aria-pressed={form.tipo === tipo}
                      onClick={() => setForm(f => ({
                        ...f,
                        tipo,
                        pelotoes: tipo === 'personalizado' ? [] : (f.pelotoes.length === 0 ? ['4km', '6km', '8km'] : f.pelotoes),
                      }))}
                      className={`ds-tap flex-1 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${
                        form.tipo === tipo
                          ? 'border-brand-border bg-brand-soft text-brand-strong'
                          : 'border-line bg-surface-sunken text-ink-muted hover:border-line-strong hover:text-ink'
                      }`}
                    >
                      {tipo === 'corrida' ? 'Corrida' : 'Personalizado'}
                    </button>
                  ))}
                </div>
              </fieldset>

              <Field
                label="Título *"
                htmlFor={id('titulo')}
                error={fieldErrors.titulo}
                errorId={id('titulo-err')}
              >
                <Input
                  id={id('titulo')}
                  value={form.titulo}
                  onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                  placeholder="Ex.: Somma Club — Edição #04 de Março"
                  required
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.titulo)}
                  aria-describedby={fieldErrors.titulo ? id('titulo-err') : undefined}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Data *"
                  htmlFor={id('data')}
                  error={fieldErrors.data_evento}
                  errorId={id('data-err')}
                >
                  <Input
                    id={id('data')}
                    type="date"
                    value={form.data_evento}
                    onChange={e => setForm(f => ({ ...f, data_evento: e.target.value }))}
                    required
                    aria-required="true"
                    aria-invalid={Boolean(fieldErrors.data_evento)}
                    aria-describedby={fieldErrors.data_evento ? id('data-err') : undefined}
                  />
                </Field>
                <Field label="Horário de início" htmlFor={id('hora')}>
                  <Input
                    id={id('hora')}
                    type="time"
                    value={form.horario_inicio}
                    onChange={e => setForm(f => ({ ...f, horario_inicio: e.target.value }))}
                  />
                </Field>
              </div>

              <Field label="Local" htmlFor={id('local')}>
                <Input
                  id={id('local')}
                  value={form.local}
                  onChange={e => setForm(f => ({ ...f, local: e.target.value }))}
                  placeholder="Parque da Cidade — Brasília, DF"
                />
              </Field>

              <Field
                label="Link do endereço"
                htmlFor={id('local-url')}
                hint="Abre o mapa direto no celular do insider."
                errorId={id('local-url-hint')}
              >
                <Input
                  id={id('local-url')}
                  type="url"
                  inputMode="url"
                  value={form.local_url}
                  onChange={e => setForm(f => ({ ...f, local_url: e.target.value }))}
                  placeholder="https://maps.app.goo.gl/..."
                  aria-describedby={id('local-url-hint')}
                />
              </Field>

              <Field label="Descrição" htmlFor={id('descricao')}>
                <textarea
                  id={id('descricao')}
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  rows={3}
                  placeholder="Percurso, orientações, ponto de encontro..."
                  className={`${FIELD_CLASS} resize-none`}
                />
              </Field>
            </div>
          </section>

          {form.tipo === 'corrida' ? (
            <section>
              <SectionTitle as="h3" title="Pelotões" className="mb-3" />

              {form.pelotoes.length > 0 ? (
                <ul className="mb-2.5 flex flex-wrap gap-2">
                  {form.pelotoes.map(p => (
                    <li
                      key={p}
                      className="inline-flex items-center gap-1 rounded-full border border-brand-border bg-brand-soft py-1 pl-3 pr-1 text-xs font-medium text-brand-strong"
                    >
                      {p}
                      <button
                        type="button"
                        onClick={() => removePelotao(p)}
                        aria-label={`Remover pelotão ${p}`}
                        className="flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-brand/20"
                      >
                        <X aria-hidden="true" className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mb-2.5 text-meta text-ink-subtle">Nenhum pelotão definido para este evento.</p>
              )}

              <div className="flex gap-2">
                <label htmlFor={id('novo-pelotao')} className="sr-only">Adicionar pelotão</label>
                <Input
                  id={id('novo-pelotao')}
                  value={newPelotao}
                  onChange={e => setNewPelotao(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPelotao() } }}
                  placeholder="Ex.: 10km"
                  enterKeyHint="done"
                />
                <Button type="button" variant="secondary" onClick={addPelotao} aria-label="Adicionar pelotão">
                  <Plus aria-hidden="true" />
                </Button>
              </div>
            </section>
          ) : null}

          <section>
            <SectionTitle
              as="h3"
              title="Agendamento do check-in"
              className="mb-3"
              meta="Opcional"
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Abertura automática" htmlFor={id('abertura')}>
                <Input
                  id={id('abertura')}
                  type="datetime-local"
                  value={form.checkin_abertura}
                  onChange={e => setForm(f => ({ ...f, checkin_abertura: e.target.value }))}
                />
              </Field>
              <Field label="Fechamento automático" htmlFor={id('fechamento')}>
                <Input
                  id={id('fechamento')}
                  type="datetime-local"
                  value={form.checkin_fechamento}
                  onChange={e => setForm(f => ({ ...f, checkin_fechamento: e.target.value }))}
                />
              </Field>
            </div>

            <fieldset className="mt-4">
              <legend className="mb-1.5 text-meta font-medium text-ink-muted">Status manual</legend>
              <div className="flex flex-wrap gap-2">
                {STATUS_ORDER.map(status => {
                  const s = STATUS_CONFIG[status]
                  const Icon = s.icon
                  const selected = form.checkin_status === status
                  return (
                    <button
                      key={status}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setForm(f => ({ ...f, checkin_status: status }))}
                      className={`ds-tap flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${
                        selected
                          ? 'border-brand-border bg-brand-soft text-brand-strong'
                          : 'border-line bg-surface-sunken text-ink-muted hover:border-line-strong hover:text-ink'
                      }`}
                    >
                      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                      {s.label}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          </section>

          {saveError ? (
            <p role="alert" className="rounded-lg border border-danger-border bg-danger-soft px-3 py-2.5 text-meta font-medium text-danger">
              {saveError}
            </p>
          ) : null}

          <p className="flex items-start gap-2 text-meta text-ink-subtle">
            <CalendarDays aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Depois de criar o evento, monte a escala dos insiders no módulo Escala.
          </p>
        </div>
      </ResponsiveModal>
    </PageShell>
  )
}

