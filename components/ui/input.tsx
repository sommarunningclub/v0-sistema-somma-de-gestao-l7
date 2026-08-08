import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Campo de texto do design system.
 *
 * `text-base` (16px) é intencional e não deve virar `text-sm`: abaixo de 16px
 * o Safari no iPhone dá zoom automático ao focar o campo e quebra o layout.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-11 w-full rounded-lg border border-line bg-surface-sunken px-3.5 py-2 text-base text-ink',
          'transition-colors duration-150',
          'placeholder:text-ink-subtle',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink',
          'hover:border-line-strong',
          'focus-visible:border-brand focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand',
          'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'lg:h-10',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

export { Input }
