'use client'

import * as React from 'react'
import { Drawer as DrawerPrimitive } from 'vaul'
import {
  ChevronLeft,
  ChevronRight,
  Grid2x2,
  Lock,
  RefreshCw,
  Search,
  WifiOff,
} from 'lucide-react'
import {
  MOBILE_PRIMARY_IDS,
  NAV_GROUPS,
  NAV_ITEMS,
  getNavItem,
  type NavItem,
} from '@/lib/nav'
import { cn } from '@/lib/utils'
import { CommandPalette } from '@/components/somma/command-palette'
import { UserMenu } from '@/components/somma/user-menu'
import { ConfirmHost } from '@/components/somma/confirm'
import { useOnlineStatus } from '@/hooks/use-online-status'

const SIDEBAR_STORAGE_KEY = 'somma_sidebar_collapsed'
const LOGO_URL =
  'https://cdn.shopify.com/s/files/1/0788/1932/8253/files/STICKER.svg?v=1771864806'

export interface AdminShellProps {
  activeSection: string
  onNavigate: (sectionId: string) => void
  permissions: Record<string, boolean>
  onRefresh?: () => void
  refreshing?: boolean
  children: React.ReactNode
}

/**
 * Estrutura global do painel.
 *
 * Desktop: sidebar agrupada e recolhível (estado persistido) + cabeçalho
 * contextual com trilha, busca global e conta.
 * Celular: cabeçalho compacto + barra inferior com os quatro módulos de uso
 * diário e um botão "Módulos" que abre a grade completa em bottom sheet —
 * o padrão de app nativo, em vez do menu lateral escondido atrás de um ícone.
 */
export function AdminShell({
  activeSection,
  onNavigate,
  permissions,
  onRefresh,
  refreshing = false,
  children,
}: AdminShellProps) {
  const [collapsed, setCollapsed] = React.useState(false)
  const [paletteOpen, setPaletteOpen] = React.useState(false)
  const [moreOpen, setMoreOpen] = React.useState(false)
  const isOnline = useOnlineStatus()

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    setCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true')
  }, [])

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed((current) => {
      const next = !current
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next))
      }
      return next
    })
  }, [])

  const allowed = React.useMemo(
    () => NAV_ITEMS.filter((item) => permissions[item.permission] !== false),
    [permissions],
  )

  const current = getNavItem(activeSection)

  /**
   * Direção da transição, derivada da posição do módulo na navegação: ir para
   * um módulo mais abaixo na lista entra pela direita, voltar entra pela
   * esquerda. Isso dá ao painel a noção de "avançar e voltar" que um app tem,
   * em vez de um corte seco a cada troca.
   *
   * `prefers-reduced-motion` desliga tudo isso globalmente em `globals.css`.
   */
  const ordemAnterior = React.useRef<number>(-1)
  const indiceAtual = NAV_ITEMS.findIndex((item) => item.id === activeSection)
  const [direcao, setDirecao] = React.useState<'forward' | 'back' | 'none'>('none')

  React.useEffect(() => {
    const anterior = ordemAnterior.current
    if (anterior === -1 || indiceAtual === -1) setDirecao('none')
    else if (indiceAtual > anterior) setDirecao('forward')
    else if (indiceAtual < anterior) setDirecao('back')
    ordemAnterior.current = indiceAtual
  }, [indiceAtual])

  const classeTransicao =
    direcao === 'forward'
      ? 'animate-module-in-forward'
      : direcao === 'back'
        ? 'animate-module-in-back'
        : 'animate-module-in'

  const navigate = React.useCallback(
    (sectionId: string) => {
      setMoreOpen(false)
      onNavigate(sectionId)
      // O conteúdo é uma região rolável própria; leva o usuário ao topo do
      // módulo novo em vez de manter a posição do módulo anterior.
      document.getElementById('main-content-scroll')?.scrollTo({ top: 0 })
    },
    [onNavigate],
  )

  const primaryMobile = React.useMemo(
    () =>
      MOBILE_PRIMARY_IDS.map((id) => allowed.find((item) => item.id === id)).filter(
        (item): item is NavItem => Boolean(item),
      ),
    [allowed],
  )

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-canvas">
      {/*
        Tarja de identificação. Empresta o vocabulário do painel de referência
        (o "UNCLASSIFIED // ..." no alto da tela): ancora o produto, informa o
        contexto operacional e é onde o laranja aparece antes de qualquer dado.
      */}
      <div className="ds-strip pt-safe">
        <span>Somma Club</span>
        {/* Em chaves: solto no JSX, `//` é lido como início de comentário. */}
        <span aria-hidden="true" className="text-brand/40">
          {'//'}
        </span>
        <span className="truncate">Painel Operacional</span>
        <span className="ml-auto flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              isOnline ? 'bg-success' : 'bg-warning',
            )}
          />
          <span className={isOnline ? 'text-success' : 'text-warning'}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </span>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* ---------------- Sidebar (desktop) ---------------- */}
      <aside
        aria-label="Navegação principal"
        className={cn(
          'hidden shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 ease-somma lg:flex',
          collapsed ? 'w-[4.5rem]' : 'w-[15.5rem]',
        )}
      >
        <div
          className={cn(
            'flex h-header shrink-0 items-center border-b border-line',
            collapsed ? 'justify-center px-2' : 'justify-between px-4',
          )}
        >
          {!collapsed ? (
            <img src={LOGO_URL} alt="Somma Club" className="h-7 w-auto" />
          ) : (
            <img src={LOGO_URL} alt="Somma Club" className="h-6 w-auto" />
          )}
          {!collapsed ? (
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Recolher menu"
              title="Recolher menu"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
          {NAV_GROUPS.map((group) => {
            const items = NAV_ITEMS.filter((item) => item.group === group.id)
            if (items.length === 0) return null

            return (
              <div key={group.id} className="mb-1.5">
                {group.label && !collapsed ? (
                  <p className="px-2.5 pb-1.5 pt-3 ds-eyebrow text-brand">{group.label}</p>
                ) : group.label ? (
                  <div className="mx-2.5 my-3 h-px bg-line" aria-hidden="true" />
                ) : null}

                <ul className="space-y-0.5">
                  {items.map((item) => (
                    <li key={item.id}>
                      <SidebarLink
                        item={item}
                        active={activeSection === item.id}
                        allowed={permissions[item.permission] !== false}
                        collapsed={collapsed}
                        onSelect={() => navigate(item.id)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </nav>

        <div className={cn('shrink-0 border-t border-line p-2.5', collapsed && 'px-2')}>
          {collapsed ? (
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Expandir menu"
              title="Expandir menu"
              className="mb-2 flex h-9 w-full items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : null}
          <UserMenu variant="sidebar" collapsed={collapsed} />
        </div>
      </aside>

      {/* ---------------- Coluna principal ---------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        {!isOnline ? (
          <div
            role="status"
            className="flex shrink-0 items-center justify-center gap-2 bg-warning-soft px-4 py-2 text-meta font-medium text-warning"
          >
            <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
            Sem conexão — as alterações não serão salvas até você voltar a ficar online.
          </div>
        ) : null}

        {/* Cabeçalho */}
        <header className="flex h-header shrink-0 items-center gap-2 border-b border-line bg-surface px-3 sm:px-4 lg:px-6">
          {/* mobile: logo */}
          <img src={LOGO_URL} alt="Somma Club" className="h-6 w-auto shrink-0 lg:hidden" />

          {/* desktop: trilha de navegação */}
          <nav aria-label="Trilha de navegação" className="hidden min-w-0 items-center gap-1.5 lg:flex">
            <span className="text-meta text-ink-subtle">Somma</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-disabled" aria-hidden="true" />
            <span aria-current="page" className="truncate text-meta font-medium text-ink-strong">
              {current?.label ?? 'Painel'}
            </span>
          </nav>

          {/*
            Mobile: rótulo do módulo. É deliberadamente um <p>, não um <h1> —
            o título real da página vem do `PageHeader` de cada módulo, e dois
            <h1> na mesma página quebrariam a hierarquia para leitores de tela.
          */}
          <p className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold text-ink-strong lg:hidden">
            {current?.label ?? 'Painel'}
          </p>

          <div className="hidden flex-1 lg:block" />

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className={cn(
              'group hidden items-center gap-2 rounded-lg border border-line bg-surface-sunken px-3 py-2 text-meta text-ink-muted transition-colors hover:border-line-strong hover:text-ink lg:flex lg:w-64',
            )}
          >
            <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1 text-left">Buscar...</span>
            <kbd className="rounded border border-line px-1.5 font-mono text-[0.625rem] leading-4 text-ink-subtle">
              ⌘K
            </kbd>
          </button>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Buscar"
            className="ds-tap flex items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink lg:hidden"
          >
            <Search className="h-5 w-5" />
          </button>

          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Atualizar dados"
              title="Atualizar dados"
              className="ds-tap hidden items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink disabled:opacity-50 sm:flex lg:h-10 lg:min-h-0 lg:w-10"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin text-brand')} />
              <span aria-live="polite" className="sr-only">
                {refreshing ? 'Atualizando dados' : ''}
              </span>
            </button>
          ) : null}

          <div className="lg:hidden">
            <UserMenu variant="compact" />
          </div>
        </header>

        {/* Conteúdo */}
        <main
          id="main-content-scroll"
          tabIndex={-1}
          className="scroll-touch min-h-0 flex-1 overflow-y-auto overscroll-contain bg-canvas pb-[calc(theme(spacing.tabbar)+env(safe-area-inset-bottom,0px))] lg:pb-0"
        >
          {/*
            A `key` faz o wrapper remontar a cada troca de módulo, o que
            reinicia a animação de entrada. `will-change` só durante a
            transição seria ideal, mas a animação é curta o bastante para não
            justificar o custo de uma camada extra de composição.
          */}
          <div key={activeSection} className={classeTransicao}>
            {children}
          </div>
        </main>

        {/* ---------------- Barra inferior (mobile) ---------------- */}
        <nav
          aria-label="Navegação"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-safe backdrop-blur-md lg:hidden"
        >
          <ul className="flex items-stretch">
            {primaryMobile.map((item) => (
              <li key={item.id} className="flex-1">
                <TabBarButton
                  icon={item.icon}
                  label={item.label}
                  active={activeSection === item.id}
                  onClick={() => navigate(item.id)}
                />
              </li>
            ))}
            <li className="flex-1">
              <TabBarButton
                icon={Grid2x2}
                label="Módulos"
                active={moreOpen || !primaryMobile.some((item) => item.id === activeSection)}
                onClick={() => setMoreOpen(true)}
              />
            </li>
          </ul>
        </nav>
      </div>
      </div>

      {/* Grade completa de módulos (mobile) */}
      <ModulesSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        items={allowed}
        activeSection={activeSection}
        onSelect={navigate}
      />

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        items={allowed}
        onNavigate={navigate}
      />

      <ConfirmHost />
    </div>
  )
}

function SidebarLink({
  item,
  active,
  allowed,
  collapsed,
  onSelect,
}: {
  item: NavItem
  active: boolean
  allowed: boolean
  collapsed: boolean
  onSelect: () => void
}) {
  const Icon = allowed ? item.icon : Lock

  return (
    <button
      type="button"
      onClick={allowed ? onSelect : undefined}
      disabled={!allowed}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? item.label : !allowed ? 'Você não tem acesso a este módulo' : undefined}
      className={cn(
        'relative flex w-full items-center gap-3 rounded py-2.5 text-[0.8125rem] font-medium transition-colors duration-150',
        collapsed ? 'justify-center px-2' : 'px-2.5',
        !allowed
          ? 'cursor-not-allowed text-ink-disabled'
          : active
            // Preenchimento sólido usa `brand-fill`: o #ff2c04 puro com texto
            // branco rende 3,7:1 e reprovaria AA neste tamanho de texto.
            ? 'bg-brand-fill font-semibold text-white'
            : 'text-ink-muted hover:bg-surface-hover hover:text-ink-strong',
      )}
    >
      {/* Indicador de estado ativo que não depende só de cor */}
      {active ? (
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-brand" />
      ) : null}
      <Icon className="h-[1.125rem] w-[1.125rem] shrink-0" aria-hidden="true" />
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
      {collapsed ? <span className="sr-only">{item.label}</span> : null}
    </button>
  )
}

function TabBarButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ElementType
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex h-tabbar w-full flex-col items-center justify-center gap-1 px-1 transition-colors',
        active ? 'text-brand' : 'text-ink-muted active:text-ink',
      )}
    >
      {/* Barra superior marca a aba ativa sem depender só da cor do ícone. */}
      {active ? (
        <span aria-hidden="true" className="absolute inset-x-3 top-0 h-[2px] bg-brand" />
      ) : null}
      <Icon className="h-[1.375rem] w-[1.375rem]" aria-hidden="true" />
      <span className="max-w-full truncate text-[0.625rem] font-medium leading-none">{label}</span>
    </button>
  )
}

function ModulesSheet({
  open,
  onOpenChange,
  items,
  activeSection,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: NavItem[]
  activeSection: string
  onSelect: (id: string) => void
}) {
  return (
    <DrawerPrimitive.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground>
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] lg:hidden" />
        <DrawerPrimitive.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] rounded-t-2xl border-t border-line bg-surface shadow-sheet lg:hidden">
          <div className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-line-strong" aria-hidden="true" />
          <DrawerPrimitive.Title className="px-5 pb-1 pt-3 text-base font-semibold text-ink-strong">
            Módulos
          </DrawerPrimitive.Title>
          <DrawerPrimitive.Description className="px-5 pb-4 text-meta text-ink-muted">
            {items.length} {items.length === 1 ? 'módulo disponível' : 'módulos disponíveis'} para o
            seu acesso.
          </DrawerPrimitive.Description>

          <div className="scroll-touch max-h-[60dvh] overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="grid grid-cols-3 gap-2.5 xs:grid-cols-4">
              {items.map((item) => {
                const active = item.id === activeSection
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item.id)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-[5.25rem] flex-col items-center justify-center gap-2 rounded-xl border p-2 text-center transition-colors active:scale-[0.97]',
                      active
                        ? 'border-brand-border bg-brand-soft text-brand-strong'
                        : 'border-line bg-surface-raised text-ink active:bg-surface-hover',
                    )}
                  >
                    <item.icon className="h-6 w-6" aria-hidden="true" />
                    <span className="text-[0.6875rem] font-medium leading-tight">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  )
}
