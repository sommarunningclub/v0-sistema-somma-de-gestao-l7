"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Search, Plus, X, RefreshCw, Copy, Loader2, QrCode,
  CheckCircle, Clock, AlertTriangle, Ban, Zap, ReceiptText,
  Calendar, DollarSign, Hash, ChevronRight, Link2, MessageCircle, ExternalLink,
} from "lucide-react"

// ─── Tipos ───────────────────────────────────────────────────────────────────

type PixAuthStatus = "CREATED" | "ACTIVE" | "EXPIRED" | "REFUSED" | "CANCELLED"
type PixFrequency  = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "SEMIANNUALLY" | "ANNUALLY"

interface PixAuthorization {
  id: string
  status: PixAuthStatus
  contractId: string
  description?: string
  value: number
  frequency: PixFrequency
  startDate?: string
  finishDate?: string
  payload?: string        // chave copia-e-cola
  encodedImage?: string   // QR Code base64
  paymentLink?: string    // link de pagamento
  expirationDate?: string
  cancellationDate?: string
  cancellationReason?: string
  customerId?: string
  customer?: string
}

interface PaymentInstruction {
  id: string
  status: string
  value: number
  dueDate?: string
  paymentDate?: string
  authorizationId: string
}

interface AsaasCustomer {
  id: string
  name: string
  email?: string
  cpfCnpj?: string
}

interface CreateFormData {
  customerId: string
  contractId: string
  frequency: PixFrequency
  startDate: string
  finishDate: string
  value: string
  description: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_ORDER: Record<string, number> = {
  CREATED: 0, ACTIVE: 1, EXPIRED: 2, REFUSED: 3, CANCELLED: 4,
}

const FREQUENCY_LABELS: Record<PixFrequency, string> = {
  WEEKLY: "Semanal",
  MONTHLY: "Mensal",
  QUARTERLY: "Trimestral",
  SEMIANNUALLY: "Semestral",
  ANNUALLY: "Anual",
}

function statusBadge(status: PixAuthStatus) {
  const map: Record<PixAuthStatus, { label: string; cls: string }> = {
    CREATED:   { label: "Aguardando escaneamento", cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    ACTIVE:    { label: "Ativo",                   cls: "bg-green-500/20 text-green-400 border-green-500/30" },
    EXPIRED:   { label: "Expirado",                cls: "bg-neutral-500/20 text-neutral-400 border-neutral-600" },
    REFUSED:   { label: "Recusado",                cls: "bg-red-500/20 text-red-400 border-red-500/30" },
    CANCELLED: { label: "Cancelado",               cls: "bg-neutral-700/60 text-neutral-500 border-neutral-700" },
  }
  const s = map[status] ?? { label: status, cls: "bg-neutral-700/60 text-neutral-400 border-neutral-700" }
  return <Badge className={`text-xs border ${s.cls}`}>{s.label}</Badge>
}

function StatusIcon({ status }: { status: PixAuthStatus }) {
  if (status === "CREATED")   return <Clock       className="w-5 h-5 text-yellow-400" />
  if (status === "ACTIVE")    return <CheckCircle className="w-5 h-5 text-green-400" />
  if (status === "REFUSED")   return <AlertTriangle className="w-5 h-5 text-red-400" />
  if (status === "CANCELLED") return <Ban          className="w-5 h-5 text-neutral-500" />
  return <AlertTriangle className="w-5 h-5 text-neutral-400" />
}

function fmt(v?: string) {
  if (!v) return "—"
  try { return new Date(v).toLocaleDateString("pt-BR") } catch { return v }
}

function fmtCurrency(v?: number) {
  if (v == null) return "R$ 0,00"
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function PixAutomaticoPage() {
  const [authorizations, setAuthorizations] = useState<PixAuthorization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("")

  // Modais
  const [showQrModal, setShowQrModal]     = useState<PixAuthorization | null>(null)
  const [showDetail, setShowDetail]       = useState<PixAuthorization | null>(null)
  const [showCreate, setShowCreate]       = useState(false)
  const [showInstructions, setShowInstructions] = useState<PixAuthorization | null>(null)
  const [instructions, setInstructions]   = useState<PaymentInstruction[]>([])
  const [loadingInstr, setLoadingInstr]   = useState(false)

  // Formulário de criação
  const [customers, setCustomers] = useState<AsaasCustomer[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [customerSearch, setCustomerSearch] = useState("")
  const [selectedCustomer, setSelectedCustomer] = useState<AsaasCustomer | null>(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const [form, setForm] = useState<CreateFormData>({
    customerId: "",
    contractId: "",
    frequency: "MONTHLY",
    startDate: new Date().toISOString().split("T")[0],
    finishDate: "",
    value: "",
    description: "",
  })

  // ─── Fetch autorizações ───────────────────────────────────────────────────

  const fetchAuthorizations = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ action: "list", limit: "100" })
      if (filterStatus) params.set("status", filterStatus)
      const res = await fetch(`/api/asaas/pix-automatic?${params}`)
      const json = await res.json()
      if (!res.ok) { setError(json?.message || "Erro ao carregar autorizações"); return }
      const raw: PixAuthorization[] = json?.data || json?.object === "list" ? json.data : Array.isArray(json) ? json : []
      raw.sort((a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99))
      setAuthorizations(raw)
    } catch (e) {
      setError("Falha na conexão com a API")
    } finally {
      setLoading(false)
    }
  }, [filterStatus])

  useEffect(() => { fetchAuthorizations() }, [fetchAuthorizations])

  // ─── Buscar clientes para o formulário ───────────────────────────────────

  const searchCustomers = useCallback(async (term: string) => {
    if (term.length < 2) { setCustomers([]); return }
    setLoadingCustomers(true)
    try {
      const res = await fetch(`/api/asaas?endpoint=/customers&name=${encodeURIComponent(term)}&limit=20`)
      const json = await res.json()
      setCustomers(json?.data || [])
    } catch { setCustomers([]) }
    finally { setLoadingCustomers(false) }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => searchCustomers(customerSearch), 400)
    return () => clearTimeout(t)
  }, [customerSearch, searchCustomers])

  // ─── Criar autorização ────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!form.customerId || !form.contractId || !form.value || !form.startDate) {
      alert("Preencha os campos obrigatórios: cliente, contrato, valor e data de início")
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        customerId: form.customerId,
        contractId: form.contractId,
        frequency: form.frequency,
        startDate: form.startDate,
        value: parseFloat(form.value),
      }
      if (form.description) payload.description = form.description
      if (form.finishDate)   payload.finishDate  = form.finishDate

      const res  = await fetch("/api/asaas/pix-automatic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const json = await res.json()
      if (!res.ok) { alert(`Erro: ${json?.message || JSON.stringify(json)}`); return }

      // Se o Asaas retornou QR Code, exibe direto
      if (json?.immediateQrCode?.encodedImage) {
        setShowQrModal({ ...json, encodedImage: json.immediateQrCode.encodedImage, payload: json.immediateQrCode.copyPasteCode })
      }
      setShowCreate(false)
      resetForm()
      fetchAuthorizations()
    } catch { alert("Falha ao criar autorização") }
    finally { setSaving(false) }
  }

  // ─── Cancelar autorização ─────────────────────────────────────────────────

  const handleCancel = async (id: string) => {
    if (!confirm("Cancelar esta autorização de Pix Automático?")) return
    const res  = await fetch(`/api/asaas/pix-automatic?id=${id}`, { method: "DELETE" })
    const json = await res.json()
    if (!res.ok) { alert(`Erro: ${json?.message || "Falha ao cancelar"}`); return }
    setShowDetail(null)
    fetchAuthorizations()
  }

  // ─── Buscar instruções de pagamento ──────────────────────────────────────

  const fetchInstructions = async (auth: PixAuthorization) => {
    setShowInstructions(auth)
    setLoadingInstr(true)
    setInstructions([])
    try {
      const res  = await fetch(`/api/asaas/pix-automatic?action=instructions&authorizationId=${auth.id}&limit=50`)
      const json = await res.json()
      setInstructions(json?.data || [])
    } catch { setInstructions([]) }
    finally { setLoadingInstr(false) }
  }

  // ─── Copiar para clipboard ────────────────────────────────────────────────

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  const resetForm = () => {
    setForm({ customerId: "", contractId: "", frequency: "MONTHLY", startDate: new Date().toISOString().split("T")[0], finishDate: "", value: "", description: "" })
    setSelectedCustomer(null)
    setCustomerSearch("")
    setCustomers([])
  }

  // ─── Filtro local ─────────────────────────────────────────────────────────

  const filtered = authorizations.filter(a => {
    const q = searchTerm.toLowerCase()
    const matchSearch = !searchTerm || a.contractId?.toLowerCase().includes(q) || (a.customerId || a.customer || "").toLowerCase().includes(q) || a.description?.toLowerCase().includes(q)
    return matchSearch
  })

  // ─── Métricas ─────────────────────────────────────────────────────────────

  const metrics = {
    total:     authorizations.length,
    active:    authorizations.filter(a => a.status === "ACTIVE").length,
    pending:   authorizations.filter(a => a.status === "CREATED").length,
    cancelled: authorizations.filter(a => a.status === "CANCELLED").length,
    mrr:       authorizations.filter(a => a.status === "ACTIVE" && a.frequency === "MONTHLY").reduce((s, a) => s + (a.value || 0), 0),
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Pix Automático</h1>
          <p className="text-neutral-400 text-sm mt-1">Autorizações de débito recorrente via Pix</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchAuthorizations} variant="outline" size="sm" className="border-neutral-600 text-neutral-400 hover:text-white gap-2">
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </Button>
          <Button onClick={() => { resetForm(); setShowCreate(true) }} className="bg-green-600 hover:bg-green-700 text-white gap-2" size="sm">
            <Plus className="w-4 h-4" />
            Nova Autorização
          </Button>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total",    value: metrics.total,     icon: Zap,          cls: "text-blue-400" },
          { label: "Ativos",   value: metrics.active,    icon: CheckCircle,  cls: "text-green-400" },
          { label: "Pendentes",value: metrics.pending,   icon: Clock,        cls: "text-yellow-400" },
          { label: "MRR (PIX)",value: fmtCurrency(metrics.mrr), icon: DollarSign, cls: "text-orange-400", isText: true },
        ].map(m => (
          <Card key={m.label} className="bg-neutral-800 border-neutral-700">
            <CardContent className="p-4 flex items-center gap-3">
              <m.icon className={`w-8 h-8 ${m.cls}`} />
              <div>
                <p className="text-neutral-400 text-xs">{m.label}</p>
                <p className={`text-xl font-bold ${m.cls}`}>{m.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Controles */}
      <Card className="bg-neutral-800 border-neutral-700">
        <CardContent className="pt-4 flex flex-wrap gap-3">
          <div className="flex-1 min-w-52 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <Input
              placeholder="Buscar por contrato, cliente..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 bg-neutral-700 border-neutral-600 text-white"
            />
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-neutral-700 border border-neutral-600 text-white px-3 py-2 rounded-md text-sm"
          >
            <option value="">Todos os status</option>
            <option value="CREATED">Aguardando</option>
            <option value="ACTIVE">Ativo</option>
            <option value="EXPIRED">Expirado</option>
            <option value="REFUSED">Recusado</option>
            <option value="CANCELLED">Cancelado</option>
          </select>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card className="bg-neutral-800 border-neutral-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base">
            Autorizações <span className="text-neutral-500 font-normal text-sm">({filtered.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-neutral-400">
              <Loader2 className="w-6 h-6 animate-spin" /> Carregando autorizações...
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-16 gap-3 text-red-400">
              <AlertTriangle className="w-5 h-5" /> {error}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-neutral-500">
              <QrCode className="w-12 h-12" />
              <p>Nenhuma autorização encontrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-700">
                    {["Status", "Contrato", "Valor", "Frequência", "Início", "Fim", "Ações"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-neutral-400 font-medium text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(auth => (
                    <tr
                      key={auth.id}
                      onClick={() => setShowDetail(auth)}
                      className="border-b border-neutral-700/50 hover:bg-neutral-700/40 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <StatusIcon status={auth.status} />
                          {statusBadge(auth.status)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white font-medium">{auth.contractId}</td>
                      <td className="px-4 py-3 text-green-400 font-semibold">{fmtCurrency(auth.value)}</td>
                      <td className="px-4 py-3 text-neutral-300">{FREQUENCY_LABELS[auth.frequency] || auth.frequency}</td>
                      <td className="px-4 py-3 text-neutral-300">{fmt(auth.startDate)}</td>
                      <td className="px-4 py-3 text-neutral-400">{fmt(auth.finishDate)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                          {auth.status === "CREATED" && auth.encodedImage && (
                            <button onClick={() => setShowQrModal(auth)} className="p-1.5 rounded bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400" title="Ver QR Code">
                              <QrCode className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => fetchInstructions(auth)} className="p-1.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400" title="Instruções de pagamento">
                            <ReceiptText className="w-4 h-4" />
                          </button>
                          {(auth.status === "CREATED" || auth.status === "ACTIVE") && (
                            <button onClick={() => handleCancel(auth.id)} className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400" title="Cancelar">
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Modal Detalhe ─────────────────────────────────────────────── */}
      {showDetail && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowDetail(null)}>
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">Detalhes da Autorização</h2>
              <button onClick={() => setShowDetail(null)} className="text-neutral-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex items-center gap-3">
              <StatusIcon status={showDetail.status} />
              {statusBadge(showDetail.status)}
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                { label: "ID",         value: showDetail.id },
                { label: "Contrato",   value: showDetail.contractId },
                { label: "Valor",      value: fmtCurrency(showDetail.value) },
                { label: "Frequência", value: FREQUENCY_LABELS[showDetail.frequency] || showDetail.frequency },
                { label: "Início",     value: fmt(showDetail.startDate) },
                { label: "Fim",        value: fmt(showDetail.finishDate) },
                { label: "Descrição",  value: showDetail.description || "—" },
                ...(showDetail.cancellationReason ? [{ label: "Motivo cancelamento", value: showDetail.cancellationReason }] : []),
              ].map(r => (
                <div key={r.label}>
                  <p className="text-neutral-400 text-xs">{r.label}</p>
                  <p className="text-white font-medium break-all">{r.value}</p>
                </div>
              ))}
            </div>
            {/* Chave copia-e-cola */}
            {showDetail.payload && (
              <div className="bg-neutral-800 rounded-lg p-3">
                <p className="text-neutral-400 text-xs mb-1">Chave Pix (copia e cola)</p>
                <div className="flex items-center gap-2">
                  <p className="text-white text-xs font-mono truncate flex-1">{showDetail.payload}</p>
                  <button onClick={() => copyToClipboard(showDetail.payload!, showDetail.id)} className="text-blue-400 hover:text-blue-300 shrink-0">
                    {copied === showDetail.id ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              {showDetail.status === "CREATED" && showDetail.encodedImage && (
                <Button onClick={() => setShowQrModal(showDetail)} size="sm" className="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 gap-2 border border-yellow-500/30">
                  <QrCode className="w-4 h-4" /> Ver QR Code
                </Button>
              )}
              <Button onClick={() => fetchInstructions(showDetail)} size="sm" variant="outline" className="border-neutral-600 text-neutral-300 gap-2">
                <ReceiptText className="w-4 h-4" /> Instruções
              </Button>
              {(showDetail.status === "CREATED" || showDetail.status === "ACTIVE") && (
                <Button onClick={() => handleCancel(showDetail.id)} size="sm" className="bg-red-500/20 text-red-400 hover:bg-red-500/30 gap-2 border border-red-500/30 ml-auto">
                  <Ban className="w-4 h-4" /> Cancelar
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal QR Code ─────────────────────────────────────────────── */}
      {showQrModal && (() => {
        const paymentUrl = showQrModal.paymentLink ||
          (showQrModal.payload ? `https://asaas.com/i/${showQrModal.id}` : null)
        const whatsAppMsg = encodeURIComponent(
          `Olá! Segue o link para autorizar seu Pix Automático Somma:\n\n` +
          `Contrato: ${showQrModal.contractId}\n` +
          `Valor: ${fmtCurrency(showQrModal.value)} / ${FREQUENCY_LABELS[showQrModal.frequency] || showQrModal.frequency}\n\n` +
          (paymentUrl ? `Link de pagamento: ${paymentUrl}\n\n` : "") +
          (showQrModal.payload ? `Ou use a chave Pix copia e cola:\n${showQrModal.payload}` : "")
        )
        return (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowQrModal(null)}>
            <div className="bg-neutral-900 border border-neutral-700 rounded-xl w-full max-w-md p-6 space-y-5" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-white font-bold text-lg">QR Code Pix Automático</h2>
                  <p className="text-neutral-400 text-xs mt-0.5">Contrato: {showQrModal.contractId} · {fmtCurrency(showQrModal.value)}</p>
                </div>
                <button onClick={() => setShowQrModal(null)} className="text-neutral-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>

              {/* QR Code */}
              <div className="flex flex-col items-center gap-3">
                {showQrModal.encodedImage ? (
                  <div className="bg-white p-3 rounded-xl">
                    <img
                      src={`data:image/png;base64,${showQrModal.encodedImage}`}
                      alt="QR Code Pix Automático"
                      className="w-64 h-64 rounded"
                    />
                  </div>
                ) : (
                  <div className="w-64 h-64 bg-neutral-800 rounded-xl flex items-center justify-center text-neutral-500 border border-neutral-700">
                    <QrCode className="w-20 h-20" />
                  </div>
                )}
                <p className="text-neutral-400 text-xs text-center">Escaneie com o app do banco para autorizar o débito recorrente</p>
                {showQrModal.expirationDate && (
                  <p className="text-xs text-yellow-400/80">Expira em: {fmt(showQrModal.expirationDate)}</p>
                )}
              </div>

              {/* Copia e cola */}
              {showQrModal.payload && (
                <div className="bg-neutral-800 rounded-lg p-3">
                  <p className="text-neutral-400 text-xs mb-1.5">Chave Pix — copia e cola</p>
                  <div className="flex items-center gap-2">
                    <p className="text-white text-xs font-mono truncate flex-1">{showQrModal.payload}</p>
                    <button
                      onClick={() => copyToClipboard(showQrModal.payload!, showQrModal.id + "-payload")}
                      className="shrink-0 text-blue-400 hover:text-blue-300 transition-colors"
                      title="Copiar chave"
                    >
                      {copied === showQrModal.id + "-payload" ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Link de pagamento */}
              {paymentUrl && (
                <div className="bg-neutral-800 rounded-lg p-3">
                  <p className="text-neutral-400 text-xs mb-1.5">Link de pagamento</p>
                  <div className="flex items-center gap-2">
                    <p className="text-blue-400 text-xs truncate flex-1">{paymentUrl}</p>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => copyToClipboard(paymentUrl, showQrModal.id + "-link")}
                        className="text-neutral-400 hover:text-white transition-colors"
                        title="Copiar link"
                      >
                        {copied === showQrModal.id + "-link" ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <a
                        href={paymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neutral-400 hover:text-white transition-colors"
                        title="Abrir link"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Ações */}
              <div className="flex gap-2 pt-1">
                {paymentUrl && (
                  <Button
                    onClick={() => copyToClipboard(paymentUrl, showQrModal.id + "-link-btn")}
                    size="sm"
                    className="flex-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 gap-2"
                  >
                    {copied === showQrModal.id + "-link-btn" ? <CheckCircle className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                    Copiar Link
                  </Button>
                )}
                <a
                  href={`https://wa.me/?text=${whatsAppMsg}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button
                    size="sm"
                    className="w-full bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30 gap-2"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Enviar via WhatsApp
                  </Button>
                </a>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ─── Modal Instruções de Pagamento ─────────────────────────────── */}
      {showInstructions && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowInstructions(null)}>
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl w-full max-w-2xl p-6 space-y-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold">Instruções de Pagamento</h2>
              <button onClick={() => setShowInstructions(null)} className="text-neutral-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-neutral-400 text-sm">Contrato: <span className="text-white">{showInstructions.contractId}</span></p>
            {loadingInstr ? (
              <div className="flex items-center justify-center py-8 gap-2 text-neutral-400">
                <Loader2 className="w-5 h-5 animate-spin" /> Buscando instruções...
              </div>
            ) : instructions.length === 0 ? (
              <p className="text-neutral-500 text-sm text-center py-8">Nenhuma instrução encontrada</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-700">
                    {["Status", "Valor", "Vencimento", "Pagamento"].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-neutral-400 text-xs font-medium uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {instructions.map(instr => (
                    <tr key={instr.id} className="border-b border-neutral-800 hover:bg-neutral-800/50">
                      <td className="px-3 py-2">
                        <Badge className="text-xs bg-neutral-700/60 text-neutral-300 border-neutral-600">{instr.status}</Badge>
                      </td>
                      <td className="px-3 py-2 text-green-400 font-medium">{fmtCurrency(instr.value)}</td>
                      <td className="px-3 py-2 text-neutral-300">{fmt(instr.dueDate)}</td>
                      <td className="px-3 py-2 text-neutral-300">{fmt(instr.paymentDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ─── Modal Criar Autorização ───────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl w-full max-w-lg p-6 space-y-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">Nova Autorização Pix</h2>
              <button onClick={() => setShowCreate(false)} className="text-neutral-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {/* Busca de cliente */}
            <div>
              <label className="text-neutral-400 text-xs block mb-1.5">Cliente Asaas <span className="text-red-400">*</span></label>
              {selectedCustomer ? (
                <div className="flex items-center justify-between bg-neutral-800 rounded-lg px-3 py-2 border border-neutral-600">
                  <div>
                    <p className="text-white text-sm font-medium">{selectedCustomer.name}</p>
                    <p className="text-neutral-500 text-xs">{selectedCustomer.email}</p>
                  </div>
                  <button onClick={() => { setSelectedCustomer(null); setForm(f => ({ ...f, customerId: "" })) }} className="text-neutral-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <Input
                    placeholder="Digite o nome do cliente..."
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    className="pl-10 bg-neutral-700 border-neutral-600 text-white"
                  />
                  {loadingCustomers && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-neutral-400" />}
                  {customers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-neutral-800 border border-neutral-600 rounded-lg mt-1 z-10 max-h-48 overflow-y-auto">
                      {customers.map(c => (
                        <button key={c.id} className="w-full text-left px-3 py-2 hover:bg-neutral-700 transition-colors" onClick={() => { setSelectedCustomer(c); setForm(f => ({ ...f, customerId: c.id })); setCustomers([]); setCustomerSearch("") }}>
                          <p className="text-white text-sm">{c.name}</p>
                          <p className="text-neutral-500 text-xs">{c.cpfCnpj}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Contrato */}
              <div>
                <label className="text-neutral-400 text-xs block mb-1.5">ID do Contrato <span className="text-red-400">*</span></label>
                <Input value={form.contractId} onChange={e => setForm(f => ({ ...f, contractId: e.target.value.slice(0, 35) }))} placeholder="CONTRATO-2026-001" className="bg-neutral-700 border-neutral-600 text-white" />
              </div>
              {/* Valor */}
              <div>
                <label className="text-neutral-400 text-xs block mb-1.5">Valor (R$) <span className="text-red-400">*</span></label>
                <Input type="number" min="0.01" step="0.01" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="299.90" className="bg-neutral-700 border-neutral-600 text-white" />
              </div>
              {/* Frequência */}
              <div>
                <label className="text-neutral-400 text-xs block mb-1.5">Frequência <span className="text-red-400">*</span></label>
                <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value as PixFrequency }))} className="w-full bg-neutral-700 border border-neutral-600 text-white px-3 py-2 rounded-md text-sm">
                  {Object.entries(FREQUENCY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              {/* Data início */}
              <div>
                <label className="text-neutral-400 text-xs block mb-1.5">Data de Início <span className="text-red-400">*</span></label>
                <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className="bg-neutral-700 border-neutral-600 text-white" />
              </div>
              {/* Data fim */}
              <div>
                <label className="text-neutral-400 text-xs block mb-1.5">Data de Fim <span className="text-neutral-500">(opcional)</span></label>
                <Input type="date" value={form.finishDate} onChange={e => setForm(f => ({ ...f, finishDate: e.target.value }))} className="bg-neutral-700 border-neutral-600 text-white" />
              </div>
              {/* Descrição */}
              <div>
                <label className="text-neutral-400 text-xs block mb-1.5">Descrição <span className="text-neutral-500">(máx. 35 chars)</span></label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value.slice(0, 35) }))} placeholder="Plano Mensal..." className="bg-neutral-700 border-neutral-600 text-white" />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <Button onClick={() => setShowCreate(false)} variant="outline" className="flex-1 border-neutral-600 text-neutral-400">Cancelar</Button>
              <Button onClick={handleCreate} disabled={saving} className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Criando...</> : <><QrCode className="w-4 h-4" /> Criar e Gerar QR</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
