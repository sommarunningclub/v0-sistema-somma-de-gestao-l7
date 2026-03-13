"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Search, RefreshCw, Download, CheckCircle2, XCircle,
  Users, Trash2, AlertTriangle, X, Shield,
  CheckCircle, Eye, FilterX, Loader2, SlidersHorizontal,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { PillTabBar } from "@/components/mobile/pill-tab-bar"
import { StickySummary } from "@/components/mobile/sticky-summary"
import { SwipeCard } from "@/components/mobile/swipe-card"
import { MobileCard } from "@/components/mobile/mobile-card"
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

export default function CheckInPage() {
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
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  // Mobile-specific state
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const uniquePelotoes = Array.from(new Set(checkInData.map(c => c.pelotao).filter(Boolean))) as string[]
  const activeFilterCount = [selectedSexo !== null, selectedPelotao !== null, activeFilter !== 'all'].filter(Boolean).length
  const totalValidated = checkInData.filter(c => c.validated).length
  const totalPending = checkInData.filter(c => !c.validated).length
  const getCheckinInitials = (nome?: string) => (nome ?? 'X').split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()
  const pelotaoAvatarBg = (pelotao?: string): string => {
    const map: Record<string, string> = {
      Alfa: 'bg-orange-500/20 text-orange-400',
      Bravo: 'bg-blue-500/20 text-blue-400',
      Charlie: 'bg-purple-500/20 text-purple-400',
      Delta: 'bg-green-500/20 text-green-400',
    }
    return map[pelotao ?? ''] ?? 'bg-neutral-700 text-neutral-300'
  }

  const fetchCheckInData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/checkin", { cache: "no-store" })
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setCheckInData(json.data || [])
      setLastRefresh(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCheckInData() }, [fetchCheckInData])

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
    } catch (err) {
      console.error('[v0] Error toggling validation:', err)
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
    a.download = `checkin_${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.csv`
    a.click()
  }

  // Calculate stats by sexo and pelotao
  const statsBySexo = (sexo: string | undefined) =>
    checkInData.filter(c => c.sexo === sexo).length
  const statsByPelotao = (pelotao: string | undefined) =>
    checkInData.filter(c => c.pelotao === pelotao).length

  const uniqueSexos = Array.from(new Set(checkInData.map(c => c.sexo).filter(Boolean)))
    .sort() as string[]

  return (
    <div className="min-h-screen bg-neutral-950 text-white">

      {/* ── MOBILE VIEW ── */}
      <div className="md:hidden flex flex-col h-full">

        {/* Sticky header */}
        <div className="sticky top-14 z-20 bg-neutral-900 border-b border-neutral-800 px-3 pt-3 pb-2 space-y-2">

          {/* Title row */}
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-sm font-bold text-white tracking-wider flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-orange-500" />
              Check-in
            </h1>
            <div className="flex items-center gap-2">
              {/* Filter button with badge */}
              <button
                onClick={() => setMobileFiltersOpen(true)}
                className="relative flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-300 hover:bg-neutral-700 transition-colors"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filtros
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              {/* CSV export */}
              <button
                onClick={handleExport}
                disabled={filtered.length === 0}
                className="flex items-center gap-1 px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-300 hover:bg-neutral-700 transition-colors disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </button>
            </div>
          </div>

          {/* Pill tab bar */}
          <PillTabBar
            tabs={[
              { key: 'all', label: 'Hoje' },
              { key: 'validated', label: 'Validados' },
              { key: 'not_validated', label: 'Pendentes' },
            ]}
            activeTab={activeFilter}
            onChange={(key) => setActiveFilter(key as "all" | "validated" | "not_validated")}
          />

          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar nome, CPF, pelotão…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-8 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500/50"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Sticky summary */}
        <StickySummary
          items={[
            { label: 'Total', value: checkInData.length, color: 'orange' },
            { label: 'Validados', value: totalValidated, color: 'green' },
            { label: 'Pendentes', value: totalPending, color: 'yellow' },
          ]}
        />

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 pb-24">

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 text-neutral-400">
              <Loader2 className="w-7 h-7 animate-spin mb-3 text-orange-500" />
              <p className="text-sm">Carregando check-ins…</p>
            </div>
          )}

          {/* Empty state */}
          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              {activeFilterCount > 0 || searchTerm ? (
                <>
                  <FilterX className="w-9 h-9 text-neutral-600 mb-3" />
                  <p className="text-neutral-400 text-sm mb-3">Nenhum resultado</p>
                  <button
                    onClick={() => {
                      setSearchTerm("")
                      setActiveFilter("all")
                      setSelectedSexo(null)
                      setSelectedPelotao(null)
                    }}
                    className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-300 hover:bg-neutral-700 transition-colors"
                  >
                    Limpar filtros
                  </button>
                </>
              ) : (
                <>
                  <Users className="w-9 h-9 text-neutral-600 mb-3" />
                  <p className="text-neutral-400 text-sm">Nenhum check-in registrado</p>
                </>
              )}
            </div>
          )}

          {/* Items */}
          {!loading && filtered.map((item, idx) => {
            const isUpdating = updatingId === item.id
            const formattedTime = item.data
              ? (() => {
                  try {
                    return new Date(item.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                  } catch {
                    return item.data
                  }
                })()
              : "—"
            const subtitleText = [formattedTime, item.pelotao].filter(Boolean).join(" · ")

            return (
              <SwipeCard
                key={item.id || idx}
                disabled={isUpdating}
                actions={[
                  {
                    key: 'validate',
                    label: item.validated ? 'Desfazer' : 'Validar',
                    icon: <CheckCircle className="w-4 h-4" />,
                    color: item.validated ? 'orange' : 'green',
                    onTrigger: () => handleToggleValidation(item),
                  },
                  {
                    key: 'view',
                    label: 'Ver',
                    icon: <Eye className="w-4 h-4" />,
                    color: 'blue',
                    onTrigger: () => {},
                  },
                ]}
              >
                <MobileCard
                  title={item.nome ?? '—'}
                  subtitle={subtitleText}
                  avatar={getCheckinInitials(item.nome)}
                  avatarBg={pelotaoAvatarBg(item.pelotao)}
                  borderColor={item.validated ? 'green' : 'yellow'}
                  isUpdating={isUpdating}
                  expandable
                  expandedContent={
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-neutral-500 mb-0.5">CPF</p>
                          <p className="text-neutral-200 font-mono">{formatCPF(item.cpf)}</p>
                        </div>
                        <div>
                          <p className="text-neutral-500 mb-0.5">Telefone</p>
                          <p className="text-neutral-200 font-mono">{item.telefone || '—'}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-neutral-500 mb-0.5">Email</p>
                          <p className="text-neutral-200 truncate">{item.email || '—'}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleValidation(item) }}
                          disabled={isUpdating}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                            item.validated
                              ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30'
                              : 'bg-green-500/15 text-green-400 border border-green-500/30'
                          }`}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          {item.validated ? 'Desfazer' : 'Validar'}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDelete(item) }}
                          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/30 transition-colors hover:bg-red-500/25"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Excluir
                        </button>
                      </div>
                    </div>
                  }
                />
              </SwipeCard>
            )
          })}
        </div>

        {/* FAB for new check-in — deferred, no POST API available */}

        {/* Filters bottom sheet */}
        <MobileBottomSheet
          isOpen={mobileFiltersOpen}
          onClose={() => setMobileFiltersOpen(false)}
          title="Filtrar Check-ins"
          height="auto"
        >
          <div className="space-y-5">
            {/* Pelotão */}
            <div>
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Pelotão</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedPelotao(null)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selectedPelotao === null
                      ? 'bg-orange-500 text-white'
                      : 'bg-neutral-800 text-neutral-300 border border-neutral-700'
                  }`}
                >
                  Todos
                </button>
                {uniquePelotoes.map(pelotao => (
                  <button
                    key={pelotao}
                    onClick={() => setSelectedPelotao(pelotao)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      selectedPelotao === pelotao
                        ? 'bg-orange-500 text-white'
                        : 'bg-neutral-800 text-neutral-300 border border-neutral-700'
                    }`}
                  >
                    {pelotao}
                  </button>
                ))}
              </div>
            </div>

            {/* Status */}
            <div>
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Status</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { key: 'all', label: 'Todos' },
                    { key: 'validated', label: 'Validados' },
                    { key: 'not_validated', label: 'Pendentes' },
                  ] as { key: "all" | "validated" | "not_validated"; label: string }[]
                ).map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setActiveFilter(opt.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      activeFilter === opt.key
                        ? 'bg-orange-500 text-white'
                        : 'bg-neutral-800 text-neutral-300 border border-neutral-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Apply */}
            <button
              onClick={() => setMobileFiltersOpen(false)}
              className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Aplicar
            </button>
          </div>
        </MobileBottomSheet>
      </div>

      {/* ── DESKTOP VIEW ── */}
      <div className="hidden md:block">
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2 tracking-wider">
                <Shield className="w-5 h-5 text-orange-500" />
                CHECK-IN SOMMA
              </h1>
              <p className="text-xs text-neutral-500 mt-1">
                Registros de hoje em diante
                {lastRefresh && (
                  <span className="ml-2">
                    · atualizado {lastRefresh.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchCheckInData}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-sm text-neutral-300 hover:bg-neutral-800 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Atualizar</span>
              </button>
              <button
                onClick={handleExport}
                disabled={filtered.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-sm text-neutral-300 hover:bg-neutral-800 transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Exportar CSV</span>
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div
              onClick={() => setActiveFilter("all")}
              className={`cursor-pointer rounded-xl p-4 text-center border transition-colors ${activeFilter === "all" ? "bg-orange-500/15 border-orange-500/50" : "bg-neutral-900 border-neutral-800 hover:border-neutral-700"}`}
            >
              <p className="text-2xl font-bold font-mono text-white">{checkInData.length}</p>
              <p className="text-xs text-neutral-400 mt-1 uppercase tracking-wider">Total</p>
            </div>
            <div
              onClick={() => setActiveFilter("validated")}
              className={`cursor-pointer rounded-xl p-4 text-center border transition-colors ${activeFilter === "validated" ? "bg-green-500/15 border-green-500/50" : "bg-neutral-900 border-neutral-800 hover:border-neutral-700"}`}
            >
              <p className="text-2xl font-bold font-mono text-green-400">{totalValidated}</p>
              <p className="text-xs text-neutral-400 mt-1 uppercase tracking-wider">Validados</p>
            </div>
            <div
              onClick={() => setActiveFilter("not_validated")}
              className={`cursor-pointer rounded-xl p-4 text-center border transition-colors ${activeFilter === "not_validated" ? "bg-red-500/15 border-red-500/50" : "bg-neutral-900 border-neutral-800 hover:border-neutral-700"}`}
            >
              <p className="text-2xl font-bold font-mono text-orange-400">{totalPending}</p>
              <p className="text-xs text-neutral-400 mt-1 uppercase tracking-wider">Pendentes</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
            <Input
              placeholder="Buscar por nome, CPF, pelotão, telefone ou email..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-9 bg-neutral-900 border-neutral-700 text-white placeholder-neutral-500 text-sm"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filters: Sexo and Pelotão */}
          {(uniqueSexos.length > 0 || uniquePelotoes.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {uniqueSexos.length > 0 && (
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Por Sexo</h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedSexo(null)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        selectedSexo === null
                          ? "bg-orange-500 text-white"
                          : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                      }`}
                    >
                      Todos ({checkInData.length})
                    </button>
                    {uniqueSexos.map(sexo => {
                      const count = statsBySexo(sexo)
                      return (
                        <button
                          key={sexo}
                          onClick={() => setSelectedSexo(sexo)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            selectedSexo === sexo
                              ? "bg-blue-500 text-white"
                              : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                          }`}
                        >
                          {sexo} ({count})
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {uniquePelotoes.length > 0 && (
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Por Pelotão</h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedPelotao(null)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        selectedPelotao === null
                          ? "bg-orange-500 text-white"
                          : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                      }`}
                    >
                      Todos ({checkInData.length})
                    </button>
                    {uniquePelotoes.map(pelotao => {
                      const count = statsByPelotao(pelotao)
                      return (
                        <button
                          key={pelotao}
                          onClick={() => setSelectedPelotao(pelotao)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            selectedPelotao === pelotao
                              ? "bg-purple-500 text-white"
                              : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                          }`}
                        >
                          {pelotao} ({count})
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="text-center py-16 text-neutral-400">
              <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-3 text-orange-500" />
              <p className="text-sm">Carregando check-ins...</p>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-4 text-red-400 text-sm flex gap-3 items-start">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Erro ao carregar dados</p>
                <p className="text-red-500 text-xs mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && filtered.length === 0 && (
            <div className="text-center py-16">
              <Users className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
              <p className="text-neutral-400 text-sm">
                {searchTerm ? `Nenhum resultado para "${searchTerm}"` : "Nenhum check-in encontrado para hoje"}
              </p>
            </div>
          )}

          {/* Tabela desktop */}
          {!loading && !error && filtered.length > 0 && (
            <div>
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-800 bg-neutral-800/50">
                        <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Pelotão</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Nome</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Telefone</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">CPF</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Data/Hora</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Validação</th>
                        <th className="text-center py-3 px-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                      {filtered.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-neutral-800/40 transition-colors">
                          <td className="py-3 px-4">
                            {item.pelotao ? (
                              <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 font-mono text-xs font-semibold">
                                {item.pelotao}
                              </Badge>
                            ) : (
                              <span className="text-neutral-600 text-xs">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-medium text-white max-w-[180px]">
                            <p className="truncate">{item.nome || "—"}</p>
                            {item.email && <p className="text-xs text-neutral-500 truncate">{item.email}</p>}
                          </td>
                          <td className="py-3 px-4 text-neutral-300 font-mono text-xs">{item.telefone || "—"}</td>
                          <td className="py-3 px-4 text-neutral-300 font-mono text-xs">{formatCPF(item.cpf)}</td>
                          <td className="py-3 px-4 text-neutral-400 text-xs whitespace-nowrap">{item.data || "—"}</td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => handleToggleValidation(item)}
                              disabled={updatingId === item.id}
                              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                                item.validated
                                  ? "bg-green-500/15 text-green-400 hover:bg-green-500/25"
                                  : "bg-neutral-800 text-neutral-500 hover:bg-neutral-700 hover:text-white"
                              }`}
                            >
                              {item.validated
                                ? <><CheckCircle2 className="w-3.5 h-3.5" /> Validado</>
                                : <><XCircle className="w-3.5 h-3.5" /> Pendente</>
                              }
                            </button>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => setConfirmDelete(item)}
                              className="p-1.5 rounded-lg text-neutral-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Deletar check-in"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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

      {/* Modal confirmação de deleção */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Deletar check-in?</h3>
                <p className="text-xs text-neutral-400">Esta ação remove o registro do banco de dados e não pode ser desfeita.</p>
              </div>
            </div>

            <div className="bg-neutral-800 rounded-xl p-3 mb-5 space-y-1.5 text-sm">
              <p className="text-white font-medium">{confirmDelete.nome || "—"}</p>
              <p className="text-neutral-400 font-mono text-xs">{formatCPF(confirmDelete.cpf)}</p>
              {confirmDelete.pelotao && <p className="text-orange-400 text-xs">Pelotão: {confirmDelete.pelotao}</p>}
              <p className="text-neutral-500 text-xs">{confirmDelete.data}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={!!deletingId}
                className="flex-1 py-2.5 rounded-xl bg-neutral-800 text-neutral-300 hover:bg-neutral-700 text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={!!deletingId}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {deletingId ? (
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
