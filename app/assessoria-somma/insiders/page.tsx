"use client"

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronDown, Search } from "lucide-react"

interface InsiderData {
  id: string
  nome: string
  cpf: string
  assessoria_somma: string
  cupom_loja_somma: string
  evolve: string
  dopahmina: string
  tex_barbearia: string
  big_box: string
}

export default function InsidersPage() {
  const [insiders, setInsiders] = useState<InsiderData[]>([])
  const [filteredInsiders, setFilteredInsiders] = useState<InsiderData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetchInsiders()
  }, [])

  useEffect(() => {
    // Filtrar por nome ou CPF
    const filtered = insiders.filter(
      (insider) =>
        insider.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        insider.cpf.includes(searchTerm)
    )
    setFilteredInsiders(filtered)
  }, [searchTerm, insiders])

  const fetchInsiders = async () => {
    setLoading(true)
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseKey) {
        console.error("[v0] Supabase credentials not configured")
        setLoading(false)
        return
      }

      const supabase = createClient(supabaseUrl, supabaseKey)
      console.log("[v0] Fetching insiders data from dados_insiders table")

      const { data, error } = await supabase
        .from("dados_insiders")
        .select("*")
        .order("nome", { ascending: true })

      if (error) {
        console.error("[v0] Error fetching insiders:", error.message)
      } else {
        console.log("[v0] Fetched insiders count:", data?.length || 0)
        setInsiders(data || [])
        setFilteredInsiders(data || [])
      }
    } catch (err) {
      console.error("[v0] Error in fetchInsiders:", err)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (value: string) => {
    if (!value) return "text-neutral-500"
    const lower = value.toLowerCase()
    if (lower === "ativo" || lower === "yes" || lower === "sim") return "text-green-400"
    if (lower === "inativo" || lower === "no" || lower === "não") return "text-red-400"
    return "text-blue-400"
  }

  return (
    <div className="flex-1 overflow-auto bg-neutral-900 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Insiders</h1>
        <p className="text-neutral-400 text-sm">Gestão de dados dos insiders - Benefícios e cupons</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="bg-neutral-800 border-neutral-700">
          <CardContent className="pt-4">
            <div className="text-3xl font-bold text-orange-500">{filteredInsiders.length}</div>
            <p className="text-xs text-neutral-400 mt-1">Total de Insiders</p>
          </CardContent>
        </Card>
        <Card className="bg-neutral-800 border-neutral-700">
          <CardContent className="pt-4">
            <div className="text-3xl font-bold text-green-400">
              {insiders.filter((i) => i.assessoria_somma && i.assessoria_somma.toLowerCase() === "ativo").length}
            </div>
            <p className="text-xs text-neutral-400 mt-1">Assessoria Ativa</p>
          </CardContent>
        </Card>
        <Card className="bg-neutral-800 border-neutral-700">
          <CardContent className="pt-4">
            <div className="text-3xl font-bold text-blue-400">
              {insiders.filter((i) => i.cupom_loja_somma && i.cupom_loja_somma.toLowerCase() === "ativo").length}
            </div>
            <p className="text-xs text-neutral-400 mt-1">Cupom Loja Ativa</p>
          </CardContent>
        </Card>
        <Card className="bg-neutral-800 border-neutral-700">
          <CardContent className="pt-4">
            <div className="text-3xl font-bold text-purple-400">{insiders.length}</div>
            <p className="text-xs text-neutral-400 mt-1">Beneficiários</p>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="mb-6 flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <Input
            type="text"
            placeholder="Buscar por nome ou CPF..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-neutral-800 border-neutral-700 text-white"
          />
        </div>
        <Button onClick={fetchInsiders} variant="outline" className="border-neutral-700">
          Atualizar
        </Button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredInsiders.length === 0 && (
        <Card className="bg-neutral-800 border-neutral-700 text-center py-12">
          <CardContent>
            <p className="text-neutral-400 mb-4">Nenhum insider encontrado</p>
            <Button onClick={fetchInsiders} variant="outline" className="border-neutral-700">
              Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Insiders List */}
      {!loading && filteredInsiders.length > 0 && (
        <div className="space-y-3">
          {filteredInsiders.map((insider) => (
            <Card
              key={insider.id}
              className="bg-neutral-800 border-neutral-700 hover:border-neutral-600 transition-colors cursor-pointer"
              onClick={() => setExpandedId(expandedId === insider.id ? null : insider.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-white truncate">{insider.nome}</CardTitle>
                    <p className="text-xs text-neutral-400 mt-1">CPF: {insider.cpf}</p>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-neutral-500 flex-shrink-0 transition-transform ${
                      expandedId === insider.id ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </CardHeader>

              {/* Expanded Content */}
              {expandedId === insider.id && (
                <CardContent>
                  <div className="space-y-3 pt-2 border-t border-neutral-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Assessoria Somma */}
                      <div className="p-3 bg-neutral-700/50 rounded-lg">
                        <p className="text-xs text-neutral-400 mb-1">Assessoria Somma</p>
                        <p className={`text-sm font-semibold ${getStatusColor(insider.assessoria_somma)}`}>
                          {insider.assessoria_somma || "-"}
                        </p>
                      </div>

                      {/* Cupom Loja Somma */}
                      <div className="p-3 bg-neutral-700/50 rounded-lg">
                        <p className="text-xs text-neutral-400 mb-1">Cupom Loja Somma</p>
                        <p className={`text-sm font-semibold ${getStatusColor(insider.cupom_loja_somma)}`}>
                          {insider.cupom_loja_somma || "-"}
                        </p>
                      </div>

                      {/* Evolve */}
                      <div className="p-3 bg-neutral-700/50 rounded-lg">
                        <p className="text-xs text-neutral-400 mb-1">Evolve</p>
                        <p className={`text-sm font-semibold ${getStatusColor(insider.evolve)}`}>
                          {insider.evolve || "-"}
                        </p>
                      </div>

                      {/* Dopamina */}
                      <div className="p-3 bg-neutral-700/50 rounded-lg">
                        <p className="text-xs text-neutral-400 mb-1">Dopamina</p>
                        <p className={`text-sm font-semibold ${getStatusColor(insider.dopahmina)}`}>
                          {insider.dopahmina || "-"}
                        </p>
                      </div>

                      {/* Tex Barbearia */}
                      <div className="p-3 bg-neutral-700/50 rounded-lg">
                        <p className="text-xs text-neutral-400 mb-1">Tex Barbearia</p>
                        <p className={`text-sm font-semibold ${getStatusColor(insider.tex_barbearia)}`}>
                          {insider.tex_barbearia || "-"}
                        </p>
                      </div>

                      {/* Big Box */}
                      <div className="p-3 bg-neutral-700/50 rounded-lg">
                        <p className="text-xs text-neutral-400 mb-1">Big Box</p>
                        <p className={`text-sm font-semibold ${getStatusColor(insider.big_box)}`}>
                          {insider.big_box || "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
