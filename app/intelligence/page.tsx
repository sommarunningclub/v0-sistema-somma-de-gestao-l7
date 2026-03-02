"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Users, DollarSign, Award, Mail, Phone, Briefcase, Edit, Trash2, UserPlus, X, Check, Loader2, Download, ReceiptText } from "lucide-react"
import { supabase, type Professor, type ProfessorClient, type CommissionConfig } from "@/lib/supabase-client"
import { getSession } from "@/components/protected-route"

type TabType = "professors" | "commissions" | "repasse"

interface AsaasCustomer {
  id: string
  name: string
  email: string
  cpfCnpj: string
}

interface AsaasSubscription {
  id: string
  customer: string
  value: number
  status: string
  cycle: string
  nextDueDate: string
}

interface CommissionBreakdown {
  professorId: string
  professorName: string
  totalClients: number
  totalSubscriptionValue: number
  sommaFee: number
  professorCommission: number
}

export default function CarteirasPage() {
  const [activeTab, setActiveTab] = useState<TabType>("professors")
  const [professors, setProfessors] = useState<Professor[]>([])
  const [professorClients, setProfessorClients] = useState<ProfessorClient[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [showNewProfessorModal, setShowNewProfessorModal] = useState(false)
  const [showLinkClientModal, setShowLinkClientModal] = useState(false)
  const [showEditProfessorModal, setShowEditProfessorModal] = useState(false)
  const [selectedProfessor, setSelectedProfessor] = useState<Professor | null>(null)
  const [editingProfessor, setEditingProfessor] = useState<Professor | null>(null)
  const [expandedProfessorId, setExpandedProfessorId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    specialty: "",
    status: "active" as "active" | "inactive",
    client_type: "cliente_somma" as "cliente_somma" | "cliente_professor",
  })

  // Asaas customers state
  const [asaasCustomers, setAsaasCustomers] = useState<AsaasCustomer[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<AsaasCustomer | null>(null)
  const [selectedTag, setSelectedTag] = useState<string>("alunoprofessor")
  const [newCustomTag, setNewCustomTag] = useState<string>("")
  const [showNewTagInput, setShowNewTagInput] = useState(false)

  // Insiders state (para vincular na carteira)
  const [linkModalTab, setLinkModalTab] = useState<"asaas" | "insiders">("asaas")
  const [insiders, setInsiders] = useState<{ id: string; nome: string; cpf: string }[]>([])
  const [loadingInsiders, setLoadingInsiders] = useState(false)
  const [selectedInsider, setSelectedInsider] = useState<{ id: string; nome: string; cpf: string } | null>(null)
  const [insiderSearch, setInsiderSearch] = useState("")

  // Commissions state
  const [sommaFixedFee, setSommaFixedFee] = useState(50.00)
  const [editingFee, setEditingFee] = useState(false)
  const [newFeeValue, setNewFeeValue] = useState("50.00")
  const [commissionBreakdowns, setCommissionBreakdowns] = useState<CommissionBreakdown[]>([])
  const [loadingCommissions, setLoadingCommissions] = useState(false)

  // Repasse state
  const [repasseSettings, setRepasseSettings] = useState<Record<string, boolean>>({})
  const [loadingRepasse, setLoadingRepasse] = useState(false)
  const [showRepasseReport, setShowRepasseReport] = useState(false)
  const [repasseReport, setRepasseReport] = useState<any>(null)
  const [loadingRepasseReport, setLoadingRepasseReport] = useState(false)

  const fetchCommissionConfig = async () => {
    const { data, error } = await supabase
      .from("commission_config")
      .select("*")
      .single()

    if (error) {
      console.error("[v0] Error fetching commission config:", error)
    } else if (data) {
      setSommaFixedFee(data.somma_fixed_fee)
      setNewFeeValue(data.somma_fixed_fee.toFixed(2))
    }
  }

  const fetchCommissionData = async () => {
    setLoadingCommissions(true)
    const breakdowns: CommissionBreakdown[] = []

    for (const professor of professors) {
      // Filtrar apenas professores que PAGAM TAXA para Somma (enable_repasse = true)
      if (repasseSettings[professor.id] !== true) continue

      const clients = professorClients.filter(pc => pc.professor_id === professor.id)
      
      // Para cada cliente, buscar assinatura ativa do Asaas
      let totalSubscriptionValue = 0
      for (const client of clients) {
        try {
          const response = await fetch(`/api/asaas?endpoint=/subscriptions&customer=${client.asaas_customer_id}`)
          if (response.ok) {
            const data = await response.json()
            const activeSubs = (data.data || []).filter((s: AsaasSubscription) => s.status === "ACTIVE")
            totalSubscriptionValue += activeSubs.reduce((sum: number, s: AsaasSubscription) => sum + s.value, 0)
          }
        } catch (err) {
          console.error("[v0] Error fetching subscription for client:", client.asaas_customer_id, err)
        }
      }

      const sommaTotal = sommaFixedFee * clients.length
      const professorTotal = totalSubscriptionValue - sommaTotal

      breakdowns.push({
        professorId: professor.id,
        professorName: professor.name,
        totalClients: clients.length,
        totalSubscriptionValue,
        sommaFee: sommaTotal,
        professorCommission: professorTotal > 0 ? professorTotal : 0
      })
    }

    setCommissionBreakdowns(breakdowns)
    setLoadingCommissions(false)
  }

  const fetchRepasseSettings = async () => {
    setLoadingRepasse(true)
    try {
      const response = await fetch("/api/professores/repasse?action=list")
      if (response.ok) {
        const data = await response.json()
        const settingsMap: Record<string, boolean> = {}
        data.data?.forEach((s: any) => {
          settingsMap[s.professor_id] = s.enable_repasse
        })
        setRepasseSettings(settingsMap)
        return settingsMap
      }
    } catch (err) {
      console.error("[v0] Error fetching repasse settings:", err)
    }
    setLoadingRepasse(false)
    return {}
  }

  const handleToggleRepasse = async (professorId: string) => {
    try {
      const newValue = !repasseSettings[professorId]
      const response = await fetch("/api/professores/repasse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle",
          professor_id: professorId,
          enable_repasse: newValue,
          notes: newValue ? "Somma cobra taxa de comissão" : "Professor recebe repasse",
        }),
      })
      if (response.ok) {
        const data = await response.json()
        setRepasseSettings(prev => ({ ...prev, [professorId]: newValue }))
      }
    } catch (err) {
      console.error("[v0] Error toggling repasse:", err)
    }
  }

  const handleGenerateReport = async () => {
    setLoadingRepasseReport(true)
    try {
      const response = await fetch("/api/professores/repasse/report?action=generate")
      if (response.ok) {
        const data = await response.json()
        setRepasseReport(data)
      }
    } catch (err) {
      console.error("[v0] Error generating report:", err)
    }
    setLoadingRepasseReport(false)
  }

  const handleDownloadCSV = () => {
    if (!repasseReport) return

    const lines = repasseReport.reportLines || []
    const headers = ["Aluno (ID Asaas)", "Aluno (Nome)", "Professor (ID)", "Professor (Nome)", "Total Pago", "Somma Taxa", "Repasse Professor"]
    const rows = lines.map((line: any) => [
      line.aluno_asaas_id,
      line.aluno_nome,
      line.professor_id,
      line.professor_nome,
      line.total_pago.toFixed(2),
      line.somma_taxa_cobrada.toFixed(2),
      line.professor_repasse.toFixed(2),
    ])

    const csv = [headers, ...rows].map(r => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `repasse_${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  useEffect(() => {
    // Check if user is admin
    const session = getSession()
    if (session && session.role === 'admin') {
      setIsAdmin(true)
    }
    
    fetchProfessors(session)
    fetchProfessorClients(session)
    fetchCommissionConfig()
    if (isAdmin) {
      fetchRepasseSettings()
    }
  }, [])

  useEffect(() => {
    if (activeTab === "commissions" && isAdmin) {
      fetchRepasseSettings().then(() => fetchCommissionData())
    } else if (activeTab === "repasse" && isAdmin) {
      fetchRepasseSettings()
    }
  }, [activeTab, professors, professorClients, sommaFixedFee])

  const fetchProfessors = async (session: any) => {
    setLoading(true)
    let query = supabase.from("professors").select("*")
    
    // Se não for admin, filtra apenas o professor do usuário logado
    if (session && session.role !== 'admin') {
      query = query.eq("email", session.email)
    }
    
    const { data, error } = await query.order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Error fetching professors:", error)
    } else {
      console.log("[v0] Fetched professors, count:", data?.length || 0, "isAdmin:", !session || session.role === 'admin')
      setProfessors(data || [])
    }
    setLoading(false)
  }

  const fetchProfessorClients = async () => {
    try {
      const session = await getSession()
      let query = supabase.from("professor_clients").select("*").eq("status", "active")
      
      // Se não for admin, filtra apenas os clientes do professor do usuário logado
      if (session && session.role !== 'admin') {
        // Primeiro, encontra o professor com o email do usuário
        const { data: professorData } = await supabase
          .from("professors")
          .select("id")
          .eq("email", session.email)
          .single()
        
        if (professorData) {
          query = query.eq("professor_id", professorData.id)
        } else {
          // Se não encontrar professor, retorna lista vazia
          setProfessorClients([])
          return
        }
      }
      
      const { data, error } = await query

      if (error) {
        console.error("[v0] Error fetching professor clients:", error)
      } else {
        console.log("[v0] Fetched professor clients, count:", data?.length || 0)
        setProfessorClients(data || [])
      }
    } catch (err) {
      console.error("[v0] Error in fetchProfessorClients:", err)
    }
  }

  const fetchAsaasCustomers = async () => {
    setLoadingCustomers(true)
    try {
      const response = await fetch("/api/asaas?endpoint=/customers&limit=100")
      if (response.ok) {
        const data = await response.json()
        setAsaasCustomers(data.data || [])
      }
    } catch (err) {
      console.error("[v0] Error fetching Asaas customers:", err)
    }
    setLoadingCustomers(false)
  }

  const fetchInsiders = async () => {
    setLoadingInsiders(true)
    try {
      const { data, error } = await supabase
        .from("dados_insiders")
        .select("id, nome, cpf")
        .order("nome", { ascending: true })
      if (!error) setInsiders(data || [])
    } catch (err) {
      console.error("[v0] Error fetching insiders:", err)
    }
    setLoadingInsiders(false)
  }

  const handleCreateProfessor = async () => {
    if (!formData.name || !formData.email) {
      alert("Nome e email são obrigatórios")
      return
    }

    const { data, error } = await supabase
      .from("professors")
      .insert([formData])
      .select()

    if (error) {
      console.error("[v0] Error creating professor:", error)
      alert("Erro ao criar professor")
    } else {
      alert("Professor criado com sucesso!")
      setShowNewProfessorModal(false)
      setFormData({
        name: "",
        email: "",
        phone: "",
        specialty: "",
        status: "active",
        client_type: "cliente_somma",
      })
      fetchProfessors()
    }
  }

  const handleUpdateProfessor = async () => {
    if (!editingProfessor || !editingProfessor.name || !editingProfessor.email) {
      alert("Nome e email são obrigatórios")
      return
    }

    const { error } = await supabase
      .from("professors")
      .update({
        name: editingProfessor.name,
        email: editingProfessor.email,
        phone: editingProfessor.phone,
        specialty: editingProfessor.specialty,
        status: editingProfessor.status,
      })
      .eq("id", editingProfessor.id)

    if (error) {
      console.error("[v0] Error updating professor:", error)
      alert("Erro ao atualizar professor")
    } else {
      alert("Professor atualizado com sucesso!")
      setShowEditProfessorModal(false)
      setEditingProfessor(null)
      fetchProfessors()
    }
  }

  const handleLinkClient = async () => {
    if (!selectedProfessor) return

    const finalTag = showNewTagInput && newCustomTag.trim()
      ? newCustomTag.trim()
      : selectedTag

    if (linkModalTab === "insiders" && selectedInsider) {
      // Buscar dados completos do insider para garantir CPF e validações
      const { data: insiderData, error: insiderError } = await supabase
        .from("dados_insiders")
        .select("id, nome, cpf, evolve")
        .eq("id", selectedInsider.id)
        .single()

      if (insiderError || !insiderData) {
        console.error("[v0] Error fetching insider details:", insiderError)
        alert("Erro ao buscar dados do insider")
        return
      }

      // Validar que CPF existe
      if (!insiderData.cpf || insiderData.cpf.trim() === "") {
        alert("Insider não possui CPF registrado. Não é possível vincular.")
        return
      }

      // Usar CPF como identificador único (mais seguro que ID autoincrement)
      const { error } = await supabase
        .from("professor_clients")
        .insert([{
          professor_id: selectedProfessor.id,
          asaas_customer_id: `insider_cpf_${insiderData.cpf}`,
          customer_name: insiderData.nome,
          customer_cpf_cnpj: insiderData.cpf,
          customer_email: "", // Insiders podem não ter email registrado
          status: "active",
          tag: finalTag,
          linked_at: new Date().toISOString(),
        }])

      if (error) {
        console.error("[v0] Error linking insider:", error)
        // Erro de constraint UNIQUE: insider já vinculado
        if (error.code === "23505") {
          alert("Este insider já está vinculado a este professor")
        } else {
          alert(`Erro ao vincular: ${error.message}`)
        }
        return
      }

      console.log("[v0] Insider linked successfully:", insiderData.cpf)
      alert("Insider vinculado com sucesso!")
      setShowLinkClientModal(false)
      setSelectedInsider(null)
      setInsiderSearch("")
      setSelectedTag("alunoprofessor")
      setNewCustomTag("")
      setShowNewTagInput(false)
      fetchProfessorClients()
      return
    }

    if (!selectedCustomer) return

    // Validar que cliente não está já vinculado a este professor
    const existingLink = professorClients.find(
      pc => pc.asaas_customer_id === selectedCustomer.id && pc.professor_id === selectedProfessor.id
    )
    if (existingLink && existingLink.status === "active") {
      alert("Este cliente já está vinculado a este professor")
      return
    }

    const { error } = await supabase
      .from("professor_clients")
      .insert([{
        professor_id: selectedProfessor.id,
        asaas_customer_id: selectedCustomer.id,
        customer_name: selectedCustomer.name,
        customer_cpf_cnpj: selectedCustomer.cpfCnpj,
        customer_email: selectedCustomer.email,
        status: "active",
        tag: finalTag,
        linked_at: new Date().toISOString(),
      }])
      .select()

    if (error) {
      console.error("[v0] Error linking client:", error)
      if (error.code === "23505") {
        alert("Este cliente já está vinculado a este professor")
      } else {
        alert(`Erro ao vincular: ${error.message}`)
      }
    } else {
      console.log("[v0] Client linked successfully:", selectedCustomer.id)
      alert("Cliente vinculado com sucesso!")
      setShowLinkClientModal(false)
      setSelectedCustomer(null)
      setSelectedTag("alunoprofessor")
      setNewCustomTag("")
      setShowNewTagInput(false)
      fetchProfessorClients()
    }
  }

  const handleDeleteProfessor = async (professorId: string) => {
    if (!confirm("Tem certeza que deseja deletar este professor?")) return

    const { error } = await supabase
      .from("professors")
      .delete()
      .eq("id", professorId)

    if (error) {
      console.error("[v0] Error deleting professor:", error)
      alert("Erro ao deletar professor")
    } else {
      alert("Professor deletado com sucesso!")
      fetchProfessors()
    }
  }

  const handleUnlinkClient = async (linkId: string) => {
    if (!confirm("Tem certeza que deseja desvincular este cliente?")) return

    const { error } = await supabase
      .from("professor_clients")
      .update({ status: "inactive", unlinked_at: new Date().toISOString() })
      .eq("id", linkId)

    if (error) {
      console.error("[v0] Error unlinking client:", error)
      alert("Erro ao desvincular cliente")
    } else {
      alert("Cliente desvinculado com sucesso!")
      fetchProfessorClients()
    }
  }

  const handleUpdateFee = async () => {
    const feeValue = parseFloat(newFeeValue)
    if (isNaN(feeValue) || feeValue < 0) {
      alert("Valor inválido")
      return
    }

    console.log("[v0] Updating commission fee to:", feeValue)

    // Primeiro, verificar se existe algum registro
    const { data: existing } = await supabase
      .from("commission_config")
      .select("*")
      .limit(1)
      .single()

    let error = null

    if (existing) {
      // Atualizar o registro existente
      const result = await supabase
        .from("commission_config")
        .update({ somma_fixed_fee: feeValue, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
      error = result.error
    } else {
      // Criar novo registro se não existir
      const result = await supabase
        .from("commission_config")
        .insert([{ somma_fixed_fee: feeValue, updated_at: new Date().toISOString() }])
      error = result.error
    }

    if (error) {
      console.error("[v0] Error updating commission config:", error)
      alert("Erro ao atualizar taxa")
    } else {
      console.log("[v0] Commission fee updated successfully")
      setSommaFixedFee(feeValue)
      setEditingFee(false)
      alert("Taxa atualizada com sucesso!")
      // Recalcular comissões com novo valor
      fetchCommissionData()
    }
  }

  const filteredProfessors = professors.filter((prof) =>
    prof.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prof.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prof.specialty?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getProfessorClients = (professorId: string) => {
    return professorClients.filter(pc => pc.professor_id === professorId)
  }

  const totalProfessors = professors.length
  const activeProfessors = professors.filter(p => p.status === "active").length
  const totalLinkedClients = professorClients.length
  const topProfessor = professors.length > 0 ? professors[0] : null

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden">
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-white tracking-wider truncate">CARTEIRAS</h1>
          <p className="text-xs text-neutral-400 mt-0.5 hidden sm:block">Professores, carteiras de clientes e comissões</p>
        </div>
        <Button
          onClick={() => setShowNewProfessorModal(true)}
          size="sm"
          className="bg-orange-500 hover:bg-orange-600 text-white shrink-0 text-xs px-3"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Novo
        </Button>
      </div>

      {/* Tabs — scroll horizontal em mobile */}
      <div className="flex gap-1 border-b border-neutral-800 overflow-x-auto scrollbar-hide -mx-4 sm:mx-0 px-4 sm:px-0">
        <button
          onClick={() => setActiveTab("professors")}
          className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors relative shrink-0 ${
            activeTab === "professors" ? "text-white" : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Professores
          {activeTab === "professors" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500" />
          )}
        </button>
        {isAdmin && (
          <>
            <button
              onClick={() => setActiveTab("commissions")}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors relative shrink-0 ${
                activeTab === "commissions" ? "text-white" : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              Comissões
              {activeTab === "commissions" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("repasse")}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors relative shrink-0 ${
                activeTab === "repasse" ? "text-white" : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              Repasse
              {activeTab === "repasse" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500" />
              )}
            </button>
          </>
        )}
      </div>

      {/* Tab: Gestão de Professores */}
      {activeTab === "professors" && (
        <>
          {/* Stats Overview — 2 cols em mobile, 4 em desktop */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="bg-neutral-900 border-neutral-700">
              <CardContent className="p-3 sm:p-4">
                <p className="text-[10px] text-neutral-400 tracking-wider mb-1">PROFESSORES</p>
                <p className="text-2xl font-bold text-white font-mono">{totalProfessors}</p>
              </CardContent>
            </Card>
            <Card className="bg-neutral-900 border-neutral-700">
              <CardContent className="p-3 sm:p-4">
                <p className="text-[10px] text-neutral-400 tracking-wider mb-1">CLIENTES</p>
                <p className="text-2xl font-bold text-white font-mono">{totalLinkedClients}</p>
              </CardContent>
            </Card>
            <Card className="bg-neutral-900 border-neutral-700">
              <CardContent className="p-3 sm:p-4">
                <p className="text-[10px] text-neutral-400 tracking-wider mb-1">RECEITA</p>
                <p className="text-2xl font-bold text-white font-mono">R$ 0</p>
              </CardContent>
            </Card>
            <Card className="bg-neutral-900 border-neutral-700">
              <CardContent className="p-3 sm:p-4">
                <p className="text-[10px] text-neutral-400 tracking-wider mb-1">ATIVOS</p>
                <p className="text-2xl font-bold text-white font-mono">{activeProfessors}</p>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
            <Input
              placeholder="Buscar professor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-neutral-900 border-neutral-700 text-white placeholder-neutral-500 text-sm h-10"
            />
          </div>

          {/* Professors List */}
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-12 text-neutral-400 text-sm">Carregando...</div>
            ) : filteredProfessors.length === 0 ? (
              <div className="text-center py-12 text-neutral-400 text-sm">Nenhum professor encontrado</div>
            ) : (
              filteredProfessors.map((professor) => {
                const clients = getProfessorClients(professor.id)
                const isExpanded = expandedProfessorId === professor.id

                return (
                  <div
                    key={professor.id}
                    className={`bg-neutral-900 rounded-xl border transition-colors ${
                      professor.status === "active" ? "border-orange-500/40" : "border-neutral-700"
                    }`}
                  >
                    {/* Card Top — Avatar + Info + Actions */}
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className="w-11 h-11 rounded-full bg-neutral-800 flex items-center justify-center shrink-0 border border-neutral-700">
                          <span className="text-base font-bold text-white">
                            {professor.name.charAt(0).toUpperCase()}
                          </span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-white tracking-wide leading-tight">
                              {professor.name.toUpperCase()}
                            </h3>
                            <Badge className={`text-[10px] px-1.5 py-0.5 shrink-0 ${
                              professor.status === "active"
                                ? "bg-white/10 text-white border-white/20"
                                : "bg-red-500/20 text-red-400 border-red-500/30"
                            }`}>
                              {professor.status === "active" ? "ATIVO" : "INATIVO"}
                            </Badge>
                          </div>
                          {professor.specialty && (
                            <p className="text-xs text-neutral-400 mt-0.5">{professor.specialty}</p>
                          )}
                          <div className="mt-1.5 space-y-0.5">
                            <p className="text-xs text-neutral-500 truncate">{professor.email}</p>
                            {professor.phone && (
                              <p className="text-xs text-neutral-500">{professor.phone}</p>
                            )}
                          </div>
                        </div>

                        {/* Action icons */}
                        <div className="flex items-center gap-0 shrink-0">
                          <button
                            className="p-2 text-neutral-400 hover:text-white active:scale-90 transition-all"
                            onClick={() => {
                              setSelectedProfessor(professor)
                              setLinkModalTab("asaas")
                              fetchAsaasCustomers()
                              fetchInsiders()
                              setShowLinkClientModal(true)
                            }}
                            aria-label="Vincular cliente"
                          >
                            <UserPlus className="w-4 h-4" />
                          </button>
                          <button
                            className="p-2 text-neutral-400 hover:text-white active:scale-90 transition-all"
                            onClick={() => {
                              setEditingProfessor(professor)
                              setShowEditProfessorModal(true)
                            }}
                            aria-label="Editar professor"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            className="p-2 text-neutral-400 hover:text-red-500 active:scale-90 transition-all"
                            onClick={() => handleDeleteProfessor(professor.id)}
                            aria-label="Excluir professor"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Card Bottom — Stats + Buttons */}
                    <div className="flex items-center justify-between px-4 pb-4 pt-0 border-t border-neutral-800/80 mt-0 pt-3">
                      {/* Stats */}
                      <div className="flex items-center gap-5">
                        <div>
                          <span className="text-xl font-bold text-white font-mono">{clients.length}</span>
                          <p className="text-[10px] text-neutral-400">Clientes</p>
                        </div>
                        <div>
                          <span className="text-xl font-bold text-green-500 font-mono">R$ 0</span>
                          <p className="text-[10px] text-neutral-400">Receita</p>
                        </div>
                      </div>

                      {/* Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setExpandedProfessorId(isExpanded ? null : professor.id)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-600 active:scale-95 transition-all"
                        >
                          {isExpanded ? "Ocultar" : "Ver Clientes"}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedProfessor(professor)
                            setLinkModalTab("asaas")
                            fetchAsaasCustomers()
                            fetchInsiders()
                            setShowLinkClientModal(true)
                          }}
                          className="text-xs px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-600 active:scale-95 transition-all"
                        >
                          Vincular
                        </button>
                      </div>
                    </div>

                    {/* Expanded Clients */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-neutral-800">
                        <h4 className="text-xs font-semibold text-neutral-300 mt-3 mb-2 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" />
                          Clientes ({clients.length})
                        </h4>
                        {clients.length === 0 ? (
                          <p className="text-xs text-neutral-500 py-2">Nenhum cliente vinculado</p>
                        ) : (
                          <div className="space-y-2">
                            {clients.map((client) => (
                              <div
                                key={client.id}
                                className="flex items-center justify-between p-2.5 bg-neutral-800 rounded-lg"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                                    <span className="text-xs font-bold text-green-500">
                                      {client.customer_name.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-white truncate">{client.customer_name}</p>
                                    <p className="text-[10px] text-neutral-400 truncate">{client.customer_email}</p>
                                  </div>
                                </div>
                                <button
                                  className="p-1.5 text-neutral-500 hover:text-red-500 active:scale-90 transition-all shrink-0"
                                  onClick={() => handleUnlinkClient(client.id)}
                                  aria-label="Desvincular cliente"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </>
      )}

      {/* Tab: Repasse de Comissões */}

      {activeTab === "commissions" && (
        <>
          {/* Config Card */}
          <Card className="bg-neutral-900 border-neutral-700">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wider mb-2">TAXA FIXA SOMMA</h3>
                  <p className="text-xs text-neutral-400">
                    Valor fixo que a Somma recebe de cada cliente. O restante vai para o professor.
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {editingFee ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={newFeeValue}
                        onChange={(e) => setNewFeeValue(e.target.value)}
                        className="w-32 bg-neutral-800 border-neutral-700 text-white"
                      />
                      <Button
                        onClick={handleUpdateFee}
                        size="sm"
                        className="bg-orange-500 hover:bg-orange-600 text-white"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={() => {
                          setEditingFee(false)
                          setNewFeeValue(sommaFixedFee.toFixed(2))
                        }}
                        size="sm"
                        variant="ghost"
                        className="text-neutral-400 hover:text-white bg-transparent"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-white font-mono">
                          R$ {sommaFixedFee.toFixed(2)}
                        </p>
                        <p className="text-xs text-neutral-400">por cliente/mês</p>
                      </div>
                      <Button
                        onClick={() => setEditingFee(true)}
                        variant="outline"
                        size="sm"
                        className="border-neutral-700 text-neutral-400 hover:text-white hover:border-orange-500 bg-transparent"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Editar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-neutral-900 border-neutral-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-neutral-400 tracking-wider">RECEITA SOMMA</p>
                    <p className="text-2xl font-bold text-white font-mono mt-1">
                      R$ {(commissionBreakdowns.reduce((sum, b) => sum + b.sommaFee, 0)).toFixed(2)}
                    </p>
                  </div>
                  <DollarSign className="w-8 h-8 text-white" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-neutral-900 border-neutral-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-neutral-400 tracking-wider">REPASSE PROFESSORES</p>
                    <p className="text-2xl font-bold text-white font-mono mt-1">
                      R$ {(commissionBreakdowns.reduce((sum, b) => sum + b.professorCommission, 0)).toFixed(2)}
                    </p>
                  </div>
                  <Users className="w-8 h-8 text-white" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-neutral-900 border-neutral-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-neutral-400 tracking-wider">RECEITA TOTAL</p>
                    <p className="text-2xl font-bold text-white font-mono mt-1">
                      R$ {(commissionBreakdowns.reduce((sum, b) => sum + b.totalSubscriptionValue, 0)).toFixed(2)}
                    </p>
                  </div>
                  <Award className="w-8 h-8 text-white" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Commission Breakdown Table */}
          <Card className="bg-neutral-900 border-neutral-700">
            <CardContent className="p-6">
              <h3 className="text-sm font-bold text-white tracking-wider mb-4">BREAKDOWN POR PROFESSOR</h3>
              
              {loadingCommissions ? (
                <div className="text-center py-8 text-neutral-400">Calculando comissões...</div>
              ) : commissionBreakdowns.length === 0 ? (
                <div className="text-center py-8 text-neutral-400">Nenhuma comissão para calcular</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-neutral-800">
                        <th className="text-left py-3 px-4 text-sm font-medium text-neutral-400">Professor</th>
                        <th className="text-center py-3 px-4 text-sm font-medium text-neutral-400">Clientes</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-neutral-400">Receita Total</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-neutral-400">Taxa Somma</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-neutral-400">Comissão Professor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commissionBreakdowns.map((breakdown, index) => (
                        <tr
                          key={breakdown.professorId}
                          className={`border-b border-neutral-800 hover:bg-neutral-800/50 transition-colors ${
                            index % 2 === 0 ? "bg-neutral-900" : "bg-neutral-850"
                          }`}
                        >
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                                <span className="text-sm font-bold text-purple-500">
                                  {breakdown.professorName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <span className="font-medium text-white">{breakdown.professorName}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <Badge className="bg-blue-500/20 text-blue-400">
                              {breakdown.totalClients}
                            </Badge>
                          </td>
                          <td className="py-4 px-4 text-right font-mono text-white">
                            R$ {breakdown.totalSubscriptionValue.toFixed(2)}
                          </td>
                          <td className="py-4 px-4 text-right font-mono text-green-500">
                            R$ {breakdown.sommaFee.toFixed(2)}
                          </td>
                          <td className="py-4 px-4 text-right font-mono text-purple-500 font-bold">
                            R$ {breakdown.professorCommission.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-4 p-4 bg-blue-900/20 border border-blue-700/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-500/20 rounded">
                    <DollarSign className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <h4 className="font-medium text-white mb-1">Regra de Cálculo</h4>
                    <p className="text-sm text-neutral-400">
                      A Somma fica com <strong className="text-blue-400">R$ {sommaFixedFee.toFixed(2)}</strong> fixos por cliente. 
                      O restante do valor do plano vai para o professor responsável pela carteira daquele cliente.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Tab: Relatório de Repasse - Admin Only */}
      {activeTab === "repasse" && isAdmin && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <Card className="bg-neutral-900 border-neutral-700">
              <CardContent className="p-4">
                <p className="text-xs text-neutral-400 tracking-wider mb-1">CONTROLE DE REPASSE</p>
                <p className="text-sm text-neutral-300">Ative ou desative o repasse para cada professor</p>
              </CardContent>
            </Card>
            <Card className="bg-neutral-900 border-neutral-700">
              <CardContent className="p-4">
                <p className="text-xs text-neutral-400 tracking-wider mb-1">AÇÕES</p>
                <div className="flex gap-2">
                  <Button onClick={handleGenerateReport} disabled={loadingRepasseReport} size="sm" className="bg-orange-500 hover:bg-orange-600 text-white gap-1">
                    {loadingRepasseReport ? <Loader2 className="w-3 h-3 animate-spin" /> : <ReceiptText className="w-3 h-3" />}
                    Gerar
                  </Button>
                  <Button onClick={handleDownloadCSV} disabled={!repasseReport} size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-1">
                    <Download className="w-3 h-3" />
                    CSV
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-neutral-900 border-neutral-700">
              <CardContent className="p-4">
                <p className="text-xs text-neutral-400 tracking-wider mb-1">STATUS</p>
                <p className="text-sm text-neutral-300">{repasseReport ? `${repasseReport.summary?.length || 0} professores mapeados` : "Gere um relatório"}</p>
              </CardContent>
            </Card>
          </div>

          {/* Repasse Settings - Toggle by Professor */}
          <Card className="bg-neutral-900 border-neutral-700 mb-6">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-white mb-4 tracking-wider">Configuração de Repasse por Professor</h3>
              {loadingRepasse ? (
                <div className="text-center py-8 text-neutral-400">Carregando configurações...</div>
              ) : professors.length === 0 ? (
                <div className="text-center py-8 text-neutral-400">Nenhum professor encontrado</div>
              ) : (
                <div className="space-y-3">
                  {professors.map(prof => (
                    <div key={prof.id} className="flex items-center justify-between bg-neutral-800 p-4 rounded-lg">
                      <div className="flex-1">
                        <p className="text-white font-medium">{prof.name}</p>
                        <p className="text-xs text-neutral-400">{prof.email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {repasseSettings[prof.id] !== false ? (
                          <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded">Somma cobra taxa</span>
                        ) : (
                          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">Professor recebe repasse</span>
                        )}
                        <Button
                          onClick={() => handleToggleRepasse(prof.id)}
                          size="sm"
                          className={repasseSettings[prof.id] !== false ? "bg-neutral-700 hover:bg-neutral-600 text-white" : "bg-green-600 hover:bg-green-700 text-white"}
                        >
                          {repasseSettings[prof.id] !== false ? "Desabilitar" : "Habilitar"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Relatório Detalhado */}
          {repasseReport && (
            <Card className="bg-neutral-900 border-neutral-700">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-white mb-4 tracking-wider">Relatório Detalhado por Professor</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-700">
                        <th className="px-4 py-2 text-left text-neutral-400">Professor</th>
                        <th className="px-4 py-2 text-center text-neutral-400">Alunos</th>
                        <th className="px-4 py-2 text-right text-neutral-400">Total Pago</th>
                        <th className="px-4 py-2 text-right text-neutral-400">Taxa Somma</th>
                        <th className="px-4 py-2 text-right text-neutral-400">Repasse Prof</th>
                      </tr>
                    </thead>
                    <tbody>
                      {repasseReport.summary?.map((prof: any) => (
                        <tr key={prof.professor_id} className="border-b border-neutral-800 hover:bg-neutral-800/50">
                          <td className="px-4 py-3 text-white">{prof.professor_nome}</td>
                          <td className="px-4 py-3 text-center text-neutral-300">{prof.total_alunos}</td>
                          <td className="px-4 py-3 text-right text-neutral-300">R$ {prof.total_pago.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-orange-400">-R$ {prof.total_taxa_somma.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-green-400 font-semibold">R$ {prof.total_repasse.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-neutral-400 mt-4">Gerado em: {new Date(repasseReport.generatedAt).toLocaleString("pt-BR")}</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Modal: Novo Professor */}
      {showNewProfessorModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <Card className="bg-neutral-900 border-neutral-800 w-full max-w-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Novo Professor</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowNewProfessorModal(false)}
                  className="text-neutral-400 hover:text-white bg-transparent"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <p className="text-neutral-400 mb-6">Adicione um novo professor ao sistema para gerenciar carteiras de clientes</p>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-sm text-white mb-2 block">Nome Completo *</label>
                  <Input
                    placeholder="João Silva"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-neutral-800 border-neutral-700 text-white"
                  />
                </div>

                <div>
                  <label className="text-sm text-white mb-2 block">Email *</label>
                  <Input
                    type="email"
                    placeholder="joao@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="bg-neutral-800 border-neutral-700 text-white"
                  />
                </div>

                <div>
                  <label className="text-sm text-white mb-2 block">Telefone</label>
                  <Input
                    placeholder="(11) 98888-8888"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="bg-neutral-800 border-neutral-700 text-white"
                  />
                </div>

                <div>
                  <label className="text-sm text-white mb-2 block">Especialidade</label>
                  <Input
                    placeholder="Nutrição, Treino, etc."
                    value={formData.specialty}
                    onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                    className="bg-neutral-800 border-neutral-700 text-white"
                  />
                </div>

                <div>
                  <label className="text-sm text-white mb-2 block">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as "active" | "inactive" })}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-white"
                  >
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm text-white mb-2 block">Tipo de Cliente</label>
                  <select
                    value={formData.client_type}
                    onChange={(e) => setFormData({ ...formData, client_type: e.target.value as "cliente_somma" | "cliente_professor" })}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-white"
                  >
                    <option value="cliente_somma">Cliente Somma</option>
                    <option value="cliente_professor">Cliente Professor</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setShowNewProfessorModal(false)}
                  className="flex-1 border-neutral-700 text-neutral-400 hover:bg-neutral-800 bg-transparent"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreateProfessor}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                >
                  Criar Professor
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal: Vincular Cliente */}
      {showLinkClientModal && selectedProfessor && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <Card className="bg-neutral-900 border-neutral-800 w-full max-w-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Vincular Cliente</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowLinkClientModal(false)
                    setSelectedCustomer(null)
                  }}
                  className="text-neutral-400 hover:text-white bg-transparent"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <p className="text-neutral-400 mb-6">
                Selecione um cliente do plano Assessoria para vincular a {selectedProfessor.name}.
              </p>

              {/* Tabs */}
              <div className="flex gap-1 bg-neutral-800 p-1 rounded-lg mb-4">
                <button
                  onClick={() => setLinkModalTab("asaas")}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                    linkModalTab === "asaas"
                      ? "bg-orange-500 text-white"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  Clientes Asaas
                </button>
                <button
                  onClick={() => setLinkModalTab("insiders")}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                    linkModalTab === "insiders"
                      ? "bg-orange-500 text-white"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  Insiders
                </button>
              </div>

              {/* Asaas Customer List */}
              {linkModalTab === "asaas" && (loadingCustomers ? (
                <div className="text-center py-8 text-neutral-400">Carregando clientes...</div>
              ) : asaasCustomers.length === 0 ? (
                <div className="text-center py-8 text-neutral-400">Nenhum cliente encontrado</div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {asaasCustomers.map((customer) => {
                    const isLinked = professorClients.some(pc => pc.asaas_customer_id === customer.id)
                    const isSelected = selectedCustomer?.id === customer.id

                    return (
                      <div
                        key={customer.id}
                        className={`p-4 rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-orange-500/20 border-orange-500"
                            : isLinked
                              ? "bg-neutral-800/50 border-neutral-700 opacity-50 cursor-not-allowed"
                              : "bg-neutral-800 border-neutral-700 hover:bg-neutral-800/80"
                        }`}
                        onClick={() => {
                          if (!isLinked) {
                            setSelectedCustomer(customer)
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-white">{customer.name}</p>
                              {isLinked && (
                                <Badge className="bg-neutral-700 text-neutral-400 text-xs">Vinculado</Badge>
                              )}
                              {customer.cpfCnpj && (
                                <Badge className={customer.cpfCnpj.length === 11 ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400"}>
                                  Asaas
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-neutral-400">{customer.email}</p>
                            {customer.cpfCnpj && (
                              <p className="text-xs text-neutral-500 mt-1">CPF/CNPJ: {customer.cpfCnpj}</p>
                            )}
                          </div>
                          {isSelected && !isLinked && (
                            <div className="p-2 bg-orange-500 rounded-full">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}

              {/* Insiders List */}
              {linkModalTab === "insiders" && (
                <div className="space-y-2">
                  <Input
                    placeholder="Buscar insider por nome ou CPF..."
                    value={insiderSearch}
                    onChange={e => setInsiderSearch(e.target.value)}
                    className="bg-neutral-700 border-neutral-600 text-white mb-3"
                  />
                  {loadingInsiders ? (
                    <div className="text-center py-8 text-neutral-400">Carregando insiders...</div>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {insiders
                        .filter(i =>
                          !insiderSearch ||
                          i.nome.toLowerCase().includes(insiderSearch.toLowerCase()) ||
                          i.cpf.includes(insiderSearch)
                        )
                        .map(insider => {
                          const isSelected = selectedInsider?.id === insider.id
                          return (
                            <div
                              key={insider.id}
                              onClick={() => setSelectedInsider(isSelected ? null : insider)}
                              className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                                isSelected
                                  ? "bg-orange-500/20 border-orange-500"
                                  : "bg-neutral-800 border-neutral-700 hover:bg-neutral-700/60"
                              }`}
                            >
                              <div>
                                <p className="font-medium text-white text-sm">{insider.nome}</p>
                                <p className="text-xs text-neutral-400">CPF: {insider.cpf}</p>
                              </div>
                              {isSelected && (
                                <div className="p-1.5 bg-orange-500 rounded-full">
                                  <Check className="w-3.5 h-3.5 text-white" />
                                </div>
                              )}
                            </div>
                          )
                        })}
                    </div>
                  )}
                </div>
              )}

              {/* Tag Selection */}
              {(selectedCustomer || selectedInsider) && (
                <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4 mb-6">
                  <label className="text-sm font-medium text-white mb-3 block">Selecione uma tag para este cliente:</label>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedTag("alunoprofessor")
                          setShowNewTagInput(false)
                        }}
                        className={`flex-1 py-2 px-3 rounded-lg border transition-all text-sm ${
                          selectedTag === "alunoprofessor" && !showNewTagInput
                            ? "bg-blue-500 border-blue-500 text-white"
                            : "bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-600"
                        }`}
                      >
                        #alunoprofessor
                      </button>
                      <button
                        onClick={() => {
                          setSelectedTag("alunosomma")
                          setShowNewTagInput(false)
                        }}
                        className={`flex-1 py-2 px-3 rounded-lg border transition-all text-sm ${
                          selectedTag === "alunosomma" && !showNewTagInput
                            ? "bg-blue-500 border-blue-500 text-white"
                            : "bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-600"
                        }`}
                      >
                        #alunosomma
                      </button>
                      <button
                        onClick={() => setShowNewTagInput(!showNewTagInput)}
                        className={`flex-1 py-2 px-3 rounded-lg border transition-all text-sm ${
                          showNewTagInput
                            ? "bg-green-500 border-green-500 text-white"
                            : "bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-600"
                        }`}
                      >
                        + Nova Tag
                      </button>
                    </div>
                    {showNewTagInput && (
                      <Input
                        placeholder="Digite a nova tag (ex: #premium)"
                        value={newCustomTag}
                        onChange={(e) => setNewCustomTag(e.target.value)}
                        className="bg-neutral-700 border-neutral-600 text-white placeholder:text-neutral-500"
                      />
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowLinkClientModal(false)
                    setSelectedCustomer(null)
                  }}
                  className="flex-1 border-neutral-700 text-neutral-400 hover:bg-neutral-800 bg-transparent"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleLinkClient}
                  disabled={linkModalTab === "insiders" ? !selectedInsider : !selectedCustomer}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Vincular
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal: Editar Professor */}
      {showEditProfessorModal && editingProfessor && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <Card className="bg-neutral-900 border-neutral-800 w-full max-w-md">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Editar Professor</h2>
                <button
                  onClick={() => {
                    setShowEditProfessorModal(false)
                    setEditingProfessor(null)
                  }}
                  className="text-neutral-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label className="text-xs text-neutral-400 tracking-wider">NOME</label>
                <Input
                  value={editingProfessor.name}
                  onChange={(e) => setEditingProfessor({ ...editingProfessor, name: e.target.value })}
                  className="bg-neutral-800 border-neutral-700 text-white mt-1"
                  placeholder="Nome do professor"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 tracking-wider">EMAIL</label>
                <Input
                  value={editingProfessor.email}
                  onChange={(e) => setEditingProfessor({ ...editingProfessor, email: e.target.value })}
                  className="bg-neutral-800 border-neutral-700 text-white mt-1"
                  placeholder="email@example.com"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 tracking-wider">TELEFONE</label>
                <Input
                  value={editingProfessor.phone || ""}
                  onChange={(e) => setEditingProfessor({ ...editingProfessor, phone: e.target.value })}
                  className="bg-neutral-800 border-neutral-700 text-white mt-1"
                  placeholder="(61) 9999-9999"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 tracking-wider">ESPECIALIDADE</label>
                <Input
                  value={editingProfessor.specialty || ""}
                  onChange={(e) => setEditingProfessor({ ...editingProfessor, specialty: e.target.value })}
                  className="bg-neutral-800 border-neutral-700 text-white mt-1"
                  placeholder="Sua especialidade"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 tracking-wider">STATUS</label>
                <select
                  value={editingProfessor.status}
                  onChange={(e) => setEditingProfessor({ ...editingProfessor, status: e.target.value as "active" | "inactive" })}
                  className="w-full bg-neutral-800 border border-neutral-700 text-white rounded-md p-2 mt-1"
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEditProfessorModal(false)
                    setEditingProfessor(null)
                  }}
                  className="flex-1 border-neutral-700 text-neutral-400 hover:bg-neutral-800 bg-transparent"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleUpdateProfessor}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      </div>{/* end p-4 sm:p-6 */}
    </div>
  )
}
