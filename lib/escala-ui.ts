import type { EstadoPreenchimento } from '@/lib/types/escala'

export const CORES_ESTADO: Record<
  EstadoPreenchimento,
  { texto: string; fundo: string; borda: string; ponto: string }
> = {
  completo: { texto: 'text-green-400', fundo: 'bg-green-500/15', borda: 'border-green-500/30', ponto: 'bg-green-500' },
  parcial: { texto: 'text-yellow-400', fundo: 'bg-yellow-500/15', borda: 'border-yellow-500/30', ponto: 'bg-yellow-500' },
  vazio: { texto: 'text-red-400', fundo: 'bg-red-500/10', borda: 'border-red-500/30', ponto: 'bg-red-500' },
}

export const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']

/** `mes` 1-based. Ex.: nomeDoMes(2026, 8) === 'agosto de 2026' */
export function nomeDoMes(ano: number, mes: number): string {
  return new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
}
