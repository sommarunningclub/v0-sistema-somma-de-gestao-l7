"use client"

import React from "react"

import { useState } from "react"
import { Save, X, Camera } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { supabase } from "@/lib/supabase-client"

interface UserProfileEditProps {
  user: {
    id: string
    email: string
    full_name: string | null
    role: string | null
  }
  onClose: () => void
  onSave: () => void
}

export function UserProfileEdit({ user, onClose, onSave }: UserProfileEditProps) {
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
      // Update user data in Supabase
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
      console.log("[v0] Profile updated successfully")
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

  return (
    <Card className="bg-neutral-800 border-neutral-700 w-full max-w-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold text-white tracking-wider">EDITAR PERFIL</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-neutral-400 hover:text-white bg-transparent"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500/30 rounded text-red-400 text-xs mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-500/20 border border-green-500/30 rounded text-green-400 text-xs mb-4">
            Perfil atualizado com sucesso!
          </div>
        )}

        <div className="space-y-4">
          {/* Avatar Section */}
          <div>
            <label className="text-xs text-neutral-400 tracking-wider block mb-2">FOTO DE PERFIL</label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {avatar ? (
                  <img src={avatar || "/placeholder.svg"} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-8 h-8 text-orange-500" />
                )}
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="block w-full text-xs text-neutral-400
                    file:mr-4 file:py-2 file:px-3 file:rounded file:border-0
                    file:text-xs file:font-bold file:bg-orange-500 file:text-white
                    hover:file:bg-orange-600"
                />
                <p className="text-xs text-neutral-500 mt-1">PNG, JPG até 5MB</p>
              </div>
            </div>
          </div>

          {/* Name Field */}
          <div>
            <label className="text-xs text-neutral-400 tracking-wider block mb-2">NOME COMPLETO</label>
            <Input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Seu nome completo"
              className="bg-neutral-900 border-neutral-700 text-white placeholder-neutral-600 text-sm"
            />
          </div>

          {/* Email (Read-only) */}
          <div>
            <label className="text-xs text-neutral-400 tracking-wider block mb-2">EMAIL</label>
            <div className="px-3 py-2 bg-neutral-900 border border-neutral-700 rounded text-sm text-neutral-400">
              {user.email}
            </div>
          </div>

          {/* Role (Read-only) */}
          <div>
            <label className="text-xs text-neutral-400 tracking-wider block mb-2">FUNÇÃO</label>
            <div className="px-3 py-2 bg-neutral-900 border border-neutral-700 rounded text-sm text-neutral-400 capitalize">
              {user.role || "Usuário"}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold"
            >
              <Save className="w-4 h-4 mr-2" />
              {loading ? "Salvando..." : "Salvar"}
            </Button>
            <Button
              onClick={onClose}
              disabled={loading}
              variant="outline"
              className="flex-1 border-neutral-700 text-neutral-400 hover:text-white hover:border-orange-500 bg-transparent text-sm"
            >
              Cancelar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
