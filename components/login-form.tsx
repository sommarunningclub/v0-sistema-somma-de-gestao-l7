'use client'

import React from "react"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<'form'>) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Funcao para gerar hash de senha usando Web Crypto API (mesma do cadastro)
  const hashPassword = async (password: string): Promise<string> => {
    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    return hashHex
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Gerar hash da senha para comparar com o banco
      const password_hash = await hashPassword(password)

      // Buscar usuario na tabela users
      const { data: user, error: dbError } = await supabase
        .from('users')
        .select('id, email, full_name, role, is_active, permissions, password_hash')
        .eq('email', email.toLowerCase().trim())
        .single()

      if (dbError || !user) {
        setError('Credenciais de login inválidas')
        return
      }

      // Verificar se o usuario esta ativo
      if (!user.is_active) {
        setError('Usuário desativado. Contate o administrador.')
        return
      }

      // Verificar a senha
      if (user.password_hash !== password_hash) {
        setError('Credenciais de login inválidas')
        return
      }

      // Login bem-sucedido - salvar sessao no localStorage
      const sessionData = {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        permissions: user.permissions,
        logged_in_at: new Date().toISOString()
      }
      localStorage.setItem('somma_session', JSON.stringify(sessionData))
      
      // Redirecionar para a pagina principal
      router.push('/')
    } catch (err) {
      console.error('[v0] Login exception:', err)
      setError('Erro ao realizar login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form 
      onSubmit={handleLogin}
      className={`flex flex-col gap-4 w-full ${className || ''}`} 
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-2 text-center mb-4">
          <img 
            src="/logo-somma.svg" 
            alt="Somma Logo" 
            className="h-20 sm:h-24 w-auto"
          />
          <p className="text-xs sm:text-sm text-neutral-400">
            SSG - Sistema Somma de Gestão
          </p>
        </div>

        {error && (
          <div className="p-2 bg-red-500/20 border border-red-500/30 rounded text-red-400 text-xs sm:text-sm">
            {error}
          </div>
        )}

        <Field>
          <FieldLabel htmlFor="email" className="text-white text-xs sm:text-sm">Email</FieldLabel>
          <Input 
            id="email" 
            type="email" 
            placeholder="seu@email.com" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className="bg-neutral-800 border-neutral-700 text-white placeholder-neutral-500 text-xs sm:text-sm py-2"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="password" className="text-white text-xs sm:text-sm">Senha</FieldLabel>
          <Input 
            id="password" 
            type="password"
            placeholder="Sua senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            className="bg-neutral-800 border-neutral-700 text-white placeholder-neutral-500 text-xs sm:text-sm py-2"
          />
        </Field>

        <Button 
          type="submit"
          disabled={loading}
          className="bg-black hover:bg-neutral-900 text-white font-bold tracking-wider mt-2 text-xs sm:text-sm py-2"
        >
          {loading ? 'Entrando...' : 'ACESSAR SISTEMA'}
        </Button>
      </FieldGroup>
    </form>
  )
}
