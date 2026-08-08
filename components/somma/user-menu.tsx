'use client'

import * as React from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronsUpDown, LogOut, Mail, UserCog } from 'lucide-react'
import { ProfileModal } from '@/components/profile-modal'
import { getSession, logout } from '@/components/protected-route'
import { apiFetch } from '@/lib/api-client'
import { cn } from '@/lib/utils'

interface UserData {
  id: string
  email: string
  full_name: string | null
  role: string | null
  created_at: string
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gerenciador',
  user: 'Usuário',
}

/** Iniciais para o avatar — no máximo duas letras, como no iOS. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function useCurrentUser() {
  const [user, setUser] = React.useState<UserData | null>(null)
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(async () => {
    try {
      const session = getSession()
      if (!session) {
        setUser(null)
        return
      }
      const res = await apiFetch('/api/auth/me')
      const data = res.ok ? await res.json().catch(() => null) : null
      setUser(
        data?.id
          ? data
          : {
              id: session.id,
              email: session.email,
              full_name: session.full_name || session.email?.split('@')[0] || 'Usuário',
              role: session.role || 'user',
              created_at: session.logged_in_at || new Date().toISOString(),
            },
      )
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  return { user, loading, reload: load }
}

export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-brand font-semibold text-white',
        size === 'sm' && 'h-7 w-7 text-[0.6875rem]',
        size === 'md' && 'h-9 w-9 text-xs',
        size === 'lg' && 'h-11 w-11 text-sm',
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  )
}

/**
 * Menu do usuário. Presente em todas as larguras — no desktop ancorado no pé
 * da sidebar, no celular no canto do cabeçalho — para que sair da conta e
 * editar o perfil estejam sempre no mesmo lugar.
 */
export function UserMenu({
  variant = 'sidebar',
  collapsed = false,
}: {
  variant?: 'sidebar' | 'compact'
  collapsed?: boolean
}) {
  const { user, loading, reload } = useCurrentUser()
  const [editing, setEditing] = React.useState(false)

  if (loading) {
    return (
      <div className={cn('ds-skeleton', variant === 'compact' ? 'h-9 w-9 rounded-full' : 'h-12 w-full rounded-lg')} />
    )
  }
  if (!user) return null

  const displayName = user.full_name?.trim() || user.email?.split('@')[0] || 'Usuário'
  const roleLabel = ROLE_LABEL[user.role ?? 'user'] ?? 'Usuário'

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          {variant === 'compact' ? (
            <button
              type="button"
              aria-label={`Conta de ${displayName}`}
              className="ds-tap flex items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-brand"
            >
              <Avatar name={displayName} size="md" />
            </button>
          ) : (
            <button
              type="button"
              aria-label={`Conta de ${displayName}`}
              className={cn(
                'group flex w-full items-center gap-2.5 rounded-lg border border-line bg-surface-raised p-2 text-left transition-colors hover:border-line-strong hover:bg-surface-hover',
                collapsed && 'justify-center border-transparent bg-transparent p-1.5',
              )}
            >
              <Avatar name={displayName} size={collapsed ? 'md' : 'md'} />
              {!collapsed ? (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.8125rem] font-semibold text-ink-strong">
                      {displayName}
                    </span>
                    <span className="block truncate text-[0.6875rem] text-ink-muted">{roleLabel}</span>
                  </span>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                </>
              ) : null}
            </button>
          )}
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            side={variant === 'compact' ? 'bottom' : 'top'}
            align={variant === 'compact' ? 'end' : 'start'}
            sideOffset={8}
            className="z-50 w-64 overflow-hidden rounded-xl border border-line bg-surface p-1.5 shadow-overlay data-[state=open]:animate-pop-in"
          >
            <div className="flex items-center gap-3 px-2.5 py-3">
              <Avatar name={displayName} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-strong">{displayName}</p>
                <p className="truncate text-meta text-ink-muted">{roleLabel}</p>
              </div>
            </div>

            <div className="mx-1 mb-1.5 flex items-center gap-2 rounded-lg bg-surface-sunken px-2.5 py-2">
              <Mail className="h-3.5 w-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
              <span className="truncate text-meta text-ink-muted">{user.email}</span>
            </div>

            <DropdownMenu.Separator className="my-1 h-px bg-line" />

            <DropdownMenu.Item
              onSelect={() => setEditing(true)}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm text-ink outline-none data-[highlighted]:bg-surface-hover data-[highlighted]:text-ink-strong"
            >
              <UserCog className="h-4 w-4 text-ink-subtle" aria-hidden="true" />
              Editar perfil
            </DropdownMenu.Item>

            <DropdownMenu.Item
              onSelect={() => logout()}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm text-danger outline-none data-[highlighted]:bg-danger-soft"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sair da conta
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {editing ? (
        <ProfileModal
          user={user}
          onClose={() => setEditing(false)}
          onSave={async () => {
            setEditing(false)
            await reload()
          }}
        />
      ) : null}
    </>
  )
}
