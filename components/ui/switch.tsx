'use client'

import * as React from 'react'
import * as SwitchPrimitives from '@radix-ui/react-switch'

import { cn } from '@/lib/utils'

/**
 * Interruptor do design system.
 *
 * Usado onde a mudança é aplicada a um estado (uma permissão liberada ou não),
 * e não onde se marca itens de uma lista — nesse caso use `Checkbox`.
 * O trilho tem 44px de área de toque efetiva via `before:` para atender ao
 * mínimo de alvo no celular sem inflar o desenho.
 */
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      'group relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent',
      'transition-colors duration-150 ease-somma',
      'before:absolute before:left-1/2 before:top-1/2 before:h-11 before:w-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[""]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
      'disabled:cursor-not-allowed disabled:opacity-45',
      'data-[state=checked]:bg-brand data-[state=unchecked]:border-line data-[state=unchecked]:bg-surface-sunken',
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        'pointer-events-none block h-5 w-5 rounded-full shadow-card ring-0',
        'transition-transform duration-150 ease-somma',
        'data-[state=checked]:translate-x-[1.375rem] data-[state=checked]:bg-white',
        'data-[state=unchecked]:translate-x-0.5 data-[state=unchecked]:bg-ink-muted',
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
