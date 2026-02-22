"use client"

import { useState, useEffect } from "react"
import { ChevronRight, ChevronDown, Monitor, Settings, Shield, Target, Users, Bell, RefreshCw, CreditCard, LogOut, CheckSquare, Briefcase, LayoutDashboard, Receipt, Ticket, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { UserProfile } from "@/components/user-profile"
import ProtectedRouteComponent from "@/components/protected-route"
import { logout, hasPermission } from "@/components/protected-route"
import CommandCenterPage from "./command-center/page"
import AgentNetworkPage from "./agent-network/page"
import IntelligencePage from "./intelligence/page"
import SystemsPage from "./systems/page"
import PagamentosPage from "./pagamentos/page"
import CheckInPage from "./checkin/page"
import ParcerioSommaPage from "./parceiro/page"
import OperationsPage from "./operations/page"

export default function TacticalDashboard() {
  const [activeSection, setActiveSection] = useState("overview")
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pagamentosOpen, setPagamentosOpen] = useState(false)
  const [pagamentosTab, setPagamentosTab] = useState("dashboard")
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})

  // Carrega permissoes quando o componente monta
  useEffect(() => {
    const loadPermissions = () => {
      const permObj: Record<string, boolean> = {
        dashboard: hasPermission('dashboard'),
        checkin: hasPermission('checkin'),
        membros: hasPermission('membros'),
        parceiro: hasPermission('parceiro'),
        carteiras: hasPermission('carteiras'),
        pagamentos: hasPermission('pagamentos'),
        admin: hasPermission('admin'),
      }
      setPermissions(permObj)
    }
    loadPermissions()
  }, [])

  const pagamentosSubItems = [
    { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { id: "clientes", icon: Users, label: "Clientes Asaas" },
    { id: "listaespera", icon: Users, label: "Lista de Espera" },
    { id: "cobrancas", icon: Receipt, label: "Cobrancas" },
    { id: "assinaturas", icon: CreditCard, label: "Assinaturas" },
    { id: "cupons", icon: Ticket, label: "Cupons" },
    { id: "sincronizacao", icon: RefreshCw, label: "Sincronizacao" },
  ]

  const handleRefresh = async () => {
    setIsRefreshing(true)
    // Pequeno delay para mostrar o feedback visual
    await new Promise(resolve => setTimeout(resolve, 500))
    window.location.reload()
  }

  const handleLogout = () => {
    logout()
  }

  // Valida se pode navegar para secao
  const canAccessSection = (sectionId: string): boolean => {
    if (sectionId === "overview") return true // Dashboard sempre disponivel
    if (sectionId === "pagamentos") return permissions.pagamentos === true
    if (sectionId === "systems") return permissions.admin === true
    return permissions[sectionId] === true
  }

  return (
    <ProtectedRouteComponent>
      <div className="flex h-screen w-screen overflow-hidden bg-black">
        {/* Mobile Sidebar - Optimized for touch */}
        <aside
          className={`${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } md:translate-x-0 w-64 md:w-64 lg:w-72 bg-neutral-900 border-r border-neutral-700 transition-transform duration-300 fixed md:relative z-40 h-screen overflow-y-auto flex flex-col`}
        >
          <div className="p-3 sm:p-4 lg:p-5 flex-1 flex flex-col min-h-screen md:min-h-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 sm:mb-8">
              <div>
                <h1 className="text-orange-500 font-bold text-lg tracking-wider">SOMMA</h1>
                <p className="text-neutral-500 text-xs">v2.1.7</p>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="md:hidden p-1 text-neutral-400 hover:text-orange-500 transition-colors active:scale-95"
                aria-label="Close menu"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation - Touch optimized */}
            <nav className="space-y-1 flex-1">
              {[
                { id: "overview", icon: Monitor, label: "DASHBOARD", permissionKey: "dashboard" },
                { id: "checkin", icon: CheckSquare, label: "CHECK-IN", permissionKey: "checkin" },
                { id: "agents", icon: Users, label: "MEMBROS", permissionKey: "membros" },
                { id: "parceiro", icon: Briefcase, label: "PARCEIRO SOMMA", permissionKey: "parceiro" },
                { id: "intelligence", icon: Target, label: "CARTEIRAS", permissionKey: "carteiras" },
              ].map((item) => {
                const hasAccess = permissions[item.permissionKey] !== false
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (hasAccess) {
                        setActiveSection(item.id)
                        setPagamentosOpen(false)
                        setSidebarOpen(false)
                      }
                    }}
                    disabled={!hasAccess}
                    className={`w-full flex items-center gap-2 sm:gap-3 px-3 py-2.5 sm:px-4 sm:py-3 rounded-lg transition-all active:scale-95 md:active:scale-100 ${
                      !hasAccess
                        ? "opacity-40 cursor-not-allowed text-neutral-600"
                        : activeSection === item.id
                        ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                        : "text-neutral-400 hover:text-white hover:bg-neutral-800"
                    }`}
                    title={!hasAccess ? "Acesso negado" : ""}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm font-medium truncate">{item.label}</span>
                  </button>
                )
              })}

              {/* Assessoria Somma com Dropdown */}
              {permissions.pagamentos && (
                <div>
                  <button
                    onClick={() => {
                      setPagamentosOpen(!pagamentosOpen)
                      if (!pagamentosOpen) {
                        setActiveSection("pagamentos")
                      }
                    }}
                    className={`w-full flex items-center gap-2 sm:gap-3 px-3 py-2.5 sm:px-4 sm:py-3 rounded-lg transition-all active:scale-95 md:active:scale-100 ${
                      activeSection === "pagamentos"
                        ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                        : "text-neutral-400 hover:text-white hover:bg-neutral-800"
                    }`}
                  >
                    <CreditCard className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm font-medium truncate flex-1 text-left">ASSESSORIA SOMMA</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${pagamentosOpen ? "rotate-180" : ""}`} />
                  </button>

                  {/* Submenu Dropdown */}
                  {pagamentosOpen && (
                    <div className="ml-3 sm:ml-4 mt-1 space-y-1 border-l border-neutral-700 pl-2 sm:pl-3">
                      {pagamentosSubItems.map((subItem) => (
                        <button
                          key={subItem.id}
                          onClick={() => {
                            setActiveSection("pagamentos")
                            setPagamentosTab(subItem.id)
                            setSidebarOpen(false)
                          }}
                          className={`w-full flex items-center gap-2 sm:gap-3 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg transition-all text-xs sm:text-sm ${
                            activeSection === "pagamentos" && pagamentosTab === subItem.id
                              ? "bg-orange-500/20 text-orange-500"
                              : "text-neutral-400 hover:text-white hover:bg-neutral-800"
                          }`}
                        >
                          <subItem.icon className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{subItem.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Admin */}
              {permissions.admin && (
                <button
                  onClick={() => {
                    setActiveSection("systems")
                    setPagamentosOpen(false)
                    setSidebarOpen(false)
                  }}
                  className={`w-full flex items-center gap-2 sm:gap-3 px-3 py-2.5 sm:px-4 sm:py-3 rounded-lg transition-all active:scale-95 md:active:scale-100 ${
                    activeSection === "systems"
                      ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-800"
                  }`}
                >
                  <Settings className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-medium truncate">ADMIN</span>
                </button>
              )}
            </nav>

            {/* System Status */}
            <div className="mt-auto pt-3 sm:pt-4 space-y-3 sm:space-y-4">
              <div className="p-3 sm:p-4 bg-neutral-800 border border-neutral-700 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-white font-bold tracking-wider">ONLINE</span>
                </div>
                <div className="text-xs text-neutral-500 space-y-1">
                  <div>STATUS: OK</div>
                  <div>{Object.values(permissions).filter(Boolean).length} MODULOS</div>
                </div>
              </div>

              {/* User Profile Section */}
              <UserProfile />
            </div>
          </div>
        </aside>

        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/70 z-30 md:hidden" 
            onClick={() => setSidebarOpen(false)}
            role="presentation"
          />
        )}

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden w-full">
          {/* Top Toolbar */}
          <header className="h-14 md:h-16 bg-neutral-800 border-b border-neutral-700 flex items-center justify-between px-3 md:px-6 gap-3">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-2 text-orange-500 hover:bg-neutral-700 rounded-lg transition-colors active:scale-95 flex-shrink-0"
              aria-label="Toggle menu"
            >
              <Monitor className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="text-xs md:text-sm text-neutral-400 truncate">
                SOMMA / <span className="text-orange-500">APP</span>
              </div>
            </div>

            <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
              {isRefreshing && (
                <span className="text-xs text-orange-500 font-medium mr-2 animate-pulse hidden md:inline">
                  Atualizando...
                </span>
              )}
              <button 
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-2 text-neutral-400 hover:text-orange-500 bg-transparent disabled:opacity-50 transition-colors rounded active:scale-95 md:active:scale-100"
                aria-label="Refresh"
                title={isRefreshing ? "Atualizando..." : "Atualizar sistema"}
              >
                <RefreshCw className={`w-4 h-4 md:w-5 md:h-5 ${isRefreshing ? "animate-spin" : ""}`} />
              </button>
              <button 
                onClick={handleLogout}
                className="p-2 text-neutral-400 hover:text-red-500 bg-transparent transition-colors rounded active:scale-95 md:active:scale-100"
                aria-label="Logout"
              >
                <LogOut className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>
          </header>

          {/* Content Area - Safe area for notch */}
          <div className="flex-1 overflow-auto bg-black pb-safe-bottom md:pb-0">
            {activeSection === "overview" && <CommandCenterPage />}
            {activeSection === "checkin" && permissions.checkin && <CheckInPage />}
            {activeSection === "agents" && permissions.membros && <AgentNetworkPage />}
            {activeSection === "parceiro" && permissions.parceiro && <ParcerioSommaPage />}
            {activeSection === "intelligence" && permissions.carteiras && <IntelligencePage />}
            {activeSection === "pagamentos" && permissions.pagamentos && <PagamentosPage activeTab={pagamentosTab} />}
            {activeSection === "systems" && permissions.admin && <SystemsPage />}
          </div>
        </main>
      </div>
    </ProtectedRouteComponent>
  )
}
