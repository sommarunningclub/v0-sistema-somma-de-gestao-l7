"use client"

import { useState } from "react"
import { X, Save, Camera } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase-client"

interface ProfileModalProps {
  user: {
    id: string
    email: string
    full_name: string | null
    role: string | null
    created_at: string
  }
  onClose: () => void
  onSave: () => void
}

export function ProfileModal({ user, onClose, onSave }: ProfileModalProps) {
  const [fullName, setFullName] = useState(user.full_name || "")
  const [avatar, setAvatar] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatar(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSave = async () => {
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const { error: updateError } = await supabase
        .from("users")
        .update({
          full_name: fullName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)

      if (updateError) {
        setError("Erro ao atualizar perfil")
        console.error("[v0] Update error:", updateError)
        return
      }

      setSuccess(true)
      setTimeout(() => {
        onSave()
        onClose()
      }, 1000)
    } catch (err) {
      setError("Erro ao salvar alterações")
      console.error("[v0] Save error:", err)
    } finally {
      setLoading(false)
    }
  }

  const displayName = user.full_name?.trim() || user.email?.split("@")[0] || "Usuário"
  const roleLabel = user.role 
    ? user.role === "admin" ? "Administrador" : user.role === "manager" ? "Gerenciador" : "Usuário" 
    : "Usuário"

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-neutral-900 to-neutral-800 border-b border-neutral-700 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-wider">EDITAR PERFIL</h2>
            <p className="text-sm text-neutral-400 mt-1">Gerencie suas informações pessoais</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-700 rounded-lg transition-colors"
            aria-label="Fechar"
          >
            <X className="w-6 h-6 text-neutral-400 hover:text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status Messages */}
          {error && (
            <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-sm">
              Perfil atualizado com sucesso!
            </div>
          )}

          {/* Profile Header */}
          <div className="flex items-center gap-6 pb-6 border-b border-neutral-700">
            <div className="w-24 h-24 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0 overflow-hidden border-2 border-orange-500">
              {avatar ? (
                <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-bold text-orange-500">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-white">{displayName}</h3>
              <p className="text-orange-500 font-medium uppercase tracking-wide text-sm">{roleLabel}</p>
              <p className="text-neutral-400 text-sm mt-2">Membro desde {new Date(user.created_at).toLocaleDateString("pt-BR")}</p>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-5">
            {/* Avatar Upload */}
            <div>
              <label className="text-sm font-semibold text-white block mb-3">Foto de Perfil</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center justify-center gap-2 px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg hover:border-orange-500 cursor-pointer transition-colors">
                  <Camera className="w-4 h-4 text-orange-500" />
                  <span className="text-sm text-neutral-300">Selecionar imagem</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-neutral-500">PNG, JPG até 5MB</p>
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label className="text-sm font-semibold text-white block mb-2">Nome Completo</label>
              <Input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome completo"
                className="bg-neutral-800 border-neutral-700 text-white placeholder-neutral-500 text-sm py-3"
              />
            </div>

            {/* Email (Read-only) */}
            <div>
              <label className="text-sm font-semibold text-white block mb-2">Email</label>
              <div className="px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-400">
                {user.email}
              </div>
              <p className="text-xs text-neutral-500 mt-1">Email não pode ser alterado</p>
            </div>

            {/* Role (Read-only) */}
            <div>
              <label className="text-sm font-semibold text-white block mb-2">Função</label>
              <div className="px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-orange-500 capitalize font-medium">
                {roleLabel}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex gap-3 pt-6 border-t border-neutral-700">
            <Button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-lg transition-colors"
            >
              <Save className="w-4 h-4 mr-2" />
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
            <Button
              onClick={onClose}
              disabled={loading}
              variant="outline"
              className="flex-1 border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500 bg-transparent py-3 rounded-lg"
            >
              Cancelar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
