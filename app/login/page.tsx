'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { LoginForm } from '@/components/login-form'
import { apiFetch } from '@/lib/api-client'
import { PageLoading } from '@/components/ui/page-loading'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await apiFetch('/api/auth/me')
        if (res.ok) {
          const from = searchParams.get('from')
          router.replace(from && from.startsWith('/') ? from : '/')
          return
        }
      } catch {
        // Sem sessão — exibe login
      }
      setLoading(false)
    }
    checkAuth()
  }, [router, searchParams])

  if (loading) {
    return (
      <div className="h-screen w-screen" style={{ backgroundColor: '#fb4c00' }}>
        <div className="text-center pt-[40vh]">
          <h1 className="text-2xl font-bold text-white tracking-wider mb-6">SOMMA</h1>
        </div>
        <PageLoading
          label="Verificando sessão..."
          fullScreen
          className="text-white [&_span]:text-white/80 h-auto min-h-0"
        />
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ backgroundColor: '#fb4c00' }}>
      <div className="flex-1 lg:hidden flex flex-col justify-between p-4 sm:p-6">
        <div className="flex-1 flex items-center justify-center">
          <LoginForm redirectTo={searchParams.get('from') || '/'} />
        </div>
        <div className="pb-4 text-center">
          <p className="text-xs text-neutral-500">© 2025 Somma Assessoria</p>
        </div>
      </div>

      <div className="hidden lg:grid lg:grid-cols-2 w-full">
        <div className="flex flex-col justify-start items-center pt-12 p-10" style={{ backgroundColor: '#fb4c00' }}>
          <div className="w-full max-w-sm">
            <LoginForm redirectTo={searchParams.get('from') || '/'} />
          </div>
        </div>
        <div className="relative flex items-center justify-center bg-gradient-to-b from-neutral-900 to-black border-l border-neutral-800 overflow-hidden">
          <img
            src="https://cdn.shopify.com/s/files/1/0788/1932/8253/files/PDCSK21FEV-1910.jpg?v=1771862994"
            alt="Somma Assessoria de Corrida"
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-screen" style={{ backgroundColor: '#fb4c00' }}>
        <PageLoading
          label="Carregando..."
          fullScreen
          className="text-white [&_span]:text-white/80"
        />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
