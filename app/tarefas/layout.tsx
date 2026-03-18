import { TarefasFiltersProvider } from '@/lib/context/tarefas-filters-context'

export default function TarefasLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <TarefasFiltersProvider>
      {children}
    </TarefasFiltersProvider>
  )
}
