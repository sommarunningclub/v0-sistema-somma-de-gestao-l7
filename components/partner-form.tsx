'use client'

import * as React from 'react'
import { useEffect, useId, useMemo, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SectionTitle, Well } from '@/components/somma'
import { useIsMobile } from '@/components/ui/use-mobile'
import { cn } from '@/lib/utils'
import type { CNPJData, Partner } from '@/lib/services/partners'
import { PARTNER_BENEFIT_LABEL, PARTNER_STATUS_LABEL } from '@/components/partner-utils'

interface PartnerFormProps {
  initialData?: Partner
  cnpjData?: CNPJData
  onSubmit: (partner: Partial<Partner>) => Promise<void>
  isLoading?: boolean
  isEditMode?: boolean
  onCancel?: () => void
  /** Avisa o container quando há alterações não salvas. */
  onDirtyChange?: (dirty: boolean) => void
}

type FormState = {
  cnpj: string
  company_name: string
  company_legal_name: string
  company_email: string
  company_phone: string
  company_address: string
  company_city: string
  company_state: string
  responsible_name: string
  responsible_cpf: string
  responsible_email: string
  responsible_phone: string
  benefit: string
  benefit_type: 'percentage' | 'fixed' | 'service' | 'other'
  notes: string
  status: 'active' | 'inactive' | 'pending' | 'negotiating'
}

type FieldName = keyof FormState
type StepId = 'company' | 'contact' | 'benefit' | 'settings'

const STEPS: Array<{ id: StepId; label: string; description: string }> = [
  { id: 'company', label: 'Dados da empresa', description: 'Identificação e endereço' },
  { id: 'contact', label: 'Contato', description: 'Responsável pela parceria' },
  { id: 'benefit', label: 'Benefício', description: 'O que o membro Somma ganha' },
  { id: 'settings', label: 'Configurações', description: 'Status e observações' },
]

const FIELD_STEP: Partial<Record<FieldName, StepId>> = {
  cnpj: 'company',
  company_name: 'company',
  responsible_name: 'contact',
  responsible_cpf: 'contact',
  responsible_email: 'contact',
  responsible_phone: 'contact',
  benefit: 'benefit',
}

const inputBase = 'text-sm'
const selectClass =
  'flex h-11 w-full rounded-lg border border-line bg-surface-sunken px-3.5 text-base text-ink transition-colors hover:border-line-strong focus-visible:border-brand focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand lg:h-10 lg:text-sm'
const textareaClass =
  'w-full rounded-lg border border-line bg-surface-sunken px-3.5 py-2.5 text-base text-ink transition-colors placeholder:text-ink-subtle hover:border-line-strong focus-visible:border-brand focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand aria-[invalid=true]:border-danger lg:text-sm'

export function PartnerForm({
  initialData,
  cnpjData,
  onSubmit,
  isLoading = false,
  isEditMode = false,
  onCancel,
  onDirtyChange,
}: PartnerFormProps) {
  const uid = useId()
  const isMobile = useIsMobile()

  const [formData, setFormData] = useState<FormState>({
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
    benefit_type: (initialData?.benefit_type || 'percentage') as FormState['benefit_type'],
    notes: initialData?.notes || '',
    status: (initialData?.status || 'active') as FormState['status'],
  })

  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [dirty, setDirty] = useState(false)

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
      setDirty(true)
    }
  }, [cnpjData, isEditMode])

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  const setField = <K extends FieldName>(field: K, value: FormState[K]) => {
    setDirty(true)
    setFormData(prev => ({ ...prev, [field]: value }))
    setErrors(prev => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

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
    const newErrors: Partial<Record<FieldName, string>> = {}

    if (!formData.cnpj) newErrors.cnpj = 'CNPJ é obrigatório'
    if (!formData.company_name) newErrors.company_name = 'Nome da empresa é obrigatório'
    if (!formData.responsible_name) newErrors.responsible_name = 'Nome do responsável é obrigatório'
    if (!formData.responsible_cpf) newErrors.responsible_cpf = 'CPF do responsável é obrigatório'
    if (!formData.responsible_email) newErrors.responsible_email = 'E-mail do responsável é obrigatório'
    if (!formData.responsible_phone) newErrors.responsible_phone = 'Telefone do responsável é obrigatório'
    if (!formData.benefit) newErrors.benefit = 'Benefício é obrigatório'

    setErrors(newErrors)
    return newErrors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const newErrors = validateForm()
    if (Object.keys(newErrors).length > 0) {
      const firstField = Object.keys(newErrors)[0] as FieldName
      const targetStep = FIELD_STEP[firstField]
      if (targetStep) {
        const index = STEPS.findIndex(step => step.id === targetStep)
        if (index >= 0) setStepIndex(index)
      }
      if (typeof document !== 'undefined') {
        window.requestAnimationFrame(() => {
          document.getElementById(`${uid}-${firstField}`)?.focus()
        })
      }
      return
    }

    try {
      setIsSubmitting(true)
      await onSubmit(formData)
      setDirty(false)
    } catch (error) {
      console.error('[v0] Form submission error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const errorCountByStep = useMemo(() => {
    const counts: Record<StepId, number> = { company: 0, contact: 0, benefit: 0, settings: 0 }
    ;(Object.keys(errors) as FieldName[]).forEach(field => {
      const step = FIELD_STEP[field]
      if (step) counts[step] += 1
    })
    return counts
  }, [errors])

  const fieldProps = (field: FieldName) => ({
    id: `${uid}-${field}`,
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? `${uid}-${field}-error` : undefined,
  })

  const FieldError = ({ field }: { field: FieldName }) =>
    errors[field] ? (
      <p
        id={`${uid}-${field}-error`}
        className="mt-1.5 flex items-center gap-1.5 text-meta text-danger"
      >
        <AlertCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        {errors[field]}
      </p>
    ) : null

  const labelClass = 'mb-1.5 block text-meta font-medium text-ink-muted'

  const stepVisible = (id: StepId) => !isMobile || STEPS[stepIndex].id === id

  const sections: Record<StepId, React.ReactNode> = {
    company: (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${uid}-cnpj`} className={labelClass}>
              CNPJ <span className="text-danger">*</span>
            </label>
            <Input
              {...fieldProps('cnpj')}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              readOnly={!isEditMode}
              value={formData.cnpj}
              onChange={(e) => setField('cnpj', e.target.value)}
              className={cn(inputBase, 'font-mono', !isEditMode && 'cursor-not-allowed opacity-70')}
            />
            <FieldError field="cnpj" />
          </div>
          <div>
            <label htmlFor={`${uid}-company_name`} className={labelClass}>
              Nome da empresa <span className="text-danger">*</span>
            </label>
            <Input
              {...fieldProps('company_name')}
              type="text"
              autoComplete="organization"
              value={formData.company_name}
              onChange={(e) => setField('company_name', e.target.value)}
              className={inputBase}
            />
            <FieldError field="company_name" />
          </div>
        </div>

        <div>
          <label htmlFor={`${uid}-company_legal_name`} className={labelClass}>
            Razão social
          </label>
          <Input
            {...fieldProps('company_legal_name')}
            type="text"
            autoComplete="organization"
            value={formData.company_legal_name}
            onChange={(e) => setField('company_legal_name', e.target.value)}
            className={inputBase}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${uid}-company_email`} className={labelClass}>
              E-mail da empresa
            </label>
            <Input
              {...fieldProps('company_email')}
              type="email"
              inputMode="email"
              autoComplete="email"
              value={formData.company_email}
              onChange={(e) => setField('company_email', e.target.value)}
              className={inputBase}
            />
          </div>
          <div>
            <label htmlFor={`${uid}-company_phone`} className={labelClass}>
              Telefone da empresa
            </label>
            <Input
              {...fieldProps('company_phone')}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(00) 00000-0000"
              value={formData.company_phone}
              onChange={(e) => setField('company_phone', formatPhone(e.target.value))}
              className={inputBase}
            />
          </div>
        </div>

        <div>
          <label htmlFor={`${uid}-company_address`} className={labelClass}>
            Endereço
          </label>
          <Input
            {...fieldProps('company_address')}
            type="text"
            autoComplete="street-address"
            placeholder="Rua, número"
            value={formData.company_address}
            onChange={(e) => setField('company_address', e.target.value)}
            className={inputBase}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_8rem]">
          <div>
            <label htmlFor={`${uid}-company_city`} className={labelClass}>
              Cidade
            </label>
            <Input
              {...fieldProps('company_city')}
              type="text"
              autoComplete="address-level2"
              value={formData.company_city}
              onChange={(e) => setField('company_city', e.target.value)}
              className={inputBase}
            />
          </div>
          <div>
            <label htmlFor={`${uid}-company_state`} className={labelClass}>
              UF
            </label>
            <Input
              {...fieldProps('company_state')}
              type="text"
              autoComplete="address-level1"
              maxLength={2}
              value={formData.company_state}
              onChange={(e) => setField('company_state', e.target.value.toUpperCase())}
              className={cn(inputBase, 'uppercase')}
            />
          </div>
        </div>
      </div>
    ),
    contact: (
      <div className="space-y-4">
        <div>
          <label htmlFor={`${uid}-responsible_name`} className={labelClass}>
            Nome completo <span className="text-danger">*</span>
          </label>
          <Input
            {...fieldProps('responsible_name')}
            type="text"
            autoComplete="name"
            value={formData.responsible_name}
            onChange={(e) => setField('responsible_name', e.target.value)}
            className={inputBase}
          />
          <FieldError field="responsible_name" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${uid}-responsible_cpf`} className={labelClass}>
              CPF <span className="text-danger">*</span>
            </label>
            <Input
              {...fieldProps('responsible_cpf')}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
              value={formData.responsible_cpf}
              onChange={(e) => setField('responsible_cpf', formatCPF(e.target.value))}
              className={cn(inputBase, 'font-mono')}
            />
            <FieldError field="responsible_cpf" />
          </div>
          <div>
            <label htmlFor={`${uid}-responsible_email`} className={labelClass}>
              E-mail <span className="text-danger">*</span>
            </label>
            <Input
              {...fieldProps('responsible_email')}
              type="email"
              inputMode="email"
              autoComplete="email"
              value={formData.responsible_email}
              onChange={(e) => setField('responsible_email', e.target.value)}
              className={inputBase}
            />
            <FieldError field="responsible_email" />
          </div>
        </div>

        <div>
          <label htmlFor={`${uid}-responsible_phone`} className={labelClass}>
            Telefone / WhatsApp <span className="text-danger">*</span>
          </label>
          <Input
            {...fieldProps('responsible_phone')}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(00) 00000-0000"
            value={formData.responsible_phone}
            onChange={(e) => setField('responsible_phone', formatPhone(e.target.value))}
            className={inputBase}
          />
          <FieldError field="responsible_phone" />
        </div>
      </div>
    ),
    benefit: (
      <div className="space-y-4">
        <div>
          <label htmlFor={`${uid}-benefit_type`} className={labelClass}>
            Tipo de benefício <span className="text-danger">*</span>
          </label>
          <select
            {...fieldProps('benefit_type')}
            value={formData.benefit_type}
            onChange={(e) => setField('benefit_type', e.target.value as FormState['benefit_type'])}
            className={selectClass}
          >
            <option value="percentage">Desconto em porcentagem (%)</option>
            <option value="fixed">Valor fixo (R$)</option>
            <option value="service">Serviço/produto gratuito</option>
            <option value="other">Outro</option>
          </select>
        </div>

        <div>
          <label htmlFor={`${uid}-benefit`} className={labelClass}>
            Descrição do benefício <span className="text-danger">*</span>
          </label>
          <textarea
            {...fieldProps('benefit')}
            value={formData.benefit}
            onChange={(e) => setField('benefit', e.target.value)}
            rows={3}
            className={textareaClass}
            placeholder={
              formData.benefit_type === 'percentage'
                ? 'Ex.: 15% de desconto em todos os produtos...'
                : formData.benefit_type === 'fixed'
                ? 'Ex.: R$ 50,00 de desconto na primeira compra...'
                : formData.benefit_type === 'service'
                ? 'Ex.: 1 mês grátis de assinatura...'
                : 'Descreva o benefício oferecido...'
            }
          />
          <FieldError field="benefit" />
        </div>

        <Well className="border-brand-border bg-brand-soft p-3">
          <p className="text-meta text-brand-strong">
            O benefício cadastrado será exibido para os membros Somma ao consultar esta parceria
            como <strong>{PARTNER_BENEFIT_LABEL[formData.benefit_type]}</strong>.
          </p>
        </Well>
      </div>
    ),
    settings: (
      <div className="space-y-4">
        <div>
          <label htmlFor={`${uid}-status`} className={labelClass}>
            Status da parceria <span className="text-danger">*</span>
          </label>
          <select
            {...fieldProps('status')}
            value={formData.status}
            onChange={(e) => setField('status', e.target.value as FormState['status'])}
            className={selectClass}
          >
            <option value="active">{PARTNER_STATUS_LABEL.active}</option>
            <option value="pending">{PARTNER_STATUS_LABEL.pending}</option>
            <option value="negotiating">{PARTNER_STATUS_LABEL.negotiating}</option>
            <option value="inactive">{PARTNER_STATUS_LABEL.inactive}</option>
          </select>
        </div>

        <div>
          <label htmlFor={`${uid}-notes`} className={labelClass}>
            Observações
          </label>
          <textarea
            {...fieldProps('notes')}
            value={formData.notes}
            onChange={(e) => setField('notes', e.target.value)}
            rows={3}
            className={textareaClass}
            placeholder="Notas adicionais sobre o parceiro..."
          />
        </div>
      </div>
    ),
  }

  const isLastStep = stepIndex === STEPS.length - 1
  const busy = isSubmitting || isLoading

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {isMobile ? (
        <nav aria-label="Etapas do cadastro" className="space-y-2">
          <div className="flex items-center justify-between text-meta text-ink-muted">
            <span>
              Etapa <span className="font-mono tabular-nums text-ink">{stepIndex + 1}</span> de{' '}
              <span className="font-mono tabular-nums text-ink">{STEPS.length}</span>
            </span>
            <span className="font-medium text-ink-strong">{STEPS[stepIndex].label}</span>
          </div>
          <ol className="flex gap-1.5" role="list">
            {STEPS.map((step, index) => {
              const state =
                index === stepIndex ? 'atual' : index < stepIndex ? 'concluída' : 'pendente'
              return (
                <li key={step.id} className="flex-1">
                  <button
                    type="button"
                    onClick={() => setStepIndex(index)}
                    aria-current={index === stepIndex ? 'step' : undefined}
                    className={cn(
                      'h-1.5 w-full rounded-full transition-colors',
                      errorCountByStep[step.id] > 0
                        ? 'bg-danger'
                        : index <= stepIndex
                        ? 'bg-brand'
                        : 'bg-line-strong',
                    )}
                  >
                    <span className="sr-only">
                      {step.label} — {state}
                      {errorCountByStep[step.id] > 0 ? ' (com erros)' : ''}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>
      ) : null}

      {STEPS.map((step) =>
        stepVisible(step.id) ? (
          <section key={step.id} aria-label={step.label}>
            <SectionTitle as="h3" title={step.label} meta={step.description} />
            {sections[step.id]}
          </section>
        ) : null,
      )}

      {isMobile ? (
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              block
              onClick={() => (stepIndex === 0 ? onCancel?.() : setStepIndex(stepIndex - 1))}
              disabled={busy}
            >
              {stepIndex === 0 ? 'Cancelar' : 'Voltar'}
            </Button>
            {isLastStep ? (
              <Button type="submit" block loading={busy}>
                {isEditMode ? 'Salvar alterações' : 'Cadastrar parceiro'}
              </Button>
            ) : (
              <Button type="button" block onClick={() => setStepIndex(stepIndex + 1)}>
                Continuar
              </Button>
            )}
          </div>
          {!isLastStep ? (
            <Button type="submit" variant="ghost" block loading={busy}>
              {isEditMode ? 'Salvar agora' : 'Cadastrar agora'}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" loading={busy}>
            {isEditMode ? 'Salvar alterações' : 'Cadastrar parceiro'}
          </Button>
        </div>
      )}
    </form>
  )
}
