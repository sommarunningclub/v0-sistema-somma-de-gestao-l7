"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  Plus,
  MoreHorizontal,
  X,
  CreditCard,
  QrCode,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  Tag,
  AlertCircle,
  Loader2,
  Copy,
  ExternalLink,
} from "lucide-react"
import type { SubscriptionCreatePayload } from "@/lib/types/asaas"

interface AsaasCustomerAPI {
  id: string
  name: string
  email: string | null
  cpfCnpj: string
}

interface LocalSubscription {
  id: string
  customer: string
  customerName: string
  value: number
  cycle: string
  nextDueDate: string
  status: string
  billingType: string
  retentionMonths: number
  createdAt: string
}

export default function Assinaturas() {
  const [subscriptions, setSubscriptions] = useState<LocalSubscription[]>([])
  const [customers, setCustomers] = useState<AsaasCustomerAPI[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [selectedSubscription, setSelectedSubscription] = useState<LocalSubscription | null>(null)
  const [formData, setFormData] = useState<SubscriptionCreatePayload>({
    customer: "",
    value: 0,
    nextDueDate: new Date().toISOString().split("T")[0],
    cycle: "MONTHLY",
    description: "",
    billingType: "PIX",
  })
  const [saving, setSaving] = useState(false)

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
    discount_type: "PERCENTAGE" | "FIXED"
    discount_value: number
    calculated_discount: number
  } | null>(null)

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

      // Buscar assinaturas do Asaas via API
      const response = await fetch("/api/asaas?endpoint=/subscriptions&limit=100")
      if (response.ok) {
        const data = await response.json()
        const subs = (data.data || []).map((s: Record<string, unknown>) => ({
          id: s.id as string,
          customer: s.customer as string,
          customerName: customersData.find((c) => c.id === s.customer)?.name || (s.customer as string),
          value: s.value as number,
          cycle: s.cycle as string,
          nextDueDate: s.nextDueDate as string,
          status: s.status as string,
          billingType: s.billingType as string,
          retentionMonths: Math.floor((new Date().getTime() - new Date(s.dateCreated as string).getTime()) / (1000 * 60 * 60 * 24 * 30)),
          createdAt: s.dateCreated as string,
        }))
        setSubscriptions(subs)
      }
    } catch (err) {
      console.error("[v0] Error fetching subscriptions:", err)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const activeSubscriptions = subscriptions.filter((s) => s.status === "ACTIVE")
  const totalMRR = activeSubscriptions.reduce((sum, s) => sum + s.value, 0)

  const filteredSubscriptions = subscriptions.filter(
    (sub) =>
      sub.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.id?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-500/20 text-green-400"
      case "INACTIVE":
        return "bg-yellow-500/20 text-yellow-400"
      case "EXPIRED":
        return "bg-red-500/20 text-red-400"
      default:
        return "bg-neutral-500/20 text-neutral-400"
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      ACTIVE: "Ativa",
      INACTIVE: "Inativa",
      EXPIRED: "Expirada",
    }
    return labels[status] || status
  }

  const getCycleLabel = (cycle: string) => {
    const labels: Record<string, string> = {
      WEEKLY: "Semanal",
      BIWEEKLY: "Quinzenal",
      MONTHLY: "Mensal",
      QUARTERLY: "Trimestral",
      SEMIANNUALLY: "Semestral",
      YEARLY: "Anual",
    }
    return labels[cycle] || cycle
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

  const handleCreateSubscription = async () => {
    // Validar se cliente foi selecionado
    if (!formData.customer) {
      setSuccessModal({
        show: true,
        title: "Atencao",
        message: "Selecione um cliente antes de criar a assinatura.",
      })
      return
    }
    
    setSaving(true)
    try {
      // Build payload with discount if coupon is applied
      const finalValue = getFinalValue()
      
      // Construir payload explicitamente com os campos corretos da API Asaas
      const payload: Record<string, unknown> = {
        customer: formData.customer, // ID do cliente no Asaas (ex: cus_xxxxx)
        billingType: formData.billingType,
        value: finalValue,
        nextDueDate: formData.nextDueDate,
        cycle: formData.cycle,
        description: formData.description || undefined,
        // Configuracoes para envio de email e geracao de link
        notificationDisabled: false, // Habilita envio de email automatico pelo Asaas
      }

      // Add discount info to Asaas payload if coupon applied
      // For subscriptions, discount applies to first payment
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

      const response = await fetch("/api/asaas?endpoint=/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const asaasSubscription = await response.json()

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
              asaas_payment_id: asaasSubscription.id,
            }),
          })
        }

        // Mostrar sucesso com informacoes da assinatura
        const paymentLink = `https://www.asaas.com/subscriptions/${asaasSubscription.id}`
        
        setShowModal(false)
        setSuccessModal({
          show: true,
          title: "Assinatura Criada!",
          message: `Proximo vencimento: ${asaasSubscription.nextDueDate}. O cliente recebera um e-mail com a cobranca.`,
          link: paymentLink,
        })
        
        setFormData({
          customer: "",
          value: 0,
          nextDueDate: new Date().toISOString().split("T")[0],
          cycle: "MONTHLY",
          description: "",
          billingType: "PIX",
        })
        removeCoupon()
        fetchData()
      } else {
        const error = await response.json()
        setSuccessModal({
          show: true,
          title: "Erro ao criar assinatura",
          message: error?.error?.errors?.[0]?.description || JSON.stringify(error),
        })
      }
    } catch (err) {
      console.error("[v0] Error creating subscription:", err)
      setSuccessModal({
        show: true,
        title: "Erro ao criar assinatura",
        message: "Ocorreu um erro inesperado. Tente novamente.",
      })
    }
    setSaving(false)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wider">ASSINATURAS</h1>
          <p className="text-sm text-neutral-400">Gerenciar assinaturas recorrentes</p>
        </div>
        <Button onClick={() => setShowModal(true)} className="bg-orange-500 hover:bg-orange-600 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Nova Assinatura
        </Button>
      </div>

      {/* Cards Superiores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-neutral-900 border-neutral-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-400 tracking-wider mb-1">ASSINATURAS ATIVAS</p>
                <p className="text-3xl font-bold text-white font-mono">{activeSubscriptions.length}</p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900 border-neutral-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-400 tracking-wider mb-1">MRR ESTIMADO</p>
                <p className="text-3xl font-bold text-white font-mono">{formatCurrency(totalMRR)}</p>
              </div>
              <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <Input
          placeholder="Buscar por cliente ou ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-neutral-800 border-neutral-600 text-white placeholder-neutral-400"
        />
      </div>

      {/* Tabela */}
      <Card className="bg-neutral-900 border-neutral-700">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
            LISTA DE ASSINATURAS ({filteredSubscriptions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-neutral-400">Carregando assinaturas...</p>
            </div>
          ) : filteredSubscriptions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-neutral-400">Nenhuma assinatura encontrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-700">
                    <th className="text-left py-3 px-4 text-xs font-medium text-neutral-400 tracking-wider">
                      CLIENTE
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-neutral-400 tracking-wider">
                      VALOR (MRR)
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-neutral-400 tracking-wider">
                      CICLO ATUAL
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-neutral-400 tracking-wider">
                      RETENÇÃO
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-neutral-400 tracking-wider">
                      STATUS
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-neutral-400 tracking-wider">
                      AÇÕES
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubscriptions.map((subscription, index) => (
                    <tr
                      key={subscription.id}
                      className={`border-b border-neutral-800 hover:bg-neutral-800 transition-colors cursor-pointer ${
                        index % 2 === 0 ? "bg-neutral-900" : "bg-neutral-850"
                      }`}
                      onClick={() => setSelectedSubscription(subscription)}
                    >
                      <td className="py-3 px-4 text-sm text-white">{subscription.customerName}</td>
                      <td className="py-3 px-4 text-sm text-white font-mono font-bold">
                        {formatCurrency(subscription.value)}
                      </td>
                      <td className="py-3 px-4 text-sm text-neutral-300">{getCycleLabel(subscription.cycle)}</td>
                      <td className="py-3 px-4 text-sm text-neutral-300">{subscription.retentionMonths} meses</td>
                      <td className="py-3 px-4">
                        <Badge className={getStatusColor(subscription.status)}>
                          {getStatusLabel(subscription.status)}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-neutral-400 hover:text-orange-500"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedSubscription(subscription)
                          }}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Nova Assinatura */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="bg-neutral-900 border-neutral-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-bold text-white tracking-wider">NOVA ASSINATURA</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-neutral-400 tracking-wider mb-1 block">CLIENTE *</label>
                <select
                  value={formData.customer}
                  onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-600 text-white px-3 py-2 rounded"
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-neutral-400 tracking-wider mb-1 block">VALOR DA PARCELA *</label>
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
                  <label className="text-xs text-neutral-400 tracking-wider mb-1 block">PRIMEIRO VENCIMENTO *</label>
                  <Input
                    type="date"
                    value={formData.nextDueDate}
                    onChange={(e) => setFormData({ ...formData, nextDueDate: e.target.value })}
                    className="bg-neutral-800 border-neutral-600 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-neutral-400 tracking-wider mb-1 block">PERIODICIDADE *</label>
                <select
                  value={formData.cycle}
                  onChange={(e) => setFormData({ ...formData, cycle: e.target.value as any })}
                  className="w-full bg-neutral-800 border border-neutral-600 text-white px-3 py-2 rounded"
                >
                  <option value="WEEKLY">Semanal</option>
                  <option value="BIWEEKLY">Quinzenal</option>
                  <option value="MONTHLY">Mensal</option>
                  <option value="QUARTERLY">Trimestral</option>
                  <option value="SEMIANNUALLY">Semestral</option>
                  <option value="YEARLY">Anual</option>
                </select>
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
                  placeholder="Descrição da assinatura"
                />
              </div>

              {/* Coupon Section */}
              <div className="border border-neutral-700 rounded-lg p-4 space-y-3">
                <label className="text-xs text-neutral-400 tracking-wider flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5" />
                  CUPOM DE DESCONTO (PRIMEIRA PARCELA)
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
                      {couponLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}
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
                      {appliedCoupon.discount_type === "PERCENTAGE"
                        ? `${appliedCoupon.discount_value}% de desconto na primeira parcela`
                        : `R$ ${appliedCoupon.discount_value.toFixed(2)} de desconto na primeira parcela`}
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
                  <p className="text-xs text-neutral-500">
                    Informe o valor da parcela para aplicar um cupom
                  </p>
                )}
              </div>

              {/* Price Summary */}
              {appliedCoupon && (
                <div className="bg-neutral-800 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-400">Valor original (1a parcela):</span>
                    <span className="text-neutral-300 font-mono">{formatCurrency(formData.value)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-green-400">
                    <span>Desconto ({appliedCoupon.code}):</span>
                    <span className="font-mono">- {formatCurrency(appliedCoupon.calculated_discount)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-neutral-700">
                    <span className="text-white">1a Parcela:</span>
                    <span className="text-orange-400 font-mono">{formatCurrency(getFinalValue())}</span>
                  </div>
                  <p className="text-xs text-neutral-500 pt-1">
                    * Parcelas seguintes: {formatCurrency(formData.value)}
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t border-neutral-700">
                <Button
                  onClick={handleCreateSubscription}
                  disabled={saving || !formData.customer || !formData.value || !formData.nextDueDate}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {saving ? "Criando..." : "Criar Assinatura"}
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

      {/* Modal Detalhes da Assinatura */}
      {selectedSubscription && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="bg-neutral-900 border-neutral-700 w-full max-w-lg">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-bold text-white tracking-wider">DETALHES DA ASSINATURA</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedSubscription(null)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-neutral-800 rounded-lg">
                <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedSubscription.customerName}</h3>
                  <p className="text-sm text-neutral-400">{getCycleLabel(selectedSubscription.cycle)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-neutral-400 tracking-wider mb-1">VALOR DO CICLO</p>
                  <p className="text-xl text-white font-mono font-bold">
                    {formatCurrency(selectedSubscription.value)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 tracking-wider mb-1">PRÓXIMO VENCIMENTO</p>
                  <p className="text-sm text-white">{formatDate(selectedSubscription.nextDueDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 tracking-wider mb-1">RETENÇÃO</p>
                  <p className="text-sm text-white">{selectedSubscription.retentionMonths} meses</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 tracking-wider mb-1">LTV ACUMULADO</p>
                  <p className="text-sm text-green-500 font-mono font-bold">
                    {formatCurrency(selectedSubscription.value * selectedSubscription.retentionMonths)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 tracking-wider mb-1">STATUS</p>
                  <Badge className={getStatusColor(selectedSubscription.status)}>
                    {getStatusLabel(selectedSubscription.status)}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 tracking-wider mb-1">SAÚDE</p>
                  <div className="flex items-center gap-2">
                    {selectedSubscription.status === "ACTIVE" ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-green-500 text-sm">Saudável</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        <span className="text-yellow-500 text-sm">Atenção</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

                            {/* Link da assinatura */}
              <div className="space-y-2">
                <p className="text-xs text-neutral-400 tracking-wider">LINK DA ASSINATURA</p>
                <div className="p-3 bg-neutral-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-orange-400 break-all flex-1">
                      {`https://www.asaas.com/subscriptions/${selectedSubscription.id}`}
                    </code>
                    <Button
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(`https://www.asaas.com/subscriptions/${selectedSubscription.id}`)
                        setSuccessModal({ show: true, title: "Copiado!", message: "Link copiado para a area de transferencia." })
                      }}
                      className="bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 shrink-0"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-neutral-700">
                <Button 
                  onClick={() => window.open(`https://www.asaas.com/subscriptions/${selectedSubscription.id}`, '_blank')}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Abrir no Asaas
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(`https://www.asaas.com/subscriptions/${selectedSubscription.id}`)
                    setSuccessModal({ show: true, title: "Copiado!", message: "Link copiado para a area de transferencia." })
                  }}
                  className="border-neutral-700 text-neutral-400 hover:bg-neutral-800 bg-transparent"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar Link
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
                      <p className="text-xs text-neutral-500 mb-2">Link da assinatura:</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-orange-400 break-all flex-1">{successModal.link}</code>
                        <Button
                          size="sm"
                          onClick={() => navigator.clipboard.writeText(successModal.link || '')}
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
