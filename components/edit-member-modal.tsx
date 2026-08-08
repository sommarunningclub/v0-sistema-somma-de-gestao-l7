"use client"

import type React from "react"
import { useId, useState } from "react"
import { AlertCircle, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ResponsiveModal, SectionTitle, confirmAction, notify } from "@/components/somma"
import { updateMember, deleteMember } from "@/lib/services/members"
import type { CadastroSite } from "@/lib/supabase-client"

interface EditMemberModalProps {
  member: CadastroSite
  onClose: () => void
  onSave: () => void
}

export function EditMemberModal({ member, onClose, onSave }: EditMemberModalProps) {
  const formId = useId()
  const [formData, setFormData] = useState({
    nome_completo: member.nome_completo || "",
    email: member.email || "",
    cpf: member.cpf || "",
    whatsapp: member.whatsapp || "",
    data_nascimento: member.data_nascimento || "",
  })
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const busy = loading || deleting

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    let formattedValue = value

    if (name === "cpf") {
      formattedValue = value.replace(/\D/g, "").slice(0, 11)
    } else if (name === "whatsapp") {
      formattedValue = value.replace(/\D/g, "").slice(0, 11)
    }

    setFormData((prev) => ({
      ...prev,
      [name]: formattedValue,
    }))
  }

  const validateForm = () => {
    if (!formData.nome_completo.trim()) {
      setError("Nome completo é obrigatório")
      return false
    }
    if (!formData.email.trim()) {
      setError("Email é obrigatório")
      return false
    }
    if (!formData.email.includes("@")) {
      setError("Email inválido")
      return false
    }
    if (formData.cpf.replace(/\D/g, "").length !== 11) {
      setError("CPF deve conter 11 dígitos")
      return false
    }
    if (formData.whatsapp.replace(/\D/g, "").length < 10) {
      setError("WhatsApp inválido")
      return false
    }
    return true
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return

    setError(null)
    if (!validateForm()) return

    setLoading(true)
    try {
      const success = await updateMember(member.id, {
        nome_completo: formData.nome_completo.trim(),
        email: formData.email.trim().toLowerCase(),
        cpf: formData.cpf.replace(/\D/g, ""),
        whatsapp: formData.whatsapp.replace(/\D/g, ""),
        data_nascimento: formData.data_nascimento,
      })

      if (success) {
        notify.success("Membro atualizado", {
          description: `As alterações de ${formData.nome_completo.trim()} foram salvas.`,
        })
        onSave()
      } else {
        setError("Erro ao atualizar membro")
      }
    } catch (err) {
      setError("Erro ao salvar as alterações")
      console.error("[v0] Error saving member:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (busy) return

    const confirmed = await confirmAction({
      title: "Excluir membro?",
      description:
        "O cadastro será removido permanentemente da base. Esta ação não pode ser desfeita e o histórico do membro deixa de aparecer nas listagens.",
      detail: `${member.nome_completo} — ID ${member.id}`,
      tone: "danger",
      confirmLabel: "Excluir membro",
    })
    if (!confirmed) return

    setError(null)
    setDeleting(true)
    try {
      const success = await deleteMember(member.id)
      if (success) {
        notify.success("Membro excluído", { description: `${member.nome_completo} foi removido da base.` })
        onSave()
      } else {
        setError("Erro ao deletar membro")
      }
    } catch (err) {
      setError("Erro ao deletar membro")
      console.error("[v0] Error deleting member:", err)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <ResponsiveModal
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
      title="Editar membro"
      description={member.nome_completo}
      size="lg"
      dismissible={!busy}
      footer={
        <>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            loading={deleting}
            disabled={loading}
            block
            className="sm:mr-auto sm:w-auto"
          >
            <Trash2 aria-hidden="true" />
            Excluir
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy} block className="sm:w-auto">
            Cancelar
          </Button>
          <Button type="submit" form={formId} loading={loading} disabled={deleting} block className="sm:w-auto">
            Salvar alterações
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSave} className="space-y-6" noValidate>
        {error ? (
          <div
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
                Nome completo
              </label>
              <Input
                id={`${formId}-nome`}
                name="nome_completo"
                autoComplete="name"
                value={formData.nome_completo}
                onChange={handleInputChange}
                disabled={busy}
                placeholder="Nome completo"
              />
            </div>

            <div>
              <label htmlFor={`${formId}-cpf`} className="ds-label mb-1.5 block">
                CPF
              </label>
              <Input
                id={`${formId}-cpf`}
                name="cpf"
                inputMode="numeric"
                value={formData.cpf}
                onChange={handleInputChange}
                disabled={busy}
                placeholder="00000000000"
                maxLength={14}
                className="font-mono tabular-nums"
              />
            </div>

            <div>
              <label htmlFor={`${formId}-nascimento`} className="ds-label mb-1.5 block">
                Data de nascimento
              </label>
              <Input
                id={`${formId}-nascimento`}
                name="data_nascimento"
                type="date"
                autoComplete="bday"
                value={formData.data_nascimento}
                onChange={handleInputChange}
                disabled={busy}
              />
            </div>
          </div>
        </section>

        <section>
          <SectionTitle title="Contato" as="h3" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${formId}-email`} className="ds-label mb-1.5 block">
                E-mail
              </label>
              <Input
                id={`${formId}-email`}
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                value={formData.email}
                onChange={handleInputChange}
                disabled={busy}
                placeholder="email@exemplo.com"
              />
            </div>

            <div>
              <label htmlFor={`${formId}-whatsapp`} className="ds-label mb-1.5 block">
                WhatsApp
              </label>
              <Input
                id={`${formId}-whatsapp`}
                name="whatsapp"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={formData.whatsapp}
                onChange={handleInputChange}
                disabled={busy}
                placeholder="00000000000"
                maxLength={15}
                className="font-mono tabular-nums"
              />
            </div>
          </div>
        </section>
      </form>
    </ResponsiveModal>
  )
}
