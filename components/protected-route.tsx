'use client'

import React from "react"
import { apiFetch } from '@/lib/api-client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface SessionData {
  id: string
  email: string
  full_name: string
  role: string
  permissions: Record<string, boolean> | null
  logged_in_at: string
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await apiFetch('/api/auth/me')

        if (res.ok) {
          const fresh = await res.json()
          const sessionStr = localStorage.getItem('somma_session')
          const existing = sessionStr ? JSON.parse(sessionStr) as SessionData : null
          const updatedSession: SessionData = {
            id: fresh.id,
            email: fresh.email,
            role: fresh.role,
            permissions: fresh.permissions,
            full_name: fresh.full_name,
            logged_in_at: existing?.logged_in_at || new Date().toISOString(),
          }
          localStorage.setItem('somma_session', JSON.stringify(updatedSession))
          setIsAuthenticated(true)
          return
        }

        if (res.status === 401 || res.status === 403 || res.status === 404) {
          localStorage.removeItem('somma_session')
          router.push('/login')
          return
        }

        // Falha de rede: fallback para cache local
        const sessionStr = localStorage.getItem('somma_session')
        if (sessionStr) {
          const session: SessionData = JSON.parse(sessionStr)
          if (session.id && session.email) {
            setIsAuthenticated(true)
            return
          }
        }

        router.push('/login')
      } catch {
        const sessionStr = localStorage.getItem('somma_session')
        if (sessionStr) {
          try {
            const session: SessionData = JSON.parse(sessionStr)
            if (session.id && session.email) {
              setIsAuthenticated(true)
              return
            }
          } catch {
            // ignore
          }
        }
        localStorage.removeItem('somma_session')
        router.push('/login')
      }
    }

    checkAuth()

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'somma_session' && !e.newValue) {
        router.push('/login')
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [router])

  if (isAuthenticated === null) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-4">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent"
            aria-hidden="true"
          />
          <p className="text-meta text-ink-muted" role="status">
            Verificando sessão...
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

// Funcao helper para obter a sessao atual
export function getSession(): SessionData | null {
  if (typeof window === 'undefined') return null
  const sessionStr = localStorage.getItem('somma_session')
  if (!sessionStr) return null
  try {
    return JSON.parse(sessionStr)
  } catch {
    return null
  }
}

// Funcao helper para fazer logout
export async function logout() {
  localStorage.removeItem('somma_session')
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' })
  } catch {
    // Ignora falha de rede — cookie será limpo no próximo login
  }
  window.location.href = '/login'
}

// Funcao helper para verificar se usuario tem permissao para um modulo
export function hasPermission(moduleKey: string): boolean {
  const session = getSession()
  if (!session) return false

  // Admin tem acesso a tudo
  if (session.role === 'admin') return true

  // Verificar permissoes
  if (!session.permissions) return false

  return session.permissions[moduleKey] === true
}

export default ProtectedRoute
