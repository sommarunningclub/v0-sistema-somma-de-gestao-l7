'use client'

import React from "react"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Eye, EyeOff } from 'lucide-react'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<'form'>) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Autenticação server-side — password nunca sai do servidor
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Credenciais de login inválidas')
        return
      }

      // Salvar sessão no localStorage (sem password_hash)
      const sessionData = {
        id: data.id,
        email: data.email,
        full_name: data.full_name,
        role: data.role,
        permissions: data.permissions,
        logged_in_at: new Date().toISOString(),
      }
      localStorage.setItem('somma_session', JSON.stringify(sessionData))

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
      className={`flex flex-col gap-4 w-full items-center justify-center ${className || ''}`}
      {...props}
    >
      <div className="w-full max-w-sm flex flex-col gap-4">
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center mb-2">
            <img
              src="https://cdn.shopify.com/s/files/1/0788/1932/8253/files/Nova_Logo_Somma_Club.svg?v=1771801981"
              alt="Somma Logo"
              className="h-60 sm:h-72 w-auto"
            />
            <p className="text-xs sm:text-sm text-white">
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
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="bg-neutral-800 border-neutral-700 text-white placeholder-neutral-500 text-xs sm:text-sm py-2 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition-colors"
                aria-label={showPassword ? "Ocultar senha" : "Ver senha"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>

          <Button
            type="submit"
            disabled={loading}
            className="bg-black hover:bg-neutral-900 text-white font-bold tracking-wider mt-2 text-xs sm:text-sm py-2"
          >
            {loading ? 'Entrando...' : 'ACESSAR SISTEMA'}
          </Button>
        </FieldGroup>
      </div>
    </form>
  )
}
