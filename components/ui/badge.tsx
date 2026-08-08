import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/**
 * Etiqueta curta. Mantém a API do shadcn (`variant`), mas os tons vêm dos
 * tokens semânticos. Para status de registro prefira `StatusPill` de
 * `@/components/somma`, que já mapeia estado → tom.
 */
const badgeVariants = cva(
  [
    'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5',
    'text-eyebrow font-semibold uppercase tracking-[0.08em]',
    'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
    '[&_svg]:size-3 [&_svg]:shrink-0',
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'border-brand-border bg-brand-soft text-brand-strong',
        secondary: 'border-line bg-surface-raised text-ink',
        destructive: 'border-danger-border bg-danger-soft text-danger',
        success: 'border-success-border bg-success-soft text-success',
        warning: 'border-warning-border bg-warning-soft text-warning',
        info: 'border-info-border bg-info-soft text-info',
        outline: 'border-line bg-transparent text-ink-muted',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
