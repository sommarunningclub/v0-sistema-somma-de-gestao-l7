'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Drawer as DrawerPrimitive } from 'vaul'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/components/ui/use-mobile'

/**
 * Modal responsivo — uma única API para os dois formatos.
 *
 * No desktop é um diálogo centrado; no celular vira bottom sheet arrastável,
 * que é o padrão nativo do iOS e mantém o conteúdo ao alcance do polegar.
 * Ambos os caminhos usam primitivas acessíveis (Radix/Vaul): foco preso,
 * fechamento por ESC, `aria-modal` e restauração de foco ao fechar — tudo que
 * os ~6 modais artesanais do painel não faziam.
 */

export interface ResponsiveModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  /** Rodapé fixo — ações primária/secundária. */
  footer?: React.ReactNode
  /** Largura no desktop. */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Impede fechar clicando fora (útil em formulários com alterações). */
  dismissible?: boolean
  className?: string
}

const SIZE: Record<NonNullable<ResponsiveModalProps['size']>, string> = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
}

export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  dismissible = true,
  className,
}: ResponsiveModalProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <DrawerPrimitive.Root
        open={open}
        onOpenChange={onOpenChange}
        dismissible={dismissible}
        shouldScaleBackground
      >
        <DrawerPrimitive.Portal>
          <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px]" />
          {/*
            Sem `aria-labelledby`/`id` manuais: o Radix (por baixo do Vaul) já
            liga Content↔Title sozinho, e sobrescrever isso derruba a checagem
            interna dele — o console acusava "DialogContent requires a
            DialogTitle" mesmo com o título presente e corretamente associado.
          */}
          <DrawerPrimitive.Content
            className={cn(
              'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-2xl border-t border-line bg-surface shadow-sheet',
              className,
            )}
          >
            {/* pega para arrastar */}
            <div className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-line-strong" aria-hidden="true" />

            {/*
              Cabeçalho fixo: numa sheet alta o usuário perde a referência do
              que está preenchendo ao rolar. Ele fica colado no topo.
            */}
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line-soft bg-surface px-5 pb-3 pt-2">
              <div className="min-w-0">
                <DrawerPrimitive.Title className="truncate text-[1.0625rem] font-semibold tracking-tight text-ink-strong">
                  {title}
                </DrawerPrimitive.Title>
                {description ? (
                  <DrawerPrimitive.Description className="mt-0.5 line-clamp-2 text-meta text-ink-muted">
                    {description}
                  </DrawerPrimitive.Description>
                ) : (
                  // O Radix avisa quando não há descrição; dizemos que é intencional.
                  <DrawerPrimitive.Description className="sr-only">
                    {typeof title === 'string' ? title : 'Formulário'}
                  </DrawerPrimitive.Description>
                )}
              </div>
              {dismissible ? (
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="ds-tap -mr-2 -mt-1 flex items-center justify-center rounded-lg text-ink-muted transition-colors active:bg-surface-hover"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              ) : null}
            </div>

            <div className="scroll-touch min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

            {/*
              Rodapé: a ação principal ocupa a largura toda e o cancelar é um
              botão de texto. Dois blocos de peso igual empilhados faziam o
              usuário ter que ler para saber qual era qual.
            */}
            {footer ? (
              <div className="shrink-0 border-t border-line bg-surface px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
                <div
                  className={cn(
                    'flex flex-col gap-1 [&>button]:w-full',
                    // A ação principal (último elemento) fica embaixo, ao alcance
                    // do polegar. As secundárias perdem a moldura e viram botão de
                    // texto — dois blocos de peso igual obrigavam a ler para
                    // descobrir qual era qual.
                    '[&>button:not(:last-child)]:border-transparent [&>button:not(:last-child)]:bg-transparent [&>button:not(:last-child)]:text-ink-muted',
                  )}
                >
                  {footer}
                </div>
              </div>
            ) : (
              <div className="pb-[env(safe-area-inset-bottom)]" />
            )}
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Portal>
      </DrawerPrimitive.Root>
    )
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          onPointerDownOutside={(e) => {
            if (!dismissible) e.preventDefault()
          }}
          onEscapeKeyDown={(e) => {
            if (!dismissible) e.preventDefault()
          }}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col',
            'rounded-2xl border border-line bg-surface shadow-overlay',
            'data-[state=open]:animate-dialog-in',
            SIZE[size],
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-base font-semibold text-ink-strong">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-meta text-ink-muted">
                  {description}
                </DialogPrimitive.Description>
              ) : (
                // Sem descrição o Radix reclama de `aria-describedby`; assumimos
                // a escolha explicitamente em vez de deixar o aviso no console.
                <DialogPrimitive.Description className="sr-only">
                  {typeof title === 'string' ? title : 'Formulário'}
                </DialogPrimitive.Description>
              )}
            </div>
            {dismissible ? (
              <DialogPrimitive.Close
                className="-mr-1.5 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink-strong"
                aria-label="Fechar"
              >
                <X className="h-4.5 w-4.5" />
              </DialogPrimitive.Close>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>

          {footer ? (
            <div className="shrink-0 border-t border-line px-6 py-4">
              <div className="flex items-center justify-end gap-2">{footer}</div>
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
