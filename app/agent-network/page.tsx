"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, Mail, Phone, Trash2, MessageCircle, Plus, ChevronDown, ChevronUp } from "lucide-react"
import type { CadastroSite } from "@/lib/supabase-client"
import { TagManager } from "@/components/tag-manager"
import { getMembers, getMembersCount, searchMembers, deleteMember, PAGE_SIZE_EXPORT } from "@/lib/services/members"
import { AddMemberModal } from "@/components/add-member-modal"
import { EditMemberModal } from "@/components/edit-member-modal"
import { WhatsAppMessageModal } from "@/components/whatsapp-message-modal"
import { CreateChargeModal } from "@/components/create-charge-modal"
import { MemberChargesList } from "@/components/member-charges-list"
import { MembersStatsCollapsible } from "@/components/members-stats-collapsible"
import { MembersCardList } from "@/components/members-card-list"
import { MembersSearchBar } from "@/components/members-search-bar"
import { MembersTableRow } from "@/components/members-table-row"
import { ErrorBanner } from '@/components/ui/error-banner'
import { PageLoading } from '@/components/ui/page-loading'

export default function AgentNetworkPage() {
  const [query, setQuery] = useState("")
  const [selectedMember, setSelectedMember] = useState<CadastroSite | null>(null)
  const [editingMember, setEditingMember] = useState<CadastroSite | null>(null)
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false)
  const [showChargeModal, setShowChargeModal] = useState(false)
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

  // Buscar membros inicial
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

  // Termo já "debounced" vindo do campo de busca isolado.
  const handleSearch = useCallback((term: string) => {
    setQuery(term)
  }, [])

  // Reage a mudanças de termo de busca. A carga inicial fica por conta do
  // efeito de mount (initMembers), então pulamos a primeira execução aqui.
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
        // Ignora respostas obsoletas (usuário continuou digitando).
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

  // Carregar próxima página
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

  // Memoizar membros visíveis
  const displayedMembers = useMemo(() => members, [members])

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

  const handleDeleteMember = async (id: number) => {
    if (!confirm("Tem certeza que deseja deletar este membro? Esta ação não pode ser desfeita.")) {
      return
    }

    setDeleting(true)
    const success = await deleteMember(id)
    setDeleting(false)

    if (success) {
      setSelectedMember(null)
      setMembers((prev) => prev.filter((m) => m.id !== id))
      setTotalMembers((prev) => Math.max(0, prev - 1))
    } else {
      alert("Erro ao deletar membro. Tente novamente.")
    }
  }

  const handleOpenWhatsAppModal = () => {
    if (!selectedMember?.whatsapp) {
      alert("Este membro não possui número de WhatsApp")
      return
    }
    setShowWhatsAppModal(true)
  }

  const handleOpenChargeModal = () => {
    if (!selectedMember) {
      alert("Selecione um membro primeiro")
      return
    }
    setShowChargeModal(true)
  }

  const handleChargeCreated = () => {
    setSelectedMember(null)
  }

  return (
    <div className="w-full h-full flex flex-col p-3 sm:p-6 lg:p-8 gap-3 sm:gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-white tracking-wider">MEMBROS SOMMA</h1>
          <p className="text-xs sm:text-sm text-neutral-400">
            {searchMode ? `Resultados: ${displayedMembers.length}` : `Total: ${totalMembers} membros`}
          </p>
        </div>
        <Button 
          onClick={() => setShowAddMember(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white font-medium w-full sm:w-auto active:scale-95 md:active:scale-100"
        >
          + Adicionar Membro
        </Button>
      </div>

      {/* Mobile Collapsible Stats */}
      <MembersStatsCollapsible 
        totalMembers={totalMembers}
        activeMembers={totalMembers}
        foundMembers={displayedMembers.length}
      />

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

      {/* Search Bar - isolada para não travar a digitação */}
      <MembersSearchBar onSearch={handleSearch} isSearching={isSearching} />

      {/* Desktop Stats Grid */}
      <div className="hidden lg:grid lg:grid-cols-3 gap-3 sm:gap-4">
        <Card className="bg-neutral-900 border-neutral-700">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-neutral-400 tracking-wider">TOTAL DE MEMBROS</p>
                <p className="text-lg sm:text-2xl font-bold text-white font-mono">{totalMembers}</p>
              </div>
              <div className="text-lg sm:text-2xl">👥</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900 border-neutral-700">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-neutral-400 tracking-wider">CARREGADOS</p>
                <p className="text-lg sm:text-2xl font-bold text-orange-500 font-mono">{displayedMembers.length}</p>
              </div>
              <div className="text-lg sm:text-2xl">⬇️</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900 border-neutral-700">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-neutral-400 tracking-wider">PÁGINA</p>
                <p className="text-lg sm:text-2xl font-bold text-green-500 font-mono">{currentPage + 1}</p>
              </div>
              <div className="text-lg sm:text-2xl">📄</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mobile Card List View */}
      <MembersCardList
        members={displayedMembers}
        onSelectMember={setSelectedMember}
        loading={(loading || isSearching) && !error && displayedMembers.length === 0}
      />

      {/* Desktop Table View */}
      <Card className="hidden lg:flex bg-neutral-900 border-neutral-700 flex-1 flex-col overflow-hidden">
        <CardHeader className="border-b border-neutral-700">
          <CardTitle className="text-xs sm:text-sm font-medium text-neutral-300 tracking-wider">LISTA DE MEMBROS</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden flex flex-col p-0">
          {loading && displayedMembers.length === 0 ? (
            <PageLoading label="Carregando membros..." />
          ) : displayedMembers.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-neutral-400">
                {totalMembers === 0 ? "Nenhum membro encontrado" : "Nenhum membro corresponde à sua busca"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead className="sticky top-0 bg-neutral-800">
                  <tr className="border-b border-neutral-700">
                    <th className="text-left py-2 sm:py-3 px-3 sm:px-4 font-medium text-neutral-400 tracking-wider">NOME</th>
                    <th className="text-left py-2 sm:py-3 px-3 sm:px-4 font-medium text-neutral-400 tracking-wider hidden md:table-cell">E-MAIL</th>
                    <th className="text-left py-2 sm:py-3 px-3 sm:px-4 font-medium text-neutral-400 tracking-wider hidden lg:table-cell">CPF</th>
                    <th className="text-left py-2 sm:py-3 px-3 sm:px-4 font-medium text-neutral-400 tracking-wider hidden xl:table-cell">NASCIMENTO</th>
                    <th className="text-left py-2 sm:py-3 px-3 sm:px-4 font-medium text-neutral-400 tracking-wider hidden sm:table-cell">WHATSAPP</th>
                    <th className="text-left py-2 sm:py-3 px-3 sm:px-4 font-medium text-neutral-400 tracking-wider">AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedMembers.map((member, index) => (
                    <MembersTableRow
                      key={member.id}
                      member={member}
                      index={index}
                      onSelect={setSelectedMember}
                      formatCPF={formatCPF}
                      formatDate={formatDate}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Load More Button */}
      {hasMore && !loading && (
        <div className="flex justify-center pt-2">
          <Button
            onClick={loadMore}
            disabled={loading}
            className="bg-neutral-700 hover:bg-neutral-600 text-white w-full sm:w-auto"
          >
            {loading ? "Carregando..." : `Carregar Mais (${displayedMembers.length}/${totalMembers})`}
          </Button>
        </div>
      )}

      {/* Member Detail Modal */}
      {selectedMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="bg-neutral-900 border-neutral-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-neutral-900">
              <div>
                <CardTitle className="text-base sm:text-lg font-bold text-white tracking-wider">
                  {selectedMember.nome_completo}
                </CardTitle>
                <p className="text-xs sm:text-sm text-neutral-400">ID: {selectedMember.id}</p>
              </div>
              <Button
                variant="ghost"
                onClick={() => setSelectedMember(null)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-neutral-400 tracking-wider mb-1">NOME COMPLETO</p>
                  <p className="text-sm text-white">{selectedMember.nome_completo}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 tracking-wider mb-1">CPF</p>
                  <p className="text-sm text-white font-mono">{formatCPF(selectedMember.cpf)}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-neutral-400 tracking-wider mb-1">E-MAIL</p>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                    <p className="text-sm text-white break-all">{selectedMember.email}</p>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-neutral-400 tracking-wider mb-1">WHATSAPP</p>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                    <p className="text-sm text-white">{selectedMember.whatsapp}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 tracking-wider mb-1">DATA DE NASCIMENTO</p>
                  <p className="text-sm text-white">{formatDate(selectedMember.data_nascimento)}</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 pt-4">
                <Button 
                  onClick={() => handleEditClick(selectedMember)}
                  className="bg-orange-500 hover:bg-orange-600 text-white flex-1"
                >
                  Editar Membro
                </Button>
                <Button
                  onClick={handleOpenChargeModal}
                  className="bg-blue-500 hover:bg-blue-600 text-white flex-1"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Criar Cobrança
                </Button>
                <Button
                  onClick={handleOpenWhatsAppModal}
                  className="bg-green-500 hover:bg-green-600 text-white flex-1 flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </Button>
                <Button
                  onClick={() => handleDeleteMember(selectedMember.id)}
                  disabled={deleting}
                  className="bg-red-500 hover:bg-red-600 text-white flex-1 flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {deleting ? "Deletando..." : "Deletar"}
                </Button>
              </div>
              
              {/* Tags Section */}
              <div className="pt-4 border-t border-neutral-700">
                <TagManager entityType="membro" entityId={selectedMember.id} />
              </div>

              {/* Charges Section */}
              <div className="pt-4 border-t border-neutral-700">
                <h3 className="text-sm font-semibold text-white mb-4 tracking-wider">COBRANÇAS</h3>
                <MemberChargesList memberId={selectedMember.id} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMember && (
        <AddMemberModal 
          isOpen={showAddMember}
          onClose={() => setShowAddMember(false)}
          onMemberAdded={handleMemberAdded}
        />
      )}

      {/* Edit Member Modal */}
      {editingMember && (
        <EditMemberModal
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onSave={handleMemberUpdated}
        />
      )}

      {/* WhatsApp Message Modal */}
      {selectedMember && (
        <WhatsAppMessageModal
          isOpen={showWhatsAppModal}
          phoneNumber={selectedMember.whatsapp}
          memberName={selectedMember.nome_completo}
          onClose={() => setShowWhatsAppModal(false)}
        />
      )}

      {/* Create Charge Modal */}
      {selectedMember && (
        <CreateChargeModal
          isOpen={showChargeModal}
          onClose={() => setShowChargeModal(false)}
          member={selectedMember}
          onChargeCreated={handleChargeCreated}
        />
      )}
    </div>
  )
}
