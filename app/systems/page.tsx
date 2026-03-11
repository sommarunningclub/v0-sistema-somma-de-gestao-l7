"use client"

import React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase-client"
import { Plus, Trash2, Edit, Search, Check, X, Shield, Eye, Loader2, CheckCircle, AlertCircle, Copy } from "lucide-react"

interface ModulePermissions {
  dashboard: boolean
  checkin: boolean
  membros: boolean
  parceiro: boolean
  carteiras: boolean
  pagamentos: boolean
  crm: boolean
  admin: boolean
}

interface User {
  id: string
  email: string
  full_name: string
  role: string
  is_active: boolean
  created_at: string
  permissions: ModulePermissions | null
}

const DEFAULT_PERMISSIONS: ModulePermissions = {
  dashboard: true,
  checkin: false,
  membros: false,
  parceiro: false,
  carteiras: false,
  pagamentos: false,
  crm: false,
  admin: false,
}

const MODULE_LABELS: Record<keyof ModulePermissions, string> = {
  dashboard: "Dashboard",
  checkin: "Check-in",
  membros: "Membros",
  parceiro: "Parceiro Somma",
  carteiras: "Carteiras",
  pagamentos: "Pagamentos",
  crm: "CRM",
  admin: "Administração",
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [showNewUserModal, setShowNewUserModal] = useState(false)
  const [showPermissionsModal, setShowPermissionsModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({ 
    email: "", 
    full_name: "", 
    role: "user", 
    password: "",
    permissions: { ...DEFAULT_PERMISSIONS }
  })
  const [successModal, setSuccessModal] = useState<{
    show: boolean
    title: string
    message: string
  }>({ show: false, title: "", message: "" })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const { data, error: dbError } = await supabase
        .from("users")
        .select("id, email, full_name, role, is_active, created_at, permissions")
        .order("created_at", { ascending: false })

      if (dbError) {
        console.error("[v0] Error fetching users:", dbError)
        setError("Erro ao carregar usuários")
        return
      }

      setUsers(data || [])
    } catch (err) {
      console.error("[v0] Fetch users error:", err)
      setError("Erro ao conectar com o banco de dados")
    } finally {
      setLoading(false)
    }
  }

  // Funcao para gerar hash de senha usando Web Crypto API
  const hashPassword = async (password: string): Promise<string> => {
    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    return hashHex
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    if (!formData.email || !formData.full_name || !formData.password) {
      setSuccessModal({ show: true, title: "Atencao", message: "Preencha todos os campos obrigatorios" })
      setSaving(false)
      return
    }

    if (formData.password.length < 6) {
      setSuccessModal({ show: true, title: "Atencao", message: "A senha deve ter pelo menos 6 caracteres" })
      setSaving(false)
      return
    }

    try {
      // Gerar hash da senha
      const password_hash = await hashPassword(formData.password)

      // Determine permissions based on role
      let permissions = formData.permissions
      if (formData.role === "admin") {
        // Admin has all permissions
        permissions = {
          dashboard: true,
          checkin: true,
          membros: true,
          parceiro: true,
          carteiras: true,
          pagamentos: true,
          crm: true,
          admin: true,
        }
      }

      // Create user record in database with password_hash
      const { error: dbError } = await supabase.from("users").insert([
        {
          email: formData.email,
          full_name: formData.full_name,
          role: formData.role,
          is_active: true,
          permissions: permissions,
          password_hash: password_hash,
          created_at: new Date().toISOString(),
        },
      ])

      if (dbError) {
        console.error("[v0] Database error:", dbError)
        setSuccessModal({ show: true, title: "Erro", message: "Erro ao salvar usuario: " + dbError.message })
        setSaving(false)
        return
      }

      setSuccessModal({ show: true, title: "Sucesso!", message: "Usuario criado com sucesso!" })
      setFormData({ email: "", full_name: "", role: "user", password: "", permissions: { ...DEFAULT_PERMISSIONS } })
      setShowNewUserModal(false)
      fetchUsers()
    } catch (err) {
      console.error("[v0] Create user error:", err)
      setSuccessModal({ show: true, title: "Erro", message: "Erro ao criar usuario" })
    } finally {
      setSaving(false)
    }
  }

  const handleUpdatePermissions = async (userId: string, permissions: ModulePermissions) => {
    setSaving(true)
    console.log("[v0] Updating permissions for user:", userId, "Permissions:", permissions)
    try {
      const { error } = await supabase
        .from("users")
        .update({ permissions })
        .eq("id", userId)

      if (error) {
        console.error("[v0] Update permissions error:", error)
        setSuccessModal({ show: true, title: "Erro", message: "Erro ao atualizar permissoes: " + error.message })
        return
      }

      console.log("[v0] Permissions updated successfully")
      setSuccessModal({ show: true, title: "Sucesso!", message: "Permissoes atualizadas com sucesso!" })
      setShowPermissionsModal(false)
      setEditingUser(null)
      fetchUsers()
    } catch (err) {
      console.error("[v0] Update permissions error:", err)
      setSuccessModal({ show: true, title: "Erro", message: "Erro ao atualizar permissoes: " + String(err) })
    } finally {
      setSaving(false)
    }
  }

  const openPermissionsModal = (user: User) => {
    setEditingUser(user)
    // Merge user permissions with defaults to ensure all properties exist
    const mergedPermissions: ModulePermissions = {
      ...DEFAULT_PERMISSIONS,
      ...(user.permissions || {})
    }
    console.log("[v0] Opening permissions modal for user:", user.full_name)
    console.log("[v0] User permissions from DB:", user.permissions)
    console.log("[v0] Merged permissions:", mergedPermissions)
    // Reset formData completely with new permissions
    setFormData({
      email: "",
      full_name: "",
      role: "user",
      password: "",
      permissions: mergedPermissions
    })
    setShowPermissionsModal(true)
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Tem certeza que deseja deletar este usuario?")) return

    try {
      const { error: dbError } = await supabase.from("users").delete().eq("id", userId)

      if (dbError) {
        console.error("[v0] Delete error:", dbError)
        setSuccessModal({ show: true, title: "Erro", message: "Erro ao deletar usuario" })
        return
      }

      setSuccessModal({ show: true, title: "Sucesso!", message: "Usuario deletado com sucesso!" })
      fetchUsers()
    } catch (err) {
      console.error("[v0] Delete user error:", err)
      setSuccessModal({ show: true, title: "Erro", message: "Erro ao deletar usuario" })
    }
  }

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      // If changing to admin, grant all permissions
      let updateData: { role: string; permissions?: ModulePermissions } = { role: newRole }
      if (newRole === "admin") {
        updateData.permissions = {
          dashboard: true,
          checkin: true,
          membros: true,
          parceiro: true,
          carteiras: true,
          pagamentos: true,
          crm: true,
          admin: true,
        }
      }
      
      const { error } = await supabase.from("users").update(updateData).eq("id", userId)

      if (error) {
        console.error("[v0] Update role error:", error)
        setSuccessModal({ show: true, title: "Erro", message: "Erro ao atualizar role" })
        return
      }

      setSuccessModal({ show: true, title: "Sucesso!", message: "Role atualizado com sucesso!" })
      fetchUsers()
    } catch (err) {
      console.error("[v0] Update role error:", err)
      setSuccessModal({ show: true, title: "Erro", message: "Erro ao atualizar role" })
    }
  }

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    try {
      const { error } = await supabase.from("users").update({ is_active: !isActive }).eq("id", userId)

      if (error) {
        console.error("[v0] Toggle active error:", error)
        setSuccessModal({ show: true, title: "Erro", message: "Erro ao atualizar status" })
        return
      }

      setSuccessModal({ show: true, title: "Sucesso!", message: "Status atualizado com sucesso!" })
      fetchUsers()
    } catch (err) {
      console.error("[v0] Toggle active error:", err)
      setSuccessModal({ show: true, title: "Erro", message: "Erro ao atualizar status" })
    }
  }

  const countPermissions = (permissions: ModulePermissions | null): number => {
    if (!permissions) return 0
    return Object.values(permissions).filter(Boolean).length
  }

  const filteredUsers = users.filter(
    (user) =>
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-500/20 text-red-500"
      case "manager":
        return "bg-orange-500/20 text-orange-500"
      case "user":
        return "bg-blue-500/20 text-blue-500"
      default:
        return "bg-neutral-500/20 text-neutral-300"
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wider">ADMINISTRAÇÃO</h1>
          <p className="text-sm text-neutral-400">Gerencie usuários e permissões do sistema</p>
        </div>
        <Button
          onClick={() => {
            setEditingUser(null)
            setFormData({ email: "", full_name: "", role: "user", password: "", permissions: { ...DEFAULT_PERMISSIONS } })
            setShowNewUserModal(true)
          }}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Usuario
        </Button>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-500/20 border border-red-500/30 rounded text-red-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-500/20 border border-green-500/30 rounded text-green-400 text-sm">
          {success}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <Input
          placeholder="Buscar por email ou nome..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-neutral-900 border-neutral-700 text-white placeholder-neutral-500"
        />
      </div>

      {/* Users Table */}
      <Card className="bg-neutral-900 border-neutral-700 overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-neutral-400">Carregando usuários...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-neutral-400">Nenhum usuário encontrado</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-700">
                    <th className="px-6 py-3 text-left text-xs font-bold text-neutral-400 tracking-wider">EMAIL</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-neutral-400 tracking-wider">NOME</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-neutral-400 tracking-wider">ROLE</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-neutral-400 tracking-wider">PERMISSOES</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-neutral-400 tracking-wider">STATUS</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-neutral-400 tracking-wider">CRIADO</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-neutral-400 tracking-wider">ACOES</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b border-neutral-700 hover:bg-neutral-800/50 transition-colors">
                      <td className="px-6 py-4 text-white font-mono text-xs">{user.email}</td>
                      <td className="px-6 py-4 text-white">{user.full_name}</td>
                      <td className="px-6 py-4">
                        <select
                          value={user.role}
                          onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                          className="px-3 py-1 rounded bg-neutral-800 border border-neutral-700 text-white text-xs font-mono"
                        >
                          <option value="user">user</option>
                          <option value="manager">manager</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openPermissionsModal(user)}
                          className="text-orange-400 hover:text-orange-300 bg-transparent flex items-center gap-1"
                        >
                          <Shield className="w-3 h-3" />
                          <span className="text-xs">{countPermissions(user.permissions)}/7</span>
                        </Button>
                      </td>
                      <td className="px-6 py-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(user.id, user.is_active)}
                          className={`text-xs ${
                            user.is_active
                              ? "text-green-500 hover:text-green-400"
                              : "text-red-500 hover:text-red-400"
                          } bg-transparent`}
                        >
                          {user.is_active ? "ATIVO" : "INATIVO"}
                        </Button>
                      </td>
                      <td className="px-6 py-4 text-neutral-400 text-xs">
                        {new Date(user.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openPermissionsModal(user)}
                            className="text-orange-500 hover:text-orange-400 bg-transparent"
                            title="Editar permissoes"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-red-500 hover:text-red-400 bg-transparent"
                            title="Deletar usuario"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New User Modal */}
      {showNewUserModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <Card className="bg-neutral-900 border-neutral-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="text-white tracking-wider">NOVO USUARIO</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddUser} className="space-y-4">
                <div>
                  <label className="block text-xs text-neutral-400 tracking-wider mb-2">EMAIL *</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="usuario@example.com"
                    className="bg-neutral-800 border-neutral-700 text-white placeholder-neutral-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-neutral-400 tracking-wider mb-2">NOME COMPLETO *</label>
                  <Input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Joao Silva"
                    className="bg-neutral-800 border-neutral-700 text-white placeholder-neutral-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-neutral-400 tracking-wider mb-2">SENHA *</label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Senha segura"
                    className="bg-neutral-800 border-neutral-700 text-white placeholder-neutral-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-neutral-400 tracking-wider mb-2">TIPO DE USUARIO</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 rounded bg-neutral-800 border border-neutral-700 text-white text-sm"
                  >
                    <option value="user">Usuario</option>
                    <option value="manager">Gerenciador</option>
                    <option value="admin">Administrador (acesso total)</option>
                  </select>
                </div>

                {/* Module Permissions - only show if not admin */}
                {formData.role !== "admin" && (
                  <div>
                    <label className="block text-xs text-neutral-400 tracking-wider mb-3">
                      <Shield className="w-3 h-3 inline mr-1" />
                      PERMISSOES POR MODULO
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.keys(MODULE_LABELS) as Array<keyof ModulePermissions>).map((module) => (
                        <label
                          key={module}
                          className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                            formData.permissions[module]
                              ? "bg-orange-500/20 border-orange-500/50 text-orange-400"
                              : "bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-600"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={formData.permissions[module]}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                permissions: { ...formData.permissions, [module]: e.target.checked },
                              })
                            }
                            className="hidden"
                          />
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                            formData.permissions[module]
                              ? "bg-orange-500 border-orange-500"
                              : "border-neutral-600"
                          }`}>
                            {formData.permissions[module] && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className="text-xs">{MODULE_LABELS[module]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {formData.role === "admin" && (
                  <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded">
                    <p className="text-xs text-orange-400">
                      <Shield className="w-3 h-3 inline mr-1" />
                      Administradores tem acesso total a todos os modulos automaticamente.
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button type="submit" disabled={saving} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white">
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                    Criar
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setShowNewUserModal(false)}
                    className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Permissions Modal */}
      {showPermissionsModal && editingUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <Card className="bg-neutral-900 border-neutral-700 w-full max-w-lg">
            <CardHeader>
              <CardTitle className="text-white tracking-wider flex items-center gap-2">
                <Shield className="w-5 h-5 text-orange-500" />
                PERMISSOES - {editingUser.full_name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-neutral-400">
                Selecione os modulos que este usuario pode acessar:
              </p>

              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(MODULE_LABELS) as Array<keyof ModulePermissions>).map((module) => (
                  <label
                    key={module}
                    className={`flex items-center gap-2 p-3 rounded border cursor-pointer transition-colors ${
                      formData.permissions[module]
                        ? "bg-orange-500/20 border-orange-500/50 text-orange-400"
                        : "bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-600"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.permissions[module]}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, [module]: e.target.checked },
                        })
                      }
                      className="hidden"
                    />
                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                      formData.permissions[module]
                        ? "bg-orange-500 border-orange-500"
                        : "border-neutral-600"
                    }`}>
                      {formData.permissions[module] && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-sm">{MODULE_LABELS[module]}</span>
                  </label>
                ))}
              </div>

              <div className="flex gap-2 pt-4 border-t border-neutral-700">
                <Button 
                  onClick={() => handleUpdatePermissions(editingUser.id, formData.permissions)}
                  disabled={saving}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                  Salvar
                </Button>
                <Button
                  onClick={() => {
                    setShowPermissionsModal(false)
                    setEditingUser(null)
                  }}
                  className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Success/Error Modal */}
      {successModal.show && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <Card className="bg-neutral-900 border-neutral-700 max-w-md w-full">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-full ${
                  successModal.title.includes('Erro') || successModal.title.includes('Atencao')
                    ? 'bg-red-500/20' 
                    : 'bg-green-500/20'
                }`}>
                  {successModal.title.includes('Erro') || successModal.title.includes('Atencao') ? (
                    <AlertCircle className="w-6 h-6 text-red-400" />
                  ) : (
                    <CheckCircle className="w-6 h-6 text-green-400" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-2">{successModal.title}</h3>
                  <p className="text-neutral-400 text-sm">{successModal.message}</p>
                </div>
              </div>
              
              <div className="flex gap-2 mt-6">
                <Button
                  onClick={() => setSuccessModal({ show: false, title: "", message: "" })}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                >
                  OK
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
