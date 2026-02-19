"use client"

import React from "react"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertCircle, CheckCircle } from "lucide-react"
import type { CadastroSite } from "@/lib/supabase-client"

interface CreateSubscriptionModalProps {
  isOpen: boolean
  onClose: () => void
  member: CadastroSite | null
  onSubscriptionCreated: () => void
}

export function CreateSubscriptionModal({ isOpen, onClose, member, onSubscriptionCreated }: CreateSubscriptionModalProps) {
  const [formData, setFormData] = useState({
    valor: "",
    proxima_cobranca: new Date().toISOString().split("T")[0],
    ciclo: "MONTHLY",
    descricao: "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const validateForm = () => {
    if (!formData.valor) return "Valor é obrigatório"
    if (parseFloat(formData.valor) <= 0) return "Valor deve ser maior que zero"
    if (!formData.proxima_cobranca) return "Data da próxima cobrança é obrigatória"
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
      const { createSubscription } = await import('@/lib/services/asaas-api')
      
      // Criar assinatura no Asaas
      const { data: subscription, error: asaasError } = await createSubscription({
        customer: member.asaas_customer_id || '',
        value: parseFloat(formData.valor),
        nextDueDate: formData.proxima_cobranca,
        cycle: formData.ciclo,
        description: formData.descricao,
        billingType: "BOLETO",
      })

      if (asaasError || !subscription?.id) {
        throw new Error(asaasError || "Erro ao criar assinatura no Asaas")
      }

      // Salvar no Supabase para histórico
      const { supabase } = await import('@/lib/supabase-client')
      await supabase.from('assinaturas_membros').insert([{
        membro_id: member.id,
        asaas_subscription_id: subscription.id,
        valor: parseFloat(formData.valor),
        ciclo: formData.ciclo,
        descricao: formData.descricao,
        proxima_cobranca: formData.proxima_cobranca,
        status: 'ativa',
        data_criacao: new Date().toISOString(),
      }])

      setSuccess(true)
      setTimeout(() => {
        setFormData({
          valor: "",
          proxima_cobranca: new Date().toISOString().split("T")[0],
          ciclo: "MONTHLY",
          descricao: "",
        })
        setSuccess(false)
        onClose()
        onSubscriptionCreated()
      }, 2000)
    } catch (err) {
      console.error("[v0] Erro ao criar assinatura:", err)
      setError(err instanceof Error ? err.message : "Erro ao criar assinatura. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !member) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md bg-neutral-900 border-neutral-700">
        <CardHeader>
          <CardTitle className="text-white">Criar Assinatura - {member.nome_completo}</CardTitle>
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
                <p className="text-green-200 text-sm">Assinatura criada com sucesso!</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-white mb-2">Valor Mensal (R$)</label>
              <Input
                type="number"
                name="valor"
                value={formData.valor}
                onChange={handleChange}
                placeholder="150.00"
                step="0.01"
                min="0"
                className="bg-neutral-800 border-neutral-600 text-white placeholder-neutral-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Próxima Cobrança</label>
              <Input
                type="date"
                name="proxima_cobranca"
                value={formData.proxima_cobranca}
                onChange={handleChange}
                className="bg-neutral-800 border-neutral-600 text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Ciclo de Cobrança</label>
              <select
                name="ciclo"
                value={formData.ciclo}
                onChange={handleChange}
                className="w-full bg-neutral-800 border border-neutral-600 text-white rounded-lg px-3 py-2"
              >
                <option value="WEEKLY">Semanal</option>
                <option value="BIWEEKLY">Bi-semanal</option>
                <option value="MONTHLY">Mensal</option>
                <option value="QUARTERLY">Trimestral</option>
                <option value="SEMI_ANNUAL">Semestral</option>
                <option value="ANNUAL">Anual</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Descrição</label>
              <textarea
                name="descricao"
                value={formData.descricao}
                onChange={handleChange}
                placeholder="ex: Mensalidade - Programa Premium"
                rows={3}
                className="w-full bg-neutral-800 border border-neutral-600 text-white placeholder-neutral-500 rounded-lg px-3 py-2"
              />
            </div>

            <div className="p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg">
              <p className="text-blue-200 text-xs">
                A assinatura será cobrada automaticamente no Asaas conforme o ciclo definido.
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="submit"
                disabled={loading || success}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                {loading ? "Criando..." : "Criar Assinatura"}
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
