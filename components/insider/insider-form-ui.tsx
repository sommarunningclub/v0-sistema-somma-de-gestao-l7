"use client"

import type React from 'react'
import { AnimatePresence, motion } from 'framer-motion'

/** Classe única dos inputs — espelha o formulário da home do site. */
export const INPUT_CLS =
  'w-full rounded-xl border border-black/10 px-4 py-3 text-[#0A0A0A] outline-none transition-colors focus:border-[#FF2C03]'

/** Revela o campo quando o anterior está preenchido, sem recolher o que já apareceu. */
export function Reveal({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="overflow-hidden"
        >
          <div className="pt-4">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function InsiderField({
  id,
  label,
  children,
}: {
  id: string
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-[#0A0A0A]">
        {label}
      </label>
      {children}
    </div>
  )
}
