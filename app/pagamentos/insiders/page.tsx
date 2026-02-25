"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Search } from "lucide-react"
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

  const filteredInsiders = insiders.filter((insider) =>
    insider.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    insider.cpf.includes(searchTerm)
  )

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
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInsiders.map((insider) => (
                      <tr key={insider.id} className="border-b border-neutral-700 hover:bg-neutral-700/50 transition-colors">
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
    </div>
  )
}
