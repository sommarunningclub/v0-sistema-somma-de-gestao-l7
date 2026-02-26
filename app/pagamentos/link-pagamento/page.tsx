"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Link2,
  Plus,
  Search,
  RefreshCw,
  Copy,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
  Eye,
  Loader2,
  AlertTriangle,
  X,
  ChevronDown,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ChargeType = "DETACHED" | "INSTALLMENT" | "RECURRENT"
type BillingType = "UNDEFINED" | "BOLETO" | "CREDIT_CARD" | "PIX"
type SubscriptionCycle =
  | "WEEKLY"
  | "BIWEEKLY"
  | "MONTHLY"
  | "BIMONTHLY"
  | "QUARTERLY"
  | "SEMIANNUALLY"
  | "YEARLY"

interface PaymentLink {
  id: string
  name: string
  description?: string
  value?: number
  active: boolean
  chargeType: ChargeType
  billingType: BillingType
  subscriptionCycle?: SubscriptionCycle
  url: string
  endDate?: string
  deleted: boolean
  viewCount: number
  maxInstallmentCount?: number
  dueDateLimitDays?: number
  notificationEnabled: boolean
  externalReference?: string
}

interface CreateLinkForm {
  name: string
  description: string
  chargeType: ChargeType
  billingType: BillingType
  value: string
  subscriptionCycle: SubscriptionCycle
  maxInstallmentCount: string
  dueDateLimitDays: string
  endDate: string
  notificationEnabled: boolean
  isAddressRequired: boolean
}

// ─── Labels ───────────────────────────────────────────────────────────────────

const CHARGE_TYPE_LABELS: Record<ChargeType, string> = {
  DETACHED: "Avulsa",
  INSTALLMENT: "Parcelada",
  RECURRENT: "Recorrente",
}

const BILLING_TYPE_LABELS: Record<BillingType, string> = {
  UNDEFINED: "Qualquer forma",
  BOLETO: "Boleto",
  CREDIT_CARD: "Cartão de Crédito",
  PIX: "Pix",
}

const CYCLE_LABELS: Record<SubscriptionCycle, string> = {
  WEEKLY: "Semanal",
  BIWEEKLY: "Quinzenal",
  MONTHLY: "Mensal",
  BIMONTHLY: "Bimestral",
  QUARTERLY: "Trimestral",
  SEMIANNUALLY: "Semestral",
  YEARLY: "Anual",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(v?: number) {
  if (v == null) return "Livre"
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
}

function fmtDate(d?: string) {
  if (!d) return "—"
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR")
}

function chargeBadge(type: ChargeType) {
  const styles: Record<ChargeType, string> = {
    DETACHED: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    INSTALLMENT: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    RECURRENT: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  }
  return (
    <Badge className={`text-xs font-medium border ${styles[type]}`}>
      {CHARGE_TYPE_LABELS[type]}
    </Badge>
  )
}

function billingBadge(type: BillingType) {
  const styles: Record<BillingType, string> = {
    UNDEFINED: "bg-neutral-700 text-neutral-300 border-neutral-600",
    BOLETO: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    CREDIT_CARD: "bg-green-500/15 text-green-400 border-green-500/30",
    PIX: "bg-teal-500/15 text-teal-400 border-teal-500/30",
  }
  return (
    <Badge className={`text-xs font-medium border ${styles[type]}`}>
      {BILLING_TYPE_LABELS[type]}
    </Badge>
  )
}

// ─── Default form ─────────────────────────────────────────────────────────────

const DEFAULT_FORM: CreateLinkForm = {
  name: "",
  description: "",
  chargeType: "DETACHED",
  billingType: "UNDEFINED",
  value: "",
  subscriptionCycle: "MONTHLY",
  maxInstallmentCount: "12",
  dueDateLimitDays: "3",
  endDate: "",
  notificationEnabled: true,
  isAddressRequired: false,
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function LinkPagamentoPage() {
  const [links, setLinks] = useState<PaymentLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all")

  // Modal criar
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<CreateLinkForm>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Modal detalhe
  const [showDetail, setShowDetail] = useState<PaymentLink | null>(null)

  // Copied feedback
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchLinks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: "100" })
      const res = await fetch(`/api/asaas/payment-links?${params}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error?.errors?.[0]?.description || "Erro ao buscar links")
      }
      const data = await res.json()
      setLinks((data.data || []).filter((l: PaymentLink) => !l.deleted))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchLinks() }, [fetchLinks])

  // ── Criar ──────────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!form.name.trim()) { setSaveError("Nome é obrigatório"); return }
    setSaving(true)
    setSaveError(null)
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        billingType: form.billingType,
        chargeType: form.chargeType,
        notificationEnabled: form.notificationEnabled,
        isAddressRequired: form.isAddressRequired,
      }
      if (form.description.trim()) body.description = form.description.trim()
      if (form.value) body.value = parseFloat(form.value)
      if (form.endDate) body.endDate = form.endDate
      if (form.chargeType === "INSTALLMENT") body.maxInstallmentCount = parseInt(form.maxInstallmentCount)
      if (form.chargeType === "RECURRENT") body.subscriptionCycle = form.subscriptionCycle
      if (form.billingType === "BOLETO" || form.billingType === "UNDEFINED") {
        body.dueDateLimitDays = parseInt(form.dueDateLimitDays)
      }

      const res = await fetch("/api/asaas/payment-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = data?.error?.errors?.[0]?.description || "Erro ao criar link"
        throw new Error(msg)
      }
      setLinks(prev => [data, ...prev])
      setShowCreate(false)
      setForm(DEFAULT_FORM)
    } catch (e: any) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Toggle ativo/inativo ───────────────────────────────────────────────────

  const handleToggle = async (link: PaymentLink) => {
    const action = link.active ? "deactivate" : "activate"
    try {
      const res = await fetch(`/api/asaas/payment-links?id=${link.id}&action=${action}`, {
        method: "PATCH",
      })
      if (res.ok) {
        setLinks(prev => prev.map(l => l.id === link.id ? { ...l, active: !l.active } : l))
      }
    } catch (e) {
      console.error("[v0] Error toggling payment link:", e)
    }
  }

  // ── Deletar ────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este link?")) return
    try {
      const res = await fetch(`/api/asaas/payment-links?id=${id}`, { method: "DELETE" })
      if (res.ok) {
        setLinks(prev => prev.filter(l => l.id !== id))
        if (showDetail?.id === id) setShowDetail(null)
      }
    } catch (e) {
      console.error("[v0] Error deleting payment link:", e)
    }
  }

  // ── Copiar link ────────────────────────────────────────────────────────────

  const handleCopy = (link: PaymentLink) => {
    navigator.clipboard.writeText(link.url)
    setCopiedId(link.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // ── Filtros ────────────────────────────────────────────────────────────────

  const filtered = links.filter(l => {
    const matchSearch =
      !search ||
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.id.toLowerCase().includes(search.toLowerCase())
    const matchActive =
      filterActive === "all" ||
      (filterActive === "active" && l.active) ||
      (filterActive === "inactive" && !l.active)
    return matchSearch && matchActive
  })

  // ── Métricas ───────────────────────────────────────────────────────────────

  const activeCount = links.filter(l => l.active).length
  const totalViews = links.reduce((s, l) => s + (l.viewCount || 0), 0)
  const recurrentCount = links.filter(l => l.chargeType === "RECURRENT").length

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6 min-h-full">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Link de Pagamento</h1>
          <p className="text-neutral-400 text-xs md:text-sm mt-0.5">
            Crie e gerencie links para cobranças sem cadastro prévio do cliente
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button
            onClick={fetchLinks}
            variant="outline"
            size="sm"
            className="border-neutral-700 text-neutral-400 hover:text-white p-2 md:px-3"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden md:inline ml-2">Atualizar</span>
          </Button>
          <Button
            onClick={() => { setForm(DEFAULT_FORM); setSaveError(null); setShowCreate(true) }}
            size="sm"
            className="bg-orange-500 hover:bg-orange-600 text-white gap-1 md:gap-2"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Novo Link</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total de Links", value: links.length, sub: "criados", color: "text-white" },
          { label: "Ativos", value: activeCount, sub: "funcionando", color: "text-green-400" },
          { label: "Recorrentes", value: recurrentCount, sub: "assinaturas", color: "text-orange-400" },
          { label: "Visualizações", value: totalViews, sub: "total", color: "text-blue-400" },
        ].map(m => (
          <Card key={m.label} className="bg-neutral-800 border-neutral-700">
            <CardContent className="p-3 md:p-4">
              <p className="text-neutral-500 text-xs uppercase tracking-wider">{m.label}</p>
              <p className={`text-2xl font-bold mt-1 ${m.color}`}>{m.value}</p>
              <p className="text-neutral-500 text-xs mt-0.5">{m.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Controles de filtro */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <Input
            placeholder="Buscar por nome ou ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 bg-neutral-800 border-neutral-700 text-white placeholder-neutral-500"
          />
        </div>
        <div className="flex gap-1 bg-neutral-800 border border-neutral-700 rounded-lg p-1">
          {(["all", "active", "inactive"] as const).map(opt => (
            <button
              key={opt}
              onClick={() => setFilterActive(opt)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                filterActive === opt
                  ? "bg-orange-500 text-white"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              {opt === "all" ? "Todos" : opt === "active" ? "Ativos" : "Inativos"}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de links */}
      <div>
        <p className="text-neutral-500 text-xs uppercase tracking-wider mb-3">
          Links <span className="text-neutral-600">({filtered.length})</span>
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-neutral-400">
            <Loader2 className="w-6 h-6 animate-spin" />
            Carregando links...
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-red-400">
            <AlertTriangle className="w-8 h-8" />
            <p className="text-sm text-center max-w-sm">{error}</p>
            <Button onClick={fetchLinks} variant="outline" size="sm" className="border-neutral-700 text-neutral-400">
              Tentar novamente
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-neutral-500">
            <Link2 className="w-12 h-12 text-neutral-700" />
            <p className="text-sm">Nenhum link encontrado</p>
            <Button
              onClick={() => { setForm(DEFAULT_FORM); setShowCreate(true) }}
              size="sm"
              className="bg-orange-500 hover:bg-orange-600 text-white gap-2 mt-1"
            >
              <Plus className="w-4 h-4" />
              Criar primeiro link
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(link => (
              <div
                key={link.id}
                className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 hover:border-neutral-600 transition-all group"
              >
                {/* Linha principal */}
                <div className="flex items-start gap-3">
                  {/* Indicador ativo */}
                  <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${link.active ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]" : "bg-neutral-600"}`} />

                  {/* Info central */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => setShowDetail(link)}
                        className="text-white font-semibold text-sm hover:text-orange-400 transition-colors text-left truncate"
                      >
                        {link.name}
                      </button>
                      {chargeBadge(link.chargeType)}
                      {billingBadge(link.billingType)}
                    </div>
                    {link.description && (
                      <p className="text-neutral-400 text-xs mt-0.5 truncate">{link.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="text-green-400 font-bold text-sm">{fmtCurrency(link.value)}</span>
                      {link.chargeType === "RECURRENT" && link.subscriptionCycle && (
                        <span className="text-neutral-500 text-xs">{CYCLE_LABELS[link.subscriptionCycle]}</span>
                      )}
                      {link.chargeType === "INSTALLMENT" && link.maxInstallmentCount && (
                        <span className="text-neutral-500 text-xs">até {link.maxInstallmentCount}x</span>
                      )}
                      {link.viewCount > 0 && (
                        <span className="flex items-center gap-1 text-neutral-500 text-xs">
                          <Eye className="w-3 h-3" />
                          {link.viewCount}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Valor */}
                  <div className="hidden md:block text-right flex-shrink-0">
                    <p className="text-neutral-500 text-xs">ID</p>
                    <p className="text-neutral-400 font-mono text-xs mt-0.5">{link.id}</p>
                  </div>
                </div>

                {/* Rodapé com link e ações */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-700 gap-2">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neutral-400 hover:text-orange-400 text-xs font-mono truncate flex items-center gap-1 transition-colors max-w-[200px] sm:max-w-none"
                  >
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{link.url}</span>
                  </a>

                  <div className="flex gap-1.5 flex-shrink-0">
                    {/* Copiar URL */}
                    <button
                      onClick={() => handleCopy(link)}
                      className="p-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-neutral-300 hover:text-white transition-all active:scale-95"
                      title="Copiar link"
                    >
                      {copiedId === link.id
                        ? <Check className="w-3.5 h-3.5 text-green-400" />
                        : <Copy className="w-3.5 h-3.5" />
                      }
                    </button>

                    {/* Toggle ativo */}
                    <button
                      onClick={() => handleToggle(link)}
                      className={`p-2 rounded-lg transition-all active:scale-95 ${
                        link.active
                          ? "bg-green-500/15 hover:bg-green-500/25 text-green-400"
                          : "bg-neutral-700 hover:bg-neutral-600 text-neutral-400"
                      }`}
                      title={link.active ? "Desativar" : "Ativar"}
                    >
                      {link.active
                        ? <ToggleRight className="w-4 h-4" />
                        : <ToggleLeft className="w-4 h-4" />
                      }
                    </button>

                    {/* Deletar */}
                    <button
                      onClick={() => handleDelete(link.id)}
                      className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all active:scale-95"
                      title="Remover"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Modal Criar ──────────────────────────────────────────────────────── */}
      {showCreate && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="bg-neutral-900 border border-neutral-700 rounded-t-2xl sm:rounded-xl w-full sm:max-w-lg p-5 space-y-4 max-h-[95vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-neutral-700 rounded-full mx-auto sm:hidden" />

            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-white font-bold text-base">Novo Link de Pagamento</h2>
                <p className="text-neutral-400 text-xs mt-0.5">O cliente preenche os dados no checkout do Asaas</p>
              </div>
              <button onClick={() => setShowCreate(false)} className="text-neutral-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {saveError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {saveError}
              </div>
            )}

            {/* Nome */}
            <div>
              <label className="text-neutral-400 text-xs block mb-1.5">
                Nome do Link <span className="text-red-400">*</span>
              </label>
              <Input
                placeholder="Ex: Plano Mensal Assessoria"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="bg-neutral-800 border-neutral-700 text-white"
              />
            </div>

            {/* Descrição */}
            <div>
              <label className="text-neutral-400 text-xs block mb-1.5">Descrição</label>
              <Input
                placeholder="Descreva o que está sendo cobrado..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="bg-neutral-800 border-neutral-700 text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Tipo de cobrança */}
              <div>
                <label className="text-neutral-400 text-xs block mb-1.5">
                  Tipo de Cobrança <span className="text-red-400">*</span>
                </label>
                <select
                  value={form.chargeType}
                  onChange={e => setForm(f => ({ ...f, chargeType: e.target.value as ChargeType }))}
                  className="w-full bg-neutral-800 border border-neutral-700 text-white px-3 py-2 rounded-md text-sm"
                >
                  <option value="DETACHED">Avulsa</option>
                  <option value="INSTALLMENT">Parcelada</option>
                  <option value="RECURRENT">Recorrente / Assinatura</option>
                </select>
              </div>

              {/* Forma de pagamento */}
              <div>
                <label className="text-neutral-400 text-xs block mb-1.5">Forma de Pagamento</label>
                <select
                  value={form.billingType}
                  onChange={e => setForm(f => ({ ...f, billingType: e.target.value as BillingType }))}
                  className="w-full bg-neutral-800 border border-neutral-700 text-white px-3 py-2 rounded-md text-sm"
                >
                  <option value="UNDEFINED">Qualquer forma</option>
                  <option value="BOLETO">Boleto</option>
                  <option value="CREDIT_CARD">Cartão de Crédito</option>
                  <option value="PIX">Pix</option>
                </select>
              </div>

              {/* Valor */}
              <div>
                <label className="text-neutral-400 text-xs block mb-1.5">
                  Valor (R$) <span className="text-neutral-500">— deixe em branco para livre</span>
                </label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Ex: 299.90"
                  value={form.value}
                  onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                  className="bg-neutral-800 border-neutral-700 text-white"
                />
              </div>

              {/* Data de encerramento */}
              <div>
                <label className="text-neutral-400 text-xs block mb-1.5">
                  Data de Encerramento <span className="text-neutral-500">(opcional)</span>
                </label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                  className="bg-neutral-800 border-neutral-700 text-white"
                />
              </div>

              {/* Parcelas — só para INSTALLMENT */}
              {form.chargeType === "INSTALLMENT" && (
                <div>
                  <label className="text-neutral-400 text-xs block mb-1.5">Max. de Parcelas</label>
                  <Input
                    type="number"
                    min="2"
                    max="24"
                    value={form.maxInstallmentCount}
                    onChange={e => setForm(f => ({ ...f, maxInstallmentCount: e.target.value }))}
                    className="bg-neutral-800 border-neutral-700 text-white"
                  />
                </div>
              )}

              {/* Ciclo — só para RECURRENT */}
              {form.chargeType === "RECURRENT" && (
                <div>
                  <label className="text-neutral-400 text-xs block mb-1.5">Ciclo de Cobrança</label>
                  <select
                    value={form.subscriptionCycle}
                    onChange={e => setForm(f => ({ ...f, subscriptionCycle: e.target.value as SubscriptionCycle }))}
                    className="w-full bg-neutral-800 border border-neutral-700 text-white px-3 py-2 rounded-md text-sm"
                  >
                    {Object.entries(CYCLE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Dias vencimento boleto */}
              {(form.billingType === "BOLETO" || form.billingType === "UNDEFINED") && (
                <div>
                  <label className="text-neutral-400 text-xs block mb-1.5">Dias p/ Pagar (Boleto)</label>
                  <Input
                    type="number"
                    min="1"
                    max="30"
                    value={form.dueDateLimitDays}
                    onChange={e => setForm(f => ({ ...f, dueDateLimitDays: e.target.value }))}
                    className="bg-neutral-800 border-neutral-700 text-white"
                  />
                </div>
              )}
            </div>

            {/* Toggles */}
            <div className="space-y-2 pt-1">
              <label className="flex items-center justify-between bg-neutral-800 rounded-lg px-4 py-3 cursor-pointer">
                <div>
                  <p className="text-white text-sm font-medium">Notificações ao cliente</p>
                  <p className="text-neutral-500 text-xs">Enviar emails de notificação</p>
                </div>
                <button
                  onClick={() => setForm(f => ({ ...f, notificationEnabled: !f.notificationEnabled }))}
                  className={`w-10 h-5 rounded-full transition-all relative ${form.notificationEnabled ? "bg-orange-500" : "bg-neutral-600"}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${form.notificationEnabled ? "left-5" : "left-0.5"}`} />
                </button>
              </label>
              <label className="flex items-center justify-between bg-neutral-800 rounded-lg px-4 py-3 cursor-pointer">
                <div>
                  <p className="text-white text-sm font-medium">Endereço obrigatório</p>
                  <p className="text-neutral-500 text-xs">Cliente deve preencher endereço</p>
                </div>
                <button
                  onClick={() => setForm(f => ({ ...f, isAddressRequired: !f.isAddressRequired }))}
                  className={`w-10 h-5 rounded-full transition-all relative ${form.isAddressRequired ? "bg-orange-500" : "bg-neutral-600"}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${form.isAddressRequired ? "left-5" : "left-0.5"}`} />
                </button>
              </label>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                onClick={() => setShowCreate(false)}
                variant="outline"
                className="flex-1 border-neutral-700 text-neutral-400"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={saving}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white gap-2"
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Criando...</>
                  : <><Link2 className="w-4 h-4" /> Criar Link</>
                }
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Detalhe ────────────────────────────────────────────────────── */}
      {showDetail && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowDetail(null)}
        >
          <div
            className="bg-neutral-900 border border-neutral-700 rounded-t-2xl sm:rounded-xl w-full sm:max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-neutral-700 rounded-full mx-auto sm:hidden" />

            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-white font-bold text-base">{showDetail.name}</h2>
                <p className="text-neutral-400 text-xs font-mono mt-0.5">{showDetail.id}</p>
              </div>
              <button onClick={() => setShowDetail(null)} className="text-neutral-400 hover:text-white p-1 flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2 flex-wrap">
              {chargeBadge(showDetail.chargeType)}
              {billingBadge(showDetail.billingType)}
              <Badge className={`text-xs border ${showDetail.active ? "bg-green-500/15 text-green-400 border-green-500/30" : "bg-neutral-700 text-neutral-400 border-neutral-600"}`}>
                {showDetail.active ? "Ativo" : "Inativo"}
              </Badge>
            </div>

            {showDetail.description && (
              <p className="text-neutral-300 text-sm">{showDetail.description}</p>
            )}

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Valor", value: fmtCurrency(showDetail.value) },
                { label: "Visualizações", value: showDetail.viewCount.toString() },
                { label: "Tipo", value: CHARGE_TYPE_LABELS[showDetail.chargeType] },
                { label: "Pagamento", value: BILLING_TYPE_LABELS[showDetail.billingType] },
                ...(showDetail.chargeType === "RECURRENT" && showDetail.subscriptionCycle
                  ? [{ label: "Ciclo", value: CYCLE_LABELS[showDetail.subscriptionCycle] }]
                  : []),
                ...(showDetail.chargeType === "INSTALLMENT" && showDetail.maxInstallmentCount
                  ? [{ label: "Max. Parcelas", value: `${showDetail.maxInstallmentCount}x` }]
                  : []),
                ...(showDetail.endDate ? [{ label: "Encerramento", value: fmtDate(showDetail.endDate) }] : []),
                { label: "Notificações", value: showDetail.notificationEnabled ? "Sim" : "Não" },
              ].map(item => (
                <div key={item.label} className="bg-neutral-800 rounded-lg p-3">
                  <p className="text-neutral-500 text-xs">{item.label}</p>
                  <p className="text-white text-sm font-medium mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>

            {/* URL do link */}
            <div className="bg-neutral-800 rounded-lg p-3">
              <p className="text-neutral-500 text-xs mb-2">URL do Link</p>
              <div className="flex items-center gap-2">
                <a
                  href={showDetail.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-400 text-xs font-mono truncate flex-1 hover:underline"
                >
                  {showDetail.url}
                </a>
                <button
                  onClick={() => handleCopy(showDetail)}
                  className="p-1.5 rounded bg-neutral-700 hover:bg-neutral-600 text-neutral-300 flex-shrink-0"
                >
                  {copiedId === showDetail.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => handleToggle(showDetail)}
                variant="outline"
                className={`flex-1 border ${showDetail.active ? "border-neutral-700 text-neutral-400" : "border-green-700 text-green-400"}`}
              >
                {showDetail.active ? "Desativar Link" : "Ativar Link"}
              </Button>
              <Button
                onClick={() => handleDelete(showDetail.id)}
                className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30"
              >
                Remover
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
