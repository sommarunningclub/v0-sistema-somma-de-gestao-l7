'use client'

import { useState } from 'react'
import { X, Loader2, ChevronLeft } from 'lucide-react'

export interface StepFormStep {
  title: string
  content: React.ReactNode
  isValid?: () => boolean
}

interface StepFormProps {
  title: string
  steps: StepFormStep[]
  onComplete: () => Promise<void>
  onClose: () => void
  isOpen: boolean
  isSubmitting?: boolean
  submitError?: string | null
}

export function StepForm({
  title,
  steps,
  onComplete,
  onClose,
  isOpen,
  isSubmitting,
  submitError,
}: StepFormProps) {
  const [currentStep, setCurrentStep] = useState(0)

  if (!isOpen) return null

  const step = steps[currentStep]
  const isLast = currentStep === steps.length - 1
  const canProceed = step.isValid ? step.isValid() : true

  const handleNext = async () => {
    if (isLast) {
      await onComplete()
    } else {
      setCurrentStep((s) => s + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1)
  }

  const handleClose = () => {
    setCurrentStep(0)
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40 md:hidden"
        onClick={handleClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-neutral-900
        border-t border-neutral-800 rounded-t-2xl flex flex-col"
        style={{ height: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button onClick={handleBack} className="p-2.5 text-neutral-400 active:text-white">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <p className="text-[10px] font-semibold text-orange-400 uppercase tracking-wider">
                {title} · Etapa {currentStep + 1} de {steps.length}
              </p>
              <h2 className="text-white font-semibold text-sm">{step.title}</h2>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 text-neutral-500 active:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1 px-4 pt-3 pb-0">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors duration-300
                ${i <= currentStep ? 'bg-orange-500' : 'bg-neutral-700'}`}
            />
          ))}
        </div>

        {/* Content — scrollable, keyboard-safe */}
        <div
          className="flex-1 overflow-y-auto px-4 pt-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 80px)' }}
        >
          {step.content}
        </div>

        {/* Error */}
        {submitError && (
          <p className="px-4 pb-2 text-xs text-red-400">{submitError}</p>
        )}

        {/* Footer button */}
        <div
          className="px-4 pb-4 pt-2 border-t border-neutral-800 bg-neutral-900"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={handleNext}
            disabled={!canProceed || isSubmitting}
            className="w-full h-12 rounded-xl bg-orange-500 text-white font-semibold text-sm
              active:scale-[0.98] transition-transform
              disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isLast ? 'Confirmar' : 'Próximo →'}
          </button>
        </div>
      </div>
    </>
  )
}
