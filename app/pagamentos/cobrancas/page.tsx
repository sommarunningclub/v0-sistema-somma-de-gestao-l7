"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  Plus,
  MoreHorizontal,
  Copy,
  ExternalLink,
  X,
  CreditCard,
  QrCode,
  Tag,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  FileText,
} from "lucide-react"
import { getPaymentsFromDB, savePaymentToDB } from "@/lib/services/payments"
import type { AsaasPayment, ChargeCreatePayload } from "@/lib/types/asaas"
import { PaymentDetailModal } from "@/components/payment-detail-modal"

interface AsaasCustomerAPI {
  id: string
  name: string
  email: string | null
  cpfCnpj: string
  company?: string
}

type TabType = "all" | "pending" | "overdue" | "today" | "received"

export default function Cobrancas() {
  const searchParams = useSearchParams()
  const [payments, setPayments] = useState<AsaasPayment[]>([])
  const [customers, setCustomers] = useState<AsaasCustomerAPI[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState<TabType>("all")
  const [showModal, setShowModal] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<AsaasPayment | null>(null)
  const [chargeMode, setChargeMode] = useState<"single" | "subscription">("single")
  const [formData, setFormData] = useState<ChargeCreatePayload>({
    customer: "",
    value: 0,
    dueDate: new Date().toISOString().split("T")[0],
    billingType: "PIX",
    description: "",
  })
  const [saving, setSaving] = useState(false)
  const [preSelectedCustomer, setPreSelectedCustomer] = useState(false)
  
  // Success modal state
  const [successModal, setSuccessModal] = useState<{
    show: boolean
    title: string
    message: string
    link?: string
  }>({ show: false, title: "", message: "" })
  
  // Coupon state
  const [couponCode, setCouponCode] = useState("")
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [appliedCoupon, setAppliedCoupon] = useState<{
    id: string
    code: string
    discount_type: 'PERCENTAGE' | 'FIXED'
    discount_value: number
    calculated_discount: number
  } | null>(null)

  // Pre-select customer from URL params
  useEffect(() => {
    if (preSelectedCustomer) return
    
    const clienteId = searchParams.get("cliente")
    const clienteNome = searchParams.get("nome")
    
    if (clienteId) {
      console.log("[v0] Pre-selected customer from URL:", clienteId, clienteNome)
      setFormData((prev) => ({ ...prev, customer: clienteId }))
      setShowModal(true)
      setPreSelectedCustomer(true)
    }
  }, [searchParams, preSelectedCustomer])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Buscar clientes diretamente da API Asaas (producao)
      const customersRes = await fetch("/api/asaas?endpoint=/customers&limit=100")
      let customersData: AsaasCustomerAPI[] = []
      if (customersRes.ok) {
        const data = await customersRes.json()
        customersData = data.data || []
        setCustomers(customersData)
      }

      // Buscar cobranças diretamente da API Asaas (produção)
      const response = await fetch("/api/asaas?endpoint=/payments&limit=100")
      
      if (response.ok) {
        const asaasData = await response.json()
        
        
        // Mapear dados do Asaas para o formato esperado
        const mappedPayments: AsaasPayment[] = (asaasData.data || []).map((p: Record<string, unknown>) => ({
          id: p.id as string,
          asaas_id: p.id as string,
          customer_asaas_id: p.customer as string,
          value: p.value as number,
          net_value: p.netValue as number,
          description: p.description as string | null,
          billing_type: p.billingType as string,
          status: p.status as string,
          due_date: p.dueDate as string,
          payment_date: p.paymentDate as string | null,
          invoice_url: p.invoiceUrl as string | null,
          bank_slip_url: p.bankSlipUrl as string | null,
          pix_qr_code: (p.pix as Record<string, unknown>)?.payload as string | null,
          raw_data: p,
        }))
        
        setPayments(mappedPayments)
      } else {
        console.error("[v0] Error fetching from Asaas, falling back to local DB")
        // Fallback para banco local se a API falhar
        const paymentsData = await getPaymentsFromDB()
        setPayments(paymentsData)
      }
    } catch (err) {
      console.error("[v0] Error fetching payments:", err)
      // Fallback para banco local
      const paymentsData = await getPaymentsFromDB()
      setPayments(paymentsData)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const today = new Date().toISOString().split("T")[0]

  const filteredPayments = payments.filter((payment) => {
    const matchesSearch =
      payment.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.asaas_id?.toLowerCase().includes(searchTerm.toLowerCase())

    if (!matchesSearch) return false

    switch (activeTab) {
      case "pending":
        return payment.status === "PENDING"
      case "overdue":
        return payment.status === "OVERDUE"
      case "today":
        return payment.due_date === today
      case "received":
        return ["RECEIVED", "CONFIRMED"].includes(payment.status)
      default:
        return true
    }
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "RECEIVED":
      case "CONFIRMED":
        return "bg-green-500/20 text-green-400"
      case "PENDING":
        return "bg-yellow-500/20 text-yellow-400"
      case "OVERDUE":
        return "bg-red-500/20 text-red-400"
      case "REFUNDED":
        return "bg-purple-500/20 text-purple-400"
      default:
        return "bg-neutral-500/20 text-neutral-400"
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PENDING: "Pendente",
      RECEIVED: "Recebido",
      CONFIRMED: "Confirmado",
      OVERDUE: "Vencido",
      REFUNDED: "Estornado",
      AWAITING_RISK_ANALYSIS: "Análise",
    }
    return labels[status] || status
  }

  const getBillingTypeIcon = (type: string) => {
    switch (type) {
      case "CREDIT_CARD":
        return <CreditCard className="w-4 h-4" />
      case "PIX":
        return <QrCode className="w-4 h-4" />
      default:
        return <CreditCard className="w-4 h-4" />
    }
  }

  const getBillingTypeLabel = (type: string) => {
    switch (type) {
      case "CREDIT_CARD":
        return "Cartao"
      case "PIX":
        return "Pix"
      default:
        return type
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-"
    return new Date(dateString).toLocaleDateString("pt-BR")
  }

  const handleCreateCharge = async () => {
    // Validar se cliente foi selecionado
    if (!formData.customer) {
      setSuccessModal({
        show: true,
        title: "Atencao",
        message: "Selecione um cliente antes de criar a cobranca.",
      })
      return
    }
    
    setSaving(true)
    try {
      // Build payload with discount if coupon is applied
      const finalValue = getFinalValue()
      
      const payload: Record<string, unknown> = {
        customer: formData.customer, // ID do cliente no Asaas (ex: cus_xxxxx)
        value: finalValue,
        dueDate: formData.dueDate,
        billingType: formData.billingType,
        description: formData.description || undefined,
        // Configuracoes para envio de email e geracao de link
        notificationDisabled: false, // Habilita envio de email automatico pelo Asaas
      }

      // Add discount info to Asaas payload if coupon applied
      if (appliedCoupon && appliedCoupon.calculated_discount > 0) {
        payload.discount = {
          value: appliedCoupon.calculated_discount,
          dueDateLimitDays: 0,
          type: "FIXED",
        }
        // Add coupon info to description
        const couponNote = `[Cupom: ${appliedCoupon.code}]`
        payload.description = formData.description 
          ? `${formData.description} ${couponNote}`
          : couponNote
      }

      const response = await fetch("/api/asaas?endpoint=/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const asaasPayment = await response.json()

        // Save payment to DB
        await savePaymentToDB({
          asaas_id: asaasPayment.id,
          customer_asaas_id: formData.customer,
          value: finalValue,
          description: payload.description as string || null,
          billing_type: formData.billingType,
          status: asaasPayment.status,
          due_date: formData.dueDate,
          raw_data: asaasPayment,
        })

        // Register coupon redemption if coupon was applied
        if (appliedCoupon) {
          await fetch("/api/coupons", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "apply",
              coupon_id: appliedCoupon.id,
              order_value: formData.value,
              discount_applied: appliedCoupon.calculated_discount,
              asaas_customer_id: formData.customer,
              asaas_payment_id: asaasPayment.id,
            }),
          })
        }

        // Mostrar sucesso com link de pagamento
        const invoiceUrl = asaasPayment.invoiceUrl || `https://www.asaas.com/i/${asaasPayment.id}`
        
        setShowModal(false)
        setSuccessModal({
          show: true,
          title: "Cobranca Criada!",
          message: "O cliente recebera um e-mail com a cobranca.",
          link: invoiceUrl,
        })
        setFormData({
          customer: "",
          value: 0,
          dueDate: new Date().toISOString().split("T")[0],
          billingType: "PIX",
          description: "",
        })
        removeCoupon()
        fetchData()
      } else {
        const error = await response.json()
        setSuccessModal({
          show: true,
          title: "Erro ao criar cobranca",
          message: error?.error?.errors?.[0]?.description || JSON.stringify(error),
        })
      }
    } catch (err) {
      console.error("[v0] Error creating charge:", err)
      setSuccessModal({
        show: true,
        title: "Erro ao criar cobranca",
        message: "Ocorreu um erro inesperado. Tente novamente.",
      })
    }
    setSaving(false)
  }

  const copyToClipboard = (text: string, showNotification = true) => {
    navigator.clipboard.writeText(text)
    if (showNotification) {
      setSuccessModal({
        show: true,
        title: "Copiado!",
        message: "Link copiado para a area de transferencia.",
      })
    }
  }

  // Coupon functions
  const validateCoupon = async () => {
    if (!couponCode.trim()) return
    
    setCouponLoading(true)
    setCouponError(null)
    
    try {
      const response = await fetch("/api/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "validate",
          code: couponCode.trim().toUpperCase(),
          order_value: formData.value,
          customer_id: formData.customer || undefined,
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        setCouponError(data.error || "Cupom invalido")
        setAppliedCoupon(null)
        return
      }
      
      setAppliedCoupon({
        id: data.coupon.id,
        code: data.coupon.code,
        discount_type: data.coupon.discount_type,
        discount_value: data.coupon.discount_value,
        calculated_discount: data.discount_amount,
      })
      setCouponError(null)
    } catch {
      setCouponError("Erro ao validar cupom")
      setAppliedCoupon(null)
    } finally {
      setCouponLoading(false)
    }
  }

  const removeCoupon = () => {
    setAppliedCoupon(null)
    setCouponCode("")
    setCouponError(null)
  }

  const getFinalValue = () => {
    if (!appliedCoupon) return formData.value
    return Math.max(0, formData.value - appliedCoupon.calculated_discount)
  }

  const [customerNames, setCustomerNames] = useState<Record<string, string>>({})

  const getCustomerName = (asaasId: string) => {
    // Primeiro buscar na lista de clientes carregada da API
    const customer = customers.find((c) => c.id === asaasId)
    if (customer?.name) return customer.name
    
    // Buscar no cache de nomes
    if (customerNames[asaasId]) return customerNames[asaasId]
    
    // Se não encontrou, buscar da API Asaas (async, vai popular o cache)
    if (asaasId && !customerNames[asaasId]) {
      fetch(`/api/asaas?endpoint=/customers/${asaasId}`)
        .then(res => res.json())
        .then(data => {
          if (data?.name) {
            setCustomerNames(prev => ({ ...prev, [asaasId]: data.name }))
          }
        })
        .catch(() => {})
    }
    
    return asaasId.slice(-8) // Mostrar últimos 8 chars enquanto carrega
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wider">COBRANÇAS</h1>
          <p className="text-sm text-neutral-400">
            Gerenciar cobranças e pagamentos 
            <span className="text-orange-400 ml-2">• API Produção</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={fetchData} 
            variant="outline"
            disabled={loading}
            className="border-neutral-700 text-neutral-400 hover:bg-neutral-800 bg-transparent"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button onClick={() => setShowModal(true)} className="bg-orange-500 hover:bg-orange-600 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Nova Cobrança
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 sm:gap-2 border-b border-neutral-700 pb-3 sm:pb-4 overflow-x-auto">
        {(
          [
            { id: "all", label: "Tudo" },
            { id: "pending", label: "A Receber" },
            { id: "overdue", label: "Vencidos" },
            { id: "today", label: "Hoje" },
            { id: "received", label: "Liquidados" },
          ] as { id: TabType; label: string }[]
        ).map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab(tab.id)}
            className={`text-xs sm:text-sm whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-orange-500 hover:bg-orange-600 text-white"
                : "text-neutral-400 hover:text-white hover:bg-neutral-800"
            }`}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <Input
          placeholder="Buscar..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-neutral-800 border-neutral-600 text-white placeholder-neutral-400 text-sm"
        />
      </div>

      {/* Tabela */}
      <Card className="bg-neutral-900 border-neutral-700">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
            LISTA DE COBRANÇAS ({filteredPayments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-neutral-400">Carregando cobranças...</p>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-neutral-400">Nenhuma cobrança encontrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-700 bg-neutral-800/50">
                    <th className="text-left py-3 px-2 sm:px-4 text-xs font-medium text-neutral-400 tracking-wider">
                      CLIENTE
                    </th>
                    <th className="hidden sm:table-cell text-left py-3 px-4 text-xs font-medium text-neutral-400 tracking-wider">
                      REFERÊNCIA
                    </th>
                    <th className="text-left py-3 px-2 sm:px-4 text-xs font-medium text-neutral-400 tracking-wider">
                      VENCIMENTO
                    </th>
                    <th className="hidden md:table-cell text-left py-3 px-4 text-xs font-medium text-neutral-400 tracking-wider">
                      VALOR
                    </th>
                    <th className="hidden lg:table-cell text-left py-3 px-4 text-xs font-medium text-neutral-400 tracking-wider">
                      FORMA
                    </th>
                    <th className="text-left py-3 px-2 sm:px-4 text-xs font-medium text-neutral-400 tracking-wider">
                      STATUS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((payment, index) => (
                    <tr
                      key={payment.id}
                      className={`border-b border-neutral-800 hover:bg-neutral-800 transition-colors cursor-pointer ${
                        index % 2 === 0 ? "bg-neutral-900" : "bg-neutral-850"
                      }`}
                      onClick={() => setSelectedPayment(payment)}
                    >
                      <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm text-white min-w-0">
                        <div className="truncate">{getCustomerName(payment.customer_asaas_id)}</div>
                        <div className="text-xs text-neutral-500 truncate">{formatCurrency(payment.value)}</div>
                      </td>
                      <td className="hidden sm:table-cell py-3 px-4 text-xs text-neutral-300 font-mono">
                        {payment.asaas_id?.slice(-8) || "-"}
                      </td>
                      <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm text-neutral-300 whitespace-nowrap">
                        {formatDate(payment.due_date)}
                      </td>
                      <td className="hidden md:table-cell py-3 px-4 text-sm text-white font-mono font-bold">
                        {formatCurrency(payment.value)}
                      </td>
                      <td className="hidden lg:table-cell py-3 px-4">
                        <div className="flex items-center gap-2 text-neutral-300">
                          {getBillingTypeIcon(payment.billing_type)}
                          <span className="text-xs">{getBillingTypeLabel(payment.billing_type)}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 sm:px-4">
                        <Badge className={`${getStatusColor(payment.status)} text-xs`}>{getStatusLabel(payment.status)}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Nova Cobrança */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
          <Card className="bg-neutral-900 border border-neutral-700 w-full max-w-lg my-4 sm:my-8">
            <CardHeader className="sticky top-0 z-10 bg-neutral-800 border-b border-neutral-700 flex flex-row items-center justify-between px-4 sm:px-6 py-3 sm:py-4 rounded-t-lg">
              <CardTitle className="text-base sm:text-lg font-bold text-white tracking-wider">NOVA COBRANÇA</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowModal(false)}
                className="text-neutral-400 hover:text-white h-8 w-8 sm:h-10 sm:w-10 shrink-0"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6 overflow-y-auto max-h-[calc(100vh-120px)]">
              {/* Tipo de Cobrança */}
              <div className="flex gap-2">
                <Button
                  variant={chargeMode === "single" ? "default" : "outline"}
                  onClick={() => setChargeMode("single")}
                  className={
                    chargeMode === "single"
                      ? "bg-orange-500 hover:bg-orange-600 text-white flex-1 text-sm"
                      : "border-neutral-700 text-neutral-400 flex-1 bg-transparent text-sm"
                  }
                >
                  Venda Única
                </Button>
                <Button
                  variant={chargeMode === "subscription" ? "default" : "outline"}
                  onClick={() => setChargeMode("subscription")}
                  className={
                    chargeMode === "subscription"
                      ? "bg-orange-500 hover:bg-orange-600 text-white flex-1 text-sm"
                      : "border-neutral-700 text-neutral-400 flex-1 bg-transparent text-sm"
                  }
                >
                  Assinatura
                </Button>
              </div>

              {chargeMode === "subscription" ? (
                <div className="text-center py-6 sm:py-8">
                  <p className="text-xs sm:text-sm text-neutral-400 mb-4">Para criar uma assinatura, use o módulo de Assinaturas.</p>
                  <Button
                    onClick={() => setShowModal(false)}
                    className="bg-orange-500 hover:bg-orange-600 text-white w-full"
                  >
                    Ir para Assinaturas
                  </Button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-xs text-neutral-400 tracking-wider mb-1 block">CLIENTE *</label>
                    <select
                      value={formData.customer}
                      onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                      className="w-full bg-neutral-800 border border-neutral-600 text-white px-3 py-2 rounded text-sm"
                    >
                      <option value="">Selecione um cliente</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.id})
                        </option>
                      ))}
                    </select>
                    {customers.length === 0 && (
                      <p className="text-xs text-red-400 mt-1">
                        Nenhum cliente encontrado. Cadastre um cliente primeiro.
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-neutral-400 tracking-wider mb-1 block">VALOR *</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.value || ""}
                        onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                        className="bg-neutral-800 border-neutral-600 text-white"
                        placeholder="0,00"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-neutral-400 tracking-wider mb-1 block">VENCIMENTO *</label>
                      <Input
                        type="date"
                        value={formData.dueDate}
                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                        className="bg-neutral-800 border-neutral-600 text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-neutral-400 tracking-wider mb-1 block">FORMA DE PAGAMENTO *</label>
                    <div className="flex gap-2">
                      {(["PIX", "CREDIT_CARD"] as const).map((type) => (
                        <Button
                          key={type}
                          variant={formData.billingType === type ? "default" : "outline"}
                          onClick={() => setFormData({ ...formData, billingType: type })}
                          className={
                            formData.billingType === type
                              ? "bg-orange-500 hover:bg-orange-600 text-white flex-1"
                              : "border-neutral-700 text-neutral-400 flex-1 bg-transparent"
                          }
                        >
                          {type === "PIX" && <QrCode className="w-4 h-4 mr-2" />}
                          {type === "CREDIT_CARD" && <CreditCard className="w-4 h-4 mr-2" />}
                          {type === "PIX" ? "Pix" : "Cartao"}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-neutral-400 tracking-wider mb-1 block">DESCRIÇÃO</label>
                    <Input
                      value={formData.description || ""}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="bg-neutral-800 border-neutral-600 text-white"
                      placeholder="Descrição da cobrança"
                    />
                  </div>

                  {/* Coupon Section */}
                  <div className="border border-neutral-700 rounded-lg p-4 space-y-3">
                    <label className="text-xs text-neutral-400 tracking-wider flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5" />
                      CUPOM DE DESCONTO
                    </label>
                    
                    {!appliedCoupon ? (
                      <div className="flex gap-2">
                        <Input
                          value={couponCode}
                          onChange={(e) => {
                            setCouponCode(e.target.value.toUpperCase())
                            setCouponError(null)
                          }}
                          className="bg-neutral-800 border-neutral-600 text-white uppercase"
                          placeholder="Digite o código do cupom"
                          disabled={couponLoading}
                        />
                        <Button
                          type="button"
                          onClick={validateCoupon}
                          disabled={couponLoading || !couponCode.trim() || !formData.value}
                          className="bg-neutral-700 hover:bg-neutral-600 text-white"
                        >
                          {couponLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "Aplicar"
                          )}
                        </Button>
                      </div>
                    ) : (
                      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-400" />
                            <span className="text-green-400 font-medium">{appliedCoupon.code}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={removeCoupon}
                            className="text-neutral-400 hover:text-red-400 h-6 px-2"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className="text-xs text-neutral-400">
                          {appliedCoupon.discount_type === 'PERCENTAGE' 
                            ? `${appliedCoupon.discount_value}% de desconto`
                            : `R$ ${appliedCoupon.discount_value.toFixed(2)} de desconto`
                          }
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-green-500/20">
                          <span className="text-xs text-neutral-400">Desconto aplicado:</span>
                          <span className="text-green-400 font-mono font-bold">
                            - {formatCurrency(appliedCoupon.calculated_discount)}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {couponError && (
                      <div className="flex items-center gap-2 text-red-400 text-xs">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {couponError}
                      </div>
                    )}
                    
                    {!formData.value && !appliedCoupon && (
                      <p className="text-xs text-neutral-500">Informe o valor da cobrança para aplicar um cupom</p>
                    )}
                  </div>

                  {/* Price Summary */}
                  {appliedCoupon && (
                    <div className="bg-neutral-800 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-400">Valor original:</span>
                        <span className="text-neutral-300 font-mono">{formatCurrency(formData.value)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-green-400">
                        <span>Desconto ({appliedCoupon.code}):</span>
                        <span className="font-mono">- {formatCurrency(appliedCoupon.calculated_discount)}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold pt-2 border-t border-neutral-700">
                        <span className="text-white">Total:</span>
                        <span className="text-orange-400 font-mono">{formatCurrency(getFinalValue())}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-4 border-t border-neutral-700">
                    <Button
                      onClick={handleCreateCharge}
                      disabled={saving || !formData.customer || !formData.value || !formData.dueDate}
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      {saving ? "Criando..." : "Criar Cobrança"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowModal(false)}
                      className="border-neutral-700 text-neutral-400 hover:bg-neutral-800 bg-transparent"
                    >
                      Cancelar
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payment Detail Modal */}
      <PaymentDetailModal
        payment={selectedPayment}
        customer={
          selectedPayment
            ? customers.find((c) => c.id === selectedPayment.customer_asaas_id) || null
            : null
        }
        onClose={() => setSelectedPayment(null)}
        onPaymentUpdated={fetchData}
      />

      {/* Success/Error Modal */}
      {successModal.show && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <Card className="bg-neutral-900 border-neutral-700 max-w-md w-full">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-full ${successModal.link ? 'bg-green-500/20' : successModal.title.includes('Erro') ? 'bg-red-500/20' : 'bg-blue-500/20'}`}>
                  {successModal.link ? (
                    <CheckCircle className="w-6 h-6 text-green-400" />
                  ) : successModal.title.includes('Erro') ? (
                    <AlertCircle className="w-6 h-6 text-red-400" />
                  ) : (
                    <CheckCircle className="w-6 h-6 text-blue-400" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-2">{successModal.title}</h3>
                  <p className="text-neutral-400 text-sm">{successModal.message}</p>
                  
                  {successModal.link && (
                    <div className="mt-4 p-3 bg-neutral-800 rounded-lg">
                      <p className="text-xs text-neutral-500 mb-2">Link de pagamento:</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-orange-400 break-all flex-1">{successModal.link}</code>
                        <Button
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(successModal.link || '')
                          }}
                          className="bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 shrink-0"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex gap-2 mt-6">
                {successModal.link && (
                  <Button
                    onClick={() => window.open(successModal.link, '_blank')}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Abrir Link
                  </Button>
                )}
                <Button
                  onClick={() => setSuccessModal({ show: false, title: "", message: "" })}
                  variant="outline"
                  className={`${successModal.link ? '' : 'flex-1'} border-neutral-700 text-neutral-400 hover:bg-neutral-800 bg-transparent`}
                >
                  Fechar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
