'use client'

import { useState } from 'react'

interface UseMobileMenuState {
  isOpen: boolean
  openMenu: () => void
  closeMenu: () => void
  toggleMenu: () => void
}

export function useMobileMenu(): UseMobileMenuState {
  const [isOpen, setIsOpen] = useState(false)

  return {
    isOpen,
    openMenu: () => setIsOpen(true),
    closeMenu: () => setIsOpen(false),
    toggleMenu: () => setIsOpen(!isOpen),
  }
}
