"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, MoreHorizontal, X, Percent, DollarSign, Edit, Trash2 } from "lucide-react"
import { getCouponsFromDB, saveCouponToDB, updateCouponInDB } from "@/lib/services/payments"
import type { AsaasCoupon, CouponCreatePayload } from "@/lib/types/asaas"
import { supabase } from "@/lib/supabase-client"

export default function Cupons() {
  const [coupons, setCoupons] = useState<AsaasCoupon[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState<AsaasCoupon | null>(null)
  const [formData, setFormData] = useState<CouponCreatePayload>({
    code: "",
    type: "PERCENTAGE",
    value: 0,
    expiration_date: "",
    usage_limit: undefined,
  })
  const [saving, setSaving] = useState(false)

  const fetchCoupons = async () => {
    setLoading(true)
    try {
      // Buscar cupons do banco local
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) {
        console.error("[v0] Error fetching coupons:", error)
      } else {
        setCoupons((data || []) as AsaasCoupon[])
      }
    } catch (err) {
      console.error("[v0] Unexpected error fetching coupons:", err)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchCoupons()
  }, [])

  const filteredCoupons = coupons.filter(
    (coupon) =>
      coupon.code?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-500/20 text-green-400"
      case "EXPIRED":
        return "bg-red-500/20 text-red-400"
      case "DISABLED":
        return "bg-neutral-500/20 text-neutral-400"
      default:
        return "bg-neutral-500/20 text-neutral-400"
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      ACTIVE: "Ativo",
      EXPIRED: "Expirado",
      DISABLED: "Desativado",
    }
    return labels[status] || status
  }

  const formatValue = (coupon: AsaasCoupon) => {
    if (coupon.type === "PERCENTAGE") {
      return `${coupon.value}%`
    }
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(coupon.value)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Sem limite"
    return new Date(dateString).toLocaleDateString("pt-BR")
  }

  const handleSaveCoupon = async () => {
    setSaving(true)
    try {
      const couponData = {
        code: formData.code.toUpperCase(),
        type: formData.type,
        value: formData.value,
        expiration_date: formData.expiration_date || null,
        usage_limit: formData.usage_limit || null,
        usage_count: 0,
        status: "ACTIVE",
      }

      if (editingCoupon) {
        // Atualizar cupom existente
        const { error } = await supabase
          .from("coupons")
          .update(couponData)
          .eq("id", editingCoupon.id)

        if (error) {
          throw error
        }
      } else {
        // Criar novo cupom
        const { error } = await supabase.from("coupons").insert([couponData])

        if (error) {
          throw error
        }
      }

      setShowModal(false)
      setEditingCoupon(null)
      setFormData({
        code: "",
        type: "PERCENTAGE",
        value: 0,
        expiration_date: "",
        usage_limit: undefined,
      })
      fetchCoupons()
    } catch (err) {
      console.error("[v0] Error saving coupon:", err)
      alert("Erro ao salvar cupom")
    }
    setSaving(false)
  }

  const handleDeleteCoupon = async (couponId: string) => {
    if (!confirm("Tem certeza que deseja excluir este cupom?")) return

    try {
      const { error } = await supabase.from("coupons").delete().eq("id", couponId)

      if (error) {
        throw error
      }

      fetchCoupons()
    } catch (err) {
      console.error("[v0] Error deleting coupon:", err)
      alert("Erro ao excluir cupom")
    }
  }

  const handleToggleStatus = async (coupon: AsaasCoupon) => {
    try {
      const newStatus = coupon.status === "ACTIVE" ? "DISABLED" : "ACTIVE"
      const { error } = await supabase
        .from("coupons")
        .update({ status: newStatus })
        .eq("id", coupon.id)

      if (error) {
        throw error
      }

      fetchCoupons()
    } catch (err) {
      console.error("[v0] Error toggling coupon status:", err)
      alert("Erro ao alterar status do cupom")
    }
  }

  const openEditModal = (coupon: AsaasCoupon) => {
    setEditingCoupon(coupon)
    setFormData({
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      expiration_date: coupon.expiration_date || "",
      usage_limit: coupon.usage_limit || undefined,
    })
    setShowModal(true)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wider">CUPONS</h1>
          <p className="text-sm text-neutral-400">Gerenciar cupons de desconto</p>
        </div>
        <Button
          onClick={() => {
            setEditingCoupon(null)
            setFormData({
              code: "",
              type: "PERCENTAGE",
              value: 0,
              expiration_date: "",
              usage_limit: undefined,
            })
            setShowModal(true)
          }}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Cupom
        </Button>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <Input
          placeholder="Buscar por código do cupom..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-neutral-800 border-neutral-600 text-white placeholder-neutral-400"
        />
      </div>

      {/* Tabela */}
      <Card className="bg-neutral-900 border-neutral-700">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
            LISTA DE CUPONS ({filteredCoupons.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-neutral-400">Carregando cupons...</p>
            </div>
          ) : filteredCoupons.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-neutral-400">Nenhum cupom encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-700">
                    <th className="text-left py-3 px-4 text-xs font-medium text-neutral-400 tracking-wider">
                      CÓDIGO
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-neutral-400 tracking-wider">
                      TIPO
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-neutral-400 tracking-wider">
                      VALOR
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-neutral-400 tracking-wider">
                      EXPIRAÇÃO
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-neutral-400 tracking-wider">
                      USO
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
                  {filteredCoupons.map((coupon, index) => (
                    <tr
                      key={coupon.id}
                      className={`border-b border-neutral-800 hover:bg-neutral-800 transition-colors ${
                        index % 2 === 0 ? "bg-neutral-900" : "bg-neutral-850"
                      }`}
                    >
                      <td className="py-3 px-4 text-sm text-white font-mono font-bold">{coupon.code}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 text-neutral-300">
                          {coupon.type === "PERCENTAGE" ? (
                            <Percent className="w-4 h-4" />
                          ) : (
                            <DollarSign className="w-4 h-4" />
                          )}
                          <span className="text-xs">{coupon.type === "PERCENTAGE" ? "Percentual" : "Fixo"}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-white font-mono">{formatValue(coupon)}</td>
                      <td className="py-3 px-4 text-sm text-neutral-300">{formatDate(coupon.expiration_date)}</td>
                      <td className="py-3 px-4 text-sm text-neutral-300">
                        {coupon.usage_count} / {coupon.usage_limit || "∞"}
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={getStatusColor(coupon.status)}>{getStatusLabel(coupon.status)}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-neutral-400 hover:text-orange-500"
                            onClick={() => openEditModal(coupon)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-neutral-400 hover:text-orange-500"
                            onClick={() => handleToggleStatus(coupon)}
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-neutral-400 hover:text-red-500"
                            onClick={() => handleDeleteCoupon(coupon.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
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

      {/* Modal Criar/Editar Cupom */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="bg-neutral-900 border-neutral-700 w-full max-w-lg">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-bold text-white tracking-wider">
                {editingCoupon ? "EDITAR CUPOM" : "NOVO CUPOM"}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowModal(false)
                  setEditingCoupon(null)
                }}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-neutral-400 tracking-wider mb-1 block">CÓDIGO DO CUPOM *</label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="bg-neutral-800 border-neutral-600 text-white font-mono"
                  placeholder="EX: DESCONTO10"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 tracking-wider mb-1 block">TIPO DE DESCONTO *</label>
                <div className="flex gap-2">
                  <Button
                    variant={formData.type === "PERCENTAGE" ? "default" : "outline"}
                    onClick={() => setFormData({ ...formData, type: "PERCENTAGE" })}
                    className={
                      formData.type === "PERCENTAGE"
                        ? "bg-orange-500 hover:bg-orange-600 text-white flex-1"
                        : "border-neutral-700 text-neutral-400 flex-1 bg-transparent"
                    }
                  >
                    <Percent className="w-4 h-4 mr-2" />
                    Percentual
                  </Button>
                  <Button
                    variant={formData.type === "FIXED" ? "default" : "outline"}
                    onClick={() => setFormData({ ...formData, type: "FIXED" })}
                    className={
                      formData.type === "FIXED"
                        ? "bg-orange-500 hover:bg-orange-600 text-white flex-1"
                        : "border-neutral-700 text-neutral-400 flex-1 bg-transparent"
                    }
                  >
                    <DollarSign className="w-4 h-4 mr-2" />
                    Valor Fixo
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-neutral-400 tracking-wider mb-1 block">
                    VALOR {formData.type === "PERCENTAGE" ? "(%)" : "(R$)"} *
                  </label>
                  <Input
                    type="number"
                    step={formData.type === "PERCENTAGE" ? "1" : "0.01"}
                    value={formData.value || ""}
                    onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                    className="bg-neutral-800 border-neutral-600 text-white"
                    placeholder={formData.type === "PERCENTAGE" ? "10" : "50.00"}
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 tracking-wider mb-1 block">LIMITE DE USO</label>
                  <Input
                    type="number"
                    value={formData.usage_limit || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, usage_limit: parseInt(e.target.value) || undefined })
                    }
                    className="bg-neutral-800 border-neutral-600 text-white"
                    placeholder="Ilimitado"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-neutral-400 tracking-wider mb-1 block">DATA DE EXPIRAÇÃO</label>
                <Input
                  type="date"
                  value={formData.expiration_date || ""}
                  onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                  className="bg-neutral-800 border-neutral-600 text-white"
                />
              </div>

              <div className="flex gap-2 pt-4 border-t border-neutral-700">
                <Button
                  onClick={handleSaveCoupon}
                  disabled={saving || !formData.code || !formData.value}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {saving ? "Salvando..." : editingCoupon ? "Salvar Alterações" : "Criar Cupom"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowModal(false)
                    setEditingCoupon(null)
                  }}
                  className="border-neutral-700 text-neutral-400 hover:bg-neutral-800 bg-transparent"
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
