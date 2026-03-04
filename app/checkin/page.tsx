"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Search, RefreshCw, Download, CheckCircle2, XCircle,
  Users, Trash2, AlertTriangle, X, Shield,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

interface CheckInData {
  id?: string
  nome?: string
  telefone?: string
  email?: string
  cpf: string
  pelotao?: string
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
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<CheckInData | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

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
    return matchesSearch && matchesFilter
  })

  const totalValidated = checkInData.filter(c => c.validated).length
  const totalPending = checkInData.filter(c => !c.validated).length

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
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
          <div className="hidden md:block">
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

        {/* Cards mobile */}
        {!loading && !error && filtered.length > 0 && (
          <div className="md:hidden space-y-3">
            {filtered.map((item, idx) => (
              <div key={item.id || idx} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{item.nome || "—"}</p>
                    {item.email && <p className="text-xs text-neutral-500 truncate">{item.email}</p>}
                    <p className="text-xs text-neutral-500 mt-0.5">{item.data || "—"}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.pelotao && (
                      <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 font-mono text-xs">
                        {item.pelotao}
                      </Badge>
                    )}
                    <button
                      onClick={() => setConfirmDelete(item)}
                      className="p-1.5 rounded-lg text-neutral-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-neutral-500 mb-0.5">Telefone</p>
                    <p className="text-neutral-200 font-mono">{item.telefone || "—"}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500 mb-0.5">CPF</p>
                    <p className="text-neutral-200 font-mono">{formatCPF(item.cpf)}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleValidation(item)}
                  disabled={updatingId === item.id}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                    item.validated
                      ? "bg-green-500/15 text-green-400 border border-green-500/30"
                      : "bg-neutral-800 text-neutral-400 border border-neutral-700 hover:border-orange-500/50 hover:text-orange-300"
                  }`}
                >
                  {item.validated
                    ? <><CheckCircle2 className="w-4 h-4" /> Validado</>
                    : <><XCircle className="w-4 h-4" /> Marcar como validado</>
                  }
                </button>
              </div>
            ))}
            <p className="text-xs text-neutral-600 text-center">{filtered.length} registro(s)</p>
          </div>
        )}
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
