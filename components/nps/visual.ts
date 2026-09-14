/**
 * Cores e formatos do módulo NPS.
 *
 * As cores dos gráficos foram conferidas no validador de paleta do dataviz
 * contra `surface-raised` (#16181c):
 * - detrator / promotor (#e66767 / #3987e5): polos de uma escala divergente,
 *   passam em todas as checagens (ΔE daltonismo 19,2; contraste >= 3:1);
 * - neutro (#6a717c): meio da escala. É cinza de propósito, e fica perto do
 *   vermelho para daltônicos (ΔE 7,0), por isso toda barra do NPS vai com
 *   legenda e rótulo em texto, nunca só cor;
 * - destaque (#ff2c04) contra base cinza: ênfase de uma barra entre várias.
 *
 * Os tokens de status (success/danger) ficam para estado, não para série.
 */

export const COR_DETRATOR = '#e66767'
export const COR_NEUTRO = '#6a717c'
export const COR_PROMOTOR = '#3987e5'
export const COR_DESTAQUE = '#ff2c04'
export const COR_BASE = '#6a717c'
export const COR_GRADE = '#292c31'
export const COR_EIXO = '#949aa4'
export const COR_SUPERFICIE = '#16181c'

export const CATEGORIA = {
  detractor: { rotulo: 'Detrator', plural: 'Detratores', cor: COR_DETRATOR, tone: 'danger' as const },
  passive: { rotulo: 'Neutro', plural: 'Neutros', cor: COR_NEUTRO, tone: 'neutral' as const },
  promoter: { rotulo: 'Promotor', plural: 'Promotores', cor: COR_PROMOTOR, tone: 'info' as const },
}

export function corDaNota(nota: number): string {
  if (nota >= 9) return COR_PROMOTOR
  if (nota >= 7) return COR_NEUTRO
  return COR_DETRATOR
}

export function formatarDecimal(valor: number | null | undefined, casas = 1): string {
  if (valor === null || valor === undefined) return '-'
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
}

export function formatarNps(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '-'
  const texto = valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  return valor > 0 ? `+${texto}` : texto
}

export function formatarPct(valor: number): string {
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

/** Variação com sinal, para pontos de NPS ou de escala. */
export function formatarVariacao(valor: number, casas = 1): string {
  const texto = Math.abs(valor).toLocaleString('pt-BR', { maximumFractionDigits: casas })
  if (valor > 0) return `+${texto}`
  if (valor < 0) return `-${texto}`
  return '0'
}
