import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Campo de texto multilinha. Fica em `text-base` (16px) em todas as larguras:
 * abaixo disso o iOS dá zoom automático ao focar o campo.
 */
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<'textarea'>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        'flex min-h-[88px] w-full rounded-lg border border-line bg-surface-sunken px-3 py-2.5',
        'text-base leading-relaxed text-ink placeholder:text-ink-subtle',
        'transition-colors duration-150 ease-somma',
        'hover:border-line-strong',
        'focus-visible:border-brand-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        'disabled:cursor-not-allowed disabled:border-line-soft disabled:text-ink-disabled disabled:opacity-60',
        'aria-[invalid=true]:border-danger-border aria-[invalid=true]:focus-visible:ring-danger',
        className,
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = 'Textarea'

export { Textarea }
