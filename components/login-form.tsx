'use client'

import React from 'react'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Copy, Eye, EyeOff, ShieldCheck, Smartphone } from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import { ErrorBanner } from '@/components/ui/error-banner'
import { cn } from '@/lib/utils'

/**
 * Login do painel em duas etapas.
 *
 *   1. e-mail + senha (POST /api/auth/login) — não abre sessão; devolve qual
 *      segunda etapa falta e grava um cookie curto de "etapa pendente";
 *   2a. 'cadastro': a conta ainda não tem Google Authenticator. A tela mostra o
 *       QR code (POST /api/auth/mfa/setup) e pede o primeiro código;
 *   2b. 'codigo': pede o código de 6 dígitos do app.
 *
 * Só depois do código certo (POST /api/auth/mfa/verify) existe sessão.
 */

type Etapa = 'credenciais' | 'cadastro' | 'codigo'

type Cadastro = { qr: string; segredo: string; conta: string }

type UsuarioLogado = {
  id: string
  email: string
  full_name: string
  role: string
  permissions: unknown
}

export function LoginForm({
  className,
  redirectTo = '/',
  ...props
}: React.ComponentProps<'form'> & { redirectTo?: string }) {
  const router = useRouter()
  const [etapa, setEtapa] = useState<Etapa>('credenciais')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [cadastro, setCadastro] = useState<Cadastro | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const codigoRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (etapa !== 'credenciais') codigoRef.current?.focus()
  }, [etapa, cadastro])

  function voltarAoInicio(mensagem: string | null = null) {
    setEtapa('credenciais')
    setCadastro(null)
    setCodigo('')
    setPassword('')
    setError(mensagem)
  }

  async function prepararCadastro() {
    const res = await apiFetch('/api/auth/mfa/setup', { method: 'POST' })
    const data = (await res.json().catch(() => ({}))) as Partial<Cadastro> & { error?: string }
    if (!res.ok || !data.qr || !data.segredo) {
      voltarAoInicio(data.error || 'Não foi possível preparar o Google Authenticator.')
      return
    }
    setCadastro({ qr: data.qr, segredo: data.segredo, conta: data.conta ?? email })
    setEtapa('cadastro')
  }

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

      if (data.mfa === 'cadastro') {
        await prepararCadastro()
      } else {
        setEtapa('codigo')
      }
    } catch (err) {
      console.error('[login] exception:', err)
      setError('Erro ao realizar login')
    } finally {
      setLoading(false)
    }
  }

  const handleCodigo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (codigo.length !== 6) {
      setError('Digite os 6 dígitos do Google Authenticator.')
      return
    }
    setLoading(true)
    setError(null)

    try {
      const res = await apiFetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo }),
      })
      const data = (await res.json().catch(() => ({}))) as Partial<UsuarioLogado> & {
        error?: string
        code?: string
      }

      if (!res.ok) {
        if (data.code === 'expirado') {
          voltarAoInicio(data.error ?? 'Sessão de login expirada. Entre de novo.')
          return
        }
        setError(data.error || 'Código inválido.')
        setCodigo('')
        return
      }

      localStorage.setItem(
        'somma_session',
        JSON.stringify({
          id: data.id,
          email: data.email,
          full_name: data.full_name,
          role: data.role,
          permissions: data.permissions,
          logged_in_at: new Date().toISOString(),
        })
      )

      // Só caminho interno: `//host` e `/\host` também começam com '/' e o
      // router os trata como URL absoluta, virando redirect aberto.
      const interno = /^\/(?![/\\])/.test(redirectTo)
      router.push(interno ? redirectTo : '/')
    } catch (err) {
      console.error('[login] mfa exception:', err)
      setError('Erro ao conferir o código')
    } finally {
      setLoading(false)
    }
  }

  async function copiarSegredo() {
    if (!cadastro) return
    try {
      await navigator.clipboard.writeText(cadastro.segredo.replace(/\s/g, ''))
    } catch {
      /* sem permissão de área de transferência: a chave segue visível na tela */
    }
  }

  if (etapa === 'credenciais') {
    return (
      <form onSubmit={handleLogin} className={cn('flex w-full flex-col gap-5', className)} {...props}>
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

  return (
    <form onSubmit={handleCodigo} className={cn('flex w-full flex-col gap-5', className)} {...props}>
      {etapa === 'cadastro' && cadastro ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-ink-strong">Ative o Google Authenticator</p>
              <p className="text-sm text-ink-muted">
                A partir de agora o painel pede um código do celular a cada login. Instale o Google
                Authenticator, toque em <strong>+</strong> e escolha <strong>Ler código QR</strong>.
              </p>
            </div>
          </div>

          <div className="flex justify-center rounded-lg border border-line bg-white p-3">
            <img
              src={cadastro.qr}
              alt={`QR code do Google Authenticator para ${cadastro.conta}`}
              width={200}
              height={200}
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-ink-muted">Não consegue ler o QR? Digite esta chave no app:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 select-all break-all rounded border border-line bg-surface-sunken px-2 py-1.5 font-mono text-xs tracking-wider text-ink-strong">
                {cadastro.segredo}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => void copiarSegredo()}
                aria-label="Copiar a chave"
              >
                <Copy aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-ink-strong">Verificação em duas etapas</p>
            <p className="text-sm text-ink-muted">
              Abra o Google Authenticator e digite o código de 6 dígitos do Somma Club.
            </p>
          </div>
        </div>
      )}

      {error && <ErrorBanner message={error} />}

      <div className="space-y-2">
        <Label htmlFor="codigo-2fa">
          {etapa === 'cadastro' ? 'Código que apareceu no app' : 'Código do Google Authenticator'}
        </Label>
        <Input
          ref={codigoRef}
          id="codigo-2fa"
          name="codigo"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          placeholder="000000"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
          required
          disabled={loading}
          aria-invalid={error ? true : undefined}
          className="text-center font-mono text-lg tracking-[0.4em]"
        />
      </div>

      <Button type="submit" size="lg" block loading={loading}>
        {loading ? 'Conferindo...' : etapa === 'cadastro' ? 'Ativar e entrar' : 'Entrar'}
      </Button>

      <button
        type="button"
        onClick={() => voltarAoInicio()}
        disabled={loading}
        className="inline-flex items-center justify-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink-strong disabled:opacity-50"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Voltar e entrar com outra conta
      </button>
    </form>
  )
}
