"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ShieldAlert } from "lucide-react"
import ProtectedRouteComponent, { hasPermission } from "@/components/protected-route"
import { AdminShell, EmptyState, notify } from "@/components/somma"
import { buildDashboardUrl } from "@/lib/auth/page-routes"
import { NAV_ITEMS, getNavItem } from "@/lib/nav"
import CommandCenterPage from "./command-center/page"
import AgentNetworkPage from "./agent-network/page"
import InsidersPage from "./insiders/page"
import SystemsPage from "./systems/page"
import { CheckInModule } from "@/components/modules/checkin-module"
import ParcerioSommaPage from "./parceiro/page"
import CRMPage from "./crm/page"
import { EventosModule } from "@/components/modules/eventos-module"
import EscalaPage from "./escala/page"
import PopupsPage from "./popups/page"

/**
 * O painel é uma SPA: o middleware redireciona as rotas legadas para
 * `/?section=x` e este componente monta o módulo correspondente. A navegação
 * continua refletida na URL (compartilhável e com histórico), mas sem recarga.
 */
function SommaAdmin() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [activeSection, setActiveSection] = useState("overview")
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [refreshing, setRefreshing] = useState(false)
  const [checkinEventoId, setCheckinEventoId] = useState<string | null>(null)

  useEffect(() => {
    const resolved: Record<string, boolean> = {}
    for (const item of NAV_ITEMS) {
      resolved[item.permission] = hasPermission(item.permission)
    }
    setPermissions(resolved)
  }, [])

  const navigateToSection = useCallback(
    (section: string, tab?: string) => {
      setActiveSection(section)

      const extra: Record<string, string> = {}
      searchParams.forEach((value, key) => {
        if (!["section", "tab", "error"].includes(key)) extra[key] = value
      })
      router.replace(buildDashboardUrl(section, tab, extra), { scroll: false })
    },
    [router, searchParams],
  )

  useEffect(() => {
    const section = searchParams.get("section")
    if (section) {
      setActiveSection(section)
    } else if (searchParams.toString() === "") {
      setActiveSection("overview")
    }
  }, [searchParams])

  /**
   * O middleware redireciona quem tenta acessar um módulo sem permissão e
   * marca `?error=forbidden`. Antes esse parâmetro era ignorado e o usuário
   * caía no dashboard sem explicação alguma.
   */
  useEffect(() => {
    if (searchParams.get("error") !== "forbidden") return
    notify.error("Acesso negado", {
      description: "Você não tem permissão para abrir esse módulo. Fale com um administrador.",
    })
    const next = new URLSearchParams(searchParams.toString())
    next.delete("error")
    router.replace(next.toString() ? `/?${next.toString()}` : "/", { scroll: false })
  }, [searchParams, router])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    // Recarrega mantendo a seção atual na URL.
    await new Promise((resolve) => setTimeout(resolve, 250))
    window.location.reload()
  }, [])

  const canSee = useCallback(
    (sectionId: string) => {
      const item = getNavItem(sectionId)
      if (!item) return false
      return permissions[item.permission] !== false
    },
    [permissions],
  )

  const content = useMemo(() => {
    if (!canSee(activeSection)) {
      return (
        <div className="mx-auto w-full max-w-[1600px] px-4 py-10 sm:px-6 lg:px-8">
          <EmptyState
            icon={ShieldAlert}
            title="Módulo indisponível para o seu acesso"
            description="Este módulo existe, mas o seu perfil não tem permissão para abri-lo. Um administrador pode liberar o acesso em Administração › Usuários."
          />
        </div>
      )
    }

    switch (activeSection) {
      case "overview":
        return <CommandCenterPage />
      case "checkin":
        return <CheckInModule initialEventoId={checkinEventoId} />
      case "eventos":
        return (
          <EventosModule
            onViewCheckins={(eventoId: string) => {
              setCheckinEventoId(eventoId)
              navigateToSection("checkin")
            }}
          />
        )
      case "escala":
        return <EscalaPage />
      case "agents":
        return <AgentNetworkPage />
      case "parceiro":
        return <ParcerioSommaPage />
      case "insiders":
        return <InsidersPage />
      case "crm":
        return <CRMPage />
      case "popups":
        return <PopupsPage />
      case "systems":
        return <SystemsPage />
      default:
        return <CommandCenterPage />
    }
  }, [activeSection, canSee, checkinEventoId, navigateToSection])

  return (
    <ProtectedRouteComponent>
      <AdminShell
        activeSection={activeSection}
        onNavigate={navigateToSection}
        permissions={permissions}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      >
        {content}
      </AdminShell>
    </ProtectedRouteComponent>
  )
}

function DashboardLoading() {
  return (
    <div className="flex h-[100dvh] items-center justify-center bg-canvas">
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent"
          aria-hidden="true"
        />
        <p className="text-meta text-ink-muted" role="status">
          Carregando o painel...
        </p>
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <SommaAdmin />
    </Suspense>
  )
}
