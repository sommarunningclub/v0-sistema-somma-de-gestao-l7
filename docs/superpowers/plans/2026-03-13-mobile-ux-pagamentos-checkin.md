# Mobile UX — Pagamentos & Check-in Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a reusable mobile design system (5 new components + MobileCard extension) and apply it to Pagamentos › Cobranças, Pagamentos › Clientes, and Check-in pages.

**Architecture:** New components in `components/mobile/` follow exact TypeScript interfaces from the spec. Pages are modified only in their `md:hidden` mobile blocks — desktop is untouched. No new API routes are needed; all data fetching reuses existing state.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS, lucide-react, existing `MobileBottomSheet` component

---

## Chunk 1: Mobile Component Library

### Task 1: FAB (Floating Action Button)

**Files:**
- Create: `components/mobile/fab.tsx`

- [ ] **Step 1: Create `components/mobile/fab.tsx`**

```tsx
'use client'

import { Plus, Loader2 } from 'lucide-react'

interface FABProps {
  onClick: () => void
  icon?: React.ReactNode
  label?: string
  loading?: boolean
  className?: string
}

export function FAB({ onClick, icon, label, loading, className }: FABProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      aria-label={label ?? 'Adicionar'}
      className={`fixed bottom-20 right-4 z-40 flex items-center gap-2 h-14 rounded-full
        bg-orange-500 text-white shadow-lg shadow-orange-500/40
        active:scale-95 transition-transform
        disabled:opacity-60 disabled:cursor-not-allowed
        ${label ? 'px-5' : 'w-14 justify-center'}
        ${className ?? ''}`}
    >
      {loading
        ? <Loader2 className="w-5 h-5 animate-spin" />
        : (icon ?? <Plus className="w-6 h-6" />)}
      {label && !loading && <span className="text-sm font-semibold">{label}</span>}
    </button>
  )
}
```

- [ ] **Step 2: Verify in browser**

Start dev server if not running: `npm run dev` (port 3001)
Navigate to any Pagamentos page on mobile viewport (375px). FAB not yet used — just confirm no TypeScript errors: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add components/mobile/fab.tsx
git commit -m "feat(mobile): add FAB component"
```

---

### Task 2: PillTabBar

**Files:**
- Create: `components/mobile/pill-tab-bar.tsx`

- [ ] **Step 1: Create `components/mobile/pill-tab-bar.tsx`**

```tsx
'use client'

interface PillTab {
  key: string
  label: string
}

interface PillTabBarProps {
  tabs: PillTab[]
  activeTab: string
  onChange: (key: string) => void
  className?: string
}

export function PillTabBar({ tabs, activeTab, onChange, className }: PillTabBarProps) {
  return (
    <div
      className={`flex gap-2 overflow-x-auto scrollbar-hide pb-0 ${className ?? ''}`}
      style={{ scrollbarWidth: 'none' }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`flex-shrink-0 py-1.5 px-3 rounded-full text-xs font-semibold whitespace-nowrap
            transition-colors active:scale-95
            ${activeTab === tab.key
              ? 'bg-orange-500 text-white'
              : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
            }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors related to pill-tab-bar.tsx

- [ ] **Step 3: Commit**

```bash
git add components/mobile/pill-tab-bar.tsx
git commit -m "feat(mobile): add PillTabBar component"
```

---

### Task 3: StickySummary

**Files:**
- Create: `components/mobile/sticky-summary.tsx`

- [ ] **Step 1: Create `components/mobile/sticky-summary.tsx`**

```tsx
'use client'

type SummaryColor = 'green' | 'yellow' | 'red' | 'orange' | 'blue' | 'neutral'

export interface SummaryItem {
  label: string
  value: string | number
  color: SummaryColor
}

interface StickySummaryProps {
  items: SummaryItem[]
  className?: string
}

const colorMap: Record<SummaryColor, string> = {
  green:   'text-green-400 bg-green-500/10',
  yellow:  'text-yellow-400 bg-yellow-500/10',
  red:     'text-red-400 bg-red-500/10',
  orange:  'text-orange-400 bg-orange-500/10',
  blue:    'text-blue-400 bg-blue-500/10',
  neutral: 'text-neutral-400 bg-neutral-800',
}

export function StickySummary({ items, className }: StickySummaryProps) {
  return (
    <div className={`grid gap-2 px-3 py-2 bg-neutral-900 border-b border-neutral-800 ${className ?? ''}`}
      style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, 1fr)` }}
    >
      {items.map((item, i) => (
        <div key={i} className={`rounded-xl p-2 text-center ${colorMap[item.color]}`}>
          <div className="text-sm font-bold leading-tight">{item.value}</div>
          <div className="text-[10px] opacity-70 mt-0.5 leading-tight">{item.label}</div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/mobile/sticky-summary.tsx
git commit -m "feat(mobile): add StickySummary component"
```

---

### Task 4: SwipeCard

**Files:**
- Create: `components/mobile/swipe-card.tsx`

- [ ] **Step 1: Create `components/mobile/swipe-card.tsx`**

```tsx
'use client'

import { useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

export interface SwipeAction {
  key: string
  label: string
  icon: React.ReactNode
  color: 'green' | 'blue' | 'orange' | 'red'
  onTrigger: () => void | Promise<void>
}

interface SwipeCardProps {
  children: React.ReactNode
  actions: SwipeAction[]
  disabled?: boolean
  revealThreshold?: number
  autoTriggerThreshold?: number
  className?: string
}

const actionBg: Record<SwipeAction['color'], string> = {
  green:  'bg-green-500/20 text-green-400',
  blue:   'bg-blue-500/20 text-blue-400',
  orange: 'bg-orange-500/20 text-orange-400',
  red:    'bg-red-500/20 text-red-400',
}

export function SwipeCard({
  children,
  actions,
  disabled,
  revealThreshold = 60,
  autoTriggerThreshold = 120,
  className,
}: SwipeCardProps) {
  const startXRef = useRef(0)
  const startYRef = useRef(0)
  const cancelledRef = useRef(false)
  const [offset, setOffset] = useState(0)
  const [triggering, setTriggering] = useState<string | null>(null)

  const ACTION_WIDTH = 64
  const totalActionsWidth = actions.length * ACTION_WIDTH

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return
    startXRef.current = e.touches[0].clientX
    startYRef.current = e.touches[0].clientY
    cancelledRef.current = false
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (disabled || cancelledRef.current) return
    const dx = startXRef.current - e.touches[0].clientX
    const dy = startYRef.current - e.touches[0].clientY

    // First 10px: cancel swipe if vertical scroll wins
    if (Math.abs(offset) < 5 && Math.abs(dy) > Math.abs(dx)) {
      cancelledRef.current = true
      setOffset(0)
      return
    }

    // Only allow left swipe (positive dx)
    if (dx < 0) { setOffset(0); return }
    setOffset(Math.min(dx, totalActionsWidth + 20))
  }

  const handleTouchEnd = async () => {
    if (disabled || cancelledRef.current) { setOffset(0); return }

    if (offset >= autoTriggerThreshold && actions[0]) {
      setOffset(totalActionsWidth)
      setTriggering(actions[0].key)
      await actions[0].onTrigger()
      setTriggering(null)
      setOffset(0)
    } else if (offset >= revealThreshold) {
      setOffset(totalActionsWidth)
    } else {
      setOffset(0)
    }
  }

  return (
    <div className={`relative overflow-hidden rounded-xl ${className ?? ''}`}>
      {/* Actions revealed on swipe */}
      <div
        className="absolute right-0 top-0 bottom-0 flex"
        style={{ width: totalActionsWidth }}
      >
        {actions.map((action) => (
          <button
            key={action.key}
            onClick={async () => {
              setTriggering(action.key)
              await action.onTrigger()
              setTriggering(null)
              setOffset(0)
            }}
            style={{ width: ACTION_WIDTH }}
            className={`flex flex-col items-center justify-center gap-1 text-[10px] font-semibold
              ${actionBg[action.color]}`}
          >
            {triggering === action.key
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : action.icon}
            {action.label}
          </button>
        ))}
      </div>

      {/* Card content — slides left */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(-${offset}px)`,
          transition: offset === 0 ? 'transform 0.2s ease' : 'none',
        }}
        className="relative z-10 bg-neutral-900"
      >
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/mobile/swipe-card.tsx
git commit -m "feat(mobile): add SwipeCard component with touch swipe actions"
```

---

### Task 5: StepForm (multi-step bottom sheet)

**Files:**
- Create: `components/mobile/step-form.tsx`

- [ ] **Step 1: Create `components/mobile/step-form.tsx`**

```tsx
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
              <button onClick={handleBack} className="p-1 text-neutral-400 active:text-white">
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
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/mobile/step-form.tsx
git commit -m "feat(mobile): add StepForm multi-step bottom sheet component"
```

---

### Task 6: Extend MobileCard with borderColor + expandable props

**Files:**
- Modify: `components/mobile/mobile-card.tsx`

- [ ] **Step 1: Read current file**

Read `components/mobile/mobile-card.tsx` to confirm current interface before editing.

- [ ] **Step 2: Add new props to `MobileCardProps` and update component**

Add these fields to the `MobileCardProps` interface:
```typescript
borderColor?: 'green' | 'yellow' | 'red' | 'orange' | 'blue' | 'none'
expandable?: boolean
expandedContent?: React.ReactNode
defaultExpanded?: boolean
isUpdating?: boolean
avatar?: string   // initials string, e.g. "JS"
avatarBg?: string // tailwind bg class, e.g. "bg-orange-500/20 text-orange-400"
```

Update the component body — add state for expansion and render new sections:
```typescript
const [isExpanded, setIsExpanded] = useState(defaultExpanded ?? false)

const borderColorMap = {
  green:   'border-l-green-500',
  yellow:  'border-l-yellow-500',
  red:     'border-l-red-500',
  orange:  'border-l-orange-500',
  blue:    'border-l-blue-500',
  none:    'border-l-transparent',
}

// In the root div className — append border-l-[3px] and color:
`... border-l-[3px] ${borderColorMap[borderColor ?? 'none']} ...`

// After the existing header section, add:
{expandable && expandedContent && (
  <div
    className={`overflow-hidden transition-all duration-200 ${
      isExpanded ? 'max-h-96' : 'max-h-0'
    }`}
  >
    <div className="border-t border-neutral-700 pt-3 mt-0">
      {expandedContent}
    </div>
  </div>
)}

// If isUpdating, show spinner overlay on the card
{isUpdating && (
  <div className="absolute inset-0 bg-neutral-900/60 rounded-lg flex items-center justify-center">
    <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
  </div>
)}
```

Make the card tappable when `expandable=true` — add to `onClick` handler:
```typescript
onClick={expandable ? () => setIsExpanded(e => !e) : onPress}
```

Add avatar rendering before the title when `avatar` is provided:
```typescript
{avatar && (
  <div className={`w-9 h-9 rounded-full flex items-center justify-center
    text-xs font-bold flex-shrink-0 mr-3 ${avatarBg ?? 'bg-neutral-700 text-neutral-300'}`}>
    {avatar}
  </div>
)}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add components/mobile/mobile-card.tsx
git commit -m "feat(mobile): extend MobileCard with borderColor, expandable, avatar, isUpdating props"
```

---

## Chunk 2: Pagamentos › Cobranças — Mobile View

### Task 7: Mobile list view for Cobranças

**Files:**
- Modify: `app/pagamentos/cobrancas/page.tsx`

Context:
- Existing state: `payments` (AsaasPayment[]), `customers` (AsaasCustomerAPI[]), `loading`, `searchTerm`, `activeTab`, `setShowModal`
- `payments[].status`: `'RECEIVED'` | `'PENDING'` | `'OVERDUE'` | `'CANCELLED'`
- `payments[].billing_type`: `'PIX'` | `'CREDIT_CARD'`
- Customer name lookup: `customers.find(c => c.id === p.customer_asaas_id)?.name`

- [ ] **Step 1: Add imports at top of `app/pagamentos/cobrancas/page.tsx`**

Add after existing imports:
```typescript
import { PillTabBar } from '@/components/mobile/pill-tab-bar'
import { StickySummary, type SummaryItem } from '@/components/mobile/sticky-summary'
import { SwipeCard, type SwipeAction } from '@/components/mobile/swipe-card'
import { FAB } from '@/components/mobile/fab'
import { Eye, MessageSquare } from 'lucide-react'
```

- [ ] **Step 2: Add mobile summary computation (inside component, after `filtered` variable)**

Add below the existing desktop filter logic:
```typescript
// Mobile summary — computed from all payments (not filtered) for totals
const mobileSummary: SummaryItem[] = [
  {
    label: 'Pago',
    value: `R$${(payments.filter(p => p.status === 'RECEIVED').reduce((s, p) => s + p.value, 0) / 1000).toFixed(1)}k`,
    color: 'green',
  },
  {
    label: 'Pendente',
    value: `R$${(payments.filter(p => p.status === 'PENDING').reduce((s, p) => s + p.value, 0) / 1000).toFixed(1)}k`,
    color: 'yellow',
  },
  {
    label: 'Vencido',
    value: `R$${(payments.filter(p => p.status === 'OVERDUE').reduce((s, p) => s + p.value, 0) / 1000).toFixed(1)}k`,
    color: 'red',
  },
]

const COBRANCAS_TABS = [
  { key: 'all', label: 'Todas' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'overdue', label: 'Vencidas' },
  { key: 'received', label: 'Pagas' },
]

const statusBorderColor = (status: string): 'green' | 'yellow' | 'red' | 'none' => {
  if (status === 'RECEIVED') return 'green'
  if (status === 'PENDING') return 'yellow'
  if (status === 'OVERDUE' || status === 'CANCELLED') return 'red'
  return 'none'
}

const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    RECEIVED: 'Pago', PENDING: 'Pendente', OVERDUE: 'Vencido', CANCELLED: 'Cancelado',
  }
  return map[status] ?? status
}

const statusBadgeColor = (status: string): 'success' | 'warning' | 'error' => {
  if (status === 'RECEIVED') return 'success'
  if (status === 'PENDING') return 'warning'
  return 'error'
}

const getInitials = (name: string) =>
  name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
```

- [ ] **Step 3: Add mobile JSX block inside the page's return, right before the existing `</div>` that closes the main container**

Find the `return (` statement and the top-level wrapper div. Add the mobile block as a sibling of the existing desktop content, wrapped in `md:hidden`:

```tsx
{/* ── MOBILE VIEW ── */}
<div className="md:hidden flex flex-col h-full">
  {/* Pill tabs + search */}
  <div className="sticky top-14 z-20 bg-neutral-900 border-b border-neutral-800 px-3 pt-3 pb-2 space-y-2">
    <PillTabBar
      tabs={COBRANCAS_TABS}
      activeTab={activeTab}
      onChange={(k) => setActiveTab(k as TabType)}
    />
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
      <input
        type="text"
        placeholder="Buscar cobrança..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full pl-9 pr-4 py-2 bg-neutral-800 border border-neutral-700 rounded-xl
          text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
      />
    </div>
  </div>

  {/* Sticky summary */}
  <StickySummary items={mobileSummary} />

  {/* List */}
  <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 pb-24">
    {loading && (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
      </div>
    )}

    {!loading && filteredPayments.length === 0 && (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <FileText className="w-10 h-10 text-neutral-600" />
        <p className="text-neutral-500 text-sm font-medium">
          {searchTerm || activeTab !== 'all' ? 'Nenhum resultado' : 'Nenhuma cobrança'}
        </p>
        {(searchTerm || activeTab !== 'all') && (
          <button
            onClick={() => { setSearchTerm(''); setActiveTab('all') }}
            className="text-orange-400 text-xs"
          >
            Limpar filtros
          </button>
        )}
      </div>
    )}

    {!loading && filteredPayments.map((payment) => {
      const customerName = customers.find(c => c.id === payment.customer_asaas_id)?.name ?? 'Cliente'
      const dueDate = payment.due_date
        ? new Date(payment.due_date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        : '—'
      const billingLabel = payment.billing_type === 'PIX' ? 'PIX' : 'Cartão'

      const swipeActions: SwipeAction[] = [
        {
          key: 'view',
          label: 'Ver',
          icon: <Eye className="w-4 h-4" />,
          color: 'blue',
          onTrigger: () => setSelectedPayment(payment),
        },
        ...(payment.status === 'PENDING' || payment.status === 'OVERDUE' ? [{
          key: 'charge',
          label: 'Cobrar',
          icon: <MessageSquare className="w-4 h-4" />,
          color: 'orange' as const,
          onTrigger: () => {
            setSelectedPayment(payment)
          },
        }] : []),
      ]

      return (
        <SwipeCard key={payment.id} actions={swipeActions}>
          <MobileCard
            title={customerName}
            subtitle={`Venc. ${dueDate} · ${billingLabel}`}
            avatar={getInitials(customerName)}
            borderColor={statusBorderColor(payment.status)}
            badge={{ label: statusLabel(payment.status), color: statusBadgeColor(payment.status) }}
            onPress={() => setSelectedPayment(payment)}
          />
        </SwipeCard>
      )
    })}
  </div>

  {/* FAB */}
  <FAB onClick={() => setShowModal(true)} label="Nova cobrança" />
</div>
```

Also wrap existing desktop content in `<div className="hidden md:block ...">`.

- [ ] **Step 4: Add `MobileCard` import**

```typescript
import { MobileCard } from '@/components/mobile/mobile-card'
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Verify in browser at 375px viewport**

Open http://localhost:3001/pagamentos (Cobranças tab). Confirm:
- Pill tabs visible and switchable
- Stats bar shows totals
- Cards have colored left border
- Swipe left reveals Ver/Cobrar actions
- FAB visible bottom-right
- No horizontal scroll

- [ ] **Step 7: Commit**

```bash
git add app/pagamentos/cobrancas/page.tsx
git commit -m "feat(mobile): add mobile list view for Cobranças with pill tabs, stats and swipe cards"
```

---

### Task 8: Nova Cobrança — StepForm (3 steps)

**Files:**
- Modify: `app/pagamentos/cobrancas/page.tsx`

Context: existing `showModal`, `formData`, `saving`, `customers`, `handleSubmit` (or equivalent save function), `?cliente=` URL param pre-selection via `preSelectedCustomer` state.

- [ ] **Step 1: Add StepForm import**

```typescript
import { StepForm, type StepFormStep } from '@/components/mobile/step-form'
```

- [ ] **Step 2: Add step form state inside the component**

```typescript
const [stepFormOpen, setStepFormOpen] = useState(false)
const [stepFormCustomer, setStepFormCustomer] = useState<AsaasCustomerAPI | null>(null)
const [stepFormError, setStepFormError] = useState<string | null>(null)
const [stepFormSaving, setStepFormSaving] = useState(false)
const [customerSearch, setCustomerSearch] = useState('')
```

- [ ] **Step 3: Add URL param effect to open StepForm on mobile**

Add a new `useEffect` (the existing one only calls `fetchData()` — this is a separate, additive effect):
```typescript
useEffect(() => {
  if (preSelectedCustomer) return
  const clienteId = searchParams.get('cliente')
  if (clienteId) {
    const found = customers.find(c => c.id === clienteId)
    if (found) setStepFormCustomer(found)
    setFormData(prev => ({ ...prev, customer: clienteId }))
    // Open desktop modal on md+, step form on mobile
    if (window.innerWidth >= 768) {
      setShowModal(true)
    } else {
      setStepFormOpen(true)
    }
    setPreSelectedCustomer(true)
  }
}, [searchParams, preSelectedCustomer, customers])
```

- [ ] **Step 4: Define step form steps array (inside return, as a const before JSX)**

```typescript
const stepFormSteps: StepFormStep[] = [
  {
    title: 'Selecionar cliente',
    isValid: () => stepFormCustomer !== null,
    content: (
      <div className="space-y-3">
        <input
          type="text"
          placeholder="Buscar por nome ou CPF..."
          value={customerSearch}
          onChange={(e) => setCustomerSearch(e.target.value)}
          className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl
            text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
          autoFocus
        />
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {customers
            .filter(c => !customerSearch ||
              c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
              c.cpfCnpj.includes(customerSearch))
            .slice(0, 8)
            .map(c => (
              <button
                key={c.id}
                onClick={() => {
                  setStepFormCustomer(c)
                  setFormData(prev => ({ ...prev, customer: c.id }))
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors
                  ${stepFormCustomer?.id === c.id
                    ? 'bg-orange-500/20 border border-orange-500/40'
                    : 'bg-neutral-800 border border-neutral-700 active:bg-neutral-700'}`}
              >
                <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center
                  text-xs font-bold text-white flex-shrink-0">
                  {getInitials(c.name)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{c.name}</p>
                  {c.email && <p className="text-xs text-neutral-500 truncate">{c.email}</p>}
                </div>
                {stepFormCustomer?.id === c.id && (
                  <div className="ml-auto text-orange-400 text-xs font-semibold">✓</div>
                )}
              </button>
            ))}
        </div>
      </div>
    ),
  },
  {
    title: 'Valor e vencimento',
    isValid: () => formData.value > 0 && !!formData.dueDate,
    content: (
      <div className="space-y-3">
        <div className="bg-orange-500 rounded-2xl p-5 text-center">
          <p className="text-xs text-orange-200 mb-2 font-medium">Valor da cobrança</p>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0,00"
            value={formData.value || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))}
            className="bg-transparent text-3xl font-extrabold text-white text-center w-full
              focus:outline-none placeholder-orange-300"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-xs text-neutral-500 mb-1.5 font-medium">Forma de pagamento</p>
            <div className="flex gap-2">
              {(['PIX', 'CREDIT_CARD'] as const).map(bt => (
                <button
                  key={bt}
                  onClick={() => setFormData(prev => ({ ...prev, billingType: bt }))}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors
                    ${formData.billingType === bt
                      ? 'bg-orange-500 text-white'
                      : 'bg-neutral-800 text-neutral-400 border border-neutral-700'}`}
                >
                  {bt === 'PIX' ? 'PIX' : 'Cartão'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-neutral-500 mb-1.5 font-medium">Vencimento</p>
            <input
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
              className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl
                text-xs text-white focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>
        <div>
          <p className="text-xs text-neutral-500 mb-1.5 font-medium">Descrição (opcional)</p>
          <textarea
            rows={2}
            placeholder="Ex: Mensalidade março..."
            value={formData.description ?? ''}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl
              text-sm text-white placeholder-neutral-500 resize-none focus:outline-none focus:border-orange-500"
          />
        </div>
      </div>
    ),
  },
  {
    title: 'Confirmar',
    content: (
      <div className="space-y-3">
        <p className="text-xs text-neutral-400 font-medium uppercase tracking-wider">Resumo</p>
        {[
          { label: 'Cliente', value: stepFormCustomer?.name ?? '—' },
          { label: 'Valor', value: `R$ ${(formData.value ?? 0).toFixed(2)}` },
          { label: 'Forma', value: formData.billingType === 'PIX' ? 'PIX' : 'Cartão' },
          { label: 'Vencimento', value: formData.dueDate
            ? new Date(formData.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')
            : '—' },
          ...(formData.description ? [{ label: 'Descrição', value: formData.description }] : []),
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between items-center py-2.5 border-b border-neutral-800">
            <span className="text-xs text-neutral-500">{label}</span>
            <span className="text-sm font-medium text-white">{value}</span>
          </div>
        ))}
      </div>
    ),
  },
]
```

- [ ] **Step 5: Add StepForm component to mobile JSX block (after the existing mobile list)**

Inside the `md:hidden` div, after the list, add:
```tsx
<StepForm
  title="Nova Cobrança"
  steps={stepFormSteps}
  isOpen={stepFormOpen}
  onClose={() => { setStepFormOpen(false); setStepFormCustomer(null); setCustomerSearch('') }}
  onComplete={async () => {
    setStepFormSaving(true)
    setStepFormError(null)
    try {
      // Reuse existing save logic — call same handler as desktop modal
      await handleCreateCharge()
      setStepFormOpen(false)
      setStepFormCustomer(null)
      setCustomerSearch('')
      await fetchData()
    } catch (e) {
      setStepFormError(e instanceof Error ? e.message : 'Erro ao criar cobrança')
    } finally {
      setStepFormSaving(false)
    }
  }}
  isSubmitting={stepFormSaving}
  submitError={stepFormError}
/>
```

> **Note:** `handleCreateCharge` is defined at line 236 of `app/pagamentos/cobrancas/page.tsx`. It is already an async function — no extraction needed.

- [ ] **Step 6: Update FAB to open step form on mobile**

Change FAB `onClick`:
```tsx
<FAB
  onClick={() => {
    setStepFormCustomer(null)
    setCustomerSearch('')
    setFormData({ customer: '', value: 0, dueDate: new Date().toISOString().split('T')[0], billingType: 'PIX', description: '' })
    setStepFormOpen(true)
  }}
  label="Nova cobrança"
/>
```

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 8: Verify in browser at 375px**

- Tap FAB → step form opens
- Step 1: search and select a customer → Next enabled
- Step 2: fill value and date → Next enabled
- Step 3: confirm summary → Confirmar button
- Form closes after success

- [ ] **Step 9: Commit**

```bash
git add app/pagamentos/cobrancas/page.tsx
git commit -m "feat(mobile): add step form for Nova Cobrança on mobile"
```

---

## Chunk 3: Pagamentos › Clientes — Mobile View

### Task 9: Mobile list view for Clientes

**Files:**
- Modify: `app/pagamentos/clientes/page.tsx`

Context:
- State: `customers` (AsaasCustomerAPI[]), `loading`, `searchTerm`, `filter` (FilterType), `setSelectedCustomer`, `setShowDetails`, `setShowModal`
- Customer is active if `!c.deleted`
- Note: LTV is mentioned in the spec but `AsaasCustomerAPI` has no LTV field — omitted from mobile card in this iteration (would require a separate aggregation query)

- [ ] **Step 1: Add imports**

```typescript
import { PillTabBar } from '@/components/mobile/pill-tab-bar'
import { StickySummary, type SummaryItem } from '@/components/mobile/sticky-summary'
import { SwipeCard, type SwipeAction } from '@/components/mobile/swipe-card'
import { MobileCard } from '@/components/mobile/mobile-card'
import { FAB } from '@/components/mobile/fab'
import { useRouter } from 'next/navigation'
// (useRouter already imported — skip if already present)
```

- [ ] **Step 2: Add mobile computed values inside component**

```typescript
// Note: FilterType also includes "archived" but it has no tab here —
// mobile tabs intentionally exclude archived (rarely used on mobile).
const CLIENTES_TABS = [
  { key: 'all', label: 'Todos' },
  { key: 'active', label: 'Ativos' },
  { key: 'pf', label: 'PF' },
  { key: 'pj', label: 'PJ' },
]

const activeCount = customers.filter(c => !c.deleted).length
const inactiveCount = customers.filter(c => c.deleted).length

const clientesMobileSummary: SummaryItem[] = [
  { label: 'Total', value: customers.length, color: 'orange' },
  { label: 'Ativos', value: activeCount, color: 'green' },
  { label: 'Inativos', value: inactiveCount, color: 'neutral' },
]

const getClienteInitials = (name: string) =>
  name.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()
```

- [ ] **Step 3: Add mobile JSX block**

Inside the return, after (or instead of) the existing `ModuleMobileLayout` usage — wrap the existing layout in `hidden md:block` and add `md:hidden` mobile block:

```tsx
{/* ── MOBILE VIEW ── */}
<div className="md:hidden flex flex-col h-full">
  {/* Header */}
  <div className="sticky top-14 z-20 bg-neutral-900 border-b border-neutral-800 px-3 pt-3 pb-2 space-y-2">
    <div className="flex items-center justify-between">
      <h1 className="text-lg font-bold text-white">Clientes</h1>
    </div>
    <PillTabBar
      tabs={CLIENTES_TABS}
      activeTab={filter}
      onChange={(k) => setFilter(k as FilterType)}
    />
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
      <input
        type="text"
        placeholder="Buscar cliente..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full pl-9 pr-4 py-2 bg-neutral-800 border border-neutral-700 rounded-xl
          text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
      />
    </div>
  </div>

  <StickySummary items={clientesMobileSummary} />

  <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 pb-24">
    {loading && (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
      </div>
    )}

    {!loading && filteredCustomers.length === 0 && (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <User className="w-10 h-10 text-neutral-600" />
        <p className="text-neutral-500 text-sm font-medium">
          {searchTerm || filter !== 'all' ? 'Nenhum resultado' : 'Nenhum cliente cadastrado'}
        </p>
        {(searchTerm || filter !== 'all') && (
          <button
            onClick={() => { setSearchTerm(''); setFilter('all') }}
            className="text-orange-400 text-xs"
          >
            Limpar filtros
          </button>
        )}
      </div>
    )}

    {!loading && filteredCustomers.map((customer) => {
      const isActive = !customer.deleted
      const swipeActions: SwipeAction[] = [
        {
          key: 'view',
          label: 'Ver',
          icon: <Eye className="w-4 h-4" />,
          color: 'blue',
          onTrigger: () => { setSelectedCustomer(customer); setShowDetails(true) },
        },
        {
          key: 'charge',
          label: 'Cobrar',
          icon: <FileText className="w-4 h-4" />,
          color: 'orange',
          onTrigger: () => router.push(`/pagamentos/cobrancas?cliente=${customer.id}&nome=${encodeURIComponent(customer.name)}`),
        },
      ]

      return (
        <SwipeCard key={customer.id} actions={swipeActions}>
          <MobileCard
            title={customer.name}
            subtitle={customer.email ?? customer.cpfCnpj}
            avatar={getClienteInitials(customer.name)}
            borderColor={isActive ? 'green' : 'neutral'}
            badge={{ label: isActive ? 'Ativo' : 'Inativo', color: isActive ? 'success' : 'info' }}
            expandable
            expandedContent={
              <div className="grid grid-cols-2 gap-2 pb-1">
                {customer.email && (
                  <div className="col-span-2 bg-neutral-800 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-neutral-500 mb-0.5">E-mail</p>
                    <p className="text-xs text-white truncate">{customer.email}</p>
                  </div>
                )}
                {customer.mobilePhone && (
                  <div className="bg-neutral-800 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-neutral-500 mb-0.5">Telefone</p>
                    <p className="text-xs text-white">{customer.mobilePhone}</p>
                  </div>
                )}
                {customer.cpfCnpj && (
                  <div className="bg-neutral-800 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-neutral-500 mb-0.5">CPF/CNPJ</p>
                    <p className="text-xs text-white">{customer.cpfCnpj}</p>
                  </div>
                )}
                <div className="col-span-2 flex gap-2 mt-1">
                  <button
                    onClick={() => { setSelectedCustomer(customer); setShowDetails(true) }}
                    className="flex-1 py-2 bg-blue-500/20 text-blue-400 rounded-lg text-xs font-semibold"
                  >
                    Ver detalhes
                  </button>
                  <button
                    onClick={() => router.push(`/pagamentos/cobrancas?cliente=${customer.id}&nome=${encodeURIComponent(customer.name)}`)}
                    className="flex-1 py-2 bg-orange-500/20 text-orange-400 rounded-lg text-xs font-semibold"
                  >
                    Nova cobrança
                  </button>
                </div>
              </div>
            }
          />
        </SwipeCard>
      )
    })}
  </div>

  <FAB onClick={() => setShowModal(true)} label="Novo cliente" />
</div>
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Verify in browser at 375px**

- Pill tabs switch filter
- Stats bar shows totals
- Cards have green/gray border by status
- Tap card to expand inline (email, phone, CPF, actions)
- Swipe left → Ver + Cobrar

- [ ] **Step 6: Commit**

```bash
git add app/pagamentos/clientes/page.tsx
git commit -m "feat(mobile): add mobile list view for Clientes with expandable cards"
```

---

## Chunk 4: Check-in — Mobile View

### Task 10: Mobile list view for Check-in

**Files:**
- Modify: `app/checkin/page.tsx`

Context:
- State: `checkInData` (CheckInData[]), `loading`, `searchTerm`, `activeFilter`, `selectedSexo`, `selectedPelotao`, `updatingId`, `handleToggleValidation`, `handleDelete`, `confirmDelete`, `setConfirmDelete`
- `item.validated`: boolean
- `item.id`, `item.nome`, `item.cpf`, `item.telefone`, `item.email`, `item.pelotao`, `item.data`
- Pelotão colors: Alfa=orange, Bravo=blue, Charlie=purple, Delta=green, others=neutral

- [ ] **Step 1: Add imports**

```typescript
import { PillTabBar } from '@/components/mobile/pill-tab-bar'
import { StickySummary, type SummaryItem } from '@/components/mobile/sticky-summary'
import { SwipeCard, type SwipeAction } from '@/components/mobile/swipe-card'
import { MobileCard } from '@/components/mobile/mobile-card'
import { FAB } from '@/components/mobile/fab'
import { MobileBottomSheet } from '@/components/mobile/mobile-bottom-sheet'
import { CheckCircle, Eye, Loader2, FilterX } from 'lucide-react'
```

- [ ] **Step 2: Add mobile computed values and filter state inside component**

```typescript
const CHECKIN_PERIOD_TABS = [
  { key: 'all', label: 'Hoje' },
  { key: 'validated', label: 'Validados' },
  { key: 'not_validated', label: 'Pendentes' },
]

const pelotaoColors: Record<string, { bg: string; text: string }> = {
  Alfa:    { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  Bravo:   { bg: 'bg-blue-500/20',   text: 'text-blue-400' },
  Charlie: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  Delta:   { bg: 'bg-green-500/20',  text: 'text-green-400' },
}

const getPelotaoAvatarClass = (pelotao?: string) => {
  const c = pelotaoColors[pelotao ?? ''] ?? { bg: 'bg-neutral-700', text: 'text-neutral-300' }
  return `${c.bg} ${c.text}`
}

const totalValidated = checkInData.filter(c => c.validated).length
const totalPending = checkInData.filter(c => !c.validated).length

const checkinMobileSummary: SummaryItem[] = [
  { label: 'Total', value: checkInData.length, color: 'orange' },
  { label: 'Validados', value: totalValidated, color: 'green' },
  { label: 'Pendentes', value: totalPending, color: 'yellow' },
]

// Count active filters for badge
const activeFilterCount = [
  selectedSexo !== null,
  selectedPelotao !== null,
  activeFilter !== 'all',
].filter(Boolean).length

const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

const uniquePelotoes = Array.from(new Set(checkInData.map(c => c.pelotao).filter(Boolean))) as string[]

const getCheckinInitials = (nome?: string) =>
  (nome ?? 'X').split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()
```

- [ ] **Step 3: Add mobile JSX block**

```tsx
{/* ── MOBILE VIEW ── */}
<div className="md:hidden flex flex-col h-full">
  {/* Header */}
  <div className="sticky top-14 z-20 bg-neutral-900 border-b border-neutral-800 px-3 pt-3 pb-2 space-y-2">
    <div className="flex items-center justify-between">
      <h1 className="text-lg font-bold text-white">Check-in</h1>
      <div className="flex gap-2">
        <button
          onClick={() => setMobileFiltersOpen(true)}
          className="relative flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800
            border border-neutral-700 rounded-xl text-xs text-neutral-400 active:bg-neutral-700"
        >
          Filtros
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-orange-500 text-white text-[9px]
              font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
        <button
          onClick={handleExport}
          className="px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-xl
            text-xs text-neutral-400 active:bg-neutral-700"
        >
          CSV
        </button>
      </div>
    </div>
    <PillTabBar
      tabs={CHECKIN_PERIOD_TABS}
      activeTab={activeFilter}
      onChange={(k) => setActiveFilter(k as 'all' | 'validated' | 'not_validated')}
    />
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
      <input
        type="text"
        placeholder="Buscar membro..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full pl-9 pr-4 py-2 bg-neutral-800 border border-neutral-700 rounded-xl
          text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
      />
    </div>
  </div>

  <StickySummary items={checkinMobileSummary} />

  <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 pb-24">
    {loading && (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
      </div>
    )}

    {!loading && filtered.length === 0 && (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        {activeFilterCount > 0 || searchTerm ? (
          <>
            <FilterX className="w-10 h-10 text-neutral-600" />
            <p className="text-neutral-500 text-sm font-medium">Nenhum resultado</p>
            <button
              onClick={() => {
                setSearchTerm('')
                setActiveFilter('all')
                setSelectedSexo(null)
                setSelectedPelotao(null)
              }}
              className="text-orange-400 text-xs"
            >
              Limpar filtros
            </button>
          </>
        ) : (
          <>
            <Users className="w-10 h-10 text-neutral-600" />
            <p className="text-neutral-500 text-sm font-medium">Nenhum check-in registrado</p>
            <p className="text-neutral-600 text-xs">Toque em + para registrar</p>
          </>
        )}
      </div>
    )}

    {!loading && filtered.map((item) => {
      const isUpdating = updatingId === item.id
      const pelotaoStyle = getPelotaoAvatarClass(item.pelotao)
      const formattedDate = item.data
        ? new Date(item.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : '—'

      const swipeActions: SwipeAction[] = [
        {
          key: 'validate',
          label: item.validated ? 'Desfazer' : 'Validar',
          icon: <CheckCircle className="w-4 h-4" />,
          color: item.validated ? 'yellow' : 'green',
          onTrigger: () => handleToggleValidation(item),
        },
        {
          key: 'view',
          label: 'Ver',
          icon: <Eye className="w-4 h-4" />,
          color: 'blue',
          onTrigger: () => {}, // Card expansion is handled internally by MobileCard's tap (expandable=true)
        },
      ]

      return (
        <SwipeCard
          key={item.id ?? item.cpf}
          actions={swipeActions}
          disabled={isUpdating}
        >
          <MobileCard
            title={item.nome ?? '—'}
            subtitle={`${formattedDate}${item.pelotao ? ` · ${item.pelotao}` : ''}`}
            avatar={getCheckinInitials(item.nome)}
            avatarBg={pelotaoStyle}
            borderColor={item.validated ? 'green' : 'yellow'}
            isUpdating={isUpdating}
            expandable
            expandedContent={
              <div className="grid grid-cols-2 gap-2 pb-1">
                {item.cpf && (
                  <div className="bg-neutral-800 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-neutral-500 mb-0.5">CPF</p>
                    <p className="text-xs text-white">{formatCPF(item.cpf)}</p>
                  </div>
                )}
                {item.telefone && (
                  <div className="bg-neutral-800 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-neutral-500 mb-0.5">Telefone</p>
                    <p className="text-xs text-white">{item.telefone}</p>
                  </div>
                )}
                {item.email && (
                  <div className="col-span-2 bg-neutral-800 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-neutral-500 mb-0.5">E-mail</p>
                    <p className="text-xs text-white truncate">{item.email}</p>
                  </div>
                )}
                <div className="col-span-2 flex gap-2 mt-1">
                  <button
                    onClick={() => handleToggleValidation(item)}
                    disabled={isUpdating}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold disabled:opacity-50
                      ${item.validated
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-green-500/20 text-green-400'}`}
                  >
                    {isUpdating
                      ? 'Atualizando...'
                      : item.validated ? '↩ Desfazer' : '✓ Validar'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(item)}
                    className="px-4 py-2 bg-red-500/10 text-red-400 rounded-lg text-xs font-semibold"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            }
          />
        </SwipeCard>
      )
    })}
  </div>

  {/* Filters bottom sheet */}
  <MobileBottomSheet
    isOpen={mobileFiltersOpen}
    onClose={() => setMobileFiltersOpen(false)}
    title="Filtrar Check-ins"
    height="auto"
  >
    <div className="space-y-5">
      {/* Pelotão filter */}
      <div>
        <p className="text-xs text-neutral-500 font-semibold uppercase tracking-wider mb-2">Pelotão</p>
        <div className="flex flex-wrap gap-2">
          {['Todos', ...uniquePelotoes].map((p) => (
            <button
              key={p}
              onClick={() => setSelectedPelotao(p === 'Todos' ? null : p)}
              className={`py-1.5 px-3 rounded-full text-xs font-semibold transition-colors
                ${(p === 'Todos' && selectedPelotao === null) || selectedPelotao === p
                  ? 'bg-orange-500 text-white'
                  : 'bg-neutral-800 text-neutral-400 border border-neutral-700'}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Status filter */}
      <div>
        <p className="text-xs text-neutral-500 font-semibold uppercase tracking-wider mb-2">Status</p>
        <div className="flex flex-wrap gap-2">
          {([
            { key: 'all', label: 'Todos' },
            { key: 'validated', label: 'Validados' },
            { key: 'not_validated', label: 'Pendentes' },
          ] as const).map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`py-1.5 px-3 rounded-full text-xs font-semibold transition-colors
                ${activeFilter === f.key
                  ? 'bg-orange-500 text-white'
                  : 'bg-neutral-800 text-neutral-400 border border-neutral-700'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => setMobileFiltersOpen(false)}
        className="w-full py-3 bg-orange-500 text-white rounded-xl text-sm font-semibold"
      >
        Aplicar
      </button>
    </div>
  </MobileBottomSheet>

  {/* FAB — new check-in form is out of scope for this iteration (no POST API for new entries exists). FAB is hidden until implemented. */}
</div>
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Verify in browser at 375px**

- Stats bar shows Total/Validados/Pendentes
- Pill tabs switch status filter
- Cards show avatar with pelotão color, green/yellow border
- Tap card to expand CPF/telefone + Validar/Excluir buttons
- Swipe left → Validar + Ver actions
- Filter button opens bottom sheet with chip selectors
- Filter badge count updates when filters active

- [ ] **Step 6: Verify desktop unchanged**

Switch browser to 1280px width. Confirm original table view renders normally — no visual regression.

- [ ] **Step 7: Commit**

```bash
git add app/checkin/page.tsx
git commit -m "feat(mobile): add mobile list view for Check-in with swipe validation and filter sheet"
```

---

## Final Verification

- [ ] **Type-check full project**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Build check**

```bash
npm run build
```
Expected: build completes without errors

- [ ] **Test all three pages at 375px viewport** (DevTools → iPhone SE)

For each page, confirm:
- No horizontal scroll on list
- Primary action reachable in ≤ 2 taps
- FAB visible above bottom nav
- Empty state shows when list is empty

- [ ] **Test desktop at 1280px**

Open Cobranças, Clientes, Check-in at 1280px. Confirm original table and modal still work.

- [ ] **Final commit**

```bash
git add -A
git commit -m "feat(mobile): complete mobile UX system for Pagamentos and Check-in"
```
