'use client'

import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check, Minus } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Caixa de seleção do design system.
 *
 * Para marcar itens de uma coleção (seleção de linhas, listas de opções). Para
 * ligar/desligar um estado que vale por si, use `Switch`.
 * A área clicável é ampliada para 44px por um pseudo-elemento, mantendo o
 * desenho compacto sem quebrar o mínimo de alvo de toque.
 */
const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'relative flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center rounded-[0.3rem] border border-line-strong bg-surface-sunken',
      'transition-colors duration-150',
      'before:absolute before:left-1/2 before:top-1/2 before:h-11 before:w-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[""]',
      'hover:border-brand-border',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
      'disabled:cursor-not-allowed disabled:opacity-45',
      'data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=checked]:text-white',
      'data-[state=indeterminate]:border-brand data-[state=indeterminate]:bg-brand data-[state=indeterminate]:text-white',
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
      {props.checked === 'indeterminate' ? (
        <Minus aria-hidden="true" className="h-3 w-3" strokeWidth={3} />
      ) : (
        <Check aria-hidden="true" className="h-3 w-3" strokeWidth={3} />
      )}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
