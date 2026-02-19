"use client"

import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react" // Import Loader2 here
import { useToast } from "@/hooks/use-toast"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  X,
  Copy,
  ExternalLink,
  MessageCircle,
  CheckCircle,
  Clock,
  Send,
  Eye,
  CreditCard,
  Calendar,
  Receipt,
  User,
  Building2,
  Menu,
  XCircle,
  RotateCcw,
  AlertTriangle,
} from "lucide-react"
import type { AsaasPayment } from "@/lib/types/asaas"

interface PaymentDetailModalProps {
  payment: AsaasPayment | null
  customer: { id: string; name: string; cpfCnpj: string; company?: string } | null
  onClose: () => void
  onPaymentUpdated?: () => void
}

interface ViewingInfo {
  hasBeenViewed: boolean
  viewedDate: string | null
  viewCount: number
}

export function PaymentDetailModal({ payment, customer, onClose, onPaymentUpdated }: PaymentDetailModalProps) {
  const { toast } = useToast()
  const [copiedLink, setCopiedLink] = useState(false)
  const [viewingInfo, setViewingInfo] = useState<ViewingInfo | null>(null)
  const [loadingViewingInfo, setLoadingViewingInfo] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showRefundModal, setShowRefundModal] = useState(false)
  const [refundValue, setRefundValue] = useState("")
  const [processingAction, setProcessingAction] = useState(false)

  useEffect(() => {
    async function fetchViewingInfo() {
      if (!payment?.asaas_id) return
      
      setLoadingViewingInfo(true)
      try {
        const response = await fetch(`/api/payments/${payment.asaas_id}/viewing-info`)
        if (response.ok) {
          const data = await response.json()
          setViewingInfo(data)
        } else {
          console.error("[v0] Error fetching viewing info:", await response.text())
        }
      } catch (error) {
        console.error("[v0] Error fetching viewing info:", error)
      } finally {
        setLoadingViewingInfo(false)
      }
    }

    fetchViewingInfo()
  }, [payment?.asaas_id])

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [onClose])

  if (!payment) return null

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR")
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      PENDING: { label: "Pendente", className: "bg-yellow-500/20 text-yellow-400" },
      RECEIVED: { label: "Recebido", className: "bg-green-500/20 text-green-400" },
      CONFIRMED: { label: "Confirmado", className: "bg-green-500/20 text-green-400" },
      OVERDUE: { label: "Vencido", className: "bg-red-500/20 text-red-400" },
      REFUNDED: { label: "Reembolsado", className: "bg-purple-500/20 text-purple-400" },
    }
    const config = statusMap[status] || { label: status, className: "bg-neutral-500/20 text-neutral-400" }
    return <Badge className={config.className}>{config.label}</Badge>
  }

  const getBillingTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      PIX: "PIX",
      CREDIT_CARD: "Cartão de Crédito",
      BOLETO: "Boleto",
      DEBIT_CARD: "Cartão de Débito",
      UNDEFINED: "Indefinido",
    }
    return map[type] || type
  }

  const handleCopyLink = () => {
    const url = payment.invoice_url || payment.bank_slip_url || ""
    navigator.clipboard.writeText(url)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleOpenLink = () => {
    const url = payment.invoice_url || payment.bank_slip_url
    if (url) window.open(url, "_blank")
  }

  const handleSendWhatsApp = () => {
    if (!customer) return
    const url = payment.invoice_url || payment.bank_slip_url || ""
    const message = `Olá ${customer.name.split(" ")[0]}, segue o link de pagamento da sua cobrança: ${url}`
    const whatsappUrl = `https://wa.me/${customer.cpfCnpj.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, "_blank")
  }

  const handleCancelPayment = async () => {
    if (!payment?.asaas_id) return
    
    setProcessingAction(true)
    try {
      const response = await fetch(`/api/asaas?endpoint=/payments/${payment.asaas_id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast({
          title: "Cobrança cancelada!",
          description: "A cobrança foi cancelada com sucesso.",
          variant: "default",
        })
        setShowCancelModal(false)
        onClose()
        
        // Atualizar lista de pagamentos sem recarregar página
        if (onPaymentUpdated) {
          onPaymentUpdated()
        }
      } else {
        const error = await response.json()
        toast({
          title: "Erro ao cancelar",
          description: error.errors?.[0]?.description || "Erro desconhecido ao cancelar cobrança.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("[v0] Error canceling payment:", error)
      toast({
        title: "Erro ao cancelar",
        description: "Ocorreu um erro ao cancelar a cobrança.",
        variant: "destructive",
      })
    } finally {
      setProcessingAction(false)
    }
  }

  const handleRefundPayment = async () => {
    if (!payment?.asaas_id) return
    
    setProcessingAction(true)
    try {
      const payload: { value?: number } = {}
      
      // Se o usuário informou um valor, usa parcial, senão total
      if (refundValue && parseFloat(refundValue) > 0) {
        payload.value = parseFloat(refundValue)
      }

      const response = await fetch(`/api/asaas?endpoint=/payments/${payment.asaas_id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const isPartialRefund = payload.value && payload.value < payment.value
        toast({
          title: "Estorno realizado!",
          description: isPartialRefund 
            ? `Estorno parcial de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(payload.value!)} realizado com sucesso.`
            : "Estorno total realizado com sucesso.",
          variant: "default",
        })
        setShowRefundModal(false)
        setRefundValue("")
        onClose()
        
        // Atualizar lista de pagamentos sem recarregar página
        if (onPaymentUpdated) {
          onPaymentUpdated()
        }
      } else {
        const error = await response.json()
        toast({
          title: "Erro ao estornar",
          description: error.errors?.[0]?.description || "Erro desconhecido ao processar estorno.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("[v0] Error refunding payment:", error)
      toast({
        title: "Erro ao estornar",
        description: "Ocorreu um erro ao processar o estorno.",
        variant: "destructive",
      })
    } finally {
      setProcessingAction(false)
    }
  }

  const createdDate = payment.created_at ? new Date(payment.created_at) : null
  const paidDate = payment.payment_date ? new Date(payment.payment_date) : null

  const journeySteps = [
    {
      label: "CRIADA",
      date: createdDate ? formatDateTime(payment.created_at) : null,
      icon: CheckCircle,
      active: true,
    },
    {
      label: "ENVIADA",
      date: createdDate ? formatDateTime(payment.created_at) : null,
      icon: Send,
      active: true,
    },
    {
      label: "VISUALIZADA",
      date: viewingInfo?.viewedDate ? formatDateTime(viewingInfo.viewedDate) : null,
      icon: Eye,
      active: viewingInfo?.hasBeenViewed || false,
      pending: payment.status === "PENDING",
    },
    {
      label: "AGUARDANDO",
      date: paidDate ? formatDateTime(payment.payment_date!) : null,
      icon: Clock,
      active: paidDate !== null,
      pending: payment.status === "PENDING",
    },
  ]

  const fee = payment.billing_type === "PIX" ? payment.value * 0.004 : payment.value * 0.039
  const netValue = payment.net_value || payment.value - fee

  return (
    <div className="fixed inset-0 bg-black/80 flex items-start sm:items-center justify-center z-50 p-0 sm:p-4 lg:p-6 overflow-y-auto">
      <div className="bg-neutral-900 border-0 sm:border border-neutral-700 rounded-none sm:rounded-lg w-full max-w-6xl min-h-screen sm:min-h-0 sm:max-h-[90vh] overflow-y-auto my-0 sm:my-auto flex flex-col">
        {/* Fixed Header */}
        <div className="sticky top-0 z-10 bg-neutral-800 border-b border-neutral-700 px-4 sm:px-6 py-3 sm:py-4 flex flex-col gap-3">
          {/* Top Row: Close, Title, Status, Menu */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-neutral-400 hover:text-white shrink-0 h-8 w-8 sm:h-9 sm:w-9"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm sm:text-base lg:text-lg font-bold text-white truncate">
                  {payment.description || "Fatura"}
                </h2>
                <p className="text-xs text-neutral-400 truncate">#{payment.asaas_id || payment.id}</p>
              </div>
            </div>

            {/* Status and Mobile Menu */}
            <div className="flex items-center gap-2 shrink-0">
              {getStatusBadge(payment.status)}
              
              {/* Mobile Menu */}
              <div className="relative sm:hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                  className="text-neutral-400 hover:text-white h-8 w-8"
                >
                  <Menu className="w-4 h-4" />
                </Button>

                {/* Mobile Action Menu */}
                {showMobileMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-neutral-800 border border-neutral-700 rounded-lg shadow-lg p-1.5 space-y-1 z-50 min-w-[180px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        handleCopyLink()
                        setShowMobileMenu(false)
                      }}
                      disabled={!payment.invoice_url && !payment.bank_slip_url}
                      className="w-full justify-start text-xs text-neutral-300 hover:bg-neutral-700 h-8"
                    >
                      <Copy className="w-3.5 h-3.5 mr-2 shrink-0" />
                      {copiedLink ? "Copiado!" : "Copiar Link"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        handleOpenLink()
                        setShowMobileMenu(false)
                      }}
                      disabled={!payment.invoice_url && !payment.bank_slip_url}
                      className="w-full justify-start text-xs text-neutral-300 hover:bg-neutral-700 h-8"
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-2 shrink-0" />
                      Abrir Link
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        handleSendWhatsApp()
                        setShowMobileMenu(false)
                      }}
                      disabled={!payment.invoice_url && !payment.bank_slip_url}
                      className="w-full justify-start text-xs text-green-400 hover:bg-neutral-700 h-8"
                    >
                      <MessageCircle className="w-3.5 h-3.5 mr-2 shrink-0" />
                      WhatsApp
                    </Button>
                    {payment.status === "PENDING" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowMobileMenu(false)
                          setShowCancelModal(true)
                        }}
                        className="w-full justify-start text-xs text-red-400 hover:bg-neutral-700 h-8"
                      >
                        <XCircle className="w-3.5 h-3.5 mr-2 shrink-0" />
                        Cancelar Cobrança
                      </Button>
                    )}
                    {(payment.status === "RECEIVED" || payment.status === "CONFIRMED") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowMobileMenu(false)
                          setShowRefundModal(true)
                        }}
                        className="w-full justify-start text-xs text-purple-400 hover:bg-neutral-700 h-8"
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-2 shrink-0" />
                        Estornar
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Desktop Action Buttons */}
          <div className="hidden sm:flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              disabled={!payment.invoice_url && !payment.bank_slip_url}
              className="border-neutral-700 text-neutral-300 hover:bg-neutral-700 bg-transparent text-sm h-9"
            >
              {copiedLink ? <CheckCircle className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copiedLink ? "Copiado!" : "Copiar Link"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenLink}
              disabled={!payment.invoice_url && !payment.bank_slip_url}
              className="border-neutral-700 text-neutral-300 hover:bg-neutral-700 bg-transparent text-sm h-9"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Abrir
            </Button>
            <Button
              size="sm"
              onClick={handleSendWhatsApp}
              disabled={!payment.invoice_url && !payment.bank_slip_url}
              className="bg-green-600 hover:bg-green-700 text-white text-sm h-9"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              WhatsApp
            </Button>
            {payment.status === "PENDING" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCancelModal(true)}
                className="border-red-700 text-red-400 hover:bg-red-900/20 bg-transparent text-sm h-9"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
            )}
            {(payment.status === "RECEIVED" || payment.status === "CONFIRMED") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRefundModal(true)}
                className="border-purple-700 text-purple-400 hover:bg-purple-900/20 bg-transparent text-sm h-9"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Estornar
              </Button>
            )}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Journey Timeline */}
          <div className="bg-neutral-900 px-4 sm:px-6 py-4 sm:py-6 border-b border-neutral-700">
            <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-between gap-3 sm:gap-4">
              {journeySteps.map((step, index) => (
                <div key={index} className="flex sm:flex-col items-center gap-2 sm:gap-3">
                  <div
                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0 ${
                      step.active
                        ? "bg-orange-500 text-white"
                        : step.pending
                        ? "bg-neutral-700 text-neutral-400"
                        : "bg-neutral-800 text-neutral-500"
                    }`}
                  >
                    <step.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div className="flex-1 sm:flex-initial text-left sm:text-center min-w-0">
                    <p className={`text-xs sm:text-sm font-semibold ${step.active ? "text-white" : "text-neutral-500"}`}>
                      {step.label}
                    </p>
                    <p className="text-[10px] sm:text-xs text-neutral-500 mt-0.5 truncate">{step.date || (step.pending ? "Pendente" : "-")}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Content Grid */}
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Grid Container for Financial and Info Cards - Two columns on desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Financial Composition - Takes 2 columns on lg */}
              <Card className="bg-neutral-800 border border-neutral-700 lg:col-span-2">
                <CardContent className="p-4 sm:p-6">
                  <h3 className="text-sm font-semibold text-orange-500 mb-4 flex items-center gap-2 tracking-wider">
                    <Receipt className="w-4 h-4 sm:w-5 sm:h-5" />
                    COMPOSIÇÃO FINANCEIRA
                  </h3>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    <div>
                      <p className="text-xs text-neutral-400 mb-1.5 tracking-wider">VALOR BRUTO</p>
                      <p className="text-lg sm:text-xl font-bold text-white">{formatCurrency(payment.value)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-400 mb-1.5 tracking-wider">TAXA ({payment.billing_type === "PIX" ? "0.4%" : "3.9%"})</p>
                      <p className="text-lg sm:text-xl font-bold text-red-400">-{formatCurrency(fee)}</p>
                    </div>
                    <div className="col-span-2 lg:col-span-1 bg-orange-500/20 rounded-lg p-3 sm:p-4">
                      <p className="text-xs text-orange-400 font-semibold mb-1.5 tracking-wider">VALOR LÍQUIDO</p>
                      <p className="text-lg sm:text-xl font-bold text-orange-400">{formatCurrency(netValue)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Customer Profile - Right column on lg */}
              <Card className="bg-neutral-800 border border-neutral-700 lg:row-span-2">
                <CardContent className="p-4 sm:p-6">
                  <h3 className="text-sm font-semibold text-neutral-300 mb-4 tracking-wider">PERFIL DO PAGADOR</h3>
                  {customer ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center shrink-0">
                          <User className="w-6 h-6 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-white text-sm sm:text-base truncate">{customer.name}</p>
                          <p className="text-xs text-neutral-400 truncate">{customer.cpfCnpj}</p>
                        </div>
                      </div>
                      {customer.company && (
                        <div className="pt-4 border-t border-neutral-700">
                          <div className="flex items-center gap-2 text-xs text-neutral-400">
                            <Building2 className="w-4 h-4" />
                            <span className="font-medium">Empresa:</span>
                          </div>
                          <p className="text-sm text-white mt-1.5">{customer.company}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-400">Carregando informações...</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* General Information */}
            <Card className="bg-neutral-800 border border-neutral-700">
              <CardContent className="p-4 sm:p-6">
                <h3 className="text-sm font-semibold text-neutral-300 mb-4 tracking-wider">INFORMAÇÕES GERAIS</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-neutral-700 rounded-lg flex items-center justify-center shrink-0">
                      <CreditCard className="w-5 h-5 text-orange-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-neutral-400 mb-1 tracking-wider">MÉTODO DE CHECKOUT</p>
                      <p className="text-sm font-semibold text-white">{getBillingTypeLabel(payment.billing_type)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-neutral-700 rounded-lg flex items-center justify-center shrink-0">
                      <Calendar className="w-5 h-5 text-orange-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-neutral-400 mb-1 tracking-wider">VENCIMENTO</p>
                      <p className="text-sm font-semibold text-white">{formatDate(payment.due_date)}</p>
                    </div>
                  </div>
                </div>

                {/* Transaction Logs */}
                <div className="mt-3 sm:mt-4 lg:mt-6 pt-3 sm:pt-4 lg:pt-6 border-t border-neutral-700">
                  <h4 className="text-xs font-semibold text-neutral-400 mb-2 sm:mb-2.5 lg:mb-3 tracking-wider">LOGS E RASTREABILIDADE</h4>
                  <div className="space-y-1.5 sm:space-y-2 text-xs">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-neutral-400">ID da Transação:</span>
                      <span className="font-mono text-white break-all text-xs">{payment.asaas_id}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-neutral-400">Referência Externa:</span>
                      <span className="font-mono text-white break-all text-xs">{payment.external_reference || "N/A"}</span>
                    </div>
                  </div>
                </div>

                {/* Viewing Tracking */}
                <div className="mt-3 sm:mt-4 lg:mt-6 pt-3 sm:pt-4 lg:pt-6 border-t border-neutral-700">
                  <h4 className="text-xs font-semibold text-orange-400 mb-2 sm:mb-2.5 lg:mb-3 tracking-wider flex items-center gap-2">
                    <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4" />
                    RASTREAMENTO DE VISUALIZAÇÃO
                  </h4>
                  {loadingViewingInfo ? (
                    <div className="text-xs text-neutral-500">Carregando...</div>
                  ) : viewingInfo ? (
                    <div className="space-y-2 sm:space-y-2.5">
                      <div className="flex items-center justify-between p-2 sm:p-2.5 lg:p-3 bg-neutral-700/50 rounded-lg">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <div className={`w-2 h-2 rounded-full ${viewingInfo.hasBeenViewed ? "bg-green-500" : "bg-neutral-500"}`} />
                          <span className="text-xs text-white font-medium">
                            {viewingInfo.hasBeenViewed ? "Visualizado" : "Não visualizado"}
                          </span>
                        </div>
                        {viewingInfo.hasBeenViewed && (
                          <Badge className="bg-green-500/20 text-green-400 text-xs">{viewingInfo.viewCount}x</Badge>
                        )}
                      </div>
                      {viewingInfo.viewedDate && (
                        <div className="text-xs text-neutral-400">
                          Primeira visualização: <span className="text-white">{formatDateTime(viewingInfo.viewedDate)}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-neutral-500">Informações não disponíveis</div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* QR Code PIX */}
            {payment.billing_type === "PIX" && (
              <Card className="bg-neutral-800 border border-neutral-700">
                <CardContent className="p-3 sm:p-6">
                  <h3 className="text-xs sm:text-sm font-semibold text-neutral-300 mb-3 sm:mb-4 tracking-wider">QR CODE PIX</h3>
                  {payment.pix_qr_code ? (
                    <div className="space-y-3">
                      <div className="bg-white rounded-lg p-3 sm:p-4 flex items-center justify-center">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(payment.pix_qr_code)}`}
                          alt="QR Code PIX"
                          className="w-32 h-32 sm:w-40 sm:h-40"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigator.clipboard.writeText(payment.pix_qr_code || "")}
                        className="w-full border-neutral-700 text-neutral-300 hover:bg-neutral-700 bg-transparent text-xs sm:text-sm"
                      >
                        <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" />
                        Copiar código PIX
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-6 sm:py-8">
                      <p className="text-xs sm:text-sm text-neutral-500">QR Code não disponível</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4">
          <Card className="bg-neutral-900 border-2 border-red-700 w-full max-w-md">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-2">Cancelar Cobrança</h3>
                  <p className="text-sm text-neutral-300 mb-4">
                    Tem certeza que deseja cancelar esta cobrança? Esta ação não pode ser desfeita.
                  </p>
                  <div className="bg-neutral-800 rounded p-3 mb-4">
                    <p className="text-xs text-neutral-400">Cliente:</p>
                    <p className="text-sm text-white font-semibold">{customer?.name}</p>
                    <p className="text-xs text-neutral-400 mt-2">Valor:</p>
                    <p className="text-lg text-white font-bold">{formatCurrency(payment.value)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowCancelModal(false)}
                      disabled={processingAction}
                      className="flex-1 border-neutral-700 text-neutral-300 hover:bg-neutral-800 bg-transparent"
                    >
                      Voltar
                    </Button>
                    <Button
                      onClick={handleCancelPayment}
                      disabled={processingAction}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    >
                      {processingAction ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Cancelando...
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 mr-2" />
                          Confirmar Cancelamento
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

      {/* Refund Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4">
          <Card className="bg-neutral-900 border-2 border-purple-700 w-full max-w-md">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center shrink-0">
                  <RotateCcw className="w-6 h-6 text-purple-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-2">Estornar Cobrança</h3>
                  <p className="text-sm text-neutral-300 mb-4">
                    {payment.billing_type === "PIX" 
                      ? "Para PIX, você pode fazer estornos parciais. Deixe o campo vazio para estorno total."
                      : "Para cartão de crédito, o estorno pode levar até 10 dias úteis."}
                  </p>
                  <div className="bg-neutral-800 rounded p-3 mb-4">
                    <p className="text-xs text-neutral-400">Valor da cobrança:</p>
                    <p className="text-lg text-white font-bold">{formatCurrency(payment.value)}</p>
                    {payment.net_value && (
                      <>
                        <p className="text-xs text-neutral-400 mt-2">Valor líquido recebido:</p>
                        <p className="text-sm text-green-400">{formatCurrency(payment.net_value)}</p>
                      </>
                    )}
                  </div>
                  <div className="mb-4">
                    <label className="text-xs text-neutral-400 mb-2 block">
                      Valor do estorno (opcional - deixe vazio para estorno total):
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={refundValue}
                      onChange={(e) => setRefundValue(e.target.value)}
                      className="bg-neutral-800 border-neutral-700 text-white"
                    />
                  </div>
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3 mb-4">
                    <div className="flex gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-yellow-400">
                        Atenção: As taxas da transação não são devolvidas no estorno.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowRefundModal(false)
                        setRefundValue("")
                      }}
                      disabled={processingAction}
                      className="flex-1 border-neutral-700 text-neutral-300 hover:bg-neutral-800 bg-transparent"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleRefundPayment}
                      disabled={processingAction}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      {processingAction ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Confirmar Estorno
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
