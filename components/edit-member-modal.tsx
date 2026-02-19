"use client"

import React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updateMember, deleteMember } from "@/lib/services/members"
import type { CadastroSite } from "@/lib/supabase-client"

interface EditMemberModalProps {
  member: CadastroSite
  onClose: () => void
  onSave: () => void
}

export function EditMemberModal({ member, onClose, onSave }: EditMemberModalProps) {
  const [formData, setFormData] = useState({
    nome_completo: member.nome_completo || "",
    email: member.email || "",
    cpf: member.cpf || "",
    whatsapp: member.whatsapp || "",
    data_nascimento: member.data_nascimento || "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const formatCPF = (cpf: string) => {
    const cleaned = cpf.replace(/\D/g, "")
    if (cleaned.length <= 11) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
    }
    return cpf
  }

  const formatWhatsApp = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "")
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")
    } else if (cleaned.length === 10) {
      return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3")
    }
    return phone
  }

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

  const handleSave = async () => {
    setError(null)
    setSuccess(false)

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
        setSuccess(true)
        setTimeout(() => {
          onSave()
        }, 1500)
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
    if (!window.confirm("Tem certeza que deseja deletar este membro?")) {
      return
    }

    setLoading(true)
    try {
      const success = await deleteMember(member.id)
      if (success) {
        setSuccess(true)
        setTimeout(() => {
          onSave()
        }, 1500)
      } else {
        setError("Erro ao deletar membro")
      }
    } catch (err) {
      setError("Erro ao deletar membro")
      console.error("[v0] Error deleting member:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="bg-neutral-900 border-neutral-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="sticky top-0 bg-neutral-900 border-b border-neutral-700">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base sm:text-lg font-bold text-white tracking-wider">
              Editar Membro
            </CardTitle>
            <button
              onClick={onClose}
              disabled={loading}
              className="text-neutral-400 hover:text-white disabled:opacity-50"
            >
              ✕
            </button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-4 sm:p-6">
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500 rounded text-red-400 text-xs sm:text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-500/20 border border-green-500 rounded text-green-400 text-xs sm:text-sm">
              Membro atualizado com sucesso!
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-xs text-neutral-400 tracking-wider">NOME COMPLETO</label>
              <Input
                name="nome_completo"
                value={formData.nome_completo}
                onChange={handleInputChange}
                disabled={loading}
                className="mt-1 bg-neutral-800 border-neutral-600 text-white placeholder-neutral-500"
                placeholder="Nome completo"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-neutral-400 tracking-wider">EMAIL</label>
                <Input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={loading}
                  className="mt-1 bg-neutral-800 border-neutral-600 text-white placeholder-neutral-500"
                  placeholder="email@exemplo.com"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 tracking-wider">CPF</label>
                <Input
                  name="cpf"
                  value={formData.cpf}
                  onChange={handleInputChange}
                  disabled={loading}
                  className="mt-1 bg-neutral-800 border-neutral-600 text-white placeholder-neutral-500"
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-neutral-400 tracking-wider">WHATSAPP</label>
                <Input
                  name="whatsapp"
                  value={formData.whatsapp}
                  onChange={handleInputChange}
                  disabled={loading}
                  className="mt-1 bg-neutral-800 border-neutral-600 text-white placeholder-neutral-500"
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 tracking-wider">DATA DE NASCIMENTO</label>
                <Input
                  name="data_nascimento"
                  type="date"
                  value={formData.data_nascimento}
                  onChange={handleInputChange}
                  disabled={loading}
                  className="mt-1 bg-neutral-800 border-neutral-600 text-white placeholder-neutral-500"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-neutral-700">
            <Button
              onClick={handleSave}
              disabled={loading}
              className="bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 flex-1"
            >
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
            <Button
              onClick={handleDelete}
              disabled={loading}
              className="bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 flex-1"
            >
              {loading ? "Deletando..." : "Deletar Membro"}
            </Button>
            <Button
              onClick={onClose}
              disabled={loading}
              variant="outline"
              className="border-neutral-700 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-300 bg-transparent flex-1"
            >
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
