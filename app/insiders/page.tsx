"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { apiFetch } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertCircle,
  BadgeCheck,
  Download,
  Dumbbell,
  Pencil,
  Plus,
  RefreshCw,
  Star,
  Ticket,
  Trash2,
  Users,
} from "lucide-react"
import { searchAndRank } from "@/lib/search-utils"
import { TAMANHOS_CAMISA } from '@/lib/insider/validation'
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
  tamanho_camisa: string
  evolve: string
  dopahmina: string
  tex_barbearia: string
  big_box: string
  cupom_loja_somma: string
  assessoria_somma: string
}

type InsiderForm = Omit<Insider, 'id'>

const EMPTY_FORM: InsiderForm = {
  nome: "",
  cpf: "",
  tamanho_camisa: "",
  evolve: "",
  dopahmina: "",
  tex_barbearia: "",
  big_box: "",
  cupom_loja_somma: "",
  assessoria_somma: "",
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
]

const PAGE_SIZE = 20

const inputLabel = 'mb-1.5 block text-meta font-medium text-ink-muted'
const selectClass =
  'flex h-11 w-full rounded-lg border border-line bg-surface-sunken px-3.5 text-base text-ink transition-colors hover:border-line-strong focus-visible:border-brand focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand lg:h-10 lg:text-sm'

export default function InsidersPage() {
  const [insiders, setInsiders] = useState<Insider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedInsider, setSelectedInsider] = useState<Insider | null>(null)
  /*
   * Um único modal de formulário serve criação e edição. Em modo edição
   * `editingInsider` guarda o registro original — usado para o id do PATCH e
   * para saber o que de fato mudou.
   */
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingInsider, setEditingInsider] = useState<Insider | null>(null)
  const [creating, setCreating] = useState(false)
  const [page, setPage] = useState(1)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof InsiderForm, string>>>({})
  const [formData, setFormData] = useState<InsiderForm>(EMPTY_FORM)
  /** Valores de partida: vazios na criação, os do registro na edição. */
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

  const handleDelete = async (insider: Insider) => {
    const confirmed = await confirmAction({
      title: 'Excluir insider?',
      description: 'Esta ação não pode ser desfeita. Os benefícios associados deixam de valer.',
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

  /** Abre o formulário em modo edição, pré-preenchido com o registro. */
  const openEditInsider = (insider: Insider) => {
    const valores: InsiderForm = {
      nome: insider.nome ?? '',
      cpf: insider.cpf ?? '',
      tamanho_camisa: insider.tamanho_camisa ?? '',
      evolve: insider.evolve ?? '',
      dopahmina: insider.dopahmina ?? '',
      tex_barbearia: insider.tex_barbearia ?? '',
      big_box: insider.big_box ?? '',
      cupom_loja_somma: insider.cupom_loja_somma ?? '',
      assessoria_somma: insider.assessoria_somma ?? '',
    }
    setFormData(valores)
    setFormBaseline(valores)
    setFormErrors({})
    setEditingInsider(insider)
    setSelectedInsider(null)
    setShowCreateModal(true)
  }

  /** Abre o formulário em modo criação. */
  const openCreateInsider = () => {
    setFormData(EMPTY_FORM)
    setFormBaseline(EMPTY_FORM)
    setFormErrors({})
    setEditingInsider(null)
    setShowCreateModal(true)
  }

  /**
   * Salva o formulário. Criar e editar compartilham validação e corpo; muda
   * apenas o verbo e a rota — manter dois handlers separados faria as regras
   * divergirem com o tempo.
   */
  const handleSaveInsider = async () => {
    const errors: Partial<Record<keyof InsiderForm, string>> = {}
    if (!formData.nome.trim()) errors.nome = 'Nome é obrigatório'
    if (!formData.cpf.trim()) errors.cpf = 'CPF é obrigatório'
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

  /*
   * Compara com o baseline, não com vazio: na edição o formulário já nasce
   * preenchido, e o critério antigo o consideraria "sujo" desde o primeiro
   * instante — pedindo confirmação de descarte mesmo sem nenhuma alteração.
   */
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

  const filteredInsiders = useMemo(
    () => searchAndRank(insiders, searchTerm, (insider) => [insider.nome, insider.cpf]),
    [insiders, searchTerm],
  )

  useEffect(() => {
    setPage(1)
  }, [searchTerm])

  const pagedInsiders = useMemo(
    () => filteredInsiders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredInsiders, page],
  )

  const stats = useMemo(() => ({
    total: insiders.length,
    evolve: insiders.filter((i) => i.evolve).length,
    cupom: insiders.filter((i) => i.cupom_loja_somma).length,
    assessoria: insiders.filter((i) => i.assessoria_somma).length,
  }), [insiders])

  const exportToCSV = () => {
    const headers = ["Nome", "CPF", "Tamanho Camiseta", "Evolve", "Dopamina", "Tex Barbearia", "Big Box", "Cupom Somma", "Assessoria Somma"]
    const data = filteredInsiders.map((i) => [
      i.nome,
      i.cpf,
      i.tamanho_camisa || "—",
      i.evolve || "—",
      i.dopahmina || "—",
      i.tex_barbearia || "—",
      i.big_box || "—",
      i.cupom_loja_somma || "—",
      i.assessoria_somma || "—",
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
      insider.cupom_loja_somma, insider.assessoria_somma].filter(Boolean).length

  return (
    <PageShell>
      <PageHeader
        eyebrow="Relacionamento"
        title="Insiders"
        description="Membros VIP do clube e os benefícios liberados para cada um."
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
            <StatTile label="Total" value={stats.total} icon={Users} hint="Insiders cadastrados" />
            <StatTile label="Com Evolve" value={stats.evolve} icon={Dumbbell} tone="brand" />
            <StatTile label="Com cupom" value={stats.cupom} icon={Ticket} />
            <StatTile label="Com assessoria" value={stats.assessoria} icon={Star} />
          </StatGrid>
        )}

        <Toolbar>
          <SearchInput
            value={searchTerm}
            onValueChange={setSearchTerm}
            placeholder="Buscar por nome ou CPF..."
            label="Buscar insiders"
          />
        </Toolbar>

        {loading ? (
          <>
            <div className="lg:hidden">
              <CardListSkeleton count={4} />
            </div>
            <div className="hidden lg:block">
              <TableSkeleton rows={6} columns={5} />
            </div>
          </>
        ) : filteredInsiders.length === 0 ? (
          insiders.length === 0 ? (
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
            {/* Celular: cards */}
            <ul className="space-y-3 lg:hidden">
              {pagedInsiders.map((insider) => (
                <li key={insider.id}>
                  <MobileRecordCard
                    title={insider.nome}
                    subtitle={insider.cpf}
                    status={
                      <StatusPill tone={benefitCount(insider) > 0 ? 'success' : 'neutral'}>
                        {benefitCount(insider)} benefício{benefitCount(insider) === 1 ? '' : 's'}
                      </StatusPill>
                    }
                    fields={[
                      { label: 'Camiseta', value: insider.tamanho_camisa || '—' },
                      { label: 'Cupom Somma', value: insider.cupom_loja_somma || '—' },
                    ]}
                    onClick={() => setSelectedInsider(insider)}
                    actions={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto text-danger hover:text-danger"
                        aria-label={`Excluir ${insider.nome}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          handleDelete(insider)
                        }}
                      >
                        <Trash2 aria-hidden="true" />
                        Excluir
                      </Button>
                    }
                  />
                </li>
              ))}
            </ul>

            {/* Desktop: tabela */}
            <TableFrame className="hidden lg:block">
              <Table caption="Insiders cadastrados, com CPF, tamanho de camiseta e benefícios ativos.">
                <THead>
                  <TH>Insider</TH>
                  <TH>Camiseta</TH>
                  <TH>Cupom Somma</TH>
                  <TH>Assessoria</TH>
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
                      <TD>{insider.tamanho_camisa || <span className="text-ink-subtle">—</span>}</TD>
                      <TD>
                        {insider.cupom_loja_somma || <span className="text-ink-subtle">—</span>}
                      </TD>
                      <TD>
                        {insider.assessoria_somma || <span className="text-ink-subtle">—</span>}
                      </TD>
                      <TD>
                        <StatusPill tone={benefitCount(insider) > 0 ? 'success' : 'neutral'}>
                          {benefitCount(insider)} de 6
                        </StatusPill>
                      </TD>
                      <TD align="right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Excluir ${insider.nome}`}
                          className="text-danger hover:text-danger"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleDelete(insider)
                          }}
                        >
                          <Trash2 aria-hidden="true" />
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


      {/* Detalhe */}
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
                onClick={() => setSelectedInsider(null)}
              >
                Fechar
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
                  <div>
                    <dt className="ds-eyebrow">Nome</dt>
                    <dd className="mt-0.5 text-sm text-ink">{selectedInsider.nome}</dd>
                  </div>
                  <div>
                    <dt className="ds-eyebrow">CPF</dt>
                    <dd className="mt-0.5 font-mono text-sm text-ink">{selectedInsider.cpf}</dd>
                  </div>
                  <div>
                    <dt className="ds-eyebrow">Tamanho da camiseta</dt>
                    <dd className="mt-0.5 text-sm text-ink">{selectedInsider.tamanho_camisa || '—'}</dd>
                  </div>
                </dl>
              </Well>
            </section>

            <section>
              <SectionTitle as="h3" title="Benefícios de parceiros" />
              <Well className="p-4">
                <dl className="grid gap-4 sm:grid-cols-2">
                  {BENEFIT_FIELDS.map((field) => (
                    <div key={field.key}>
                      <dt className="ds-eyebrow">{field.label}</dt>
                      <dd className="mt-0.5 text-sm text-ink">{selectedInsider[field.key] || '—'}</dd>
                    </div>
                  ))}
                </dl>
              </Well>
            </section>

            <section>
              <SectionTitle as="h3" title="Benefícios Somma" />
              <Well className="p-4">
                <dl className="grid gap-4 sm:grid-cols-2">
                  {SOMMA_FIELDS.map((field) => (
                    <div key={field.key}>
                      <dt className="ds-eyebrow">{field.label}</dt>
                      <dd className="mt-0.5 text-sm text-ink">{selectedInsider[field.key] || '—'}</dd>
                    </div>
                  ))}
                </dl>
              </Well>
            </section>
          </div>
        ) : null}
      </ResponsiveModal>

      {/* Cadastro */}
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
            ? 'Atualize os dados e os benefícios liberados para este insider.'
            : 'Cadastre o membro VIP e os benefícios liberados para ele.'
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
            <SectionTitle as="h3" title="Identificação" meta="Obrigatório" />
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
                  aria-describedby={formErrors.nome ? 'insider-nome-error' : undefined}
                  onChange={(e) => setField('nome', e.target.value)}
                />
                {formErrors.nome ? (
                  <p id="insider-nome-error" className="mt-1.5 flex items-center gap-1.5 text-meta text-danger">
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
                  aria-describedby={formErrors.cpf ? 'insider-cpf-error' : undefined}
                  onChange={(e) => setField('cpf', e.target.value)}
                  className="font-mono"
                />
                {formErrors.cpf ? (
                  <p id="insider-cpf-error" className="mt-1.5 flex items-center gap-1.5 text-meta text-danger">
                    <AlertCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    {formErrors.cpf}
                  </p>
                ) : null}
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
                    value={formData[field.key]}
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
                    value={formData[field.key]}
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
