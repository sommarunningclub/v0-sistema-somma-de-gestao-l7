// Mobile-first responsive utilities for Somma system
// Applied via Tailwind breakpoints: sm (640px), md (768px), lg (1024px)

export const MOBILE_BREAKPOINTS = {
  xs: 320,     // iPhone SE
  sm: 640,     // Small phone
  md: 768,     // Tablet
  lg: 1024,    // Desktop
  xl: 1280,    // Large desktop
}

// Touch target size - minimum 44x44px for accessibility
export const TOUCH_TARGET = 44

// Spacing system for mobile
export const MOBILE_SPACING = {
  xs: 4,       // 4px
  sm: 8,       // 8px
  md: 12,      // 12px
  lg: 16,      // 16px
  xl: 20,      // 20px
  xxl: 24,     // 24px
}

// Typography scale for mobile
export const MOBILE_TYPOGRAPHY = {
  xs: 'text-xs',      // 12px
  sm: 'text-sm',      // 14px
  base: 'text-base',  // 16px
  lg: 'text-lg',      // 18px
  xl: 'text-xl',      // 20px
}

// Safe area for iOS/Android
export const SAFE_AREA = {
  top: 'pt-safe',
  bottom: 'pb-safe',
}
