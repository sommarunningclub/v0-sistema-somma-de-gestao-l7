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
        <div key={`${item.label}-${i}`} className={`rounded-xl p-2 text-center ${colorMap[item.color]}`}>
          <div className="text-sm font-bold leading-tight">{item.value}</div>
          <div className="text-[10px] opacity-70 mt-0.5 leading-tight">{item.label}</div>
        </div>
      ))}
    </div>
  )
}
