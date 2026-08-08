'use client'

import * as React from 'react'
import { Command } from 'cmdk'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { CornerDownLeft, Search } from 'lucide-react'
import { NAV_GROUPS, type NavItem } from '@/lib/nav'
import { cn } from '@/lib/utils'

/**
 * Busca global (⌘K / Ctrl+K).
 *
 * O painel tem onze módulos; procurar "onde ficam os cupons do parceiro"
 * exigia lembrar a categoria certa. Aqui basta digitar — os itens de navegação
 * carregam palavras-chave (`keywords`) justamente para responder a termos que
 * não aparecem no rótulo.
 */

export interface CommandAction {
  id: string
  label: string
  description?: string
  icon?: React.ElementType
  section: string
  keywords?: string[]
  onSelect: () => void
}

export function CommandPalette({
  open,
  onOpenChange,
  items,
  onNavigate,
  actions = [],
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: NavItem[]
  onNavigate: (sectionId: string) => void
  /** Ações rápidas contextuais (ex.: "Novo evento"). */
  actions?: CommandAction[]
}) {
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onOpenChange])

  const grouped = React.useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        items: items.filter((item) => item.group === group.id),
      })).filter((group) => group.items.length > 0),
    [items],
  )

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          aria-label="Busca global"
          className={
            // No celular ocupa o topo inteiro (o teclado toma a metade de
            // baixo); no desktop é a paleta centrada clássica.
            'fixed inset-x-2 top-2 z-50 overflow-hidden rounded-lg border border-line bg-surface shadow-overlay animate-fade-in ' +
            'sm:inset-x-auto sm:left-1/2 sm:top-[12vh] sm:w-[calc(100vw-2rem)] sm:max-w-xl sm:rounded-xl sm:animate-palette-in'
          }
        >
          <DialogPrimitive.Title className="sr-only">Busca global</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Digite para encontrar módulos e ações do painel.
          </DialogPrimitive.Description>

          <Command loop className="flex flex-col">
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
              <Command.Input
                autoFocus
                placeholder="Buscar módulos e ações..."
                className="h-14 w-full bg-transparent text-base text-ink outline-none placeholder:text-ink-subtle"
              />
              <kbd className="hidden shrink-0 rounded border border-line px-1.5 py-0.5 font-mono text-[0.6875rem] text-ink-subtle sm:block">
                ESC
              </kbd>
            </div>

            <Command.List className="scroll-touch max-h-[46dvh] overflow-y-auto p-2 sm:max-h-[60vh]">
              <Command.Empty className="px-3 py-8 text-center text-sm text-ink-muted">
                Nada encontrado. Tente outro termo.
              </Command.Empty>

              {actions.length > 0 ? (
                <Command.Group
                  heading="Ações rápidas"
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:ds-eyebrow"
                >
                  {actions.map((action) => (
                    <PaletteItem
                      key={action.id}
                      icon={action.icon}
                      label={action.label}
                      description={action.description}
                      keywords={action.keywords}
                      onSelect={() => {
                        onOpenChange(false)
                        action.onSelect()
                      }}
                    />
                  ))}
                </Command.Group>
              ) : null}

              {grouped.map((group) => (
                <Command.Group
                  key={group.id}
                  heading={group.label || 'Navegar'}
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:ds-eyebrow"
                >
                  {group.items.map((item) => (
                    <PaletteItem
                      key={item.id}
                      icon={item.icon}
                      label={item.label}
                      description={item.description}
                      keywords={item.keywords}
                      onSelect={() => {
                        onOpenChange(false)
                        onNavigate(item.id)
                      }}
                    />
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function PaletteItem({
  icon: Icon,
  label,
  description,
  keywords,
  onSelect,
}: {
  icon?: React.ElementType
  label: string
  description?: string
  keywords?: string[]
  onSelect: () => void
}) {
  return (
    <Command.Item
      value={`${label} ${description ?? ''} ${(keywords ?? []).join(' ')}`}
      onSelect={onSelect}
      className={cn(
        'group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm',
        'data-[selected=true]:bg-surface-hover data-[selected=true]:text-ink-strong',
      )}
    >
      {Icon ? (
        <Icon
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-ink-subtle group-data-[selected=true]:text-brand"
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">{label}</p>
        {description ? (
          <p className="truncate text-meta text-ink-muted">{description}</p>
        ) : null}
      </div>
      <CornerDownLeft
        aria-hidden="true"
        className="h-3.5 w-3.5 shrink-0 text-ink-subtle opacity-0 group-data-[selected=true]:opacity-100"
      />
    </Command.Item>
  )
}
