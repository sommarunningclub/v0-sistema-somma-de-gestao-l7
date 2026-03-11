export type CRMStage =
  | 'novo_lead'
  | 'contato_inicial'
  | 'proposta_enviada'
  | 'negociacao'
  | 'fechado_ganho'
  | 'perdido'

export const CRM_STAGES: { id: CRMStage; label: string; color: string }[] = [
  { id: 'novo_lead', label: 'Novo Lead', color: 'bg-blue-500' },
  { id: 'contato_inicial', label: 'Contato Inicial', color: 'bg-yellow-500' },
  { id: 'proposta_enviada', label: 'Proposta Enviada', color: 'bg-purple-500' },
  { id: 'negociacao', label: 'Negociação', color: 'bg-orange-500' },
  { id: 'fechado_ganho', label: 'Fechado (Ganho)', color: 'bg-green-500' },
  { id: 'perdido', label: 'Perdido', color: 'bg-red-500' },
]
