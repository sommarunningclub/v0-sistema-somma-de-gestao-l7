export type BeneficioTipo = 'status' | 'cupom' | 'descricao' | 'percentual'

export type Beneficio = {
  chave: string
  rotulo: string
  tipo: BeneficioTipo
  valor: string
  /** false = não exibir (sem valor cadastrado) */
  disponivel: boolean
}

/** Colunas lidas do banco para montar os benefícios. Nunca inclui senha. */
export const BENEFICIO_COLUNAS =
  'evolve, dopahmina, tex_barbearia, cupom_loja_somma, big_box, assessoria_somma, estamina_recovery'

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : valor == null ? '' : String(valor).trim()
}

/**
 * O texto de `evolve` carrega anotação administrativa interna sobre a
 * situação financeira da pessoa. Só o status sai daqui — o restante nunca
 * pode chegar ao browser.
 */
function statusEvolve(valor: unknown): string {
  return texto(valor).toLowerCase().startsWith('ativo') ? 'Ativo' : 'Inativo'
}

function percentual(valor: unknown): { valor: string; disponivel: boolean } {
  const bruto = texto(valor)
  // Normalize Brazilian decimal comma to dot
  const normalizado = bruto.replace(',', '.')
  const numero = Number.parseFloat(normalizado)
  // Only accept values in the range (0, 1] — a fraction between 0% and 100%
  if (!bruto || Number.isNaN(numero) || numero <= 0 || numero > 1) {
    if (bruto) {
      console.warn(`[beneficios] percentual inválido em dopahmina: ${JSON.stringify(bruto)}`)
    }
    return { valor: '', disponivel: false }
  }
  const pct = Math.round(numero * 100)
  return { valor: `${pct}% de desconto`, disponivel: true }
}

function simples(valor: unknown, tipo: 'cupom' | 'descricao') {
  const bruto = texto(valor)
  return { valor: bruto, disponivel: bruto.length > 0, tipo }
}

export function montarBeneficios(row: Record<string, unknown>): Beneficio[] {
  const dopamina = percentual(row.dopahmina)
  const tex = simples(row.tex_barbearia, 'descricao')
  const loja = simples(row.cupom_loja_somma, 'cupom')
  const bigBox = simples(row.big_box, 'cupom')
  const estamina = simples(row.estamina_recovery, 'descricao')

  return [
    {
      chave: 'evolve',
      rotulo: 'Evolve',
      tipo: 'status',
      valor: statusEvolve(row.evolve),
      disponivel: true,
    },
    {
      chave: 'dopahmina',
      rotulo: 'Dopamina',
      tipo: 'percentual',
      valor: dopamina.valor,
      disponivel: dopamina.disponivel,
    },
    {
      chave: 'tex_barbearia',
      rotulo: 'Tex Barbearia',
      tipo: 'descricao',
      valor: tex.valor,
      disponivel: tex.disponivel,
    },
    {
      chave: 'cupom_loja_somma',
      rotulo: 'Loja Somma',
      tipo: 'cupom',
      valor: loja.valor,
      disponivel: loja.disponivel,
    },
    {
      chave: 'big_box',
      rotulo: 'Big Box',
      tipo: 'cupom',
      valor: bigBox.valor,
      disponivel: bigBox.disponivel,
    },
    {
      chave: 'assessoria_somma',
      rotulo: 'Assessoria Somma',
      tipo: 'status',
      valor: texto(row.assessoria_somma).toLowerCase().startsWith('sim') ? 'Ativo' : 'Não incluído',
      disponivel: true,
    },
    {
      chave: 'estamina_recovery',
      rotulo: 'Estamina Recovery',
      tipo: 'descricao',
      valor: estamina.valor,
      disponivel: estamina.disponivel,
    },
  ]
}
