"use client"

import React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase-client"
import { AlertCircle, CheckCircle } from "lucide-react"

interface AddMemberModalProps {
  isOpen: boolean
  onClose: () => void
  onMemberAdded: () => void
}

export function AddMemberModal({ isOpen, onClose, onMemberAdded }: AddMemberModalProps) {
  const [formData, setFormData] = useState({
    nome_completo: "",
    email: "",
    cpf: "",
    data_nascimento: "",
    whatsapp: "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

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
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { error: insertError } = await supabase.from("cadastro_site").insert([
        {
          nome_completo: formData.nome_completo,
          email: formData.email,
          cpf: formData.cpf.replace(/\D/g, ""),
          data_nascimento: formData.data_nascimento,
          whatsapp: formData.whatsapp,
        },
      ])

      if (insertError) {
        setError(`Erro ao adicionar membro: ${insertError.message}`)
      } else {
        setSuccess(true)
        setTimeout(() => {
          setFormData({
            nome_completo: "",
            email: "",
            cpf: "",
            data_nascimento: "",
            whatsapp: "",
          })
          setSuccess(false)
          onMemberAdded()
          onClose()
        }, 1500)
      }
    } catch (err) {
      setError("Erro ao conectar com o servidor")
      console.error("[v0] Error adding member:", err)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="bg-neutral-900 border-neutral-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="sticky top-0 bg-neutral-900 border-b border-neutral-700">
          <CardTitle className="text-base sm:text-lg font-bold text-white tracking-wider">
            Adicionar Novo Membro
          </CardTitle>
        </CardHeader>

        <CardContent className="p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/30 rounded flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="p-3 bg-green-500/20 border border-green-500/30 rounded flex items-center gap-2 text-green-400 text-sm">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                Membro adicionado com sucesso!
              </div>
            )}

            {/* Form Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="sm:col-span-2">
                <label className="block text-xs text-neutral-400 tracking-wider mb-2">NOME COMPLETO *</label>
                <Input
                  type="text"
                  name="nome_completo"
                  value={formData.nome_completo}
                  onChange={handleChange}
                  placeholder="João Silva"
                  className="bg-neutral-800 border-neutral-600 text-white placeholder-neutral-500 text-sm"
                  required
                />
              </div>

              {/* Email */}
              <div className="sm:col-span-2">
                <label className="block text-xs text-neutral-400 tracking-wider mb-2">E-MAIL *</label>
                <Input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="joao@email.com"
                  className="bg-neutral-800 border-neutral-600 text-white placeholder-neutral-500 text-sm"
                  required
                />
              </div>

              {/* CPF */}
              <div>
                <label className="block text-xs text-neutral-400 tracking-wider mb-2">CPF *</label>
                <Input
                  type="text"
                  name="cpf"
                  value={formData.cpf}
                  onChange={handleChange}
                  placeholder="000.000.000-00"
                  className="bg-neutral-800 border-neutral-600 text-white placeholder-neutral-500 text-sm font-mono"
                  required
                />
              </div>

              {/* Birth Date */}
              <div>
                <label className="block text-xs text-neutral-400 tracking-wider mb-2">NASCIMENTO *</label>
                <Input
                  type="date"
                  name="data_nascimento"
                  value={formData.data_nascimento}
                  onChange={handleChange}
                  className="bg-neutral-800 border-neutral-600 text-white text-sm"
                  required
                />
              </div>

              {/* WhatsApp */}
              <div className="sm:col-span-2">
                <label className="block text-xs text-neutral-400 tracking-wider mb-2">WHATSAPP *</label>
                <Input
                  type="text"
                  name="whatsapp"
                  value={formData.whatsapp}
                  onChange={handleChange}
                  placeholder="(11) 99999-9999"
                  className="bg-neutral-800 border-neutral-600 text-white placeholder-neutral-500 text-sm font-mono"
                  required
                />
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-neutral-700">
              <Button
                type="button"
                onClick={onClose}
                className="bg-neutral-700 hover:bg-neutral-600 text-white flex-1 sm:flex-0"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading || success}
                className="bg-orange-500 hover:bg-orange-600 text-white flex-1 sm:flex-0"
              >
                {loading ? "Adicionando..." : "Adicionar Membro"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
