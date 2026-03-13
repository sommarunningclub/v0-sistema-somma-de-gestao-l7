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
      className={`flex gap-2 overflow-x-auto pb-0 ${className ?? ''}`}
      style={{ scrollbarWidth: 'none' }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          aria-current={activeTab === tab.key ? 'page' as const : undefined}
          className={`flex-shrink-0 py-2.5 px-4 rounded-full text-xs font-semibold whitespace-nowrap
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
