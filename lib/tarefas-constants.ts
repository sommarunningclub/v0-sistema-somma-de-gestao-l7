// lib/tarefas-constants.ts

export type TarefaPrioridade = 'baixa' | 'media' | 'alta' | 'urgente'

export const TAREFAS_PRIORIDADES: {
  id: TarefaPrioridade
  label: string
  badgeBg: string
  badgeText: string
}[] = [
  { id: 'baixa',   label: 'Baixa',   badgeBg: 'bg-blue-900/60',   badgeText: 'text-blue-300' },
  { id: 'media',   label: 'Média',   badgeBg: 'bg-purple-900/60', badgeText: 'text-purple-300' },
  { id: 'alta',    label: 'Alta',    badgeBg: 'bg-orange-900/60', badgeText: 'text-orange-300' },
  { id: 'urgente', label: 'Urgente', badgeBg: 'bg-red-900/60',    badgeText: 'text-red-300' },
]

export const COLUMN_COLORS = [
  { label: 'Cinza',    value: '#6b7280' },
  { label: 'Azul',     value: '#3b82f6' },
  { label: 'Verde',    value: '#22c55e' },
  { label: 'Amarelo',  value: '#f59e0b' },
  { label: 'Laranja',  value: '#f97316' },
  { label: 'Vermelho', value: '#ef4444' },
  { label: 'Roxo',     value: '#8b5cf6' },
]
