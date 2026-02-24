"use client"

import { useState, useEffect } from "react"
import { ChevronRight, ChevronDown, Monitor, Settings, Shield, Target, Users, Bell, RefreshCw, CreditCard, LogOut, CheckSquare, Briefcase, LayoutDashboard, Receipt, Ticket, Zap, ChevronLeft, FileSignature } from "lucide-react"
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
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
    
    // Carregar preferência de sidebar colapsado
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('somma_sidebar_collapsed')
      if (saved === 'true') {
        setSidebarCollapsed(true)
      }
    }
  }, [])

  const pagamentosSubItems = [
    { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { id: "clientes", icon: Users, label: "Clientes Asaas" },
    { id: "listaespera", icon: Users, label: "Lista de Espera" },
    { id: "cobrancas", icon: Receipt, label: "Cobrancas" },
    { id: "assinaturas", icon: CreditCard, label: "Assinaturas" },
    { id: "contratos", icon: FileSignature, label: "Contratos" },
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

  const toggleSidebarCollapse = () => {
    const newState = !sidebarCollapsed
    setSidebarCollapsed(newState)
    if (typeof window !== 'undefined') {
      localStorage.setItem('somma_sidebar_collapsed', String(newState))
    }
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
        {/* Desktop/Mobile Sidebar */}
        <aside
          className={`${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } md:translate-x-0 ${
            sidebarCollapsed ? "md:w-20" : "md:w-64"
          } w-64 bg-neutral-900 border-r border-neutral-700 transition-all duration-300 fixed md:relative z-40 h-screen overflow-y-auto flex flex-col`}
        >
          <div className="p-4 flex-1 flex flex-col min-h-screen md:min-h-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div className={sidebarCollapsed ? "hidden" : ""}>
                <img 
                  src="https://cdn.shopify.com/s/files/1/0788/1932/8253/files/STICKER.svg?v=1771864806" 
                  alt="SOMMA Logo" 
                  className="h-10 w-auto mb-2"
                />
                <p className="text-neutral-500 text-xs">v2.1.12</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSidebarCollapse}
                  className="hidden md:flex p-1 text-neutral-400 hover:text-orange-500 transition-colors active:scale-95"
                  aria-label="Toggle sidebar"
                  title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
                >
                  {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="md:hidden p-1 text-neutral-400 hover:text-orange-500 transition-colors active:scale-95"
                  aria-label="Close menu"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
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
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all active:scale-95 md:active:scale-100 ${
                      !hasAccess
                        ? "opacity-40 cursor-not-allowed text-neutral-600"
                        : activeSection === item.id
                        ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                        : "text-neutral-400 hover:text-white hover:bg-neutral-800"
                    }`}
                    title={sidebarCollapsed ? item.label : !hasAccess ? "Acesso negado" : ""}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <span className={`text-sm font-medium truncate ${sidebarCollapsed ? "hidden md:hidden" : ""}`}>{item.label}</span>
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
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all active:scale-95 md:active:scale-100 ${
                      activeSection === "pagamentos"
                        ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                        : "text-neutral-400 hover:text-white hover:bg-neutral-800"
                    }`}
                    title={sidebarCollapsed ? "ASSESSORIA SOMMA" : ""}
                  >
                    <CreditCard className="w-5 h-5 flex-shrink-0" />
                    <span className={`text-sm font-medium truncate flex-1 text-left ${sidebarCollapsed ? "hidden md:hidden" : ""}`}>ASSESSORIA SOMMA</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${pagamentosOpen ? "rotate-180" : ""} ${sidebarCollapsed ? "hidden md:hidden" : ""}`} />
                  </button>

                  {/* Submenu Dropdown */}
                  {pagamentosOpen && !sidebarCollapsed && (
                    <div className="ml-4 mt-1 space-y-1 border-l border-neutral-700 pl-3">
                      {pagamentosSubItems.map((subItem) => (
                        <button
                          key={subItem.id}
                          onClick={() => {
                            setActiveSection("pagamentos")
                            setPagamentosTab(subItem.id)
                            setSidebarOpen(false)
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm ${
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
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all active:scale-95 md:active:scale-100 ${
                    activeSection === "systems"
                      ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-800"
                  }`}
                  title={sidebarCollapsed ? "ADMIN" : ""}
                >
                  <Settings className="w-5 h-5 flex-shrink-0" />
                  <span className={`text-sm font-medium truncate ${sidebarCollapsed ? "hidden md:hidden" : ""}`}>ADMIN</span>
                </button>
              )}
            </nav>

            {/* System Status */}
            <div className={`mt-auto pt-4 space-y-4 ${sidebarCollapsed ? "hidden md:hidden" : ""}`}>
              <div className="p-4 bg-neutral-800 border border-neutral-700 rounded-lg">
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
          <div className="flex-1 overflow-auto bg-black pb-20 md:pb-0">
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
