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
    <div className="flex-1 p-6 overflow-auto bg-neutral-900">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Insiders</h1>
          <p className="text-neutral-400">Gerenciamento de dados dos Insiders Somma</p>
        </div>

        {/* Controls */}
        <Card className="bg-neutral-800 border-neutral-700">
          <CardContent className="pt-6 flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <Input
                placeholder="Buscar por nome ou CPF..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-neutral-700 border-neutral-600 text-white"
              />
            </div>
            <Button
              onClick={() => setShowFilters(!showFilters)}
              className={`gap-2 ${hasActiveFilters ? "bg-blue-600 hover:bg-blue-700" : "bg-neutral-700 hover:bg-neutral-600"} text-white`}
            >
              <Filter className="w-4 h-4" />
              Filtros {hasActiveFilters && `(${Object.values(filters).filter(f => f !== "").length})`}
            </Button>
            <Button
              onClick={openCreateModal}
              className="bg-green-600 hover:bg-green-700 text-white gap-2"
            >
              <Plus className="w-4 h-4" />
              Novo Insider
            </Button>
            <Button
              onClick={exportToCSV}
              disabled={filteredInsiders.length === 0}
              className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </Button>
            <Button
              onClick={fetchInsiders}
              variant="outline"
              className="border-neutral-600 text-neutral-400 hover:text-white"
            >
              Atualizar
            </Button>
          </CardContent>
        </Card>

        {/* Advanced Filters */}
        {showFilters && (
          <Card className="bg-neutral-800 border-neutral-700">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">Filtros Avançados</CardTitle>
                <Button
                  onClick={resetFilters}
                  variant="outline"
                  size="sm"
                  className="border-neutral-600 text-neutral-400 text-xs"
                  disabled={!hasActiveFilters}
                >
                  Limpar Filtros
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div>
                  <label className="text-neutral-400 text-xs block mb-2">Evolve</label>
                  <select
                    value={filters.evolve}
                    onChange={(e) => setFilters({ ...filters, evolve: e.target.value })}
                    className="w-full bg-neutral-700 border border-neutral-600 text-white px-3 py-2 rounded-md text-sm"
                  >
                    <option value="">Todos</option>
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                  </select>
                </div>
                <div>
                  <label className="text-neutral-400 text-xs block mb-2">Dopamina</label>
                  <select
                    value={filters.dopahmina}
                    onChange={(e) => setFilters({ ...filters, dopahmina: e.target.value })}
                    className="w-full bg-neutral-700 border border-neutral-600 text-white px-3 py-2 rounded-md text-sm"
                  >
                    <option value="">Todos</option>
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                  </select>
                </div>
                <div>
                  <label className="text-neutral-400 text-xs block mb-2">Tex Barbearia</label>
                  <select
                    value={filters.tex_barbearia}
                    onChange={(e) => setFilters({ ...filters, tex_barbearia: e.target.value })}
                    className="w-full bg-neutral-700 border border-neutral-600 text-white px-3 py-2 rounded-md text-sm"
                  >
                    <option value="">Todos</option>
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                  </select>
                </div>
                <div>
                  <label className="text-neutral-400 text-xs block mb-2">Big Box</label>
                  <select
                    value={filters.big_box}
                    onChange={(e) => setFilters({ ...filters, big_box: e.target.value })}
                    className="w-full bg-neutral-700 border border-neutral-600 text-white px-3 py-2 rounded-md text-sm"
                  >
                    <option value="">Todos</option>
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                  </select>
                </div>
                <div>
                  <label className="text-neutral-400 text-xs block mb-2">Cupom Loja Somma</label>
                  <Input
                    value={filters.cupom_loja_somma}
                    onChange={(e) => setFilters({ ...filters, cupom_loja_somma: e.target.value })}
                    placeholder="Buscar..."
                    className="bg-neutral-700 border-neutral-600 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-neutral-400 text-xs block mb-2">Assessoria Somma</label>
                  <Input
                    value={filters.assessoria_somma}
                    onChange={(e) => setFilters({ ...filters, assessoria_somma: e.target.value })}
                    placeholder="Buscar..."
                    className="bg-neutral-700 border-neutral-600 text-white text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status */}
        <div className="flex gap-4">
          <Card className="bg-neutral-800 border-neutral-700 flex-1">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-500">{filteredInsiders.length}</div>
                <div className="text-sm text-neutral-400">Insiders {searchTerm ? "encontrados" : "totais"}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error Message */}
        {error && (
          <Card className="bg-red-900/20 border-red-500/50">
            <CardContent className="pt-6 text-red-400 text-sm">
              {error}
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {loading && (
          <Card className="bg-neutral-800 border-neutral-700">
            <CardContent className="pt-6 text-center py-12">
              <div className="animate-pulse text-neutral-400">Carregando dados...</div>
            </CardContent>
          </Card>
        )}

        {/* Table */}
        {!loading && filteredInsiders.length > 0 && (
          <Card className="bg-neutral-800 border-neutral-700">
            <CardHeader>
              <CardTitle className="text-white">Lista de Insiders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-700">
                      <th className="px-4 py-3 text-left text-neutral-400 font-medium">Nome</th>
                      <th className="px-4 py-3 text-left text-neutral-400 font-medium">CPF</th>
                      <th className="px-4 py-3 text-center text-neutral-400 font-medium">Evolve</th>
                      <th className="px-4 py-3 text-center text-neutral-400 font-medium">Dopamina</th>
                      <th className="px-4 py-3 text-center text-neutral-400 font-medium">Tex Barbearia</th>
                      <th className="px-4 py-3 text-center text-neutral-400 font-medium">Big Box</th>
                      <th className="px-4 py-3 text-center text-neutral-400 font-medium">Cupom Loja Somma</th>
                      <th className="px-4 py-3 text-center text-neutral-400 font-medium">Assessoria Somma</th>
                      <th className="px-4 py-3 text-center text-neutral-400 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInsiders.map((insider) => (
                      <tr 
                        key={insider.id} 
                        onClick={() => openViewModal(insider)}
                        className="border-b border-neutral-700 hover:bg-neutral-700/50 transition-colors cursor-pointer"
                      >
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
                            insider.dopahmina === "Sim" ? "bg-green-500/20 text-green-400" : "bg-neutral-700 text-neutral-400"
                          }`}>
                            {insider.dopahmina === "Sim" ? "✓" : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                            insider.tex_barbearia === "Sim" ? "bg-green-500/20 text-green-400" : "bg-neutral-700 text-neutral-400"
                          }`}>
                            {insider.tex_barbearia === "Sim" ? "✓" : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                            insider.big_box === "Sim" ? "bg-green-500/20 text-green-400" : "bg-neutral-700 text-neutral-400"
                          }`}>
                            {insider.big_box === "Sim" ? "✓" : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-neutral-400">{insider.cupom_loja_somma || "—"}</td>
                        <td className="px-4 py-3 text-center text-neutral-400">{insider.assessoria_somma || "—"}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                openViewModal(insider)
                              }}
                              className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400"
                              title="Visualizar"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                openEditModal(insider)
                              }}
                              className="p-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDelete(insider.id)
                              }}
                              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400"
                              title="Deletar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!loading && filteredInsiders.length === 0 && !error && (
          <Card className="bg-neutral-800 border-neutral-700">
            <CardContent className="pt-6 text-center py-12">
              <div className="text-neutral-400">
                {searchTerm ? "Nenhum insider encontrado com essa busca" : "Nenhum insider cadastrado"}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* View Modal */}
      {showViewModal && selectedInsider && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <Card className="bg-neutral-800 border-neutral-700 w-full max-w-2xl my-4">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-white">Detalhes do Insider</CardTitle>
              <button onClick={() => setShowViewModal(false)} className="text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-neutral-400 text-xs block mb-1">Nome</label>
                  <div className="text-white font-medium">{selectedInsider.nome}</div>
                </div>
                <div>
                  <label className="text-neutral-400 text-xs block mb-1">CPF</label>
                  <div className="text-white font-medium">{selectedInsider.cpf}</div>
                </div>
                <div>
                  <label className="text-neutral-400 text-xs block mb-1">Evolve</label>
                  <div className="text-white">{selectedInsider.evolve || "—"}</div>
                </div>
                <div>
                  <label className="text-neutral-400 text-xs block mb-1">Dopamina</label>
                  <div className="text-white">{selectedInsider.dopahmina || "—"}</div>
                </div>
                <div>
                  <label className="text-neutral-400 text-xs block mb-1">Tex Barbearia</label>
                  <div className="text-white">{selectedInsider.tex_barbearia || "—"}</div>
                </div>
                <div>
                  <label className="text-neutral-400 text-xs block mb-1">Big Box</label>
                  <div className="text-white">{selectedInsider.big_box || "—"}</div>
                </div>
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
