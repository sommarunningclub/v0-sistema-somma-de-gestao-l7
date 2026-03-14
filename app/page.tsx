"use client"

import { useState, useEffect } from "react"
import { ChevronRight, ChevronDown, Monitor, Settings, Shield, Target, Users, Bell, RefreshCw, CreditCard, LogOut, CheckSquare, Briefcase, LayoutDashboard, Receipt, Ticket, Zap, ChevronLeft, Star, X as CloseIcon, Link2, Handshake, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { UserProfile } from "@/components/user-profile"
import ProtectedRouteComponent from "@/components/protected-route"
import { logout, hasPermission } from "@/components/protected-route"
import { OfflineBanner } from "@/hooks/use-online-status"
import CommandCenterPage from "./command-center/page"
import AgentNetworkPage from "./agent-network/page"
import IntelligencePage from "./intelligence/page"
import InsidersPage from "./pagamentos/insiders/page"
import SystemsPage from "./systems/page"
import PagamentosPage from "./pagamentos/page"
import CheckInPage from "./checkin/page"
import ParcerioSommaPage from "./parceiro/page"
import OperationsPage from "./operations/page"
import CRMPage from "./crm/page"
import EventosSommaPage from "./eventos/page"

export default function TacticalDashboard() {
  const [activeSection, setActiveSection] = useState("overview")
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pagamentosOpen, setPagamentosOpen] = useState(false)
  const [pagamentosTab, setPagamentosTab] = useState("dashboard")
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [showAppsModal, setShowAppsModal] = useState(false)

  // Carrega permissoes quando o componente monta
  useEffect(() => {
    const loadPermissions = () => {
      const permObj: Record<string, boolean> = {
        dashboard: hasPermission('dashboard'),
        checkin: hasPermission('checkin'),
        membros: hasPermission('membros'),
        parceiro: hasPermission('parceiro'),
        crm: hasPermission('crm'),
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
    { id: "link-pagamento", icon: Link2, label: "Link de Pagamento" },
    { id: "insiders", icon: Star, label: "Insiders" },
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
      <OfflineBanner />
      <div className="flex h-screen w-screen bg-black">
        {/* Desktop/Mobile Sidebar */}
        <aside
          className={`${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0 ${
            sidebarCollapsed ? "lg:w-20" : "lg:w-64"
          } w-64 bg-neutral-900 border-r border-neutral-700 transition-all duration-300 fixed lg:relative z-40 h-screen max-h-screen flex flex-col`}
        >
          <div className="p-4 flex-1 flex flex-col overflow-y-auto overscroll-contain">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div className={sidebarCollapsed ? "hidden" : ""}>
                <img 
                  src="https://cdn.shopify.com/s/files/1/0788/1932/8253/files/STICKER.svg?v=1771864806" 
                  alt="SOMMA Logo" 
                  className="h-10 w-auto mb-2"
                />
                <p className="text-neutral-500 text-xs">v2.1.21</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSidebarCollapse}
                  className="hidden lg:flex p-1 text-neutral-400 hover:text-orange-500 transition-colors active:scale-95"
                  aria-label="Toggle sidebar"
                  title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
                >
                  {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="lg:hidden p-1 text-neutral-400 hover:text-orange-500 transition-colors active:scale-95"
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
                { id: "eventos", icon: Calendar, label: "EVENTOS", permissionKey: "checkin" },
                { id: "agents", icon: Users, label: "MEMBROS", permissionKey: "membros" },
                { id: "parceiro", icon: Briefcase, label: "PARCEIRO SOMMA", permissionKey: "parceiro" },
                { id: "insiders", icon: Star, label: "INSIDERS", permissionKey: "pagamentos" },
                { id: "crm", icon: Handshake, label: "CRM", permissionKey: "crm" },
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

        {/* Mobile/Tablet Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/70 z-30 lg:hidden" 
            onClick={() => setSidebarOpen(false)}
            role="presentation"
          />
        )}

        {/* APPs Modal - mobile + tablet */}
        {showAppsModal && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-end lg:hidden" onClick={() => setShowAppsModal(false)}>
            <div className="w-full bg-neutral-900 border-t border-neutral-700 rounded-t-2xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
              {/* Drag handle */}
              <div className="w-10 h-1 bg-neutral-600 rounded-full mx-auto" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-white font-bold text-base">Módulos do Sistema</h2>
                  <span className="bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none tracking-wide">NOVO</span>
                </div>
                <button onClick={() => setShowAppsModal(false)} className="text-neutral-400 hover:text-white p-1">
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 pb-2">
                {[
                  { id: "overview",      icon: Monitor,      label: "Dashboard",   permissionKey: "dashboard" },
                  { id: "checkin",       icon: CheckSquare,  label: "Check-in",    permissionKey: "checkin" },
                  { id: "eventos",      icon: Calendar,     label: "Eventos",     permissionKey: "checkin" },
                  { id: "agents",        icon: Users,        label: "Membros",     permissionKey: "membros" },
                  { id: "parceiro",      icon: Briefcase,    label: "Parceiro",    permissionKey: "parceiro" },
                  { id: "insiders",      icon: Star,         label: "Insiders",    permissionKey: "pagamentos" },
                  { id: "crm",           icon: Handshake,    label: "CRM",         permissionKey: "crm" },
                  { id: "intelligence",  icon: Target,       label: "Carteiras",   permissionKey: "carteiras" },
                  { id: "pagamentos",    icon: CreditCard,   label: "Assessoria",  permissionKey: "pagamentos" },
                  { id: "systems",       icon: Settings,     label: "Admin",       permissionKey: "admin" },
                ].filter(m => permissions[m.permissionKey] !== false).map(m => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setActiveSection(m.id)
                      setPagamentosOpen(false)
                      setShowAppsModal(false)
                      setSidebarOpen(false)
                    }}
                    className={`flex flex-col items-center gap-2.5 p-3 sm:p-4 rounded-xl border transition-all active:scale-95 ${
                      activeSection === m.id
                        ? "bg-orange-500/20 border-orange-500/60 text-orange-400"
                        : "bg-neutral-800 border-neutral-700 text-neutral-300 hover:border-neutral-500 hover:bg-neutral-750"
                    }`}
                  >
                    <m.icon className="w-6 h-6 sm:w-7 sm:h-7" />
                    <span className="text-xs font-medium text-center leading-tight">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 w-full" style={{ minHeight: 0 }}>

          {/* Top Toolbar */}
          <header className="h-14 lg:h-16 bg-neutral-800 border-b border-neutral-700 flex items-center justify-between px-3 lg:px-6 gap-3">
            {/* Mobile/Tablet Menu Button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 text-orange-500 hover:bg-neutral-700 rounded-lg transition-colors active:scale-95 flex-shrink-0"
              aria-label="Toggle menu"
            >
              <Monitor className="w-5 h-5" />
            </button>

            {/* APPs Button - mobile + tablet */}
            <button
              onClick={() => setShowAppsModal(true)}
              className="lg:hidden relative flex items-center gap-2 bg-orange-500 hover:bg-orange-600 active:scale-95 transition-all text-white font-bold text-xs tracking-widest px-3 py-2 rounded-lg shadow-lg shadow-orange-500/30 flex-shrink-0"
              aria-label="Abrir módulos"
            >
              <Shield className="w-4 h-4" />
              APPs
              <span className="absolute -top-1.5 -right-1.5 bg-white text-orange-600 text-[9px] font-black px-1 py-0 rounded-full leading-4 tracking-tight shadow">
                NOVO
              </span>
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
                className="p-2 text-neutral-400 hover:text-orange-500 bg-transparent disabled:opacity-50 transition-colors rounded active:scale-95 lg:active:scale-100"
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
          <div className="flex-1 overflow-auto bg-black">
            {activeSection === "overview" && <CommandCenterPage />}
            {activeSection === "checkin" && permissions.checkin && <CheckInPage />}
            {activeSection === "eventos" && permissions.checkin && <EventosSommaPage />}
            {activeSection === "agents" && permissions.membros && <AgentNetworkPage />}
            {activeSection === "parceiro" && permissions.parceiro && <ParcerioSommaPage />}
              {activeSection === "insiders" && permissions.pagamentos && <InsidersPage />}
            {activeSection === "crm" && permissions.crm && <CRMPage />}
              {activeSection === "intelligence" && permissions.carteiras && <IntelligencePage />}
            {activeSection === "pagamentos" && permissions.pagamentos && <PagamentosPage activeTab={pagamentosTab} />}
            {activeSection === "systems" && permissions.admin && <SystemsPage />}
          </div>
        </main>
      </div>
    </ProtectedRouteComponent>
  )
}
