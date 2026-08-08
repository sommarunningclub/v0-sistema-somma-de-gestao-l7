'use client'

import * as React from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useIsMobile } from '@/components/ui/use-mobile'
import { cn } from '@/lib/utils'

/**
 * Barra de busca e filtros das listagens.
 *
 * Um só padrão para todos os módulos: campo de busca à esquerda, filtros à
 * direita, chips do que está aplicado logo abaixo. No celular os filtros vão
 * para um botão que abre um painel deslizante, em vez de empilhar controles e
 * empurrar a lista para fora da tela.
 */

export function Toolbar({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
  )
}

export interface SearchInputProps
  extends Omit<React.ComponentProps<'input'>, 'onChange' | 'value'> {
  value: string
  onValueChange: (value: string) => void
  label?: string
  /**
   * Placeholder curto para o celular. Um texto como "Buscar por empresa, CNPJ
   * ou responsável..." não cabe em 390px e era cortado no meio de uma palavra
   * ("Buscar por r"), o que confunde mais do que ajuda. O texto completo
   * continua no desktop e o `label` acessível não muda.
   */
  placeholderShort?: string
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onValueChange,
      placeholder = 'Buscar...',
      placeholderShort = 'Buscar',
      label = 'Buscar',
      className,
      ...props
    },
    ref,
  ) => {
    const id = React.useId()
    const isMobile = useIsMobile()

    // `basis-full` no celular: dividindo a linha com o alternador de visão ou o
    // botão de filtros, o campo ficava com ~200px e o placeholder era cortado no
    // meio da palavra. Ocupando a linha inteira, os irmãos descem para a linha
    // seguinte (o `Toolbar` é `flex-wrap`).
    return (
      <div className={cn('relative min-w-0 flex-1 basis-full sm:basis-auto sm:max-w-sm', className)}>
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
        />
        <input
          ref={ref}
          id={id}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder={isMobile ? placeholderShort : placeholder}
          className={cn(
            'h-11 w-full rounded-lg border border-line bg-surface-sunken pl-10 pr-10 text-base text-ink lg:h-10',
            'transition-colors placeholder:text-ink-subtle hover:border-line-strong',
            'focus-visible:border-brand focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand',
            '[&::-webkit-search-cancel-button]:hidden',
          )}
          {...props}
        />
        {value ? (
          <button
            type="button"
            onClick={() => onValueChange('')}
            aria-label="Limpar busca"
            className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    )
  },
)
SearchInput.displayName = 'SearchInput'

/** Botão de filtros com contador do que está aplicado. */
export function FilterButton({
  count = 0,
  onClick,
  className,
}: {
  count?: number
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={count > 0 ? `Filtros (${count} aplicados)` : 'Filtros'}
      className={cn(
        'ds-tap inline-flex items-center gap-2 rounded-lg border px-3.5 text-sm font-medium transition-colors lg:h-10 lg:min-h-0',
        count > 0
          ? 'border-brand-border bg-brand-soft text-brand-strong'
          : 'border-line bg-surface-raised text-ink hover:border-line-strong hover:text-ink-strong',
        className,
      )}
    >
      <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
      <span>Filtros</span>
      {count > 0 ? (
        <span className="ml-0.5 rounded-full bg-brand px-1.5 text-[0.6875rem] font-bold leading-[1.125rem] text-white">
          {count}
        </span>
      ) : null}
    </button>
  )
}

/** Chip de filtro aplicado, removível. */
export function FilterChip({
  label,
  value,
  onRemove,
}: {
  label: string
  value: React.ReactNode
  onRemove: () => void
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-hover py-1 pl-3 pr-1 text-xs text-ink">
      <span className="text-ink-muted">{label}:</span>
      <span className="font-medium text-ink-strong">{value}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remover filtro ${label}`}
        className="flex h-5 w-5 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-surface-active hover:text-ink-strong"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

/** Alternador segmentado (visão em tabela/cards, período, etc.). */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: Array<{
    value: T
    label: string
    /** Versão curta para o celular. Sem ela, o rótulo é omitido e sobra o ícone. */
    shortLabel?: string
    icon?: React.ElementType
  }>
  label: string
  className?: string
}) {
  const todasComIcone = options.every((option) => Boolean(option.icon))
  // Só vira icônico no celular se NENHUMA opção precisar de rótulo curto —
  // ícones parecidos (dois calendários, por exemplo) ficam indistinguíveis sem
  // texto, e isso é justamente o que a regra de não depender só de ícone evita.
  const iconicoNoMobile = todasComIcone && options.every((option) => !option.shortLabel)

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-line bg-surface-sunken p-0.5',
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value
        const Icon = option.icon
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            aria-label={iconicoNoMobile ? option.label : undefined}
            className={cn(
              'inline-flex h-9 items-center justify-center gap-1.5 rounded-md text-[0.8125rem] font-medium transition-colors',
              // Com ícone, o rótulo só aparece a partir de `sm`: três opções
              // rotuladas ("Kanban / Mês / Semana") consumiam a linha inteira e
              // esmagavam o campo de busca ao lado até virar só uma lupa.
              iconicoNoMobile ? 'w-10 px-0 sm:w-auto sm:px-3' : 'px-2.5 sm:px-3',
              selected
                ? 'bg-surface-active text-ink-strong shadow-card'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
            {iconicoNoMobile ? (
              <span className="hidden sm:inline">{option.label}</span>
            ) : option.shortLabel ? (
              <>
                <span className="sm:hidden">{option.shortLabel}</span>
                <span className="hidden sm:inline">{option.label}</span>
              </>
            ) : (
              <span>{option.label}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
