"use client"

import React from "react"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase-client"
import { AlertCircle, CheckCircle } from "lucide-react"
import type { CadastroSite } from "@/lib/supabase-client"

interface CreateChargeModalProps {
  isOpen: boolean
  onClose: () => void
  member: CadastroSite | null
  onChargeCreated: () => void
}

export function CreateChargeModal({ isOpen, onClose, member, onChargeCreated }: CreateChargeModalProps) {
  const [formData, setFormData] = useState({
    valor: "",
    data_vencimento: new Date().toISOString().split("T")[0],
    descricao: "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const validateForm = () => {
    if (!formData.valor) return "Valor é obrigatório"
    if (parseFloat(formData.valor) <= 0) return "Valor deve ser maior que zero"
    if (!formData.data_vencimento) return "Data de vencimento é obrigatória"
    if (!formData.descricao.trim()) return "Descrição é obrigatória"
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    if (!member) {
      setError("Membro não selecionado")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const chargeData = {
        membro_id: member.id,
        valor: parseFloat(formData.valor),
        data_vencimento: formData.data_vencimento,
        descricao: formData.descricao,
        status: "pendente" as const,
      }

      // Chamar serviço que vincula com Asaas automaticamente
      const { createMemberCharge } = await import('@/lib/services/charges')
      
      await createMemberCharge(chargeData, {
        asaas_customer_id: undefined, // Campo não existe em cadastro_site
        nome_completo: member.nome_completo,
        email: member.email,
      })

      setSuccess(true)
      setTimeout(() => {
        setFormData({
          valor: "",
          data_vencimento: new Date().toISOString().split("T")[0],
          descricao: "",
        })
        setSuccess(false)
        onClose()
        onChargeCreated()
      }, 2000)
    } catch (err) {
      console.error("[v0] Erro ao criar cobrança:", err)
      setError("Erro ao criar cobrança. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !member) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md bg-neutral-900 border-neutral-700">
        <CardHeader>
          <CardTitle className="text-white">Criar Cobrança - {member.nome_completo}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-900/20 border border-red-700/50 rounded-lg flex items-gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-red-200 text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="p-3 bg-green-900/20 border border-green-700/50 rounded-lg flex items-gap-2">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <p className="text-green-200 text-sm">Cobrança criada com sucesso!</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-white mb-2">Valor (R$)</label>
              <Input
                type="number"
                name="valor"
                value={formData.valor}
                onChange={handleChange}
                placeholder="100.00"
                step="0.01"
                min="0"
                className="bg-neutral-800 border-neutral-600 text-white placeholder-neutral-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Data de Vencimento</label>
              <Input
                type="date"
                name="data_vencimento"
                value={formData.data_vencimento}
                onChange={handleChange}
                className="bg-neutral-800 border-neutral-600 text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Descrição</label>
              <textarea
                name="descricao"
                value={formData.descricao}
                onChange={handleChange}
                placeholder="ex: Mensalidade Janeiro"
                rows={3}
                className="w-full bg-neutral-800 border border-neutral-600 text-white placeholder-neutral-500 rounded-lg px-3 py-2"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="submit"
                disabled={loading || success}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
              >
                {loading ? "Criando..." : "Criar Cobrança"}
              </Button>
              <Button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-white"
              >
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
