import type { Config } from 'tailwindcss'

/**
 * Somma Admin — Design System
 *
 * Duas camadas de cor convivem de propósito:
 *
 * 1. Escalas remapeadas (`neutral`, `orange`). O painel foi escrito com cores
 *    literais (`bg-neutral-900`, `text-orange-500`). Em vez de reescrever
 *    milhares de classNames, as escalas do Tailwind apontam para a paleta
 *    oficial do Somma Club — toda a UI legada herda a nova identidade.
 * 2. Tokens semânticos (`surface`, `line`, `ink`, `brand`, `state`). Todo
 *    código novo usa estes; eles descrevem função, não aparência.
 */

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
    './*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      screens: {
        xs: '400px',
        '3xl': '1760px',
      },
      colors: {
        /* ---------- 1. escalas remapeadas ---------- */
        neutral: {
          50: '#F5F6F7',
          100: '#E7E9EC',
          200: '#CBCFD5',
          300: '#A8AEB7',
          400: '#878E99',
          500: '#6A717C',
          600: '#4A4F58',
          700: '#2A2D33',
          750: '#212429',
          800: '#17191D',
          900: '#101216',
          950: '#0A0B0D',
        },
        orange: {
          50: '#FFF1ED',
          100: '#FFE0D6',
          200: '#FFC0AD',
          300: '#FF9679',
          400: '#FF6440',
          500: '#FF2C04',
          600: '#E02503',
          700: '#B81D02',
          800: '#8F1702',
          900: '#6B1101',
          950: '#3D0900',
        },

        /* ---------- 2. tokens semânticos ---------- */
        /*
         * `rgb(var(--x-rgb) / <alpha-value>)` habilita `bg-canvas/70` etc.
         * Sem o placeholder, o Tailwind 3 simplesmente não gera a classe com
         * modificador de opacidade — e falha em silêncio.
         */
        canvas: 'rgb(var(--canvas-rgb) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--surface-rgb) / <alpha-value>)',
          raised: 'rgb(var(--surface-raised-rgb) / <alpha-value>)',
          sunken: 'rgb(var(--surface-sunken-rgb) / <alpha-value>)',
          hover: 'var(--surface-hover)',
          active: 'var(--surface-active)',
        },
        line: {
          DEFAULT: 'var(--line)',
          soft: 'var(--line-soft)',
          strong: 'var(--line-strong)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          strong: 'var(--ink-strong)',
          muted: 'var(--ink-muted)',
          subtle: 'var(--ink-subtle)',
          disabled: 'var(--ink-disabled)',
        },
        brand: {
          DEFAULT: 'rgb(var(--brand-rgb) / <alpha-value>)',
          /** Preenchimento sólido com texto branco — passa AA. Ver globals.css. */
          fill: 'var(--brand-fill)',
          strong: 'var(--brand-strong)',
          soft: 'var(--brand-soft)',
          softer: 'var(--brand-softer)',
          border: 'var(--brand-border)',
          line: 'var(--brand-line)',
          ink: 'var(--brand-ink)',
        },
        success: {
          DEFAULT: 'var(--success)',
          soft: 'var(--success-soft)',
          border: 'var(--success-border)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          soft: 'var(--warning-soft)',
          border: 'var(--warning-border)',
        },
        danger: {
          DEFAULT: 'var(--danger)',
          soft: 'var(--danger-soft)',
          border: 'var(--danger-border)',
        },
        info: {
          DEFAULT: 'var(--info)',
          soft: 'var(--info-soft)',
          border: 'var(--info-border)',
        },

        /* ---------- 3. contrato shadcn/ui ---------- */
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        /* escala compacta de painel — label/meta/corpo denso */
        micro: ['0.625rem', { lineHeight: '0.875rem', letterSpacing: '0.08em' }],
        eyebrow: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.14em' }],
        meta: ['0.75rem', { lineHeight: '1.125rem' }],
      },
      /*
       * Geometria afiada, no espírito do painel de referência: cantos de 2–6px
       * em vez dos 10–12px de um SaaS genérico. Bordas de 1px carregam a
       * estrutura; o raio quase não aparece.
       */
      borderRadius: {
        DEFAULT: 'var(--radius)',
        sm: '2px',
        md: 'calc(var(--radius) + 2px)',
        lg: 'calc(var(--radius) + 4px)',
        xl: 'calc(var(--radius) + 6px)',
        '2xl': 'calc(var(--radius) + 10px)',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.4)',
        raised: '0 8px 24px -8px rgba(0,0,0,0.6)',
        overlay: '0 24px 64px -12px rgba(0,0,0,0.75)',
        sheet: '0 -12px 40px -12px rgba(0,0,0,0.7)',
        // Sombra curta e contida. Uma sombra ampla no laranja da marca vira
        // halo sobre o fundo escuro e faz o botão parecer brilhar em vez de
        // repousar sobre a superfície.
        brand: '0 2px 8px -2px rgba(255,44,4,0.30)',
        'brand-inset': 'inset 0 0 0 1px var(--brand-border)',
        'inset-brand': 'inset 3px 0 0 var(--brand)',
      },
      spacing: {
        'safe-t': 'env(safe-area-inset-top, 0px)',
        'safe-b': 'env(safe-area-inset-bottom, 0px)',
        'safe-l': 'env(safe-area-inset-left, 0px)',
        'safe-r': 'env(safe-area-inset-right, 0px)',
        header: '3.5rem',
        'tabbar': '3.75rem',
      },
      transitionTimingFunction: {
        somma: 'cubic-bezier(0.22, 0.8, 0.24, 1)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'sheet-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'pop-in': {
          from: { opacity: '0', transform: 'translateY(10px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        /*
         * Entradas para elementos centralizados por transform.
         * `animate-pop-in` NUNCA pode ser usada num elemento com
         * `-translate-x-1/2`: com `fill: both`, o transform final do keyframe
         * sobrescreve o de centralização e o elemento salta para o canto —
         * foi exatamente o bug dos modais e da busca ⌘K. Estes keyframes
         * incluem a própria centralização.
         */
        'dialog-in': {
          from: { opacity: '0', transform: 'translate(-50%, -48%) scale(0.97)' },
          to: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
        },
        'palette-in': {
          from: { opacity: '0', transform: 'translate(-50%, -8px) scale(0.98)' },
          to: { opacity: '1', transform: 'translate(-50%, 0) scale(1)' },
        },
        /* Entrada de módulo: avança na direção da navegação. */
        'module-in': {
          from: { opacity: '0', transform: 'translate3d(0, 8px, 0)' },
          to: { opacity: '1', transform: 'translate3d(0, 0, 0)' },
        },
        'module-in-forward': {
          from: { opacity: '0', transform: 'translate3d(12px, 0, 0)' },
          to: { opacity: '1', transform: 'translate3d(0, 0, 0)' },
        },
        'module-in-back': {
          from: { opacity: '0', transform: 'translate3d(-12px, 0, 0)' },
          to: { opacity: '1', transform: 'translate3d(0, 0, 0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'brand-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 160ms ease-out both',
        'rise-in': 'rise-in 220ms cubic-bezier(0.22,0.8,0.24,1) both',
        'sheet-up': 'sheet-up 280ms cubic-bezier(0.22,0.8,0.24,1) both',
        'pop-in': 'pop-in 200ms cubic-bezier(0.22,0.8,0.24,1) both',
        'dialog-in': 'dialog-in 200ms cubic-bezier(0.22,0.8,0.24,1) both',
        'palette-in': 'palette-in 180ms cubic-bezier(0.22,0.8,0.24,1) both',
        'module-in': 'module-in 260ms cubic-bezier(0.22,0.8,0.24,1) both',
        'module-in-forward': 'module-in-forward 240ms cubic-bezier(0.22,0.8,0.24,1) both',
        'module-in-back': 'module-in-back 240ms cubic-bezier(0.22,0.8,0.24,1) both',
        shimmer: 'shimmer 1.6s infinite',
        'brand-pulse': 'brand-pulse 2s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
export default config
