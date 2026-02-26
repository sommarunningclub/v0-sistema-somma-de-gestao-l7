"use client"

import { useState, useEffect } from "react"
import { LogOut, User, Mail, Calendar, Edit2, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ProfileModal } from "@/components/profile-modal"
import { getSession, logout } from "@/components/protected-route"
import { supabase } from "@/lib/supabase-client"

interface UserData {
  id: string
  email: string
  full_name: string | null
  role: string | null
  created_at: string
}

export function UserProfile() {
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showMenu, setShowMenu] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  useEffect(() => {
    fetchUserData()
  }, [])

  const fetchUserData = async () => {
    try {
      // Buscar sessao do localStorage
      const session = getSession()
      
      if (session) {
        // Buscar dados atualizados do usuario no banco
        const { data: userData, error: dbError } = await supabase
          .from("users")
          .select("id, email, full_name, role, created_at")
          .eq("id", session.id)
          .maybeSingle()

        if (userData) {
          setUser(userData)
        } else {
          // Usar dados da sessao se nao encontrar no banco
          setUser({
            id: session.id,
            email: session.email,
            full_name: session.full_name || session.email?.split("@")[0] || "Usuário",
            role: session.role || "user",
            created_at: session.logged_in_at || new Date().toISOString()
          })
        }
      }
    } catch (err) {
      console.error("[v0] Error fetching user data:", err)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    logout()
  }

  const handleRefreshProfile = async () => {
    setShowEditModal(false)
    await fetchUserData()
  }

  if (loading) {
    return (
      <div className="p-3 bg-neutral-800 rounded-lg animate-pulse">
        <div className="h-10 bg-neutral-700 rounded"></div>
      </div>
    )
  }

  if (!user) return null

  const displayName = user.full_name?.trim() || user.email?.split("@")[0] || "Usuário"
  const roleLabel = user.role ? (user.role === "admin" ? "Administrador" : user.role === "manager" ? "Gerenciador" : "Usuário") : "Usuário"

  return (
    <div className="relative w-full">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="w-full px-4 py-3 rounded-lg bg-neutral-800 border border-neutral-700 hover:border-neutral-600 transition-colors flex items-center justify-between group"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-bold text-white truncate">
              {displayName}
            </p>
            <p className="text-xs text-orange-500 font-medium uppercase tracking-wide">
              {roleLabel}
            </p>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${showMenu ? "rotate-180" : ""}`} />
      </button>

      {/* Profile Dropdown Menu */}
      {showMenu && !showEditModal && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-neutral-800 border border-neutral-700 rounded-lg shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Header Section */}
          <div className="p-4 bg-gradient-to-r from-neutral-800 to-neutral-900 border-b border-neutral-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                <span className="text-white font-bold text-lg">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-base font-bold text-white">
                  {displayName}
                </p>
                <p className="text-xs text-orange-500 font-medium uppercase tracking-wide">
                  {roleLabel}
                </p>
              </div>
            </div>
          </div>

          {/* Info Section */}
          <div className="p-4 space-y-3 border-b border-neutral-700">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-orange-500 flex-shrink-0" />
              <div>
                <p className="text-xs text-neutral-400">Email</p>
                <p className="text-sm text-white break-all">{user.email}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-orange-500 flex-shrink-0" />
              <div>
                <p className="text-xs text-neutral-400">Membro desde</p>
                <p className="text-sm text-white">
                  {new Date(user.created_at).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric"
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Actions Section */}
          <div className="p-3 space-y-2">
            <Button
              onClick={() => {
                setShowEditModal(true)
              }}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              Editar Perfil
            </Button>

            <Button
              onClick={() => {
                setShowMenu(false)
                handleLogout()
              }}
              className="w-full bg-neutral-700 hover:bg-red-500 text-white text-sm font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </Button>
          </div>
        </div>
      )}

      {/* Profile Modal - Full Screen */}
      {showEditModal && (
        <ProfileModal
          user={user}
          onClose={() => setShowEditModal(false)}
          onSave={handleRefreshProfile}
        />
      )}

      {/* Close menu when clicking outside */}
      {showMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowMenu(false)}
        />
      )}
    </div>
  )
}
