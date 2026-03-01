'use client'

import { useState, useMemo } from 'react'
import { MobileBottomSheet } from './mobile/mobile-bottom-sheet'
import { MobileHeader } from './mobile/mobile-header'
import { MobileNavigation } from './mobile/mobile-navigation'
import { useMobileMenu } from '@/hooks/use-mobile-menu'
import {
  ChevronRight,
  ChevronDown,
  Monitor,
  Settings,
  Shield,
  Target,
  Users,
  Bell,
  RefreshCw,
  CreditCard,
  LogOut,
  CheckSquare,
  Briefcase,
  LayoutDashboard,
  Receipt,
  Ticket,
  Zap,
  ChevronLeft,
  Star,
  X as CloseIcon,
  Link2,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

interface ResponsiveNavigationProps {
  children: React.ReactNode
  userEmail?: string
  userName?: string
}

export function ResponsiveNavigation({
  children,
  userEmail,
  userName,
}: ResponsiveNavigationProps) {
  const router = useRouter()
  const { isOpen, openMenu, closeMenu } = useMobileMenu()
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  const navSections = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      items: [
        { id: 'home', label: 'Home', icon: Monitor, href: '/' },
        { id: 'intelligence', label: 'Inteligência', icon: Zap, href: '/intelligence' },
      ],
    },
    {
      id: 'payments',
      label: 'Pagamentos',
      icon: CreditCard,
      items: [
        { id: 'clientes', label: 'Clientes', icon: Users, href: '/pagamentos/clientes' },
        { id: 'assinaturas', label: 'Assinaturas', icon: RefreshCw, href: '/pagamentos/assinaturas' },
        { id: 'cobrancas', label: 'Cobranças', icon: Receipt, href: '/pagamentos/cobrancas' },
        { id: 'insiders', label: 'Insiders', icon: Star, href: '/pagamentos/insiders' },
        { id: 'link-pagamento', label: 'Link de Pagamento', icon: Link2, href: '/pagamentos/link-pagamento' },
        { id: 'listaespera', label: 'Lista de Espera', icon: Ticket, href: '/pagamentos/listaespera' },
      ],
    },
    {
      id: 'operations',
      label: 'Operações',
      icon: Briefcase,
      items: [
        { id: 'checkin', label: 'Check-in', icon: CheckSquare, href: '/checkin' },
        { id: 'agent-network', label: 'Rede de Agentes', icon: Target, href: '/agent-network' },
        { id: 'parceiro', label: 'Parceiros', icon: Users, href: '/parceiro' },
      ],
    },
    {
      id: 'admin',
      label: 'Admin',
      icon: Shield,
      items: [
        { id: 'systems', label: 'Sistemas', icon: Settings, href: '/systems' },
        { id: 'asaas-status', label: 'Status Asaas', icon: RefreshCw, href: '/asaas-status' },
      ],
    },
  ]

  const handleNavigation = (href: string) => {
    router.push(href)
    closeMenu()
  }

  const navigationItems = navSections.flatMap((section) =>
    section.items.map((item) => ({
      id: item.id,
      label: item.label,
      icon: <item.icon className="w-5 h-5" />,
      onClick: () => handleNavigation(item.href),
    }))
  )

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-neutral-900 border-r border-neutral-800">
        <div className="p-6 border-b border-neutral-800">
          <h1 className="text-orange-500 font-bold text-2xl tracking-tight">SOMMA</h1>
          <p className="text-neutral-500 text-xs mt-1">Sistema de Gestão</p>
        </div>

        <nav className="flex-1 overflow-y-auto space-y-2 p-4">
          {navSections.map((section) => (
            <div key={section.id}>
              <button
                onClick={() =>
                  setExpandedSection(expandedSection === section.id ? null : section.id)
                }
                className="w-full flex items-center gap-2 px-3 py-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors text-sm font-medium"
              >
                <section.icon className="w-5 h-5" />
                <span className="flex-1 text-left">{section.label}</span>
                {expandedSection === section.id ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>

              {expandedSection === section.id && (
                <div className="ml-4 space-y-1 mt-1">
                  {section.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleNavigation(item.href)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors text-sm"
                    >
                      <item.icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Desktop User Info */}
        <div className="border-t border-neutral-800 p-4 space-y-2">
          <div className="px-3 py-2">
            <p className="text-white text-sm font-medium truncate">{userName || 'Usuário'}</p>
            <p className="text-neutral-500 text-xs truncate">{userEmail}</p>
          </div>
          <button className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-950 hover:text-red-300 rounded-lg transition-colors text-sm font-medium">
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <MobileHeader
        title="Somma"
        onMenuClick={openMenu}
        rightAction={
          <Bell className="w-5 h-5 text-neutral-400 md:hidden" />
        }
      />

      {/* Mobile Bottom Sheet Navigation */}
      <MobileBottomSheet
        isOpen={isOpen}
        onClose={closeMenu}
        title="Menu"
        height="full"
      >
        <MobileNavigation
          items={navigationItems}
          onLogout={() => {
            closeMenu()
            // Logout logic here
          }}
        />
      </MobileBottomSheet>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
