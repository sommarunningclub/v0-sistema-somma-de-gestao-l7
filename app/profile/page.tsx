'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, X, Mail, User, Calendar, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { getSession } from '@/components/protected-route'
import { supabase } from '@/lib/supabase-client'

interface UserData {
  id: string
  email: string
  full_name: string | null
  role: string | null
  created_at: string
  avatar_url?: string
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Form state
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [isModified, setIsModified] = useState(false)

  useEffect(() => {
    fetchUserData()
  }, [])

  const fetchUserData = async () => {
    try {
      setLoading(true)
      const session = await getSession()
      if (!session?.user) {
        router.push('/login')
        return
      }

      const { data, error: err } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (err) throw err
      setUser(data)
      setFullName(data.full_name || '')
      setEmail(data.email || '')
    } catch (err) {
      console.error('[v0] Error fetching user:', err)
      setError('Erro ao carregar perfil')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!user) return
    
    try {
      setSaving(true)
      setError(null)

      const { error: err } = await supabase
        .from('users')
        .update({
          full_name: fullName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (err) throw err
      
      setUser({ ...user, full_name: fullName })
      setIsModified(false)
      // Optional: Show success message
      setTimeout(() => router.back(), 500)
    } catch (err) {
      console.error('[v0] Error saving profile:', err)
      setError('Erro ao salvar perfil. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (field: 'fullName', value: string) => {
    if (field === 'fullName') {
      setFullName(value)
      setIsModified(value !== user?.full_name)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="text-white">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-neutral-800 bg-black/95 backdrop-blur-sm">
        <div className="flex items-center justify-between p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl sm:text-2xl font-bold tracking-wide">EDITAR PERFIL</h1>
          </div>
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Avatar Section */}
          {user && (
            <Card className="bg-neutral-900 border-neutral-800">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-orange-500/20 flex items-center justify-center border-2 border-orange-500">
                    <User className="w-10 h-10 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm text-neutral-400 mb-1">USUÁRIO</p>
                    <p className="text-lg font-semibold">{user.email}</p>
                    {user.role && (
                      <p className="text-xs text-orange-500 font-mono uppercase mt-1">{user.role}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="flex items-center gap-2 text-xs text-neutral-400 mb-2 uppercase tracking-wider">
                <User className="w-3.5 h-3.5" />
                Nome Completo
              </label>
              <Input
                value={fullName}
                onChange={(e) => handleChange('fullName', e.target.value)}
                placeholder="Seu nome completo"
                className="bg-neutral-800 border-neutral-700 text-white placeholder-neutral-500 py-2"
              />
            </div>

            {/* Email - Read Only */}
            <div>
              <label className="flex items-center gap-2 text-xs text-neutral-400 mb-2 uppercase tracking-wider">
                <Mail className="w-3.5 h-3.5" />
                Email
              </label>
              <div className="p-2 bg-neutral-800 border border-neutral-700 rounded-md text-neutral-400 text-sm flex items-center gap-2">
                <span>{user?.email}</span>
                <span className="text-[10px] text-neutral-500 ml-auto">Não pode ser alterado</span>
              </div>
            </div>

            {/* Role - Read Only */}
            {user?.role && (
              <div>
                <label className="flex items-center gap-2 text-xs text-neutral-400 mb-2 uppercase tracking-wider">
                  <Shield className="w-3.5 h-3.5" />
                  Função
                </label>
                <div className="p-2 bg-neutral-800 border border-neutral-700 rounded-md text-neutral-400 text-sm">
                  {user.role}
                </div>
              </div>
            )}

            {/* Created At - Read Only */}
            {user?.created_at && (
              <div>
                <label className="flex items-center gap-2 text-xs text-neutral-400 mb-2 uppercase tracking-wider">
                  <Calendar className="w-3.5 h-3.5" />
                  Membro Desde
                </label>
                <div className="p-2 bg-neutral-800 border border-neutral-700 rounded-md text-neutral-400 text-sm">
                  {new Date(user.created_at).toLocaleDateString('pt-BR')}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-4 sticky bottom-0 bg-black/95 backdrop-blur-sm -mx-4 sm:-mx-6 px-4 sm:px-6 py-4 border-t border-neutral-800">
            <Button
              onClick={() => router.back()}
              variant="outline"
              className="border-neutral-700 text-neutral-400 hover:bg-neutral-800 bg-transparent flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={!isModified || saving}
              className="bg-orange-500 hover:bg-orange-600 text-white flex-1"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
