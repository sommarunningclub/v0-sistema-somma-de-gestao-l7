'use client'

import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react"
import { apiFetch } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import {
  AlertCircle,
  BadgeCheck,
  Download,
  Dumbbell,
  Pencil,
  Plus,
  RefreshCw,
  Ticket,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
} from "lucide-react"
import { searchAndRank } from "@/lib/search-utils"
import { idadeDeNascimento } from '@/lib/insider/admin-write'
import {
  TAMANHOS_CAMISA,
  isoToBrDate,
  maskCep,
  maskCpf,
  maskDate,
  maskPhone,
  maskUf,
} from '@/lib/insider/validation'
import {
  CardListSkeleton,
  EmptyState,
  MobileRecordCard,
  NoResultsState,
  PageHeader,
  PageShell,
  ResponsiveModal,
  SearchInput,
  SectionTitle,
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
  TablePagination,
  TableSkeleton,
  Toolbar,
  Well,
  confirmAction,
  notify,
} from '@/components/somma'

interface Insider {
  id: string
  nome: string
  cpf: string
  email: string | null
  telefone: string | null
  data_nascimento: string | null
  sexo: string | null
  tamanho_camisa: string | null
  foto_url: string | null
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  evolve: string | null
  dopahmina: string | null
  tex_barbearia: string | null
  big_box: string | null
  cupom_loja_somma: string | null
  assessoria_somma: string | null
  estamina_recovery: string | null
  consent_lgpd: boolean | null
  consent_imagem: boolean | null
  ativo: boolean | null
}

type InsiderForm = {
  nome: string
  cpf: string
  email: string
  telefone: string
  data_nascimento: string
  sexo: string
  tamanho_camisa: string
  foto_url: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
  evolve: string
  dopahmina: string
  tex_barbearia: string
  big_box: string
  cupom_loja_somma: string
  assessoria_somma: string
  estamina_recovery: string
  ativo: boolean
}

const EMPTY_FORM: InsiderForm = {
  nome: '',
  cpf: '',
  email: '',
  telefone: '',
  data_nascimento: '',
  sexo: '',
  tamanho_camisa: '',
  foto_url: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  evolve: '',
  dopahmina: '',
  tex_barbearia: '',
  big_box: '',
  cupom_loja_somma: '',
  assessoria_somma: '',
  estamina_recovery: '',
  ativo: true,
}

const BENEFIT_FIELDS: Array<{ key: keyof InsiderForm; label: string; placeholder: string }> = [
  { key: 'evolve', label: 'Evolve', placeholder: 'ex: VIP, Premium' },
  { key: 'dopahmina', label: 'Dopamina', placeholder: 'Código ou benefício' },
  { key: 'tex_barbearia', label: 'Tex Barbearia', placeholder: 'Desconto ou código' },
  { key: 'big_box', label: 'Big Box', placeholder: 'Desconto ou código' },
]

const SOMMA_FIELDS: Array<{ key: keyof InsiderForm; label: string; placeholder: string }> = [
  { key: 'cupom_loja_somma', label: 'Cupom Somma', placeholder: 'Código do cupom' },
  { key: 'assessoria_somma', label: 'Assessoria Somma', placeholder: 'Descrição do benefício' },
  { key: 'estamina_recovery', label: 'Estamina Recovery', placeholder: 'Voucher ou descrição' },
]

const ADDRESS_FIELDS: Array<{ key: keyof InsiderForm; label: string; placeholder: string; span?: boolean }> = [
  { key: 'cep', label: 'CEP', placeholder: '00000-000' },
  { key: 'estado', label: 'UF', placeholder: 'DF' },
  { key: 'logradouro', label: 'Logradouro', placeholder: 'Rua, avenida...', span: true },
  { key: 'numero', label: 'Número', placeholder: '123' },
  { key: 'complemento', label: 'Complemento', placeholder: 'Apto, bloco...' },
  { key: 'bairro', label: 'Bairro', placeholder: 'Bairro' },
  { key: 'cidade', label: 'Cidade', placeholder: 'Cidade' },
]

const PAGE_SIZE = 20
const BENEFIT_TOTAL = BENEFIT_FIELDS.length + SOMMA_FIELDS.length

const inputLabel = 'mb-1.5 block text-meta font-medium text-ink-muted'
const selectClass =
  'flex h-11 w-full rounded-lg border border-line bg-surface-sunken px-3.5 text-base text-ink transition-colors hover:border-line-strong focus-visible:border-brand focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand lg:h-10 lg:text-sm'

function texto(value: string | null | undefined): string {
  return value ?? ''
}

function isAtivo(insider: Pick<Insider, 'ativo'>): boolean {
  return insider.ativo !== false
}

function formFromInsider(insider: Insider): InsiderForm {
  return {
    nome: texto(insider.nome),
    cpf: texto(insider.cpf),
    email: texto(insider.email),
    telefone: texto(insider.telefone),
    data_nascimento: isoToBrDate(insider.data_nascimento),
    sexo: texto(insider.sexo),
    tamanho_camisa: texto(insider.tamanho_camisa),
    foto_url: texto(insider.foto_url),
    cep: texto(insider.cep),
    logradouro: texto(insider.logradouro),
    numero: texto(insider.numero),
    complemento: texto(insider.complemento),
    bairro: texto(insider.bairro),
    cidade: texto(insider.cidade),
    estado: texto(insider.estado),
    evolve: texto(insider.evolve),
    dopahmina: texto(insider.dopahmina),
    tex_barbearia: texto(insider.tex_barbearia),
    big_box: texto(insider.big_box),
    cupom_loja_somma: texto(insider.cupom_loja_somma),
    assessoria_somma: texto(insider.assessoria_somma),
    estamina_recovery: texto(insider.estamina_recovery),
    ativo: isAtivo(insider),
  }
}

function rotuloSexo(value: string | null | undefined): string {
  if (value === 'masculino') return 'Masculino'
  if (value === 'feminino') return 'Feminino'
  return value?.trim() || '—'
}

function rotuloNascimento(iso: string | null | undefined): string {
  return isoToBrDate(iso) || '—'
}

function rotuloIdade(iso: string | null | undefined): string {
  const idade = idadeDeNascimento(iso)
  if (idade == null) return '—'
  return idade === 1 ? '1 ano' : `${idade} anos`
}

function rotuloSimNao(value: boolean | null | undefined): string {
  if (value === true) return 'Sim'
  if (value === false) return 'Não'
  return '—'
}

function Dado({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="ds-eyebrow">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-ink">{value || '—'}</dd>
    </div>
  )
}

export default function InsidersPage() {
  const [insiders, setInsiders] = useState<Insider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const [selectedInsider, setSelectedInsider] = useState<Insider | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingInsider, setEditingInsider] = useState<Insider | null>(null)
  const [creating, setCreating] = useState(false)
  const [page, setPage] = useState(1)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof InsiderForm, string>>>({})
  const [formData, setFormData] = useState<InsiderForm>(EMPTY_FORM)
  const [formBaseline, setFormBaseline] = useState<InsiderForm>(EMPTY_FORM)

  const fetchInsiders = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await apiFetch("/api/insiders")
      const body = await res.json().catch(() => ({}))

      if (!res.ok) {
        console.error("[insiders] Error fetching insiders:", body)
        setError(body?.error || `Erro ao carregar insiders (HTTP ${res.status})`)
        return
      }

      setInsiders(body.data || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar insiders'
      console.error("[insiders] Error fetching insiders:", err)
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInsiders()
  }, [fetchInsiders])

  const upsertLocal = (atualizado: Insider) => {
    setInsiders((current) => current.map((i) => (i.id === atualizado.id ? atualizado : i)))
    setSelectedInsider((current) => (current?.id === atualizado.id ? atualizado : current))
  }

  const handleDelete = async (insider: Insider) => {
    const confirmed = await confirmAction({
      title: 'Excluir insider?',
      description: 'Esta ação não pode ser desfeita. Prefira inativar se quiser preservar o histórico.',
      detail: insider.nome,
      tone: 'danger',
    })
    if (!confirmed) return

    try {
      const res = await apiFetch(`/api/insiders/${insider.id}`, { method: "DELETE" })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        console.error("[insiders] Error deleting insider:", body)
        notify.error(body?.error || "Erro ao deletar insider")
        return
      }

      setInsiders((current) => current.filter((i) => i.id !== insider.id))
      setSelectedInsider(null)
      notify.success('Insider excluído')
    } catch (err) {
      console.error("[insiders] Error deleting insider:", err)
      notify.error("Erro ao deletar insider")
    }
  }

  const handleSetAtivo = async (insider: Insider, ativo: boolean) => {
    if (!ativo) {
      const confirmed = await confirmAction({
        title: 'Inativar insider?',
        description: 'O insider some da escala e do ranking e não entra no portal. O cadastro e o histórico ficam salvos.',
        detail: insider.nome,
        confirmLabel: 'Inativar',
        tone: 'danger',
      })
      if (!confirmed) return
    }

    try {
      const res = await apiFetch(`/api/insiders/${insider.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body.data) {
        notify.error(body?.error || 'Erro ao atualizar o status')
        return
      }
      upsertLocal(body.data)
      notify.success(ativo ? 'Insider reativado' : 'Insider inativado')
    } catch (err) {
      console.error('[insiders] Erro ao alterar status:', err)
      notify.error('Erro ao atualizar o status')
    }
  }

  const openEditInsider = (insider: Insider) => {
    const valores = formFromInsider(insider)
    setFormData(valores)
    setFormBaseline(valores)
    setFormErrors({})
    setEditingInsider(insider)
    setSelectedInsider(null)
    setShowCreateModal(true)
  }

  const openCreateInsider = () => {
    setFormData(EMPTY_FORM)
    setFormBaseline(EMPTY_FORM)
    setFormErrors({})
    setEditingInsider(null)
    setShowCreateModal(true)
  }

  const handleSaveInsider = async () => {
    const errors: Partial<Record<keyof InsiderForm, string>> = {}
    if (!formData.nome.trim()) errors.nome = 'Nome é obrigatório'
    if (!formData.cpf.trim()) errors.cpf = 'CPF é obrigatório'
    if (formData.data_nascimento && formData.data_nascimento.length < 10) {
      errors.data_nascimento = 'Use DD/MM/AAAA'
    }
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) {
      document.getElementById(`insider-${Object.keys(errors)[0]}`)?.focus()
      return
    }

    const editando = editingInsider !== null
    setCreating(true)
    try {
      const res = await apiFetch(
        editando ? `/api/insiders/${editingInsider.id}` : '/api/insiders',
        {
          method: editando ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        },
      )
      const body = await res.json().catch(() => ({}))

      if (!res.ok) {
        console.error('[insiders] Erro ao salvar insider:', body)
        notify.error(editando ? 'Erro ao salvar alterações' : 'Erro ao criar insider', {
          description: body?.error || `HTTP ${res.status}`,
        })
        setCreating(false)
        return
      }

      if (body.data) {
        setInsiders((current) =>
          editando
            ? current.map((i) => (i.id === body.data.id ? body.data : i))
            : [...current, body.data],
        )
        setFormData(EMPTY_FORM)
        setFormBaseline(EMPTY_FORM)
        setFormErrors({})
        setEditingInsider(null)
        setShowCreateModal(false)
        notify.success(editando ? 'Alterações salvas' : 'Insider cadastrado com sucesso')
      }
    } catch (err) {
      console.error('[insiders] Erro ao salvar insider:', err)
      notify.error(editando ? 'Erro ao salvar alterações' : 'Erro ao criar insider')
    } finally {
      setCreating(false)
    }
  }

  const isFormDirty = useMemo(
    () =>
      (Object.keys(EMPTY_FORM) as Array<keyof InsiderForm>).some(
        (key) => formData[key] !== formBaseline[key],
      ),
    [formData, formBaseline],
  )

  const requestCloseCreate = async () => {
    if (isFormDirty) {
      const confirmed = await confirmAction({
        title: editingInsider ? 'Descartar alterações?' : 'Descartar cadastro?',
        description: editingInsider
          ? 'As alterações feitas neste insider não foram salvas e serão perdidas.'
          : 'Os dados preenchidos não foram salvos e serão perdidos.',
        confirmLabel: 'Descartar',
        cancelLabel: 'Continuar editando',
        tone: 'danger',
      })
      if (!confirmed) return
    }
    setFormData(EMPTY_FORM)
    setFormBaseline(EMPTY_FORM)
    setFormErrors({})
    setEditingInsider(null)
    setShowCreateModal(false)
  }

  const filteredInsiders = useMemo(() => {
    const base = mostrarInativos ? insiders : insiders.filter(isAtivo)
    return searchAndRank(base, searchTerm, (insider) => [
      insider.nome,
      insider.cpf,
      insider.email,
      insider.telefone,
    ])
  }, [insiders, searchTerm, mostrarInativos])

  useEffect(() => {
    setPage(1)
  }, [searchTerm, mostrarInativos])

  const pagedInsiders = useMemo(
    () => filteredInsiders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredInsiders, page],
  )

  const stats = useMemo(() => {
    const ativos = insiders.filter(isAtivo)
    return {
      total: ativos.length,
      inativos: insiders.length - ativos.length,
      evolve: ativos.filter((i) => i.evolve).length,
      cupom: ativos.filter((i) => i.cupom_loja_somma).length,
      assessoria: ativos.filter((i) => i.assessoria_somma).length,
    }
  }, [insiders])

  const exportToCSV = () => {
    const headers = [
      'Nome', 'CPF', 'E-mail', 'Telefone', 'Nascimento', 'Idade', 'Sexo',
      'Camiseta', 'CEP', 'Logradouro', 'Número', 'Complemento', 'Bairro', 'Cidade', 'UF',
      'Evolve', 'Dopamina', 'Tex Barbearia', 'Big Box', 'Cupom Somma', 'Assessoria Somma',
      'Estamina Recovery', 'Ativo',
    ]
    const data = filteredInsiders.map((i) => [
      i.nome,
      i.cpf,
      i.email || '—',
      i.telefone || '—',
      rotuloNascimento(i.data_nascimento),
      rotuloIdade(i.data_nascimento),
      rotuloSexo(i.sexo),
      i.tamanho_camisa || '—',
      i.cep || '—',
      i.logradouro || '—',
      i.numero || '—',
      i.complemento || '—',
      i.bairro || '—',
      i.cidade || '—',
      i.estado || '—',
      i.evolve || '—',
      i.dopahmina || '—',
      i.tex_barbearia || '—',
      i.big_box || '—',
      i.cupom_loja_somma || '—',
      i.assessoria_somma || '—',
      i.estamina_recovery || '—',
      isAtivo(i) ? 'Sim' : 'Não',
    ])

    const csv = [headers, ...data].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `insiders-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    notify.success('Exportação gerada', { description: `${filteredInsiders.length} registros.` })
  }

  const setField = (key: keyof InsiderForm, value: string) => {
    setFormData((current) => ({ ...current, [key]: value }))
    setFormErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  const benefitCount = (insider: Insider) =>
    [insider.evolve, insider.dopahmina, insider.tex_barbearia, insider.big_box,
      insider.cupom_loja_somma, insider.assessoria_somma, insider.estamina_recovery].filter(Boolean).length

  const inativarId = useId()

  return (
    <PageShell>
      <PageHeader
        eyebrow="Relacionamento"
        title="Insiders"
        description="Cadastro completo dos membros VIP, benefícios e situação de cada um."
        meta={
          <>
            <span>
              <span className="font-mono tabular-nums text-ink">{filteredInsiders.length}</span>{' '}
              {filteredInsiders.length === 1 ? 'insider' : 'insiders'} listados
            </span>
            <span>
              <span className="font-mono tabular-nums text-ink">{stats.cupom}</span> com cupom
            </span>
          </>
        }
        actions={
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchInsiders}
              disabled={loading}
              aria-label="Recarregar insiders"
            >
              <RefreshCw aria-hidden="true" className={loading ? 'animate-spin' : undefined} />
            </Button>
            <Button variant="secondary" size="sm" onClick={exportToCSV} disabled={filteredInsiders.length === 0}>
              <Download aria-hidden="true" />
              <span className="hidden sm:inline">Exportar CSV</span>
              <span className="sm:hidden">CSV</span>
            </Button>
          </>
        }
        primaryAction={
          <Button onClick={openCreateInsider}>
            <Plus aria-hidden="true" />
            Novo insider
          </Button>
        }
      />

      <div className="space-y-5">
        {error ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger-border bg-danger-soft p-3.5"
          >
            <p className="flex min-w-0 items-center gap-2 text-sm text-danger">
              <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span className="truncate">{error}</span>
            </p>
            <Button variant="ghost" size="sm" onClick={fetchInsiders} className="text-danger">
              <RefreshCw aria-hidden="true" />
              Tentar novamente
            </Button>
          </div>
        ) : null}

        {loading ? (
          <StatGridSkeleton count={4} />
        ) : (
          <StatGrid>
            <StatTile label="Ativos" value={stats.total} icon={Users} hint="Insiders no clube" />
            <StatTile label="Com Evolve" value={stats.evolve} icon={Dumbbell} tone="brand" />
            <StatTile label="Com cupom" value={stats.cupom} icon={Ticket} />
            <StatTile
              label="Inativos"
              value={stats.inativos}
              icon={UserMinus}
              hint="Ocultos da escala"
            />
          </StatGrid>
        )}

        <Toolbar>
          <SearchInput
            value={searchTerm}
            onValueChange={setSearchTerm}
            placeholder="Buscar por nome, CPF, e-mail ou telefone..."
            label="Buscar insiders"
          />
          <label className="ds-tap inline-flex items-center gap-2 rounded-lg border border-line bg-surface-raised px-3 text-sm text-ink">
            <Checkbox
              checked={mostrarInativos}
              onCheckedChange={(value) => setMostrarInativos(value === true)}
              aria-label="Mostrar insiders inativos"
            />
            Mostrar inativos
          </label>
        </Toolbar>

        {loading ? (
          <>
            <div className="lg:hidden">
              <CardListSkeleton count={4} />
            </div>
            <div className="hidden lg:block">
              <TableSkeleton rows={6} columns={6} />
            </div>
          </>
        ) : filteredInsiders.length === 0 ? (
          insiders.filter((i) => mostrarInativos || isAtivo(i)).length === 0 ? (
            <EmptyState
              icon={BadgeCheck}
              title="Nenhum insider cadastrado"
              description="Cadastre o primeiro insider para controlar os benefícios da comunidade VIP."
              action={
                <Button onClick={openCreateInsider}>
                  <Plus aria-hidden="true" />
                  Cadastrar primeiro insider
                </Button>
              }
            />
          ) : (
            <NoResultsState query={searchTerm} onClear={() => setSearchTerm('')} />
          )
        ) : (
          <>
            <ul className="space-y-3 lg:hidden">
              {pagedInsiders.map((insider) => (
                <li key={insider.id}>
                  <MobileRecordCard
                    title={insider.nome}
                    subtitle={insider.cpf}
                    status={
                      <StatusPill tone={isAtivo(insider) ? 'success' : 'neutral'}>
                        {isAtivo(insider) ? 'Ativo' : 'Inativo'}
                      </StatusPill>
                    }
                    fields={[
                      { label: 'Nascimento', value: rotuloNascimento(insider.data_nascimento) },
                      { label: 'Idade', value: rotuloIdade(insider.data_nascimento) },
                      { label: 'E-mail', value: insider.email || '—' },
                      { label: 'Camiseta', value: insider.tamanho_camisa || '—' },
                    ]}
                    onClick={() => setSelectedInsider(insider)}
                    actions={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto"
                        aria-label={isAtivo(insider) ? `Inativar ${insider.nome}` : `Reativar ${insider.nome}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          void handleSetAtivo(insider, !isAtivo(insider))
                        }}
                      >
                        {isAtivo(insider) ? <UserMinus aria-hidden="true" /> : <UserCheck aria-hidden="true" />}
                        {isAtivo(insider) ? 'Inativar' : 'Reativar'}
                      </Button>
                    }
                  />
                </li>
              ))}
            </ul>

            <TableFrame className="hidden lg:block">
              <Table caption="Insiders cadastrados, com nascimento, idade, status e benefícios.">
                <THead>
                  <TH>Insider</TH>
                  <TH>Nascimento</TH>
                  <TH>Idade</TH>
                  <TH>Status</TH>
                  <TH>Camiseta</TH>
                  <TH>Benefícios</TH>
                  <TH align="right">Ações</TH>
                </THead>
                <TBody>
                  {pagedInsiders.map((insider) => (
                    <TR key={insider.id} onClick={() => setSelectedInsider(insider)}>
                      <TD>
                        <span className="block truncate font-medium text-ink-strong">{insider.nome}</span>
                        <span className="block font-mono text-micro text-ink-subtle">{insider.cpf}</span>
                      </TD>
                      <TD className="font-mono tabular-nums">{rotuloNascimento(insider.data_nascimento)}</TD>
                      <TD className="tabular-nums">{rotuloIdade(insider.data_nascimento)}</TD>
                      <TD>
                        <StatusPill tone={isAtivo(insider) ? 'success' : 'neutral'}>
                          {isAtivo(insider) ? 'Ativo' : 'Inativo'}
                        </StatusPill>
                      </TD>
                      <TD>{insider.tamanho_camisa || <span className="text-ink-subtle">—</span>}</TD>
                      <TD>
                        <StatusPill tone={benefitCount(insider) > 0 ? 'success' : 'neutral'}>
                          {benefitCount(insider)} de {BENEFIT_TOTAL}
                        </StatusPill>
                      </TD>
                      <TD align="right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={isAtivo(insider) ? `Inativar ${insider.nome}` : `Reativar ${insider.nome}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            void handleSetAtivo(insider, !isAtivo(insider))
                          }}
                        >
                          {isAtivo(insider) ? <UserMinus aria-hidden="true" /> : <UserCheck aria-hidden="true" />}
                        </Button>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              <TablePagination
                page={page}
                pageSize={PAGE_SIZE}
                total={filteredInsiders.length}
                onPageChange={setPage}
              />
            </TableFrame>

            <div className="lg:hidden">
              <TablePagination
                page={page}
                pageSize={PAGE_SIZE}
                total={filteredInsiders.length}
                onPageChange={setPage}
                className="rounded-xl border border-line bg-surface-raised"
              />
            </div>
          </>
        )}
      </div>

      <ResponsiveModal
        open={!!selectedInsider}
        onOpenChange={(open) => {
          if (!open) setSelectedInsider(null)
        }}
        size="lg"
        title={selectedInsider?.nome ?? 'Insider'}
        description={selectedInsider?.cpf}
        footer={
          selectedInsider ? (
            <>
              <Button
                variant="destructive"
                block
                className="sm:w-auto"
                onClick={() => handleDelete(selectedInsider)}
              >
                <Trash2 aria-hidden="true" />
                Excluir
              </Button>
              <Button
                variant="secondary"
                block
                className="sm:w-auto"
                onClick={() => void handleSetAtivo(selectedInsider, !isAtivo(selectedInsider))}
              >
                {isAtivo(selectedInsider) ? <UserMinus aria-hidden="true" /> : <UserCheck aria-hidden="true" />}
                {isAtivo(selectedInsider) ? 'Inativar' : 'Reativar'}
              </Button>
              <Button block className="sm:w-auto" onClick={() => openEditInsider(selectedInsider)}>
                <Pencil aria-hidden="true" />
                Editar
              </Button>
            </>
          ) : null
        }
      >
        {selectedInsider ? (
          <div className="space-y-5">
            <section>
              <SectionTitle as="h3" title="Identificação" />
              <Well className="p-4">
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Dado label="Nome" value={selectedInsider.nome} />
                  <Dado label="CPF" value={<span className="font-mono">{selectedInsider.cpf}</span>} />
                  <Dado label="Nascimento" value={rotuloNascimento(selectedInsider.data_nascimento)} />
                  <Dado label="Idade" value={rotuloIdade(selectedInsider.data_nascimento)} />
                  <Dado label="Sexo" value={rotuloSexo(selectedInsider.sexo)} />
                  <Dado label="E-mail" value={selectedInsider.email} />
                  <Dado label="Telefone" value={selectedInsider.telefone} />
                  <Dado label="Tamanho da camiseta" value={selectedInsider.tamanho_camisa} />
                  <Dado
                    label="Status"
                    value={
                      <StatusPill tone={isAtivo(selectedInsider) ? 'success' : 'neutral'}>
                        {isAtivo(selectedInsider) ? 'Ativo' : 'Inativo'}
                      </StatusPill>
                    }
                  />
                  <Dado
                    label="Foto"
                    value={
                      selectedInsider.foto_url ? (
                        <a
                          href={selectedInsider.foto_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand underline-offset-2 hover:underline"
                        >
                          Abrir URL
                        </a>
                      ) : (
                        '—'
                      )
                    }
                  />
                  <Dado label="Consentimento LGPD" value={rotuloSimNao(selectedInsider.consent_lgpd)} />
                  <Dado label="Uso de imagem" value={rotuloSimNao(selectedInsider.consent_imagem)} />
                </dl>
              </Well>
            </section>

            <section>
              <SectionTitle as="h3" title="Endereço" />
              <Well className="p-4">
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Dado label="CEP" value={selectedInsider.cep} />
                  <Dado label="UF" value={selectedInsider.estado} />
                  <Dado label="Logradouro" value={selectedInsider.logradouro} />
                  <Dado label="Número" value={selectedInsider.numero} />
                  <Dado label="Complemento" value={selectedInsider.complemento} />
                  <Dado label="Bairro" value={selectedInsider.bairro} />
                  <Dado label="Cidade" value={selectedInsider.cidade} />
                </dl>
              </Well>
            </section>

            <section>
              <SectionTitle as="h3" title="Benefícios de parceiros" />
              <Well className="p-4">
                <dl className="grid gap-4 sm:grid-cols-2">
                  {BENEFIT_FIELDS.map((field) => (
                    <Dado key={field.key} label={field.label} value={selectedInsider[field.key as keyof Insider]} />
                  ))}
                </dl>
              </Well>
            </section>

            <section>
              <SectionTitle as="h3" title="Benefícios Somma" />
              <Well className="p-4">
                <dl className="grid gap-4 sm:grid-cols-2">
                  {SOMMA_FIELDS.map((field) => (
                    <Dado key={field.key} label={field.label} value={selectedInsider[field.key as keyof Insider]} />
                  ))}
                </dl>
              </Well>
            </section>
          </div>
        ) : null}
      </ResponsiveModal>

      <ResponsiveModal
        open={showCreateModal}
        onOpenChange={(open) => {
          if (!open) requestCloseCreate()
        }}
        size="lg"
        dismissible={false}
        title={editingInsider ? 'Editar insider' : 'Novo insider'}
        description={
          editingInsider
            ? 'Atualize os dados pessoais, o endereço e os benefícios deste insider.'
            : 'Cadastre o membro VIP. Só nome e CPF são obrigatórios agora.'
        }
        footer={
          <>
            <Button variant="secondary" block className="sm:w-auto" onClick={requestCloseCreate}>
              Cancelar
            </Button>
            <Button
              block
              className="sm:w-auto"
              loading={creating}
              disabled={Boolean(editingInsider) && !isFormDirty}
              onClick={handleSaveInsider}
            >
              {editingInsider ? 'Salvar alterações' : 'Criar insider'}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <section>
            <SectionTitle as="h3" title="Dados básicos" meta="Nome e CPF obrigatórios" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="insider-nome" className={inputLabel}>
                  Nome <span className="text-danger">*</span>
                </label>
                <Input
                  id="insider-nome"
                  type="text"
                  autoComplete="name"
                  placeholder="Nome completo"
                  value={formData.nome}
                  aria-invalid={formErrors.nome ? true : undefined}
                  onChange={(e) => setField('nome', e.target.value)}
                />
                {formErrors.nome ? (
                  <p className="mt-1.5 flex items-center gap-1.5 text-meta text-danger">
                    <AlertCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    {formErrors.nome}
                  </p>
                ) : null}
              </div>
              <div>
                <label htmlFor="insider-cpf" className={inputLabel}>
                  CPF <span className="text-danger">*</span>
                </label>
                <Input
                  id="insider-cpf"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="000.000.000-00"
                  value={formData.cpf}
                  aria-invalid={formErrors.cpf ? true : undefined}
                  onChange={(e) => setField('cpf', maskCpf(e.target.value))}
                  className="font-mono"
                />
                {formErrors.cpf ? (
                  <p className="mt-1.5 flex items-center gap-1.5 text-meta text-danger">
                    <AlertCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    {formErrors.cpf}
                  </p>
                ) : null}
              </div>
              <div>
                <label htmlFor="insider-data_nascimento" className={inputLabel}>
                  Data de nascimento
                </label>
                <Input
                  id="insider-data_nascimento"
                  type="text"
                  inputMode="numeric"
                  placeholder="DD/MM/AAAA"
                  value={formData.data_nascimento}
                  aria-invalid={formErrors.data_nascimento ? true : undefined}
                  onChange={(e) => setField('data_nascimento', maskDate(e.target.value))}
                  className="font-mono"
                />
                {formErrors.data_nascimento ? (
                  <p className="mt-1.5 flex items-center gap-1.5 text-meta text-danger">
                    <AlertCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    {formErrors.data_nascimento}
                  </p>
                ) : null}
              </div>
              <div>
                <label htmlFor="insider-sexo" className={inputLabel}>
                  Sexo
                </label>
                <select
                  id="insider-sexo"
                  value={formData.sexo}
                  onChange={(e) => setField('sexo', e.target.value)}
                  className={selectClass}
                >
                  <option value="">Selecione</option>
                  <option value="masculino">Masculino</option>
                  <option value="feminino">Feminino</option>
                </select>
              </div>
              <div>
                <label htmlFor="insider-email" className={inputLabel}>
                  E-mail
                </label>
                <Input
                  id="insider-email"
                  type="email"
                  autoComplete="email"
                  placeholder="email@exemplo.com"
                  value={formData.email}
                  onChange={(e) => setField('email', e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="insider-telefone" className={inputLabel}>
                  Telefone
                </label>
                <Input
                  id="insider-telefone"
                  type="tel"
                  inputMode="tel"
                  placeholder="(61) 99999-0000"
                  value={formData.telefone}
                  onChange={(e) => setField('telefone', maskPhone(e.target.value))}
                />
              </div>
              <div>
                <label htmlFor="insider-tamanho" className={inputLabel}>
                  Tamanho da camiseta
                </label>
                <select
                  id="insider-tamanho"
                  value={formData.tamanho_camisa}
                  onChange={(e) => setField('tamanho_camisa', e.target.value)}
                  className={selectClass}
                >
                  <option value="">Selecione uma opção</option>
                  {TAMANHOS_CAMISA.map((tamanho) => (
                    <option key={tamanho} value={tamanho}>
                      {tamanho}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="insider-foto_url" className={inputLabel}>
                  URL da foto
                </label>
                <Input
                  id="insider-foto_url"
                  type="url"
                  placeholder="https://"
                  value={formData.foto_url}
                  onChange={(e) => setField('foto_url', e.target.value)}
                />
              </div>
              <div className="sm:col-span-2 flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-sunken px-3.5 py-3">
                <div>
                  <p className="text-sm font-medium text-ink-strong">Insider ativo</p>
                  <p className="text-meta text-ink-muted">
                    Inativos saem da escala, do ranking e do portal.
                  </p>
                </div>
                <Switch
                  id={inativarId}
                  checked={formData.ativo}
                  onCheckedChange={(checked) =>
                    setFormData((current) => ({ ...current, ativo: checked }))
                  }
                  aria-label="Insider ativo"
                />
              </div>
            </div>
          </section>

          <section>
            <SectionTitle as="h3" title="Endereço" meta="Opcional" />
            <div className="grid gap-4 sm:grid-cols-2">
              {ADDRESS_FIELDS.map((field) => (
                <div key={field.key} className={field.span ? 'sm:col-span-2' : undefined}>
                  <label htmlFor={`insider-${field.key}`} className={inputLabel}>
                    {field.label}
                  </label>
                  <Input
                    id={`insider-${field.key}`}
                    type="text"
                    autoComplete="off"
                    placeholder={field.placeholder}
                    value={formData[field.key] as string}
                    onChange={(e) => {
                      const raw = e.target.value
                      if (field.key === 'cep') setField('cep', maskCep(raw))
                      else if (field.key === 'estado') setField('estado', maskUf(raw))
                      else setField(field.key, raw)
                    }}
                  />
                </div>
              ))}
            </div>
          </section>

          <section>
            <SectionTitle as="h3" title="Benefícios de parceiros" meta="Opcional" />
            <div className="grid gap-4 sm:grid-cols-2">
              {BENEFIT_FIELDS.map((field) => (
                <div key={field.key}>
                  <label htmlFor={`insider-${field.key}`} className={inputLabel}>
                    {field.label}
                  </label>
                  <Input
                    id={`insider-${field.key}`}
                    type="text"
                    autoComplete="off"
                    placeholder={field.placeholder}
                    value={formData[field.key] as string}
                    onChange={(e) => setField(field.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </section>

          <section>
            <SectionTitle as="h3" title="Benefícios Somma" meta="Opcional" />
            <div className="grid gap-4 sm:grid-cols-2">
              {SOMMA_FIELDS.map((field) => (
                <div key={field.key}>
                  <label htmlFor={`insider-${field.key}`} className={inputLabel}>
                    {field.label}
                  </label>
                  <Input
                    id={`insider-${field.key}`}
                    type="text"
                    autoComplete="off"
                    placeholder={field.placeholder}
                    value={formData[field.key] as string}
                    onChange={(e) => setField(field.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </section>
        </div>
      </ResponsiveModal>
    </PageShell>
  )
}
