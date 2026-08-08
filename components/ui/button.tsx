import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Botão do design system Somma.
 *
 * A API (nomes de `variant`/`size`) é a do shadcn para não quebrar as ~34
 * chamadas existentes, mas o visual e os alvos de toque foram refeitos:
 * altura mínima de 44px nos tamanhos usados no celular, foco visível por
 * `ring` de marca e um estado `loading` que já previne envio duplicado.
 */
const buttonVariants = cva(
  [
    'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded',
    'text-sm font-semibold tracking-tight',
    'transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-somma',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
    'disabled:pointer-events-none disabled:opacity-45',
    'active:scale-[0.98] lg:active:scale-100',
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'bg-brand-fill text-white shadow-brand hover:bg-brand',
        destructive: 'bg-danger text-white hover:brightness-110',
        outline:
          'border border-line bg-transparent text-ink hover:border-line-strong hover:bg-surface-hover hover:text-ink-strong',
        secondary:
          'border border-line bg-surface-raised text-ink hover:bg-surface-hover hover:text-ink-strong',
        ghost: 'text-ink-muted hover:bg-surface-hover hover:text-ink-strong',
        subtle: 'border border-brand-border bg-brand-soft text-brand hover:bg-brand/20',
        link: 'text-brand underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-4 py-2 lg:h-10',
        sm: 'h-9 rounded-md px-3 text-[0.8125rem]',
        lg: 'h-12 rounded-xl px-6 text-base',
        icon: 'h-11 w-11 lg:h-10 lg:w-10',
        'icon-sm': 'h-9 w-9 rounded-md',
      },
      block: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /** Mostra spinner e bloqueia o clique — evita envio duplicado. */
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, block, asChild = false, loading = false, disabled, children, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button'

    if (asChild) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, block, className }))}
          ref={ref}
          {...props}
        >
          {children}
        </Comp>
      )
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, block, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        {children}
      </Comp>
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
