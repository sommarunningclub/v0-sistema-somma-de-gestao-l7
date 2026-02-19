'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoginForm } from '@/components/login-form'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = () => {
      // Verificar sessao no localStorage
      const session = localStorage.getItem('somma_session')
      if (session) {
        router.push('/')
      }
      setLoading(false)
    }
    checkAuth()
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-black">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white tracking-wider mb-4">SOMMA</h1>
          <p className="text-neutral-400 text-sm">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen bg-black overflow-hidden">
      {/* Mobile/Tablet - Full Screen */}
      <div className="flex-1 lg:hidden flex flex-col justify-between p-4 sm:p-6">
        {/* Top Spacer */}
        <div className="flex-1 flex items-center justify-center">
          <LoginForm />
        </div>

        {/* Footer Info - Safe area for home indicator */}
        <div className="pb-4 text-center">
          <p className="text-xs text-neutral-500">
            © 2025 Somma Assessoria
          </p>
        </div>
      </div>

      {/* Desktop - Two Column */}
      <div className="hidden lg:grid lg:grid-cols-2 w-full">
        {/* Left Column - Login Form */}
        <div className="flex flex-col justify-center items-center p-10 bg-black">
          <div className="w-full max-w-sm">
            <LoginForm />
          </div>
        </div>

        {/* Right Column - Hero Image */}
        <div className="relative flex items-center justify-center bg-gradient-to-b from-neutral-900 to-black border-l border-neutral-800 overflow-hidden">
          <img 
            src="https://cdn.shopify.com/s/files/1/0788/1932/8253/files/WhatsApp_Image_2026-01-29_at_08.35.16.jpg?v=1769827835" 
            alt="Somma Assessoria de Corrida" 
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </div>
  )
}
