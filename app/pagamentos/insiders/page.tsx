"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Search, Plus, Eye, Edit, Trash2, X, Filter } from "lucide-react"
import { Input } from "@/components/ui/input"

interface Insider {
  id: string
  nome: string
  cpf: string
  evolve: string
  dopahmina: string
  tex_barbearia: string
  big_box: string
  cupom_loja_somma: string
  assessoria_somma: string
}

export default function InsidersPage() {
  const [insiders, setInsiders] = useState<Insider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    evolve: "",
    dopahmina: "",
    tex_barbearia: "",
    big_box: "",
    cupom_loja_somma: "",
    assessoria_somma: "",
  })
  const [showViewModal, setShowViewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedInsider, setSelectedInsider] = useState<Insider | null>(null)
  const [formData, setFormData] = useState<Insider | null>(null)
  const [savingForm, setSavingForm] = useState(false)

  useEffect(() => {
    fetchInsiders()
  }, [])

  const fetchInsiders = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log("[v0] Fetching insiders data...")

      const { data, error: fetchError } = await supabase
        .from("dados_insiders")
        .select("*")
        .order("nome", { ascending: true })

      if (fetchError) {
        console.error("[v0] Error fetching insiders:", fetchError)
        setError(`Erro ao carregar dados: ${fetchError.message}`)
        return
      }

      console.log("[v0] Insiders fetched successfully, count:", data?.length || 0)
      setInsiders(data || [])
    } catch (err) {
      console.error("[v0] Unexpected error:", err)
      setError("Erro inesperado ao carregar dados")
    } finally {
      setLoading(false)
    }
  }

  const filteredInsiders = insiders.filter((insider) => {
    // Filtro de busca por nome/CPF
    const searchMatch = insider.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      insider.cpf.includes(searchTerm)
    
    if (!searchMatch) return false
    
    // Filtros avançados
    if (filters.evolve && insider.evolve !== filters.evolve) return false
    if (filters.dopahmina && insider.dopahmina !== filters.dopahmina) return false
    if (filters.tex_barbearia && insider.tex_barbearia !== filters.tex_barbearia) return false
    if (filters.big_box && insider.big_box !== filters.big_box) return false
    if (filters.cupom_loja_somma && !insider.cupom_loja_somma?.toLowerCase().includes(filters.cupom_loja_somma.toLowerCase())) return false
    if (filters.assessoria_somma && !insider.assessoria_somma?.toLowerCase().includes(filters.assessoria_somma.toLowerCase())) return false
    
    return true
  })

  const openViewModal = (insider: Insider) => {
    setSelectedInsider(insider)
    setShowViewModal(true)
  }

  const openEditModal = (insider: Insider) => {
    setFormData({ ...insider })
    setSelectedInsider(insider)
    setShowEditModal(true)
  }

  const openCreateModal = () => {
    setFormData({
      id: "",
      nome: "",
      cpf: "",
      evolve: "",
      dopahmina: "",
      tex_barbearia: "",
      big_box: "",
      cupom_loja_somma: "",
      assessoria_somma: "",
    })
    setShowCreateModal(true)
  }

  const resetFilters = () => {
    setFilters({
      evolve: "",
      dopahmina: "",
      tex_barbearia: "",
      big_box: "",
      cupom_loja_somma: "",
      assessoria_somma: "",
    })
  }

  const hasActiveFilters = Object.values(filters).some((f) => f !== "")

  const handleSave = async () => {
    if (!formData) return
    if (!formData.nome || !formData.cpf) {
      setError("Nome e CPF são obrigatórios")
      return
    }

    setSavingForm(true)
    try {
      if (formData.id) {
        // Editar
        const { error: updateError } = await supabase
          .from("dados_insiders")
          .update(formData)
          .eq("id", formData.id)

        if (updateError) throw updateError
        console.log("[v0] Insider atualizado com sucesso")
      } else {
        // Criar novo
        const { error: insertError } = await supabase
          .from("dados_insiders")
          .insert([formData])

        if (insertError) throw insertError
        console.log("[v0] Insider criado com sucesso")
      }

      setShowEditModal(false)
      setShowCreateModal(false)
      setFormData(null)
      await fetchInsiders()
    } catch (err) {
      console.error("[v0] Error saving insider:", err)
      setError("Erro ao salvar insider")
    } finally {
      setSavingForm(false)
    }
  }

  const handleDelete = async (insiderId: string) => {
    if (!confirm("Tem certeza que deseja deletar este insider?")) return

    try {
      const { error: deleteError } = await supabase
        .from("dados_insiders")
        .delete()
        .eq("id", insiderId)

      if (deleteError) throw deleteError
      console.log("[v0] Insider deletado com sucesso")
      await fetchInsiders()
    } catch (err) {
      console.error("[v0] Error deleting insider:", err)
      setError("Erro ao deletar insider")
    }
  }

  const exportToCSV = () => {
    const headers = ["Nome", "CPF", "Evolve", "Dopamina", "Tex Barbearia", "Big Box", "Cupom Loja Somma", "Assessoria Somma"]
    const rows = filteredInsiders.map((insider) => [
      insider.nome,
      insider.cpf,
      insider.evolve || "",
      insider.dopahmina || "",
      insider.tex_barbearia || "",
      insider.big_box || "",
      insider.cupom_loja_somma || "",
      insider.assessoria_somma || "",
    ])

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `insiders_${new Date().toISOString().split("T")[0]}.csv`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden">
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-lg sm:text-3xl font-bold text-white tracking-wider mb-1">INSIDERS</h1>
          <p className="text-xs sm:text-sm text-neutral-400">Gerenciamento de dados dos Insiders Somma</p>
        </div>

        {/* Controls — Stack on mobile, row on tablet+ */}
        <div className="space-y-2 sm:space-y-0 sm:flex sm:gap-2 sm:items-center">
          <div className="flex-1 min-w-0 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 pointer-events-none shrink-0" />
            <Input
              placeholder="Nome ou CPF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-neutral-800 border-neutral-700 text-white placeholder-neutral-500 text-xs sm:text-sm py-2 h-10"
            />
          </div>
          <div className="flex gap-2 min-w-0 overflow-x-auto scrollbar-hide sm:overflow-visible">
            <Button
              onClick={() => setShowFilters(!showFilters)}
              size="sm"
              className={`text-xs px-3 h-10 shrink-0 gap-1.5 ${
                hasActiveFilters 
                  ? "bg-blue-600 hover:bg-blue-700" 
                  : "bg-neutral-700 hover:bg-neutral-600"
              } text-white`}
            >
              <Filter className="w-3.5 h-3.5" />
              Filtros
            </Button>
            <Button
              onClick={openCreateModal}
              size="sm"
              className="text-xs px-3 h-10 shrink-0 gap-1 bg-green-600 hover:bg-green-700 text-white"
            >
              <Plus className="w-3.5 h-3.5" />
              Novo
            </Button>
            <Button
              onClick={exportToCSV}
              disabled={filteredInsiders.length === 0}
              size="sm"
              className="text-xs px-3 h-10 shrink-0 gap-1 bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </Button>
            <Button
              onClick={fetchInsiders}
              variant="outline"
              size="sm"
              className="text-xs px-3 h-10 shrink-0 border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-600"
            >
              Atualizar
            </Button>
          </div>
        </div>

        {/* Advanced Filters — Collapsible, full-width on mobile */}
        {showFilters && (
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-3 sm:p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">Filtros Avançados</h3>
              <Button
                onClick={resetFilters}
                variant="outline"
                size="sm"
                className="text-xs px-2 h-8 border-neutral-700 text-neutral-400 shrink-0"
                disabled={!hasActiveFilters}
              >
                Limpar
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {[
                { key: "evolve", label: "Evolve" },
                { key: "dopahmina", label: "Dopamina" },
                { key: "tex_barbearia", label: "Tex Barb." },
                { key: "big_box", label: "Big Box" },
                { key: "cupom_loja_somma", label: "Cupom" },
                { key: "assessoria_somma", label: "Assessoria" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-[10px] text-neutral-400 block mb-1">{label}</label>
                  {key.includes("cupom") || key.includes("assessoria") ? (
                    <Input
                      value={filters[key as keyof typeof filters]}
                      onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}
                      placeholder="..."
                      className="bg-neutral-800 border-neutral-700 text-white text-xs h-8 px-2"
                    />
                  ) : (
                    <select
                      value={filters[key as keyof typeof filters]}
                      onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}
                      className="w-full bg-neutral-800 border border-neutral-700 text-white text-xs px-2 py-1.5 rounded h-8"
                    >
                      <option value="">Todos</option>
                      <option value="Sim">Sim</option>
                      <option value="Não">Não</option>
                    </select>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-orange-500">{filteredInsiders.length}</div>
            <div className="text-[10px] text-neutral-400 mt-1">Insiders</div>
          </div>
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-500">{filteredInsiders.filter(i => i.evolve === "Sim").length}</div>
            <div className="text-[10px] text-neutral-400 mt-1">Evolve</div>
          </div>
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-500">{filteredInsiders.filter(i => i.dopahmina === "Sim").length}</div>
            <div className="text-[10px] text-neutral-400 mt-1">Dopamina</div>
          </div>
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-purple-500">{filteredInsiders.filter(i => i.big_box === "Sim").length}</div>
            <div className="text-[10px] text-neutral-400 mt-1">Big Box</div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-12 text-neutral-400 text-sm">Carregando dados...</div>
        )}

        {/* Empty State */}
        {!loading && filteredInsiders.length === 0 && (
          <div className="text-center py-12 text-neutral-400 text-sm">Nenhum insider encontrado</div>
        )}

        {/* List — Cards on mobile, table on desktop */}
        {!loading && filteredInsiders.length > 0 && (
          <>
            {/* Mobile: Cards */}
            <div className="space-y-3 lg:hidden">
              {filteredInsiders.map((insider) => (
                <div
                  key={insider.id}
                  className="bg-neutral-900 border border-neutral-700 rounded-lg p-4 hover:border-orange-500/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-white text-sm truncate">{insider.nome}</h4>
                      <p className="text-xs text-neutral-400 truncate">{insider.cpf}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => openViewModal(insider)}
                        className="p-1.5 text-neutral-400 hover:text-white active:scale-90 transition"
                        title="Visualizar"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openEditModal(insider)}
                        className="p-1.5 text-neutral-400 hover:text-white active:scale-90 transition"
                        title="Editar"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(insider.id)}
                        className="p-1.5 text-neutral-400 hover:text-red-500 active:scale-90 transition"
                        title="Deletar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-center">
                    <div className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mx-auto ${
                      insider.evolve === "Sim" ? "bg-green-500/20 text-green-400" : "bg-neutral-800 text-neutral-500"
                    }`}>
                      {insider.evolve === "Sim" ? "✓" : "—"}
                    </div>
                    <div className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mx-auto ${
                      insider.dopahmina === "Sim" ? "bg-blue-500/20 text-blue-400" : "bg-neutral-800 text-neutral-500"
                    }`}>
                      {insider.dopahmina === "Sim" ? "✓" : "—"}
                    </div>
                    <div className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mx-auto ${
                      insider.tex_barbearia === "Sim" ? "bg-purple-500/20 text-purple-400" : "bg-neutral-800 text-neutral-500"
                    }`}>
                      {insider.tex_barbearia === "Sim" ? "✓" : "—"}
                    </div>
                    <div className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mx-auto ${
                      insider.big_box === "Sim" ? "bg-yellow-500/20 text-yellow-400" : "bg-neutral-800 text-neutral-500"
                    }`}>
                      {insider.big_box === "Sim" ? "✓" : "—"}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: Table */}
            <div className="hidden lg:block bg-neutral-900 border border-neutral-700 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-neutral-700 bg-neutral-800/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-neutral-400 font-medium">Nome</th>
                      <th className="px-4 py-3 text-left text-neutral-400 font-medium">CPF</th>
                      <th className="px-4 py-3 text-center text-neutral-400 font-medium">Evolve</th>
                      <th className="px-4 py-3 text-center text-neutral-400 font-medium">Dopamina</th>
                      <th className="px-4 py-3 text-center text-neutral-400 font-medium">Tex Barb.</th>
                      <th className="px-4 py-3 text-center text-neutral-400 font-medium">Big Box</th>
                      <th className="px-4 py-3 text-center text-neutral-400 font-medium">Cupom</th>
                      <th className="px-4 py-3 text-center text-neutral-400 font-medium">Assessoria</th>
                      <th className="px-4 py-3 text-center text-neutral-400 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInsiders.map((insider) => (
                      <tr key={insider.id} className="border-b border-neutral-700 hover:bg-neutral-800/50 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{insider.nome}</td>
                        <td className="px-4 py-3 text-neutral-400">{insider.cpf}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                            insider.evolve === "Sim" ? "bg-green-500/20 text-green-400" : "bg-neutral-700 text-neutral-400"
                          }`}>
                            {insider.evolve === "Sim" ? "✓" : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                            insider.dopahmina === "Sim" ? "bg-blue-500/20 text-blue-400" : "bg-neutral-700 text-neutral-400"
                          }`}>
                            {insider.dopahmina === "Sim" ? "✓" : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                            insider.tex_barbearia === "Sim" ? "bg-purple-500/20 text-purple-400" : "bg-neutral-700 text-neutral-400"
                          }`}>
                            {insider.tex_barbearia === "Sim" ? "✓" : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                            insider.big_box === "Sim" ? "bg-yellow-500/20 text-yellow-400" : "bg-neutral-700 text-neutral-400"
                          }`}>
                            {insider.big_box === "Sim" ? "✓" : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-neutral-400 text-xs truncate">{insider.cupom_loja_somma || "—"}</td>
                        <td className="px-4 py-3 text-center text-neutral-400 text-xs truncate">{insider.assessoria_somma || "—"}</td>
                        <td className="px-4 py-3 text-center flex items-center justify-center gap-1">
                          <button onClick={() => openViewModal(insider)} className="p-1 hover:text-white text-neutral-400 transition">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => openEditModal(insider)} className="p-1 hover:text-white text-neutral-400 transition">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(insider.id)} className="p-1 hover:text-red-500 text-neutral-400 transition">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

                <div>
                  <label className="text-neutral-400 text-xs block mb-1">Cupom Loja Somma</label>
                  <div className="text-white">{selectedInsider.cupom_loja_somma || "—"}</div>
                </div>
                <div>
                  <label className="text-neutral-400 text-xs block mb-1">Assessoria Somma</label>
                  <div className="text-white">{selectedInsider.assessoria_somma || "—"}</div>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => {
                    setShowViewModal(false)
                    openEditModal(selectedInsider)
                  }}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Editar
                </Button>
                <Button
                  onClick={() => setShowViewModal(false)}
                  variant="outline"
                  className="flex-1 border-neutral-600 text-neutral-400"
                >
                  Fechar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && formData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <Card className="bg-neutral-800 border-neutral-700 w-full max-w-2xl my-4">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-white">Editar Insider</CardTitle>
              <button onClick={() => setShowEditModal(false)} className="text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-neutral-400 text-xs block mb-1">Nome *</label>
                  <Input
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="bg-neutral-700 border-neutral-600 text-white"
                  />
                </div>
                <div>
                  <label className="text-neutral-400 text-xs block mb-1">CPF *</label>
                  <Input
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                    className="bg-neutral-700 border-neutral-600 text-white"
                  />
                </div>
                <div>
                  <label className="text-neutral-400 text-xs block mb-1">Evolve</label>
                  <select
                    value={formData.evolve}
                    onChange={(e) => setFormData({ ...formData, evolve: e.target.value })}
                    className="w-full bg-neutral-700 border border-neutral-600 text-white px-3 py-2 rounded-md"
                  >
                    <option value="">—</option>
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                  </select>
                </div>
                <div>
                  <label className="text-neutral-400 text-xs block mb-1">Dopamina</label>
                  <select
                    value={formData.dopahmina}
                    onChange={(e) => setFormData({ ...formData, dopahmina: e.target.value })}
                    className="w-full bg-neutral-700 border border-neutral-600 text-white px-3 py-2 rounded-md"
                  >
                    <option value="">—</option>
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                  </select>
                </div>
                <div>
                  <label className="text-neutral-400 text-xs block mb-1">Tex Barbearia</label>
                  <select
                    value={formData.tex_barbearia}
                    onChange={(e) => setFormData({ ...formData, tex_barbearia: e.target.value })}
                    className="w-full bg-neutral-700 border border-neutral-600 text-white px-3 py-2 rounded-md"
                  >
                    <option value="">—</option>
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                  </select>
                </div>
                <div>
                  <label className="text-neutral-400 text-xs block mb-1">Big Box</label>
                  <select
                    value={formData.big_box}
                    onChange={(e) => setFormData({ ...formData, big_box: e.target.value })}
                    className="w-full bg-neutral-700 border border-neutral-600 text-white px-3 py-2 rounded-md"
                  >
                    <option value="">—</option>
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-neutral-400 text-xs block mb-1">Cupom Loja Somma</label>
                  <Input
                    value={formData.cupom_loja_somma}
                    onChange={(e) => setFormData({ ...formData, cupom_loja_somma: e.target.value })}
                    className="bg-neutral-700 border-neutral-600 text-white"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-neutral-400 text-xs block mb-1">Assessoria Somma</label>
                  <Input
                    value={formData.assessoria_somma}
                    onChange={(e) => setFormData({ ...formData, assessoria_somma: e.target.value })}
                    className="bg-neutral-700 border-neutral-600 text-white"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleSave}
                  disabled={savingForm}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {savingForm ? "Salvando..." : "Salvar"}
                </Button>
                <Button
                  onClick={() => setShowEditModal(false)}
                  variant="outline"
                  className="flex-1 border-neutral-600 text-neutral-400"
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && formData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <Card className="bg-neutral-800 border-neutral-700 w-full max-w-2xl my-4">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-white">Novo Insider</CardTitle>
              <button onClick={() => setShowCreateModal(false)} className="text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-neutral-400 text-xs block mb-1">Nome *</label>
                  <Input
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="bg-neutral-700 border-neutral-600 text-white"
                    placeholder="Nome do insider"
                  />
                </div>
                <div>
                  <label className="text-neutral-400 text-xs block mb-1">CPF *</label>
                  <Input
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                    className="bg-neutral-700 border-neutral-600 text-white"
                    placeholder="000.000.000-00"
                  />
                </div>
                <div>
                  <label className="text-neutral-400 text-xs block mb-1">Evolve</label>
                  <select
                    value={formData.evolve}
                    onChange={(e) => setFormData({ ...formData, evolve: e.target.value })}
                    className="w-full bg-neutral-700 border border-neutral-600 text-white px-3 py-2 rounded-md"
                  >
                    <option value="">—</option>
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                  </select>
                </div>
                <div>
                  <label className="text-neutral-400 text-xs block mb-1">Dopamina</label>
                  <select
                    value={formData.dopahmina}
                    onChange={(e) => setFormData({ ...formData, dopahmina: e.target.value })}
                    className="w-full bg-neutral-700 border border-neutral-600 text-white px-3 py-2 rounded-md"
                  >
                    <option value="">—</option>
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                  </select>
                </div>
                <div>
                  <label className="text-neutral-400 text-xs block mb-1">Tex Barbearia</label>
                  <select
                    value={formData.tex_barbearia}
                    onChange={(e) => setFormData({ ...formData, tex_barbearia: e.target.value })}
                    className="w-full bg-neutral-700 border border-neutral-600 text-white px-3 py-2 rounded-md"
                  >
                    <option value="">—</option>
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                  </select>
                </div>
                <div>
                  <label className="text-neutral-400 text-xs block mb-1">Big Box</label>
                  <select
                    value={formData.big_box}
                    onChange={(e) => setFormData({ ...formData, big_box: e.target.value })}
                    className="w-full bg-neutral-700 border border-neutral-600 text-white px-3 py-2 rounded-md"
                  >
                    <option value="">—</option>
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-neutral-400 text-xs block mb-1">Cupom Loja Somma</label>
                  <Input
                    value={formData.cupom_loja_somma}
                    onChange={(e) => setFormData({ ...formData, cupom_loja_somma: e.target.value })}
                    className="bg-neutral-700 border-neutral-600 text-white"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-neutral-400 text-xs block mb-1">Assessoria Somma</label>
                  <Input
                    value={formData.assessoria_somma}
                    onChange={(e) => setFormData({ ...formData, assessoria_somma: e.target.value })}
                    className="bg-neutral-700 border-neutral-600 text-white"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleSave}
                  disabled={savingForm}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  {savingForm ? "Criando..." : "Criar Insider"}
                </Button>
                <Button
                  onClick={() => setShowCreateModal(false)}
                  variant="outline"
                  className="flex-1 border-neutral-600 text-neutral-400"
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
