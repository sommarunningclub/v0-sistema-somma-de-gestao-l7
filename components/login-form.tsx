'use client'

import React from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff } from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import { ErrorBanner } from '@/components/ui/error-banner'
import { cn } from '@/lib/utils'

export function LoginForm({
  className,
  redirectTo = '/',
  ...props
}: React.ComponentProps<'form'> & { redirectTo?: string }) {
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
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Credenciais de login inválidas')
        return
      }

      const sessionData = {
        id: data.id,
        email: data.email,
        full_name: data.full_name,
        role: data.role,
        permissions: data.permissions,
        logged_in_at: new Date().toISOString(),
      }
      localStorage.setItem('somma_session', JSON.stringify(sessionData))

      const target = redirectTo.startsWith('/') ? redirectTo : '/'
      router.push(target)
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
      className={cn('flex w-full flex-col gap-5', className)}
      {...props}
    >
      {error && <ErrorBanner message={error} />}

      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
          aria-invalid={error ? true : undefined}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Sua senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            aria-invalid={error ? true : undefined}
            className="pr-12"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="ds-tap absolute right-0 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-lg text-ink-muted transition-colors hover:text-ink-strong"
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={showPassword}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <Button type="submit" size="lg" block loading={loading} className="mt-1">
        {loading ? 'Entrando...' : 'Acessar o sistema'}
      </Button>
    </form>
  )
}
