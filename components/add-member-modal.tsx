"use client"

import type React from "react"
import { useId, useState } from "react"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ResponsiveModal, SectionTitle, notify } from "@/components/somma"
import { createMember } from "@/lib/services/members"

interface AddMemberModalProps {
  isOpen: boolean
  onClose: () => void
  onMemberAdded: () => void
}

const EMPTY_FORM = {
  nome_completo: "",
  email: "",
  cpf: "",
  data_nascimento: "",
  whatsapp: "",
}

export function AddMemberModal({ isOpen, onClose, onMemberAdded }: AddMemberModalProps) {
  const formId = useId()
  const errorId = useId()
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const formatCPF = (value: string) => {
    const cleaned = value.replace(/\D/g, "")
    if (cleaned.length <= 3) return cleaned
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`
    if (cleaned.length <= 9) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`
    return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9, 11)}`
  }

  const formatPhone = (value: string) => {
    const cleaned = value.replace(/\D/g, "")
    if (cleaned.length <= 2) return cleaned
    if (cleaned.length <= 7) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target

    if (name === "cpf") {
      setFormData({ ...formData, [name]: formatCPF(value) })
    } else if (name === "whatsapp") {
      setFormData({ ...formData, [name]: formatPhone(value) })
    } else {
      setFormData({ ...formData, [name]: value })
    }
  }

  const validateForm = () => {
    if (!formData.nome_completo.trim()) return "Nome é obrigatório"
    if (!formData.email.includes("@")) return "Email inválido"
    if (formData.cpf.replace(/\D/g, "").length !== 11) return "CPF deve ter 11 dígitos"
    if (!formData.data_nascimento) return "Data de nascimento é obrigatória"
    if (formData.whatsapp.replace(/\D/g, "").length < 10) return "WhatsApp inválido"
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    setError(null)

    try {
      await createMember({
        nome_completo: formData.nome_completo,
        email: formData.email,
        cpf: formData.cpf.replace(/\D/g, ""),
        data_nascimento: formData.data_nascimento,
        whatsapp: formData.whatsapp,
      })

      notify.success("Membro adicionado", {
        description: `${formData.nome_completo} já aparece na lista de membros.`,
      })
      setFormData(EMPTY_FORM)
      onMemberAdded()
      onClose()
    } catch (err) {
      const message =
        err instanceof Error ? `Erro ao adicionar membro: ${err.message}` : "Erro ao conectar com o servidor"
      setError(message)
      notify.error("Não foi possível adicionar o membro", { description: message })
      console.error("[membros] Error adding member:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ResponsiveModal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !loading) onClose()
      }}
      title="Adicionar novo membro"
      description="Os campos marcados com * são obrigatórios."
      size="lg"
      dismissible={!loading}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading} block className="sm:w-auto">
            Cancelar
          </Button>
          <Button type="submit" form={formId} loading={loading} block className="sm:w-auto">
            Adicionar membro
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-6" noValidate>
        {error ? (
          <div
            id={errorId}
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-danger-border bg-danger-soft p-3 text-sm text-danger"
          >
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <section>
          <SectionTitle title="Identificação" as="h3" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor={`${formId}-nome`} className="ds-label mb-1.5 block">
                Nome completo *
              </label>
              <Input
                id={`${formId}-nome`}
                type="text"
                name="nome_completo"
                autoComplete="name"
                value={formData.nome_completo}
                onChange={handleChange}
                placeholder="João Silva"
                required
              />
            </div>

            <div>
              <label htmlFor={`${formId}-cpf`} className="ds-label mb-1.5 block">
                CPF *
              </label>
              <Input
                id={`${formId}-cpf`}
                type="text"
                inputMode="numeric"
                name="cpf"
                value={formData.cpf}
                onChange={handleChange}
                placeholder="000.000.000-00"
                maxLength={14}
                className="font-mono tabular-nums"
                required
              />
            </div>

            <div>
              <label htmlFor={`${formId}-nascimento`} className="ds-label mb-1.5 block">
                Nascimento *
              </label>
              <Input
                id={`${formId}-nascimento`}
                type="date"
                name="data_nascimento"
                autoComplete="bday"
                value={formData.data_nascimento}
                onChange={handleChange}
                required
              />
            </div>
          </div>
        </section>

        <section>
          <SectionTitle title="Contato" as="h3" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor={`${formId}-email`} className="ds-label mb-1.5 block">
                E-mail *
              </label>
              <Input
                id={`${formId}-email`}
                type="email"
                inputMode="email"
                name="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                value={formData.email}
                onChange={handleChange}
                placeholder="joao@email.com"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor={`${formId}-whatsapp`} className="ds-label mb-1.5 block">
                WhatsApp *
              </label>
              <Input
                id={`${formId}-whatsapp`}
                type="tel"
                inputMode="tel"
                name="whatsapp"
                autoComplete="tel"
                value={formData.whatsapp}
                onChange={handleChange}
                placeholder="(11) 99999-9999"
                maxLength={15}
                className="font-mono tabular-nums"
                required
              />
            </div>
          </div>
        </section>
      </form>
    </ResponsiveModal>
  )
}
