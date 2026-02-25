"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  Plus,
  MoreHorizontal,
  User,
  Building,
  Mail,
  Phone,
  MapPin,
  X,
  Eye,
  FileText,
  ArrowLeft,
  Edit,
  DollarSign,
  TrendingUp,
  Calendar,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Tag,
  Loader2,
  Trash2,
  AlertTriangle,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { CustomerCreatePayload } from "@/lib/types/asaas"
import { TagManager } from "@/components/tag-manager"

type FilterType = "all" | "active" | "pf" | "pj" | "archived"

interface AsaasCustomerAPI {
  id: string
  name: string
  email: string | null
  cpfCnpj: string
  mobilePhone: string | null
  phone: string | null
  address: string | null
  addressNumber: string | null
  complement: string | null
  province: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  dateCreated: string
  deleted?: boolean
  personType?: string
  company?: string
  groupName?: string | null
}

interface AsaasPayment {
  id: string
  customer: string
  value: number
  netValue: number
  description: string | null
  billingType: string
  status: string
  dueDate: string
  paymentDate: string | null
  invoiceUrl: string | null
}

interface AsaasSubscription {
  id: string
  customer: string
  value: number
  cycle: string
  status: string
  nextDueDate: string
  dateCreated: string
}

interface CustomerStats {
  totalPaid: number
  totalPayments: number
  netRevenue: number
  nextDueDate: string | null
  financialStatus: string
}

export default function ClientesAsaas() {
  const router = useRouter()
  const [customers, setCustomers] = useState<AsaasCustomerAPI[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filter, setFilter] = useState<FilterType>("all")
  const [showModal, setShowModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<AsaasCustomerAPI | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null)
  const [customerPayments, setCustomerPayments] = useState<AsaasPayment[]>([])
  const [customerSubscription, setCustomerSubscription] = useState<AsaasSubscription | null>(null)
  const [customerStats, setCustomerStats] = useState<CustomerStats | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const [formData, setFormData] = useState<CustomerCreatePayload>({
    name: "",
    cpfCnpj: "",
    email: "",
    mobilePhone: "",
    phone: "",
    postalCode: "",
    address: "",
    addressNumber: "",
    city: "",
    state: "",
    groupName: "",
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingCustomer, setEditingCustomer] = useState<AsaasCustomerAPI | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingCustomer, setDeletingCustomer] = useState<AsaasCustomerAPI | null>(null)
  const [processingDelete, setProcessingDelete] = useState(false)
  const [loadingCep, setLoadingCep] = useState(false)
  const { toast } = useToast()

  const fetchCustomers = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/asaas?endpoint=/customers&limit=100")
      console.log("[v0] fetchCustomers response status:", response.status)
      console.log("[v0] fetchCustomers response ok:", response.ok)
      
      if (!response.ok) {
        const errorData = await response.json()
        console.log("[v0] API error:", errorData)
        
        // Mensagem mais clara para erro de configuração
        if (errorData.error?.message?.includes('not configured')) {
          setError("API Asaas não configurada. Configure ASAAS_API_KEY nas variáveis de ambiente para acessar os dados em produção.")
        } else {
          setError(errorData.error?.message || "Erro ao buscar clientes")
        }
        setCustomers([])
        return
      }
      
      const data = await response.json()
      console.log("[v0] API data received:", data)
      setCustomers(data.data || [])
    } catch (err) {
      console.error("[v0] fetchCustomers error:", err)
      setError("Erro de conexão com a API. Verifique se as variáveis de ambiente estão configuradas.")
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }

  const handleCepChange = async (cep: string) => {
    // Remove caracteres não numéricos
    const cleanCep = cep.replace(/\D/g, "")
    
    // Atualizar o campo de CEP
    setFormData({ ...formData, postalCode: cleanCep })

    // Se o CEP tem 8 dígitos, buscar informações
    if (cleanCep.length === 8) {
      setLoadingCep(true)
      try {
        console.log("[v0] Fetching CEP data for:", cleanCep)
        const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`)
        
        if (!response.ok) {
          console.error("[v0] CEP not found")
          toast({
            title: "CEP não encontrado",
            description: "Não foi possível encontrar informações para este CEP",
            variant: "destructive",
          })
          setLoadingCep(false)
          return
        }

        const data = await response.json()
        console.log("[v0] CEP data received:", data)

        // Preencher os campos com os dados recebidos
        setFormData(prev => ({
          ...prev,
          address: data.street || "",
          city: data.city || "",
          state: data.state || "",
        }))

        toast({
          title: "Sucesso",
          description: "Endereço preenchido automaticamente",
        })
      } catch (error) {
        console.error("[v0] Error fetching CEP:", error)
        toast({
          title: "Erro",
          description: "Falha ao buscar informações do CEP",
          variant: "destructive",
        })
      } finally {
        setLoadingCep(false)
      }
    }
  }

  const fetchCustomerDetails = async (customerId: string) => {
    setLoadingDetails(true)
    console.log("[v0] Fetching details for customer:", customerId)
    try {
      // Buscar cobranças do cliente
      const paymentsRes = await fetch(`/api/asaas?endpoint=/payments&customer=${customerId}`)
      console.log("[v0] Payments response status:", paymentsRes.status)
      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json()
        console.log("[v0] Payments data:", paymentsData)
        setCustomerPayments(paymentsData.data || [])
        
        // Calcular estatísticas
        const payments = paymentsData.data || []
        const paidPayments = payments.filter((p: AsaasPayment) => p.status === "RECEIVED" || p.status === "CONFIRMED")
        const totalPaid = paidPayments.reduce((sum: number, p: AsaasPayment) => sum + p.value, 0)
        const netRevenue = paidPayments.reduce((sum: number, p: AsaasPayment) => sum + (p.netValue || p.value), 0)
        
        const pendingPayments = payments.filter((p: AsaasPayment) => p.status === "PENDING" || p.status === "OVERDUE")
        const nextDue = pendingPayments.length > 0 
          ? pendingPayments.sort((a: AsaasPayment, b: AsaasPayment) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]?.dueDate
          : null
        
        const hasOverdue = payments.some((p: AsaasPayment) => p.status === "OVERDUE")
        
        setCustomerStats({
          totalPaid,
          totalPayments: paidPayments.length,
          netRevenue,
          nextDueDate: nextDue,
          financialStatus: hasOverdue ? "Inadimplente" : "Adimplente"
        })
      }

      // Buscar assinaturas do cliente
      const subsRes = await fetch(`/api/asaas?endpoint=/subscriptions&customer=${customerId}`)
      console.log("[v0] Subscriptions response status:", subsRes.status)
      if (subsRes.ok) {
        const subsData = await subsRes.json()
        console.log("[v0] Subscriptions data:", subsData)
        const activeSub = (subsData.data || []).find((s: AsaasSubscription) => s.status === "ACTIVE")
        console.log("[v0] Active subscription found:", activeSub)
        setCustomerSubscription(activeSub || null)
      }
    } catch (err) {
      console.error("Erro ao buscar detalhes:", err)
    } finally {
      setLoadingDetails(false)
    }
  }

  useEffect(() => {
    console.log("[v0] Component mounted, calling fetchCustomers")
    fetchCustomers()
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(null)
      }
    }
    
    // Apenas adicionar listener se houver dropdown aberto
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [dropdownOpen])

  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch =
      customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.cpfCnpj?.includes(searchTerm)

    if (!matchesSearch) return false

    switch (filter) {
      case "pf":
        return customer.cpfCnpj?.length === 11
      case "pj":
        return customer.cpfCnpj?.length === 14
      case "active":
        return !customer.deleted
      case "archived":
        return customer.deleted
      default:
        return true
    }
  })

  const formatDocument = (doc: string | null) => {
    if (!doc) return "-"
    if (doc.length === 11) {
      return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
    }
    return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
  }

  const formatPhone = (phone: string | null) => {
    if (!phone) return "-"
    const cleaned = phone.replace(/\D/g, "")
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")
    }
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3")
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-"
    const date = new Date(dateStr)
    const month = date.toLocaleDateString("pt-BR", { month: "short" })
    const year = date.getFullYear()
    return `Desde ${month} de ${year}`
  }

  const formatDateFull = (dateStr: string) => {
    if (!dateStr) return "-"
    return new Date(dateStr).toLocaleDateString("pt-BR")
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
  }

  const getCycleLabel = (cycle: string) => {
    const cycles: Record<string, string> = {
      MONTHLY: "Mensal",
      WEEKLY: "Semanal",
      BIWEEKLY: "Quinzenal",
      QUARTERLY: "Trimestral",
      SEMIANNUALLY: "Semestral",
      YEARLY: "Anual"
    }
    return cycles[cycle] || cycle
  }

  const getPaymentStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: "bg-yellow-500/20 text-yellow-400",
      RECEIVED: "bg-green-500/20 text-green-400",
      CONFIRMED: "bg-green-500/20 text-green-400",
      OVERDUE: "bg-red-500/20 text-red-400",
      REFUNDED: "bg-purple-500/20 text-purple-400",
    }
    return colors[status] || "bg-neutral-500/20 text-neutral-400"
  }

  const getPaymentStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PENDING: "Pendente",
      RECEIVED: "Recebido",
      CONFIRMED: "Confirmado",
      OVERDUE: "Vencido",
      REFUNDED: "Estornado",
    }
    return labels[status] || status
  }

  const getBillingTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      BOLETO: "Boleto",
      CREDIT_CARD: "Cartao de Credito",
      PIX: "PIX",
      UNDEFINED: "-"
    }
    return types[type] || type
  }

  const handleOpenDetails = (customer: AsaasCustomerAPI) => {
    setSelectedCustomer(customer)
    setShowDetails(true)
    setDropdownOpen(null)
    fetchCustomerDetails(customer.id)
  }

  const handleEditCustomer = async () => {
    if (!editingCustomer) return
    setSaving(true)
    
    const payload = {
      name: formData.name,
      email: formData.email,
      mobilePhone: formData.mobilePhone,
      phone: formData.phone,
      postalCode: formData.postalCode,
      address: formData.address,
      addressNumber: formData.addressNumber,
      city: formData.city,
      state: formData.state,
      groupName: formData.groupName || undefined,
    }
    
    console.log("[v0] Updating customer with payload:", payload)
    
    try {
      const response = await fetch(`/api/asaas?endpoint=/customers/${editingCustomer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const responseData = await response.json()
      console.log("[v0] Update customer response:", response.status, responseData)

      if (response.ok) {
        toast({ title: "Cliente atualizado", description: "Dados atualizados com sucesso." })
        setShowEditModal(false)
        setEditingCustomer(null)
        fetchCustomers()
        if (showDetails && selectedCustomer?.id === editingCustomer.id) {
          setSelectedCustomer({ ...editingCustomer, ...responseData })
        }
      } else {
        const errorMsg = responseData.error?.errors?.[0]?.description || 
                        responseData.error?.description || 
                        JSON.stringify(responseData)
        toast({ title: "Erro ao atualizar", description: errorMsg, variant: "destructive" })
      }
    } catch (err) {
      console.error("[v0] Error updating customer:", err)
      toast({ title: "Erro ao atualizar", description: "Ocorreu um erro ao atualizar o cliente.", variant: "destructive" })
    }
    setSaving(false)
  }

  const openEditModal = (customer: AsaasCustomerAPI) => {
    setEditingCustomer(customer)
    setFormData({
      name: customer.name,
      cpfCnpj: customer.cpfCnpj,
      email: customer.email || "",
      mobilePhone: customer.mobilePhone || "",
      phone: customer.phone || "",
      postalCode: customer.postalCode || "",
      address: customer.address || "",
      addressNumber: customer.addressNumber || "",
      city: customer.city || "",
      state: customer.state || "",
      groupName: customer.groupName || "",
    })
    setShowEditModal(true)
  }

  const handleCreateCustomer = async () => {
    setSaving(true)
    
    if (!formData.name || !formData.cpfCnpj) {
      toast({ title: "Campos obrigatorios", description: "Nome e CPF/CNPJ sao obrigatorios.", variant: "destructive" })
      setSaving(false)
      return
    }

    // Limpar CPF/CNPJ (remover pontos, tracos e barras)
    const cleanCpfCnpj = formData.cpfCnpj.replace(/\D/g, "")
    
    const payload = {
      ...formData,
      cpfCnpj: cleanCpfCnpj,
      groupName: formData.groupName || undefined,
    }
    
    console.log("[v0] Creating customer with payload:", payload)
    
    try {
      const response = await fetch("/api/asaas?endpoint=/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const responseData = await response.json()
      console.log("[v0] Create customer response:", response.status, responseData)

      if (response.ok) {
        toast({ title: "Cliente criado", description: "Novo cliente adicionado com sucesso." })
        setShowModal(false)
        setFormData({
          name: "",
          cpfCnpj: "",
          email: "",
          mobilePhone: "",
          phone: "",
          postalCode: "",
          address: "",
          addressNumber: "",
          city: "",
          state: "",
          groupName: "",
        })
        fetchCustomers()
      } else {
        const errorMsg = responseData.error?.errors?.[0]?.description || 
                        responseData.error?.description || 
                        JSON.stringify(responseData)
        toast({ title: "Erro ao criar cliente", description: errorMsg, variant: "destructive" })
      }
    } catch (err) {
      console.error("[v0] Error creating customer:", err)
      toast({ title: "Erro ao criar", description: "Ocorreu um erro ao criar o cliente.", variant: "destructive" })
    }
    setSaving(false)
  }

  const handleDeleteCustomer = async () => {
    if (!deletingCustomer) return
    
    setProcessingDelete(true)
    try {
      const response = await fetch(`/api/asaas?endpoint=/customers/${deletingCustomer.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast({
          title: "Cliente removido",
          description: `${deletingCustomer.name} foi removido do Asaas com sucesso.`,
        })
        setShowDeleteModal(false)
        setDeletingCustomer(null)
        
        // Se estava nos detalhes, voltar para lista
        if (showDetails && selectedCustomer?.id === deletingCustomer.id) {
          setShowDetails(false)
          setSelectedCustomer(null)
        }
        
        fetchCustomers()
      } else {
        const errorData = await response.json()
        toast({
          title: "Erro ao remover cliente",
          description: errorData.errors?.[0]?.description || errorData.error?.description || "Erro desconhecido",
          variant: "destructive",
        })
      }
    } catch (err) {
      console.error("[v0] Error deleting customer:", err)
      toast({
        title: "Erro ao remover",
        description: "Ocorreu um erro ao remover o cliente.",
        variant: "destructive",
      })
    } finally {
      setProcessingDelete(false)
    }
  }

  const openDeleteModal = (customer: AsaasCustomerAPI) => {
    setDeletingCustomer(customer)
    setShowDeleteModal(true)
    setDropdownOpen(null)
  }

  // Tela de Detalhes do Cliente
  if (showDetails && selectedCustomer) {
    return (
      <div className="p-3 md:p-6 space-y-4 md:space-y-6 bg-neutral-950 min-h-screen">
        {/* Header com nome do cliente */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setShowDetails(false); setSelectedCustomer(null) }}
              className="text-neutral-400 hover:text-white shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0">
              {selectedCustomer.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg md:text-xl font-bold text-white break-words">{selectedCustomer.name}</h1>
                {selectedCustomer.groupName && (
                  <Badge className="bg-orange-500/20 text-orange-400 flex items-center gap-1 text-xs">
                    <Tag className="w-3 h-3" />
                    {selectedCustomer.groupName}
                  </Badge>
                )}
              </div>
              <p className="text-xs md:text-sm text-neutral-400 break-all">
                {formatDocument(selectedCustomer.cpfCnpj)} &middot; ID: {selectedCustomer.id}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button 
              onClick={() => openDeleteModal(selectedCustomer)}
              variant="outline" 
              className="border-red-700 text-red-400 hover:bg-red-900/20 bg-transparent flex-1 md:flex-none"
              size="sm"
            >
              <Trash2 className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Remover</span>
            </Button>
            <Button 
              onClick={() => openEditModal(selectedCustomer)}
              variant="outline" 
              className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 bg-transparent flex-1 md:flex-none"
              size="sm"
            >
              <Edit className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Editar</span>
            </Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white flex-1 md:flex-none" size="sm">
              <DollarSign className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Nova Cobranca</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Coluna Esquerda - Dados de Contato e Assinatura */}
          <div className="space-y-4 md:space-y-6">
            {/* Dados de Contato */}
            <Card className="bg-neutral-900 border-neutral-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-neutral-300 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Dados de Contato
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-neutral-500">E-mail Principal</p>
                  <p className="text-sm text-orange-400">{selectedCustomer.email || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Telefone / Celular</p>
                  <p className="text-sm text-white">{formatPhone(selectedCustomer.mobilePhone || selectedCustomer.phone)}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Endereco</p>
                  <p className="text-sm text-white">
                    {selectedCustomer.address ? (
                      <>
                        {selectedCustomer.address}
                        {selectedCustomer.addressNumber && `, ${selectedCustomer.addressNumber}`}
                        <br />
                        {selectedCustomer.city && `${selectedCustomer.city}`}
                        {selectedCustomer.state && `-${selectedCustomer.state}`}
                        <br />
                        {selectedCustomer.postalCode}
                      </>
                    ) : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    Grupo do Cliente
                  </p>
                  {selectedCustomer.groupName ? (
                    <Badge className="bg-orange-500/20 text-orange-400 mt-1">
                      {selectedCustomer.groupName}
                    </Badge>
                  ) : (
                    <p className="text-sm text-neutral-500">Sem grupo</p>
                  )}
                </div>

                {/* Tags */}
                <div className="pt-2 border-t border-neutral-700">
                  <TagManager entityType="asaas_customer" entityId={selectedCustomer.id} />
                </div>
              </CardContent>
            </Card>

            {/* Assinatura Ativa */}
            {customerSubscription && (
              <Card className="bg-neutral-900 border-neutral-700 border-l-4 border-l-green-500">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-green-400 flex items-center gap-2">
                      <RefreshCw className="w-4 h-4" />
                      Assinatura Ativa
                    </CardTitle>
                    <Badge className="bg-green-500/20 text-green-400">Ativa</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-end justify-between">
                    <span className="text-3xl font-bold text-white">{formatCurrency(customerSubscription.value)}</span>
                    <span className="text-sm text-neutral-400">{getCycleLabel(customerSubscription.cycle)}</span>
                  </div>
                  <div className="text-sm text-neutral-400">
                    <p>Prox. vencimento: <span className="text-white">{formatDateFull(customerSubscription.nextDueDate)}</span></p>
                    <p>Criado em: {formatDateFull(customerSubscription.dateCreated)}</p>
                  </div>
                  <Button variant="outline" size="sm" className="w-full border-neutral-700 text-neutral-300 hover:bg-neutral-800 bg-transparent">
                    REGRAS DE COBRANCA
                  </Button>
                </CardContent>
              </Card>
            )}

            {!customerSubscription && !loadingDetails && (
              <Card className="bg-neutral-900 border-neutral-700">
                <CardContent className="py-6 text-center">
                  <RefreshCw className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                  <p className="text-sm text-neutral-500">Nenhuma assinatura ativa</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Coluna Direita - Metricas e Historico */}
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            {/* Cards de Metricas */}
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <Card className="bg-neutral-900 border-neutral-700">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-neutral-500 uppercase tracking-wider">Total Pago (LTV)</p>
                      <p className="text-xl font-bold text-white mt-1">
                        {loadingDetails ? "..." : formatCurrency(customerStats?.totalPaid || 0)}
                      </p>
                      <p className="text-xs text-neutral-500">{customerStats?.totalPayments || 0} pagamentos</p>
                    </div>
                    <DollarSign className="w-5 h-5 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-neutral-900 border-neutral-700">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-neutral-500 uppercase tracking-wider">Receita Liquida</p>
                      <p className="text-xl font-bold text-white mt-1">
                        {loadingDetails ? "..." : formatCurrency(customerStats?.netRevenue || 0)}
                      </p>
                      <p className="text-xs text-neutral-500">Apos taxas</p>
                    </div>
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-neutral-900 border-neutral-700">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-neutral-500 uppercase tracking-wider">Proximo Venc.</p>
                      <p className="text-xl font-bold text-white mt-1">
                        {loadingDetails ? "..." : customerStats?.nextDueDate ? formatDateFull(customerStats.nextDueDate) : "-"}
                      </p>
                      <p className="text-xs text-neutral-500">Automatico</p>
                    </div>
                    <Calendar className="w-5 h-5 text-orange-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-neutral-900 border-neutral-700">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-neutral-500 uppercase tracking-wider">Status Financeiro</p>
                      <p className={`text-xl font-bold mt-1 ${customerStats?.financialStatus === "Adimplente" ? "text-green-400" : "text-red-400"}`}>
                        {loadingDetails ? "..." : customerStats?.financialStatus || "Adimplente"}
                      </p>
                      <p className="text-xs text-neutral-500">Baseado no historico</p>
                    </div>
                    <AlertCircle className={`w-5 h-5 ${customerStats?.financialStatus === "Adimplente" ? "text-green-500" : "text-red-500"}`} />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Historico de Cobrancas */}
            <Card className="bg-neutral-900 border-neutral-700">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-neutral-300">
                  Historico de Cobrancas <Badge className="ml-2 bg-neutral-700 text-neutral-300">{customerPayments.length}</Badge>
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-orange-400 hover:text-orange-300">
                  Ver Todos
                </Button>
              </CardHeader>
              <CardContent>
                {loadingDetails ? (
                  <div className="text-center py-8">
                    <p className="text-neutral-400">Carregando cobrancas...</p>
                  </div>
                ) : customerPayments.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-neutral-500">Nenhuma cobranca encontrada</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-neutral-700">
                          <th className="text-left py-3 px-2 text-xs font-medium text-neutral-500">Vencimento</th>
                          <th className="text-left py-3 px-2 text-xs font-medium text-neutral-500">Descricao</th>
                          <th className="text-left py-3 px-2 text-xs font-medium text-neutral-500">Valor Bruto</th>
                          <th className="text-left py-3 px-2 text-xs font-medium text-neutral-500">Valor Liquido</th>
                          <th className="text-left py-3 px-2 text-xs font-medium text-neutral-500">Forma</th>
                          <th className="text-left py-3 px-2 text-xs font-medium text-neutral-500">Status</th>
                          <th className="text-left py-3 px-2 text-xs font-medium text-neutral-500">Acoes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customerPayments.slice(0, 10).map((payment) => (
                          <tr key={payment.id} className="border-b border-neutral-800 hover:bg-neutral-800/50">
                            <td className="py-3 px-2 text-sm text-white">{formatDateFull(payment.dueDate)}</td>
                            <td className="py-3 px-2 text-sm text-neutral-300">{payment.description || "Cobranca Avulsa"}</td>
                            <td className="py-3 px-2 text-sm text-white">{formatCurrency(payment.value)}</td>
                            <td className="py-3 px-2 text-sm text-neutral-300">{formatCurrency(payment.netValue || payment.value)}</td>
                            <td className="py-3 px-2 text-sm text-neutral-300">{getBillingTypeLabel(payment.billingType)}</td>
                            <td className="py-3 px-2">
                              <Badge className={getPaymentStatusColor(payment.status)}>
                                {getPaymentStatusLabel(payment.status)}
                              </Badge>
                            </td>
                            <td className="py-3 px-2">
                              {payment.invoiceUrl && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => window.open(payment.invoiceUrl!, "_blank")}
                                  className="text-neutral-400 hover:text-orange-500"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  // Debug: log customers state
  console.log("[v0] Rendering ClientesAsaas - customers:", customers.length, "loading:", loading, "error:", error)

  // Tela principal de lista de clientes
  return (
    <div className="w-full h-full flex flex-col bg-neutral-950">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-neutral-800 p-3 md:p-6">
        <div className="flex flex-col gap-3 md:gap-4">
          <div className="flex justify-between items-center gap-3">
            <h1 className="text-lg md:text-2xl font-bold text-white tracking-wider">CLIENTES ASAAS</h1>
            <Button
              onClick={() => {
                setFormData({
                  name: "",
                  cpfCnpj: "",
                  email: "",
                  mobilePhone: "",
                  phone: "",
                  postalCode: "",
                  address: "",
                  addressNumber: "",
                  city: "",
                  state: "",
                  groupName: "",
                })
                setShowModal(true)
              }}
              className="bg-orange-500 hover:bg-orange-600 text-white shrink-0"
              size="sm"
            >
              <Plus className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Novo Cliente</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Busca e Filtros */}
      <div className="flex-shrink-0 px-3 md:px-6 py-4 space-y-3">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <Input
            placeholder="Buscar clientes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-neutral-900 border-neutral-700 text-white placeholder-neutral-500 text-base"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-3 px-3">
          {[
            { key: "all", label: "Todos" },
            { key: "active", label: "Ativos" },
            { key: "pj", label: "PJ" },
            { key: "pf", label: "PF" },
            { key: "archived", label: "Arquivados" },
          ].map((f) => (
            <Button
              key={f.key}
              variant={filter === f.key ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f.key as FilterType)}
              className={`shrink-0 ${
                filter === f.key
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "border-neutral-700 text-neutral-400 hover:bg-neutral-800 bg-transparent"
              }`}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Tabela de Clientes - Desktop / Cards - Mobile */}
      <div className="flex-1 overflow-auto px-3 md:px-6">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-neutral-400">Carregando clientes...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
            <p className="text-red-400 mb-2 text-center max-w-md">{error}</p>
            <p className="text-neutral-500 text-sm mb-4 text-center max-w-md">
              {error.includes('não configurada') 
                ? 'Em produção, os dados serão carregados automaticamente quando as variáveis de ambiente estiverem configuradas.' 
                : 'Verifique sua conexão e tente novamente.'}
            </p>
            <Button onClick={fetchCustomers} variant="outline" size="sm" className="border-neutral-700 text-neutral-400 hover:bg-neutral-800 bg-transparent">
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar Novamente
            </Button>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-neutral-500">Nenhum cliente encontrado</p>
          </div>
        ) : (
          <>
            {/* Mobile Cards View */}
            <div className="md:hidden space-y-3">
              {filteredCustomers.map((customer) => (
                <Card 
                  key={customer.id} 
                  className="bg-neutral-900 border-neutral-800 cursor-pointer hover:border-neutral-700 transition-colors"
                  onClick={() => handleOpenDetails(customer)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold shrink-0">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-white font-medium truncate">{customer.name}</h3>
                          <p className="text-xs text-neutral-400">{formatDocument(customer.cpfCnpj)}</p>
                        </div>
                      </div>
                      <Badge className={customer.deleted ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}>
                        {customer.deleted ? "Inativo" : "Ativo"}
                      </Badge>
                    </div>
                    
                    {customer.email && (
                      <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1">
                        <Mail className="w-3 h-3" />
                        <span className="truncate">{customer.email}</span>
                      </div>
                    )}
                    
                    {customer.mobilePhone && (
                      <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1">
                        <Phone className="w-3 h-3" />
                        <span>{customer.mobilePhone}</span>
                      </div>
                    )}
                    
                    {customer.city && (
                      <div className="flex items-center gap-2 text-xs text-neutral-400">
                        <MapPin className="w-3 h-3" />
                        <span>{customer.city}/{customer.state}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Desktop Table View */}
            <Card className="hidden md:block bg-neutral-900 border-neutral-700">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-neutral-700 bg-neutral-800/50">
                        <th className="text-left py-4 px-6 text-xs font-medium text-neutral-400 uppercase tracking-wider">Nome</th>
                        <th className="text-left py-4 px-6 text-xs font-medium text-neutral-400 uppercase tracking-wider">Localidade & Doc</th>
                        <th className="text-left py-4 px-6 text-xs font-medium text-neutral-400 uppercase tracking-wider">Contato</th>
                        <th className="text-left py-4 px-6 text-xs font-medium text-neutral-400 uppercase tracking-wider">Cadastro</th>
                        <th className="text-left py-4 px-6 text-xs font-medium text-neutral-400 uppercase tracking-wider">Status</th>
                        <th className="text-left py-4 px-6 text-xs font-medium text-neutral-400 uppercase tracking-wider"></th>
                      </tr>
                    </thead>
                <tbody>
                  {filteredCustomers.map((customer, index) => (
                    <tr
                      key={customer.id}
                      className={`border-b border-neutral-800 hover:bg-neutral-800/50 transition-colors ${
                        index % 2 === 0 ? "bg-neutral-900" : "bg-neutral-900/50"
                      }`}
                    >
                      <td className="py-4 px-6 cursor-pointer hover:bg-neutral-800/50 transition-colors" onClick={() => handleOpenDetails(customer)}>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">{customer.name}</span>
                            <Badge className={customer.cpfCnpj?.length === 11 ? "bg-blue-500/20 text-blue-400 text-xs" : "bg-purple-500/20 text-purple-400 text-xs"}>
                              {customer.cpfCnpj?.length === 11 ? "PF" : "PJ"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {customer.company && (
                              <p className="text-xs text-neutral-500 flex items-center gap-1">
                                <User className="w-3 h-3" /> {customer.company}
                              </p>
                            )}
                            {customer.groupName && (
                              <Badge className="bg-orange-500/20 text-orange-400 text-xs flex items-center gap-1">
                                <Tag className="w-2.5 h-2.5" />
                                {customer.groupName}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="space-y-1">
                          <p className="text-sm text-neutral-300 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-neutral-500" />
                            {customer.city && customer.state ? `${customer.city}, ${customer.state}` : "-"}
                          </p>
                          <p className="text-xs text-neutral-500 flex items-center gap-1 font-mono">
                            <FileText className="w-3 h-3" />
                            {customer.cpfCnpj}
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="space-y-1">
                          <p className="text-sm text-neutral-300 flex items-center gap-1">
                            <Mail className="w-3 h-3 text-neutral-500" />
                            {customer.email || "-"}
                          </p>
                          <p className="text-xs text-neutral-500 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {customer.mobilePhone || customer.phone || "-"}
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <p className="text-sm text-neutral-400">{formatDate(customer.dateCreated)}</p>
                      </td>
                      <td className="py-4 px-6">
                        <Badge className={customer.deleted ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}>
                          {customer.deleted ? "INATIVO" : "ATIVO"}
                        </Badge>
                      </td>
                      <td className="py-4 px-6 relative">
                        <div ref={dropdownRef}>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDropdownOpen(dropdownOpen === customer.id ? null : customer.id)
                            }}
                            className="text-neutral-400 hover:text-white"
                          >
                            <MoreHorizontal className="w-5 h-5" />
                          </Button>
                          
                          {/* Dropdown Menu */}
                          {dropdownOpen === customer.id && (
                            <div className="absolute right-0 top-full mt-1 w-40 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl z-50">
                              <button
                                onClick={() => handleOpenDetails(customer)}
                                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-green-600 flex items-center gap-2 rounded-t-lg"
                              >
                                <Eye className="w-4 h-4" />
                                Detalhes
                              </button>
                              <button
                                onClick={() => {
                                  setDropdownOpen(null)
                                  router.push(`/pagamentos/cobrancas?cliente=${customer.id}&nome=${encodeURIComponent(customer.name)}`)
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-neutral-300 hover:bg-neutral-700 flex items-center gap-2"
                              >
                                <FileText className="w-4 h-4" />
                                Faturar
                              </button>
                              <button
                                onClick={() => {
                                  openEditModal(customer)
                                  setDropdownOpen(null)
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-neutral-300 hover:bg-neutral-700 flex items-center gap-2"
                              >
                                <Edit className="w-4 h-4" />
                                Editar
                              </button>
                              <div className="border-t border-neutral-700" />
                              <button
                                onClick={() => openDeleteModal(customer)}
                                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 rounded-b-lg"
                              >
                                <Trash2 className="w-4 h-4" />
                                Remover
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </>
        )}
      </div>

      {/* Modal Novo Cliente */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-end md:items-center justify-center md:p-4 z-50">
          <Card className="bg-neutral-900 border-neutral-700 w-full max-w-2xl max-h-[95vh] md:max-h-[90vh] overflow-y-auto rounded-t-2xl md:rounded-lg">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-neutral-900 z-10 border-b border-neutral-800">
              <CardTitle className="text-base md:text-lg font-bold text-white">Novo Cliente</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs text-neutral-400 mb-1 block">Nome Completo *</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-neutral-800 border-neutral-600 text-white text-base"
                    placeholder="Nome completo ou razao social"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 mb-1 block">CPF/CNPJ *</label>
                  <Input
                    value={formData.cpfCnpj}
                    onChange={(e) => setFormData({ ...formData, cpfCnpj: e.target.value.replace(/\D/g, "") })}
                    className="bg-neutral-800 border-neutral-600 text-white"
                    placeholder="Apenas numeros"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 mb-1 block">E-mail</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="bg-neutral-800 border-neutral-600 text-white"
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 mb-1 block">Celular</label>
                  <Input
                    value={formData.mobilePhone}
                    onChange={(e) => setFormData({ ...formData, mobilePhone: e.target.value.replace(/\D/g, "") })}
                    className="bg-neutral-800 border-neutral-600 text-white"
                    placeholder="11999999999"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 mb-1 block">Telefone</label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, "") })}
                    className="bg-neutral-800 border-neutral-600 text-white"
                    placeholder="1133334444"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 mb-1 block">CEP</label>
                  <Input
                    value={formData.postalCode}
                    onChange={(e) => handleCepChange(e.target.value)}
                    disabled={loadingCep}
                    className="bg-neutral-800 border-neutral-600 text-white disabled:opacity-50"
                    placeholder="00000000"
                  />
                  {loadingCep && <p className="text-xs text-neutral-400 mt-1">Carregando endereço...</p>}
                </div>
                <div>
                  <label className="text-xs text-neutral-400 mb-1 block">Endereco</label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="bg-neutral-800 border-neutral-600 text-white"
                    placeholder="Rua, Avenida..."
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 mb-1 block">Numero</label>
                  <Input
                    value={formData.addressNumber}
                    onChange={(e) => setFormData({ ...formData, addressNumber: e.target.value })}
                    className="bg-neutral-800 border-neutral-600 text-white"
                    placeholder="123"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 mb-1 block">Cidade</label>
                  <Input
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="bg-neutral-800 border-neutral-600 text-white"
                    placeholder="Sao Paulo"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 mb-1 block">Estado</label>
                  <Input
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="bg-neutral-800 border-neutral-600 text-white"
                    placeholder="SP"
                    maxLength={2}
                  />
                </div>
                
                {/* Grupo do Cliente */}
                <div className="md:col-span-2">
                  <label className="text-xs text-neutral-400 mb-1 block flex items-center gap-2">
                    <Tag className="w-3 h-3" />
                    Grupo do Cliente
                  </label>
                  <Input
                    value={formData.groupName || ""}
                    onChange={(e) => setFormData({ ...formData, groupName: e.target.value })}
                    className="bg-neutral-800 border-neutral-600 text-white"
                    placeholder="Ex: VIP, Premium, Corporativo..."
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    Digite o nome do grupo para organizar seus clientes
                  </p>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-neutral-700">
                <Button
                  onClick={handleCreateCustomer}
                  disabled={saving || !formData.name || !formData.cpfCnpj}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {saving ? "Salvando..." : "Criar Cliente"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  className="border-neutral-700 text-neutral-400 hover:bg-neutral-800 bg-transparent"
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de Edicao de Cliente */}
      {showEditModal && editingCustomer && (
        <div className="fixed inset-0 bg-black/80 flex items-end md:items-center justify-center md:p-4 z-50">
          <Card className="bg-neutral-900 border-neutral-700 w-full max-w-2xl max-h-[95vh] md:max-h-[90vh] overflow-y-auto rounded-t-2xl md:rounded-lg">
            <CardHeader className="sticky top-0 bg-neutral-900 z-10 border-b border-neutral-800">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base md:text-lg text-white">Editar Cliente</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingCustomer(null)
                  }}
                  className="text-neutral-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs text-neutral-400 mb-1 block">Nome *</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-neutral-800 border-neutral-600 text-white"
                    placeholder="Nome completo"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-neutral-400 mb-1 block">CPF/CNPJ</label>
                  <Input
                    value={formatDocument(formData.cpfCnpj)}
                    disabled
                    className="bg-neutral-700 border-neutral-600 text-neutral-500 cursor-not-allowed"
                  />
                  <p className="text-xs text-neutral-500 mt-1">CPF/CNPJ nao pode ser alterado</p>
                </div>
                <div>
                  <label className="text-xs text-neutral-400 mb-1 block">E-mail</label>
                  <Input
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="bg-neutral-800 border-neutral-600 text-white"
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 mb-1 block">Celular</label>
                  <Input
                    value={formData.mobilePhone}
                    onChange={(e) => setFormData({ ...formData, mobilePhone: e.target.value.replace(/\D/g, "") })}
                    className="bg-neutral-800 border-neutral-600 text-white"
                    placeholder="11999999999"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 mb-1 block">Telefone</label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, "") })}
                    className="bg-neutral-800 border-neutral-600 text-white"
                    placeholder="1133334444"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 mb-1 block">CEP</label>
                  <Input
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value.replace(/\D/g, "") })}
                    className="bg-neutral-800 border-neutral-600 text-white"
                    placeholder="00000000"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 mb-1 block">Endereco</label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="bg-neutral-800 border-neutral-600 text-white"
                    placeholder="Rua, Avenida..."
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 mb-1 block">Numero</label>
                  <Input
                    value={formData.addressNumber}
                    onChange={(e) => setFormData({ ...formData, addressNumber: e.target.value })}
                    className="bg-neutral-800 border-neutral-600 text-white"
                    placeholder="123"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 mb-1 block">Cidade</label>
                  <Input
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="bg-neutral-800 border-neutral-600 text-white"
                    placeholder="Sao Paulo"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 mb-1 block">Estado</label>
                  <Input
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="bg-neutral-800 border-neutral-600 text-white"
                    placeholder="SP"
                    maxLength={2}
                  />
                </div>
                
                {/* Grupo do Cliente */}
                <div className="md:col-span-2">
                  <label className="text-xs text-neutral-400 mb-1 block flex items-center gap-2">
                    <Tag className="w-3 h-3" />
                    Grupo do Cliente (opcional)
                  </label>
                  <Input
                    value={formData.groupName || ""}
                    onChange={(e) => setFormData({ ...formData, groupName: e.target.value })}
                    className="bg-neutral-800 border-neutral-600 text-white"
                    placeholder="Digite o nome do grupo criado no Asaas"
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    Digite exatamente o nome do grupo criado no painel do Asaas
                  </p>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-neutral-700 mt-4">
                <Button
                  onClick={handleEditCustomer}
                  disabled={saving}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Salvar Alteracoes"}
                </Button>
                <Button
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingCustomer(null)
                  }}
                  variant="outline"
                  className="flex-1 border-neutral-700 text-neutral-300 hover:bg-neutral-800 bg-transparent"
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Confirmacao de Remocao */}
      {showDeleteModal && deletingCustomer && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
          <Card className="bg-neutral-900 border-2 border-red-700 w-full max-w-md">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-2">Remover Cliente</h3>
                  <p className="text-sm text-neutral-300 mb-4">
                    Tem certeza que deseja remover este cliente do Asaas? Esta acao nao pode ser desfeita.
                  </p>
                  
                  <div className="bg-neutral-800 rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold">
                        {deletingCustomer.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white truncate">{deletingCustomer.name}</p>
                        <p className="text-xs text-neutral-400">{formatDocument(deletingCustomer.cpfCnpj)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                    <div className="flex gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <div className="text-xs text-red-400 space-y-1">
                        <p>Ao remover este cliente:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                          <li>Todas as cobrancas pendentes serao canceladas</li>
                          <li>Todas as assinaturas ativas serao encerradas</li>
                          <li>Os dados do cliente serao removidos do Asaas</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowDeleteModal(false)
                        setDeletingCustomer(null)
                      }}
                      disabled={processingDelete}
                      className="flex-1 border-neutral-700 text-neutral-300 hover:bg-neutral-800 bg-transparent"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleDeleteCustomer}
                      disabled={processingDelete}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    >
                      {processingDelete ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Removendo...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Confirmar Remocao
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
