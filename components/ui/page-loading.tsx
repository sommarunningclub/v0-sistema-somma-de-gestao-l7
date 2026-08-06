interface PageLoadingProps {
  label?: string
  className?: string
  fullScreen?: boolean
}

export function PageLoading({
  label = 'Carregando...',
  className = '',
  fullScreen = false,
}: PageLoadingProps) {
  return (
    <div
      className={`flex items-center justify-center ${
        fullScreen ? 'min-h-screen w-full' : 'h-48'
      } ${className}`}
    >
      <div className="flex items-center gap-3 text-neutral-400">
        <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">{label}</span>
      </div>
    </div>
  )
}
