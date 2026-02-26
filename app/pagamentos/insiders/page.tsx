"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Search, Plus, Eye, Edit, Trash2, X, Filter, MoreHorizontal, Users } from "lucide-react"
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
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedInsider, setSelectedInsider] = useState<Insider | null>(null)

  useEffect(() => {
    fetchInsiders()
  }, [])

  const fetchInsiders = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log("[v0] Fetching insiders data...")
      const { data, error: err } = await supabase
        .from("dados_insiders")
        .select("*")
        .limit(100)

      if (err) {
        console.error("[v0] Error fetching insiders:", err)
        setError(err.message)
        return
      }

      console.log("[v0] Insiders fetched successfully, count:", data?.length)
      setInsiders(data || [])
    } catch (err: any) {
      console.error("[v0] Error fetching insiders:", err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este insider?")) return

    try {
      const { error: err } = await supabase
        .from("dados_insiders")
        .delete()
        .eq("id", id)

      if (err) {
        console.error("[v0] Error deleting insider:", err)
        alert("Erro ao deletar insider")
        return
      }

      setInsiders(insiders.filter((i) => i.id !== id))
      console.log("[v0] Insider deleted successfully")
    } catch (err: any) {
      console.error("[v0] Error deleting insider:", err)
      alert("Erro ao deletar insider")
    }
  }

  const filteredInsiders = insiders.filter((insider) =>
    insider.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    insider.cpf.includes(searchTerm)
  )

  const exportToCSV = () => {
    const headers = ["Nome", "CPF", "Evolve", "Dopamina", "Tex Barbearia", "Big Box", "Cupom Somma", "Assessoria Somma"]
    const data = filteredInsiders.map((i) => [
      i.nome,
      i.cpf,
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
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden">
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-white tracking-wider">INSIDERS</h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">Gerencie membros VIP e seus benefícios</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={exportToCSV}
            variant="outline"
            size="sm"
            className="border-neutral-700 text-neutral-400 hover:text-white h-9 px-3 text-xs"
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            Exportar
          </Button>
          <Button
            onClick={() => setShowViewModal(false)}
            size="sm"
            className="bg-orange-500 hover:bg-orange-600 text-white h-9 px-3 text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Novo
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-neutral-900 border-neutral-700">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[10px] text-neutral-400 tracking-wider mb-1">TOTAL</p>
            <p className="text-2xl font-bold text-white font-mono">{insiders.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-neutral-900 border-neutral-700">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[10px] text-neutral-400 tracking-wider mb-1">COM EVOLVE</p>
            <p className="text-2xl font-bold text-orange-500 font-mono">
              {insiders.filter((i) => i.evolve).length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-neutral-900 border-neutral-700">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[10px] text-neutral-400 tracking-wider mb-1">COM CUPOM</p>
            <p className="text-2xl font-bold text-green-500 font-mono">
              {insiders.filter((i) => i.cupom_loja_somma).length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-neutral-900 border-neutral-700">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[10px] text-neutral-400 tracking-wider mb-1">ASSESSORIA</p>
            <p className="text-2xl font-bold text-blue-500 font-mono">
              {insiders.filter((i) => i.assessoria_somma).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
        <Input
          placeholder="Buscar por nome ou CPF..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 bg-neutral-900 border-neutral-700 text-white placeholder-neutral-500 text-sm h-10"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-neutral-400">Carregando insiders...</div>
      ) : error ? (
        <div className="text-center py-12 text-red-400">Erro: {error}</div>
      ) : filteredInsiders.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
          <p className="text-neutral-400">{searchTerm ? "Nenhum insider encontrado" : "Nenhum insider cadastrado"}</p>
        </div>
      ) : (
        <>
          {/* Grid View - Mobile Optimized */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredInsiders.map((insider) => (
              <div
                key={insider.id}
                className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 hover:border-orange-500/40 transition-colors"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">{insider.nome.toUpperCase()}</h3>
                    <p className="text-xs text-neutral-400 mt-0.5">{insider.cpf}</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedInsider(insider)
                      setShowViewModal(true)
                    }}
                    className="p-1.5 text-neutral-400 hover:text-orange-500 active:scale-90 transition-all shrink-0 ml-2"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>

                {/* Benefits Grid */}
                <div className="space-y-2 mb-4 py-3 border-t border-b border-neutral-800">
                  {[
                    { label: "Evolve", value: insider.evolve, color: "orange" },
                    { label: "Dopamina", value: insider.dopahmina, color: "red" },
                    { label: "Tex Barbearia", value: insider.tex_barbearia, color: "purple" },
                    { label: "Big Box", value: insider.big_box, color: "cyan" },
                  ].map((benefit, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-xs text-neutral-400">{benefit.label}</span>
                      <span className="text-xs font-mono text-white">
                        {benefit.value ? "✓" : "—"}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Somma Benefits */}
                <div className="space-y-1 mb-4">
                  {insider.cupom_loja_somma && (
                    <div className="flex items-center gap-1 text-xs bg-green-500/10 text-green-400 px-2 py-1 rounded">
                      <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full" />
                      Cupom: {insider.cupom_loja_somma}
                    </div>
                  )}
                  {insider.assessoria_somma && (
                    <div className="flex items-center gap-1 text-xs bg-blue-500/10 text-blue-400 px-2 py-1 rounded">
                      <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full" />
                      Assessoria: {insider.assessoria_somma}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedInsider(insider)
                      setShowViewModal(true)
                    }}
                    className="flex-1 py-1.5 px-2 rounded-lg border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-600 text-xs font-medium active:scale-95 transition-all"
                  >
                    <Eye className="w-3.5 h-3.5 inline mr-1" />
                    Ver
                  </button>
                  <button
                    onClick={() => handleDelete(insider.id)}
                    className="py-1.5 px-2 rounded-lg border border-neutral-700 text-neutral-400 hover:text-red-500 hover:border-red-700/50 text-xs font-medium active:scale-95 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      </div>

      {/* View Modal */}
      {showViewModal && selectedInsider && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <Card className="bg-neutral-800 border-neutral-700 w-full max-w-2xl my-4">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-white text-lg">{selectedInsider.nome.toUpperCase()}</CardTitle>
              <button
                onClick={() => setShowViewModal(false)}
                className="text-neutral-400 hover:text-white active:scale-90 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Grid Layout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-neutral-400 text-xs block mb-1 tracking-wide">NOME</label>
                  <div className="text-white font-medium">{selectedInsider.nome}</div>
                </div>
                <div>
                  <label className="text-neutral-400 text-xs block mb-1 tracking-wide">CPF</label>
                  <div className="text-white font-mono">{selectedInsider.cpf}</div>
                </div>
                <div>
                  <label className="text-neutral-400 text-xs block mb-1 tracking-wide">EVOLVE</label>
                  <div className="text-white">{selectedInsider.evolve || "—"}</div>
                </div>
                <div>
                  <label className="text-neutral-400 text-xs block mb-1 tracking-wide">DOPAMINA</label>
                  <div className="text-white">{selectedInsider.dopahmina || "—"}</div>
                </div>
                <div>
                  <label className="text-neutral-400 text-xs block mb-1 tracking-wide">TEX BARBEARIA</label>
                  <div className="text-white">{selectedInsider.tex_barbearia || "—"}</div>
                </div>
                <div>
                  <label className="text-neutral-400 text-xs block mb-1 tracking-wide">BIG BOX</label>
                  <div className="text-white">{selectedInsider.big_box || "—"}</div>
                </div>
                <div>
                  <label className="text-neutral-400 text-xs block mb-1 tracking-wide">CUPOM SOMMA</label>
                  <div className="text-white">{selectedInsider.cupom_loja_somma || "—"}</div>
                </div>
                <div>
                  <label className="text-neutral-400 text-xs block mb-1 tracking-wide">ASSESSORIA SOMMA</label>
                  <div className="text-white">{selectedInsider.assessoria_somma || "—"}</div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-neutral-700">
                <Button
                  onClick={() => setShowViewModal(false)}
                  variant="outline"
                  className="flex-1 border-neutral-700 text-neutral-400 hover:text-white"
                >
                  Fechar
                </Button>
                <Button
                  onClick={() => handleDelete(selectedInsider.id)}
                  variant="destructive"
                  className="flex-1"
                >
                  Deletar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
