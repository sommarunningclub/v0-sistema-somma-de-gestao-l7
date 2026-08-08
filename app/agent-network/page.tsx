"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Download,
  Mail,
  MessageCircle,
  Phone,
  Receipt,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import type { CadastroSite } from "@/lib/supabase-client"
import { TagManager } from "@/components/tag-manager"
import { getMembers, getMembersCount, searchMembers, deleteMember, PAGE_SIZE_EXPORT } from "@/lib/services/members"
import { AddMemberModal } from "@/components/add-member-modal"
import { EditMemberModal } from "@/components/edit-member-modal"
import { WhatsAppMessageModal } from "@/components/whatsapp-message-modal"
import { MembersStatsCollapsible } from "@/components/members-stats-collapsible"
import { MembersCardList } from "@/components/members-card-list"
import { MembersSearchBar } from "@/components/members-search-bar"
import { MembersTableRow } from "@/components/members-table-row"
import { ErrorBanner } from "@/components/ui/error-banner"
import {
  EmptyState,
  FilterButton,
  FilterChip,
  NoResultsState,
  PageHeader,
  PageShell,
  Panel,
  ResponsiveModal,
  SectionTitle,
  StatGrid,
  StatTile,
  TBody,
  TH,
  THead,
  Table,
  TableFrame,
  TableSkeleton,
  Toolbar,
  confirmAction,
  notify,
  type SortDirection,
} from "@/components/somma"

type ContactFilter = "todos" | "com-whatsapp" | "sem-whatsapp"
type SortKey = "nome_completo" | "email" | "data_nascimento"

const CONTACT_FILTER_LABEL: Record<ContactFilter, string> = {
  todos: "Todos",
  "com-whatsapp": "Com WhatsApp",
  "sem-whatsapp": "Sem WhatsApp",
}

export default function AgentNetworkPage() {
  const [query, setQuery] = useState("")
  const [selectedMember, setSelectedMember] = useState<CadastroSite | null>(null)
  const [editingMember, setEditingMember] = useState<CadastroSite | null>(null)
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false)
  const [members, setMembers] = useState<CadastroSite[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddMember, setShowAddMember] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const [totalMembers, setTotalMembers] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [searchMode, setSearchMode] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [contactFilter, setContactFilter] = useState<ContactFilter>("todos")
  const [sortKey, setSortKey] = useState<SortKey>("nome_completo")
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)

  useEffect(() => {
    async function initMembers() {
      setLoading(true)
      setError(null)
      try {
        const [membersData, count] = await Promise.all([
          getMembers(0),
          getMembersCount()
        ])
        setMembers(membersData)
        setTotalMembers(count)
        setCurrentPage(0)
        setHasMore(membersData.length === PAGE_SIZE_EXPORT)
      } catch (err) {
        console.error("[v0] Erro ao carregar membros:", err)
        setError('Erro ao carregar membros')
      } finally {
        setLoading(false)
      }
    }
    initMembers()
  }, [])

  const handleSearch = useCallback((term: string) => {
    setQuery(term)
  }, [])

  const didMount = useRef(false)
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true
      return
    }

    let cancelled = false
    async function runSearch() {
      setIsSearching(true)
      setCurrentPage(0)
      try {
        const isSearch = query.trim().length > 0
        setSearchMode(isSearch)
        const results = isSearch ? await searchMembers(query, 0) : await getMembers(0)
        if (cancelled) return
        setMembers(results)
        setHasMore(results.length === PAGE_SIZE_EXPORT)
      } catch (err) {
        console.error("[v0] Erro ao buscar:", err)
        if (!cancelled) setError('Erro ao buscar membros')
      } finally {
        if (!cancelled) setIsSearching(false)
      }
    }

    runSearch()
    return () => {
      cancelled = true
    }
  }, [query])

  const loadMore = useCallback(async () => {
    if (loading || isSearching || !hasMore) return

    setLoading(true)
    try {
      const nextPage = currentPage + 1
      const newMembers = searchMode
        ? await searchMembers(query, nextPage)
        : await getMembers(nextPage)

      setMembers((prev) => [...prev, ...newMembers])
      setCurrentPage(nextPage)
      setHasMore(newMembers.length === PAGE_SIZE_EXPORT)
    } catch (err) {
      console.error("[v0] Erro ao carregar mais:", err)
      setError('Erro ao carregar mais membros')
    } finally {
      setLoading(false)
    }
  }, [currentPage, loading, isSearching, hasMore, searchMode, query])

  const displayedMembers = useMemo(() => {
    const filtered = members.filter((member) => {
      const digits = (member.whatsapp || "").replace(/\D/g, "")
      if (contactFilter === "com-whatsapp") return digits.length >= 10
      if (contactFilter === "sem-whatsapp") return digits.length < 10
      return true
    })

    if (!sortDirection) return filtered

    const factor = sortDirection === "asc" ? 1 : -1
    return [...filtered].sort((a, b) => {
      const left = (a[sortKey] || "").toString()
      const right = (b[sortKey] || "").toString()
      if (sortKey === "data_nascimento") return left.localeCompare(right) * factor
      return left.localeCompare(right, "pt-BR", { sensitivity: "base" }) * factor
    })
  }, [members, contactFilter, sortKey, sortDirection])

  const activeFilterCount = contactFilter === "todos" ? 0 : 1
  const isEmptyResult = displayedMembers.length === 0
  const isFirstLoad = (loading || isSearching) && members.length === 0
  const hasQueryOrFilter = query.trim().length > 0 || activeFilterCount > 0

  const toggleSort = useCallback(
    (key: SortKey) => {
      if (sortKey !== key) {
        setSortKey(key)
        setSortDirection("asc")
        return
      }
      setSortDirection((previous) =>
        previous === "asc" ? "desc" : previous === "desc" ? null : "asc",
      )
    },
    [sortKey],
  )

  const directionFor = (key: SortKey): SortDirection => (sortKey === key ? sortDirection : null)

  const clearSearchAndFilters = useCallback(() => {
    setContactFilter("todos")
    setQuery("")
  }, [])

  const formatCPF = (cpf: string) => {
    const cleaned = cpf.replace(/\D/g, "")
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return "-"
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString("pt-BR")
    } catch {
      return dateString
    }
  }

  const handleMemberAdded = async () => {
    setShowAddMember(false)
    setLoading(true)
    try {
      const [data, count] = await Promise.all([
        getMembers(0),
        getMembersCount()
      ])
      setMembers(data)
      setTotalMembers(count)
      setCurrentPage(0)
      setHasMore(data.length === PAGE_SIZE_EXPORT)
    } finally {
      setLoading(false)
    }
  }

  const reloadMembersList = useCallback(async () => {
    const pages = Array.from({ length: currentPage + 1 }, (_, i) => i)
    const fetchPage = searchMode && query.trim()
      ? (page: number) => searchMembers(query, page)
      : (page: number) => getMembers(page)

    const results = await Promise.all(pages.map(fetchPage))
    setMembers(results.flat())
  }, [currentPage, searchMode, query])

  const handleMemberUpdated = async () => {
    setEditingMember(null)
    setSelectedMember(null)
    setLoading(true)
    try {
      await reloadMembersList()
    } finally {
      setLoading(false)
    }
  }

  const handleEditClick = (member: CadastroSite) => {
    setSelectedMember(null)
    setEditingMember(member)
  }

  const handleDeleteMember = async (member: CadastroSite) => {
    const confirmed = await confirmAction({
      title: "Excluir membro?",
      description:
        "O cadastro sai da base permanentemente, junto com o vínculo dele nas listagens. Esta ação não pode ser desfeita.",
      detail: `${member.nome_completo} — ID ${member.id}`,
      tone: "danger",
      confirmLabel: "Excluir membro",
    })
    if (!confirmed) return

    setDeleting(true)
    const success = await deleteMember(member.id)
    setDeleting(false)

    if (success) {
      setSelectedMember(null)
      setMembers((prev) => prev.filter((m) => m.id !== member.id))
      setTotalMembers((prev) => Math.max(0, prev - 1))
      notify.success("Membro excluído", { description: `${member.nome_completo} foi removido da base.` })
    } else {
      notify.error("Erro ao deletar membro", { description: "Tente novamente em alguns instantes." })
    }
  }

  const handleOpenWhatsAppModal = () => {
    if (!selectedMember?.whatsapp) {
      notify.warning("Sem WhatsApp cadastrado", {
        description: "Edite o membro e informe um número para enviar mensagens.",
      })
      return
    }
    setShowWhatsAppModal(true)
  }

  const primaryAction = (
    <Button onClick={() => setShowAddMember(true)}>
      <UserPlus aria-hidden="true" />
      Novo membro
    </Button>
  )

  return (
    <PageShell>
      <PageHeader
        eyebrow="Relacionamento"
        title="Membros"
        description="Base de cadastros do site: contatos e tags de cada membro."
        meta={
          <>
            <span>
              <span className="font-mono tabular-nums text-ink">{totalMembers}</span> na base
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <span className="font-mono tabular-nums text-ink">{displayedMembers.length}</span> na tela
            </span>
            {searchMode ? <span className="text-brand">busca ativa</span> : null}
          </>
        }
        primaryAction={primaryAction}
      >
        <Toolbar>
          <MembersSearchBar onSearch={handleSearch} isSearching={isSearching} className="min-w-0 flex-1" />
          <FilterButton count={activeFilterCount} onClick={() => setShowFilters(true)} />
        </Toolbar>

        {activeFilterCount > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <FilterChip
              label="Contato"
              value={CONTACT_FILTER_LABEL[contactFilter]}
              onRemove={() => setContactFilter("todos")}
            />
          </div>
        ) : null}
      </PageHeader>

      <div className="space-y-4">
        <MembersStatsCollapsible
          totalMembers={totalMembers}
          activeMembers={totalMembers}
          foundMembers={displayedMembers.length}
          loading={isFirstLoad}
        />

        <StatGrid className="hidden lg:grid lg:grid-cols-3">
          <StatTile
            label="Total de membros"
            value={totalMembers.toLocaleString("pt-BR")}
            hint="cadastros no site"
            icon={Users}
            loading={isFirstLoad}
          />
          <StatTile
            label="Carregados"
            value={displayedMembers.length.toLocaleString("pt-BR")}
            hint={searchMode ? "resultados da busca" : "nesta sessão"}
            icon={Download}
            tone="brand"
            loading={isFirstLoad}
          />
          <StatTile
            label="Página atual"
            value={(currentPage + 1).toLocaleString("pt-BR")}
            hint={hasMore ? "há mais registros" : "fim da lista"}
            icon={Receipt}
            loading={isFirstLoad}
          />
        </StatGrid>

        {error && (
          <ErrorBanner
            message={error}
            onRetry={async () => {
              setLoading(true)
              setError(null)
              try {
                const [membersData, count] = await Promise.all([getMembers(0), getMembersCount()])
                setMembers(membersData)
                setTotalMembers(count)
                setCurrentPage(0)
                setHasMore(membersData.length === PAGE_SIZE_EXPORT)
              } catch {
                setError('Erro ao carregar membros')
              } finally {
                setLoading(false)
              }
            }}
          />
        )}

        {isFirstLoad ? (
          <>
            <div className="lg:hidden">
              <MembersCardList members={[]} onSelectMember={setSelectedMember} loading />
            </div>
            <div className="hidden lg:block">
              <TableSkeleton rows={8} columns={6} />
            </div>
          </>
        ) : isEmptyResult ? (
          hasQueryOrFilter ? (
            <NoResultsState query={query || CONTACT_FILTER_LABEL[contactFilter]} onClear={clearSearchAndFilters} />
          ) : (
            <EmptyState
              icon={Users}
              title="Nenhum membro cadastrado"
              description="Assim que alguém se cadastrar no site — ou você adicionar manualmente — o registro aparece aqui."
              action={primaryAction}
            />
          )
        ) : (
          <>
            <MembersCardList
              members={displayedMembers}
              onSelectMember={setSelectedMember}
              selectedId={selectedMember?.id ?? null}
            />

            <TableFrame className="hidden lg:block" busy={loading || isSearching}>
              <Table caption="Lista de membros da Somma com nome, contato, CPF e data de nascimento">
                <THead>
                  <TH
                    sortable
                    direction={directionFor("nome_completo")}
                    onSort={() => toggleSort("nome_completo")}
                  >
                    Nome
                  </TH>
                  <TH
                    className="hidden md:table-cell"
                    sortable
                    direction={directionFor("email")}
                    onSort={() => toggleSort("email")}
                  >
                    E-mail
                  </TH>
                  <TH className="hidden lg:table-cell">CPF</TH>
                  <TH
                    className="hidden xl:table-cell"
                    sortable
                    direction={directionFor("data_nascimento")}
                    onSort={() => toggleSort("data_nascimento")}
                  >
                    Nascimento
                  </TH>
                  <TH className="hidden sm:table-cell">WhatsApp</TH>
                  <TH align="right" width="88px">
                    Ações
                  </TH>
                </THead>
                <TBody>
                  {displayedMembers.map((member) => (
                    <MembersTableRow
                      key={member.id}
                      member={member}
                      selected={selectedMember?.id === member.id}
                      onSelect={setSelectedMember}
                      formatCPF={formatCPF}
                      formatDate={formatDate}
                    />
                  ))}
                </TBody>
              </Table>
            </TableFrame>
          </>
        )}

        {hasMore && !isFirstLoad && !isEmptyResult && (
          <div className="flex justify-center pt-1">
            <Button
              variant="secondary"
              onClick={loadMore}
              loading={loading || isSearching}
              className="w-full sm:w-auto"
            >
              Carregar mais ({displayedMembers.length}/{totalMembers})
            </Button>
          </div>
        )}
      </div>

      <ResponsiveModal
        open={showFilters}
        onOpenChange={setShowFilters}
        title="Filtros"
        description="Refina a lista já carregada, sem alterar a busca no servidor."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setContactFilter("todos")} block className="sm:w-auto">
              Limpar
            </Button>
            <Button onClick={() => setShowFilters(false)} block className="sm:w-auto">
              Aplicar
            </Button>
          </>
        }
      >
        <fieldset className="space-y-2">
          <legend className="ds-eyebrow mb-2">Contato</legend>
          {(Object.keys(CONTACT_FILTER_LABEL) as ContactFilter[]).map((option) => (
            <label
              key={option}
              className="ds-tap flex cursor-pointer items-center gap-3 rounded-lg border border-line px-3.5 text-sm text-ink transition-colors hover:border-line-strong has-[:checked]:border-brand-border has-[:checked]:bg-brand-soft"
            >
              <input
                type="radio"
                name="contact-filter"
                value={option}
                checked={contactFilter === option}
                onChange={() => setContactFilter(option)}
                className="h-4 w-4 accent-brand"
              />
              {CONTACT_FILTER_LABEL[option]}
            </label>
          ))}
        </fieldset>
      </ResponsiveModal>

      {selectedMember && (
        <ResponsiveModal
          open={!showWhatsAppModal}
          onOpenChange={(open) => {
            if (!open) setSelectedMember(null)
          }}
          title={selectedMember.nome_completo}
          description={`ID ${selectedMember.id}`}
          size="lg"
          footer={
            <>
              <Button
                variant="destructive"
                onClick={() => handleDeleteMember(selectedMember)}
                loading={deleting}
                block
                className="sm:mr-auto sm:w-auto"
              >
                <Trash2 aria-hidden="true" />
                Excluir
              </Button>
              <Button variant="secondary" onClick={handleOpenWhatsAppModal} block className="sm:w-auto">
                <MessageCircle aria-hidden="true" />
                WhatsApp
              </Button>
              <Button onClick={() => handleEditClick(selectedMember)} block className="sm:w-auto">
                Editar membro
              </Button>
            </>
          }
        >
          <div className="space-y-6">
            <section>
              <SectionTitle title="Dados cadastrais" as="h3" />
              <Panel inset>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <dt className="ds-eyebrow">Nome completo</dt>
                    <dd className="mt-1 text-sm text-ink-strong">{selectedMember.nome_completo}</dd>
                  </div>
                  <div>
                    <dt className="ds-eyebrow">CPF</dt>
                    <dd className="mt-1 font-mono text-sm tabular-nums text-ink">
                      {selectedMember.cpf ? formatCPF(selectedMember.cpf) : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="ds-eyebrow">Data de nascimento</dt>
                    <dd className="mt-1 text-sm text-ink">{formatDate(selectedMember.data_nascimento)}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="ds-eyebrow">E-mail</dt>
                    <dd className="mt-1 flex items-center gap-2 text-sm text-ink">
                      <Mail aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-subtle" />
                      <span className="break-all">{selectedMember.email || "—"}</span>
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="ds-eyebrow">WhatsApp</dt>
                    <dd className="mt-1 flex items-center gap-2 text-sm text-ink">
                      <Phone aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-subtle" />
                      <span className="font-mono tabular-nums">{selectedMember.whatsapp || "—"}</span>
                    </dd>
                  </div>
                </dl>
              </Panel>
            </section>

            <TagManager entityType="membro" entityId={String(selectedMember.id)} />
          </div>
        </ResponsiveModal>
      )}

      <AddMemberModal
        isOpen={showAddMember}
        onClose={() => setShowAddMember(false)}
        onMemberAdded={handleMemberAdded}
      />

      {editingMember && (
        <EditMemberModal
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onSave={handleMemberUpdated}
        />
      )}

      {selectedMember && (
        <WhatsAppMessageModal
          isOpen={showWhatsAppModal}
          phoneNumber={selectedMember.whatsapp}
          memberName={selectedMember.nome_completo}
          onClose={() => setShowWhatsAppModal(false)}
        />
      )}

    </PageShell>
  )
}
