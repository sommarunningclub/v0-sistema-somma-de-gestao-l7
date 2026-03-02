/**
 * Mobile Typography & Spacing System for Somma
 * 
 * This file defines all mobile-optimized typography and spacing values
 * to ensure consistency across all modules and components.
 */

/* ===== TYPOGRAPHY SCALE ===== */

export const TYPOGRAPHY = {
  // Display
  display_lg: 'text-3xl md:text-4xl font-bold leading-tight', // 30px -> 36px
  display: 'text-2xl md:text-3xl font-bold leading-tight',    // 24px -> 30px
  
  // Heading
  heading_xl: 'text-xl md:text-2xl font-bold leading-snug',   // 20px -> 24px
  heading_lg: 'text-lg md:text-xl font-bold leading-snug',    // 18px -> 20px
  heading: 'text-base md:text-lg font-bold leading-snug',     // 16px -> 18px
  heading_sm: 'text-sm md:text-base font-bold leading-snug',  // 14px -> 16px
  
  // Body
  body_lg: 'text-base md:text-lg leading-relaxed',            // 16px -> 18px (default)
  body: 'text-sm md:text-base leading-relaxed',               // 14px -> 16px
  body_sm: 'text-xs md:text-sm leading-relaxed',              // 12px -> 14px (captions)
  
  // Monospace (for data/codes)
  mono_lg: 'font-mono text-sm md:text-base',                  // 14px -> 16px
  mono: 'font-mono text-xs md:text-sm',                       // 12px -> 14px
  mono_sm: 'font-mono text-xs',                               // 12px
}

/* ===== SPACING SCALE ===== */

// Based on Tailwind 8px base
export const SPACING = {
  xs: '0.25rem',    // 4px  - micro spacing
  sm: '0.5rem',     // 8px  - small gaps
  md: '1rem',       // 16px - default gutters
  lg: '1.5rem',     // 24px - larger sections
  xl: '2rem',       // 32px - major sections
  xxl: '3rem',      // 48px - page sections
}

/* ===== PADDING ===== */

export const PADDING = {
  container: 'px-4 md:px-6 lg:px-8',     // Safe area padding
  card_mobile: 'p-3 md:p-4',              // Card content mobile
  section_mobile: 'p-4 md:p-6',           // Section padding mobile
  dense: 'p-2 md:p-3',                    // Compact layouts
}

/* ===== GAP/MARGINS ===== */

export const GAP = {
  xs: 'gap-2',      // 8px
  sm: 'gap-3',      // 12px
  md: 'gap-4',      // 16px
  lg: 'gap-6',      // 24px
  xl: 'gap-8',      // 32px
}

/* ===== TOUCH TARGETS ===== */

export const TOUCH_TARGETS = {
  // Minimum 44x44px per Apple/Google guidelines
  default: 'min-h-11 px-4 py-2.5',    // 44px height
  compact: 'min-h-10 px-3 py-2',      // 40px height (for dense UIs)
  large: 'min-h-12 px-4 py-3',        // 48px height (for important CTAs)
  icon: 'w-10 h-10 flex items-center justify-center', // 40x40px
  icon_lg: 'w-12 h-12 flex items-center justify-center', // 48x48px
}

/* ===== RESPONSIVE UTILITIES ===== */

export const RESPONSIVE = {
  // Mobile-first breakpoints
  mobile_only: 'md:hidden',                    // Hide on desktop
  desktop_only: 'hidden md:block',             // Hide on mobile
  tablet_up: 'md:block',                       // Show on tablet+
  
  // Layouts
  grid_mobile: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  grid_compact: 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
  flex_col_mobile: 'flex flex-col md:flex-row',
}

/* ===== TYPOGRAPHY UTILITY CLASSES ===== */

export const TEXT = {
  truncate: 'truncate',                      // Single line truncate
  line_clamp_2: 'line-clamp-2',             // 2 lines max
  line_clamp_3: 'line-clamp-3',             // 3 lines max
  balance: 'text-balance',                   // Better text wrapping
}

/* ===== COLOR & CONTRAST ===== */

export const COLORS = {
  text_primary: 'text-white',
  text_secondary: 'text-neutral-400',
  text_tertiary: 'text-neutral-500',
  text_inverse: 'text-neutral-900',
  
  bg_primary: 'bg-neutral-900',
  bg_secondary: 'bg-neutral-800',
  bg_tertiary: 'bg-neutral-700',
  
  border_light: 'border-neutral-800',
  border_dark: 'border-neutral-700',
}

/* ===== STATES & TRANSITIONS ===== */

export const STATES = {
  active: 'active:scale-95 active:opacity-90',
  hover: 'hover:opacity-80 transition-opacity',
  disabled: 'disabled:opacity-50 disabled:cursor-not-allowed',
  loading: 'opacity-50 pointer-events-none',
}

export const TRANSITIONS = {
  fast: 'transition-all duration-100',        // Quick feedback
  normal: 'transition-all duration-200',      // Default
  smooth: 'transition-all duration-300',      // Smooth animations
}
