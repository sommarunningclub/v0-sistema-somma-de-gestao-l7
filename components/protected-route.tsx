'use client'

import React from "react"

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
    const checkAuth = () => {
      // Verificar sessao no localStorage
      const sessionStr = localStorage.getItem('somma_session')
      
      if (!sessionStr) {
        router.push('/login')
        return
      }

      try {
        const session: SessionData = JSON.parse(sessionStr)
        
        // Verificar se a sessao tem os dados necessarios
        if (!session.id || !session.email) {
          localStorage.removeItem('somma_session')
          router.push('/login')
          return
        }

        // Sessao valida
        setIsAuthenticated(true)
      } catch {
        // Sessao invalida
        localStorage.removeItem('somma_session')
        router.push('/login')
      }
    }

    checkAuth()

    // Escutar mudancas no localStorage (logout em outra aba)
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
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white tracking-wider mb-4">SOMMA CLUB</h1>
          <p className="text-neutral-400">Carregando...</p>
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
export function logout() {
  localStorage.removeItem('somma_session')
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
