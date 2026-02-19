'use client'

import { CardContent } from "@/components/ui/card"
import { CardTitle } from "@/components/ui/card"
import { CardHeader } from "@/components/ui/card"
import { Card } from "@/components/ui/card"
import React from "react"
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertCircle, Loader2 } from 'lucide-react'
import type { CNPJData, Partner } from '@/lib/services/partners'

interface PartnerFormProps {
  initialData?: Partner
  cnpjData?: CNPJData
  onSubmit: (partner: Partial<Partner>) => Promise<void>
  isLoading?: boolean
  isEditMode?: boolean
  onCancel?: () => void
}

export function PartnerForm({ initialData, cnpjData, onSubmit, isLoading = false, isEditMode = false, onCancel }: PartnerFormProps) {
  const [formData, setFormData] = useState({
    cnpj: initialData?.cnpj || '',
    company_name: initialData?.company_name || '',
    company_legal_name: initialData?.company_legal_name || '',
    company_email: initialData?.company_email || '',
    company_phone: initialData?.company_phone || '',
    company_address: initialData?.company_address || '',
    company_city: initialData?.company_city || '',
    company_state: initialData?.company_state || '',
    responsible_name: initialData?.responsible_name || '',
    responsible_cpf: initialData?.responsible_cpf || '',
    responsible_email: initialData?.responsible_email || '',
    responsible_phone: initialData?.responsible_phone || '',
    benefit: initialData?.benefit || '',
    benefit_type: (initialData?.benefit_type || 'percentage') as 'percentage' | 'fixed' | 'service' | 'other',
    notes: initialData?.notes || '',
    status: (initialData?.status || 'active') as 'active' | 'inactive' | 'pending' | 'negotiating'
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (cnpjData && !isEditMode) {
      setFormData(prev => ({
        ...prev,
        cnpj: cnpjData.cnpj,
        company_name: cnpjData.name,
        company_legal_name: cnpjData.legal_name,
        company_email: cnpjData.email || '',
        company_phone: cnpjData.phone || '',
        company_address: cnpjData.address?.street ? `${cnpjData.address.street}, ${cnpjData.address.number}` : '',
        company_city: cnpjData.address?.city || '',
        company_state: cnpjData.address?.state || ''
      }))
      setErrors({})
    }
  }, [cnpjData, isEditMode])

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11)
    if (numbers.length <= 3) return numbers
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`
  }

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11)
    if (numbers.length <= 2) return numbers
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.cnpj) newErrors.cnpj = 'CNPJ e obrigatorio'
    if (!formData.company_name) newErrors.company_name = 'Nome da empresa e obrigatorio'
    if (!formData.responsible_name) newErrors.responsible_name = 'Nome do responsavel e obrigatorio'
    if (!formData.responsible_cpf) newErrors.responsible_cpf = 'CPF do responsavel e obrigatorio'
    if (!formData.responsible_email) newErrors.responsible_email = 'Email do responsavel e obrigatorio'
    if (!formData.responsible_phone) newErrors.responsible_phone = 'Telefone do responsavel e obrigatorio'
    if (!formData.benefit) newErrors.benefit = 'Beneficio e obrigatorio'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    try {
      setIsSubmitting(true)
      await onSubmit(formData)
    } catch (error) {
      console.error('[v0] Form submission error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Company Info Section */}
      <Card className="bg-neutral-900 border-neutral-700">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
            DADOS DA EMPRESA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">
                CNPJ *
              </label>
              <Input
                readOnly={!isEditMode}
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                className={`text-sm rounded-lg ${!isEditMode ? 'bg-neutral-800/50 border-neutral-600 text-neutral-400 cursor-not-allowed' : 'bg-neutral-800 border-neutral-600 text-white'}`}
              />
              {errors.cnpj && <p className="text-xs text-red-400 mt-1">{errors.cnpj}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">
                Nome da Empresa *
              </label>
              <Input
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                className="bg-neutral-800 border-neutral-600 text-white text-sm rounded-lg"
              />
              {errors.company_name && <p className="text-xs text-red-400 mt-1">{errors.company_name}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">
              Razão Social
            </label>
            <Input
              value={formData.company_legal_name}
              onChange={(e) => setFormData({ ...formData, company_legal_name: e.target.value })}
              className="bg-neutral-800 border-neutral-600 text-white text-sm rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">
                Email
              </label>
              <Input
                type="email"
                value={formData.company_email}
                onChange={(e) => setFormData({ ...formData, company_email: e.target.value })}
                className="bg-neutral-800 border-neutral-600 text-white text-sm rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">
                Telefone
              </label>
              <Input
                value={formData.company_phone}
                onChange={(e) => setFormData({ ...formData, company_phone: formatPhone(e.target.value) })}
                className="bg-neutral-800 border-neutral-600 text-white text-sm rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">
              Endereço
            </label>
            <Input
              value={formData.company_address}
              onChange={(e) => setFormData({ ...formData, company_address: e.target.value })}
              className="w-full bg-neutral-800 border border-neutral-600 text-white text-sm rounded-lg p-2 placeholder-neutral-400"
              placeholder="Rua, número"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">
                Cidade
              </label>
              <Input
                value={formData.company_city}
                onChange={(e) => setFormData({ ...formData, company_city: e.target.value })}
                className="bg-neutral-800 border-neutral-600 text-white text-sm rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">
                UF
              </label>
              <Input
                maxLength={2}
                value={formData.company_state}
                onChange={(e) => setFormData({ ...formData, company_state: e.target.value.toUpperCase() })}
                className="bg-neutral-800 border-neutral-600 text-white text-sm rounded-lg"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Responsible Person Section */}
      <Card className="bg-neutral-900 border-neutral-700">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
            DADOS DO RESPONSÁVEL
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">
              Nome Completo *
            </label>
            <Input
              value={formData.responsible_name}
              onChange={(e) => setFormData({ ...formData, responsible_name: e.target.value })}
              className="bg-neutral-800 border-neutral-600 text-white text-sm rounded-lg"
            />
            {errors.responsible_name && <p className="text-xs text-red-400 mt-1">{errors.responsible_name}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">
                CPF *
              </label>
              <Input
                value={formData.responsible_cpf}
                onChange={(e) => setFormData({ ...formData, responsible_cpf: formatCPF(e.target.value) })}
                className="bg-neutral-800 border-neutral-600 text-white text-sm rounded-lg"
              />
              {errors.responsible_cpf && <p className="text-xs text-red-400 mt-1">{errors.responsible_cpf}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">
                Email *
              </label>
              <Input
                type="email"
                value={formData.responsible_email}
                onChange={(e) => setFormData({ ...formData, responsible_email: e.target.value })}
                className="bg-neutral-800 border-neutral-600 text-white text-sm rounded-lg"
              />
              {errors.responsible_email && <p className="text-xs text-red-400 mt-1">{errors.responsible_email}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">
              Telefone / WhatsApp *
            </label>
            <Input
              value={formData.responsible_phone}
              onChange={(e) => setFormData({ ...formData, responsible_phone: formatPhone(e.target.value) })}
              className="bg-neutral-800 border-neutral-600 text-white text-sm rounded-lg"
            />
            {errors.responsible_phone && <p className="text-xs text-red-400 mt-1">{errors.responsible_phone}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">
              Observacoes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full bg-neutral-800 border border-neutral-600 text-white text-sm rounded-lg p-2 placeholder-neutral-400"
              placeholder="Notas adicionais sobre o parceiro..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Status Section */}
      <Card className="bg-neutral-900 border-neutral-700">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
            STATUS DA PARCERIA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">
              Status *
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' | 'pending' | 'negotiating' })}
              className="w-full bg-neutral-800 border border-neutral-600 text-white text-sm rounded-lg p-2.5 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="active">Ativo</option>
              <option value="pending">Pendente</option>
              <option value="negotiating">Em negociacao</option>
              <option value="inactive">Inativo</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Benefit Section */}
      <Card className="bg-neutral-900 border-neutral-700">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
            BENEFICIO DA PARCERIA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">
              Tipo de Beneficio *
            </label>
            <select
              value={formData.benefit_type}
              onChange={(e) => setFormData({ ...formData, benefit_type: e.target.value as 'percentage' | 'fixed' | 'service' | 'other' })}
              className="w-full bg-neutral-800 border border-neutral-600 text-white text-sm rounded-lg p-2.5 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="percentage">Desconto em Porcentagem (%)</option>
              <option value="fixed">Valor Fixo (R$)</option>
              <option value="service">Servico/Produto Gratuito</option>
              <option value="other">Outro</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">
              Descricao do Beneficio *
            </label>
            <textarea
              value={formData.benefit}
              onChange={(e) => setFormData({ ...formData, benefit: e.target.value })}
              rows={3}
              className="w-full bg-neutral-800 border border-neutral-600 text-white text-sm rounded-lg p-2 placeholder-neutral-400"
              placeholder={
                formData.benefit_type === 'percentage' 
                  ? 'Ex: 15% de desconto em todos os produtos...'
                  : formData.benefit_type === 'fixed'
                  ? 'Ex: R$ 50,00 de desconto na primeira compra...'
                  : formData.benefit_type === 'service'
                  ? 'Ex: 1 mes gratis de assinatura...'
                  : 'Descreva o beneficio oferecido...'
              }
            />
            {errors.benefit && <p className="text-xs text-red-400 mt-1">{errors.benefit}</p>}
          </div>

          <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
            <p className="text-xs text-orange-300">
              O beneficio cadastrado sera exibido para os membros Somma ao consultar esta parceria.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Status Section - Only in edit mode */}
      {isEditMode && (
        <Card className="bg-neutral-900 border-neutral-700">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
              STATUS DA PARCERIA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' | 'pending' | 'negotiating' })}
                className="w-full bg-neutral-800 border border-neutral-600 text-white text-sm rounded-lg p-2.5 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="active">Ativo</option>
                <option value="pending">Pendente</option>
                <option value="negotiating">Em negociacao</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-6 border-t border-neutral-700">
        <Button
          type="button"
          onClick={onCancel}
          variant="outline"
          className="bg-transparent hover:bg-neutral-800 border-neutral-600 text-neutral-300 flex-1"
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 rounded-lg disabled:opacity-50 flex-1"
          disabled={isSubmitting || isLoading}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {isEditMode ? 'Salvando...' : 'Cadastrando...'}
            </>
          ) : (
            isEditMode ? 'Salvar Alteracoes' : 'Cadastrar Parceiro'
          )}
        </Button>
      </div>
    </form>
  )
}
