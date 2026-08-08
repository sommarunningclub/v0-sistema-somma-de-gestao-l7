'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { useEstadoVazioAssumiuAcao } from './primary-action'

/**
 * Portal para o `body`.
 *
 * Elementos `position: fixed` não podem depender da pureza dos ancestrais:
 * qualquer `transform`, `filter`, `backdrop-filter` ou `contain` no caminho
 * cria um contexto de contenção e o "fixo" passa a se ancorar nesse ancestral
 * em vez da viewport. Foi o que aconteceu quando a animação de troca de módulo
 * (que usa `transform`) começou a envolver o conteúdo: o FAB ancorou no meio da
 * tela. Portalizando, o problema não pode voltar.
 */
function PortalParaBody({ children }: { children: React.ReactNode }) {
  const [montado, setMontado] = React.useState(false)
  React.useEffect(() => setMontado(true), [])
  if (!montado) return null
  return createPortal(children, document.body)
}

/**
 * Cabeçalho contextual de módulo.
 *
 * Responde "onde estou" (eyebrow + título), "o que é isto" (descrição) e "qual
 * é a próxima ação" (`primaryAction`).
 *
 * No celular ele é deliberadamente enxuto: o nome do módulo já aparece no
 * cabeçalho do shell e a descrição longa empurrava o conteúdo para fora da tela
 * — em Pop-ups, o bloco de título ocupava mais da metade de um iPhone antes de
 * mostrar o primeiro dado. Sobram só os metadados e a toolbar; a ação principal
 * migra para um FAB ao alcance do polegar.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  primaryAction,
  actions,
  meta,
  children,
  sticky = true,
  className,
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  /** Ação principal: botão no desktop, FAB no celular. */
  primaryAction?: React.ReactNode
  /** Ações secundárias. */
  actions?: React.ReactNode
  /** Linha de metadados/contagens. */
  meta?: React.ReactNode
  /** Conteúdo extra: tabs, toolbar de filtros. */
  children?: React.ReactNode
  sticky?: boolean
  className?: string
}) {
  const estadoVazioAssumiu = useEstadoVazioAssumiuAcao()

  return (
    <>
      <div
        className={cn(
          'z-20 -mx-4 mb-4 border-b border-line bg-canvas/85 px-4 pb-3 pt-3 backdrop-blur-md',
          'sm:-mx-6 sm:px-6 lg:-mx-8 lg:mb-5 lg:px-8 lg:pb-4 lg:pt-4',
          sticky && 'sticky top-0',
          className,
        )}
      >
        {/* O heading continua no DOM para a página não ficar sem <h1>. */}
        <h1 className="sr-only lg:hidden">{title}</h1>

        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="hidden min-w-0 flex-1 lg:block">
            {eyebrow ? <div className="mb-1 ds-eyebrow text-brand">{eyebrow}</div> : null}
            <h1 className="truncate text-2xl font-semibold tracking-tight text-ink-strong">
              {title}
            </h1>
            {description ? (
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-muted">{description}</p>
            ) : null}
            {meta ? (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-ink-muted">
                {meta}
              </div>
            ) : null}
          </div>

          {meta ? (
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-meta text-ink-muted lg:hidden">
              {meta}
            </div>
          ) : null}

          {actions || primaryAction ? (
            <div className="flex shrink-0 items-center gap-2">
              {actions}
              {/* Duas ações laranja na mesma tela competiam; no celular fica só o FAB. */}
              {primaryAction ? (
                <span className="hidden lg:inline-flex">{primaryAction}</span>
              ) : null}
            </div>
          ) : null}
        </div>

        {children ? <div className="mt-3 lg:mt-4">{children}</div> : null}
      </div>

      {/*
        FAB — a mesma ação principal, reposicionada. Vive fora do cabeçalho de
        propósito: `backdrop-blur` cria contexto de contenção e um `position:
        fixed` lá dentro passaria a se ancorar no cabeçalho, não na viewport.
        O botão recebido é remodelado em pílula, então cada módulo segue
        passando um `<Button>` comum sem conhecer o FAB.
      */}
      {primaryAction && !estadoVazioAssumiu ? (
        <PortalParaBody>
          <div
            className={cn(
              'fixed right-4 z-30 lg:hidden',
              'bottom-[calc(theme(spacing.tabbar)+env(safe-area-inset-bottom,0px)+0.75rem)]',
              '[&>button]:h-14 [&>button]:rounded-full [&>button]:px-5 [&>button]:text-[0.9375rem]',
              '[&>button]:shadow-[0_10px_28px_-8px_rgba(0,0,0,0.75),0_2px_10px_-2px_rgba(255,44,4,0.4)]',
              '[&_svg]:size-5',
            )}
          >
            {primaryAction}
          </div>
        </PortalParaBody>
      ) : null}
    </>
  )
}

/** Container padrão de conteúdo de módulo. Garante respiro e safe areas. */
export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[1600px] px-4 pb-24 sm:px-6 lg:px-8 lg:pb-10',
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * Barra de ações fixa no rodapé (mobile). Fica acima da tab bar e respeita a
 * safe area do iPhone.
 */
export function MobileActionBar({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <PortalParaBody>
      <div
        className={cn(
          'fixed inset-x-0 bottom-[calc(theme(spacing.tabbar)+env(safe-area-inset-bottom,0px))] z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur-md lg:hidden',
          className,
        )}
      >
        <div className="flex items-center gap-2">{children}</div>
      </div>
    </PortalParaBody>
  )
}
