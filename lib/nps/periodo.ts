/**
 * Período das rodadas do NPS: bimestres do calendário.
 *
 * Três formas do mesmo bimestre, cada uma com seu lugar:
 * - `2026-B5`: a referência gravada no banco (ordena e agrupa);
 * - "set–out 2026": o que a tela mostra;
 * - `2026-set-out`: o código do link público.
 *
 * O site tem o espelho do rótulo em `lib/assessoria-nps/rodada.ts`.
 *
 * Datas: Brasília não tem horário de verão desde 2019, então o fuso é fixo em
 * -03:00. As contas de janela ficam exatas sem biblioteca de fuso horário.
 */

export const FUSO_BRASILIA = '-03:00'
const OFFSET_MS = 3 * 60 * 60 * 1000
const HORA_MS = 60 * 60 * 1000
const DIA_MS = 24 * HORA_MS

const NOMES = [
  { rotulo: 'jan–fev', slug: 'jan-fev' },
  { rotulo: 'mar–abr', slug: 'mar-abr' },
  { rotulo: 'mai–jun', slug: 'mai-jun' },
  { rotulo: 'jul–ago', slug: 'jul-ago' },
  { rotulo: 'set–out', slug: 'set-out' },
  { rotulo: 'nov–dez', slug: 'nov-dez' },
] as const

export interface Bimestre {
  ano: number
  /** 1 = jan–fev … 6 = nov–dez. */
  numero: number
}

const pad = (n: number) => String(n).padStart(2, '0')

export function referenciaDoBimestre({ ano, numero }: Bimestre): string {
  return `${ano}-B${numero}`
}

export function lerReferencia(referencia: string | null | undefined): Bimestre | null {
  const m = /^(\d{4})-B([1-6])$/.exec(referencia ?? '')
  return m ? { ano: Number(m[1]), numero: Number(m[2]) } : null
}

export function rotuloDoBimestre({ ano, numero }: Bimestre): string {
  return `${NOMES[numero - 1].rotulo} ${ano}`
}

/** Referência fora do padrão bimestral aparece como veio. */
export function rotuloDaReferencia(referencia: string | null | undefined): string {
  const b = lerReferencia(referencia)
  return b ? rotuloDoBimestre(b) : referencia || 'Sem período'
}

export function slugDoBimestre({ ano, numero }: Bimestre): string {
  return `${ano}-${NOMES[numero - 1].slug}`
}

export function tituloPadrao(b: Bimestre): string {
  return `NPS da Assessoria · ${rotuloDoBimestre(b)}`
}

/** A data vista no relógio de Brasília, em campos UTC para aritmética simples. */
function relogioBrasilia(d: Date): Date {
  return new Date(d.getTime() - OFFSET_MS)
}

export function bimestreDaData(d: Date): Bimestre {
  const local = relogioBrasilia(d)
  return { ano: local.getUTCFullYear(), numero: Math.ceil((local.getUTCMonth() + 1) / 2) }
}

export function proximoBimestre({ ano, numero }: Bimestre): Bimestre {
  return numero === 6 ? { ano: ano + 1, numero: 1 } : { ano, numero: numero + 1 }
}

export function bimestreAnterior({ ano, numero }: Bimestre): Bimestre {
  return numero === 1 ? { ano: ano - 1, numero: 6 } : { ano, numero: numero - 1 }
}

/** O anterior (para registrar uma rodada atrasada), o atual e os próximos. */
export function bimestresParaEscolha(agora: Date, proximos = 5): Bimestre[] {
  const atual = bimestreDaData(agora)
  const lista = [bimestreAnterior(atual), atual]
  let b = atual
  for (let i = 0; i < proximos; i++) {
    b = proximoBimestre(b)
    lista.push(b)
  }
  return lista
}

export function inicioDoBimestre({ ano, numero }: Bimestre): Date {
  const mes = (numero - 1) * 2 + 1
  return new Date(`${ano}-${pad(mes)}-01T00:00:00${FUSO_BRASILIA}`)
}

/** Quantos dias a rodada fica no ar por padrão. */
export const DIAS_NO_AR = 15

/**
 * Janela sugerida ao criar uma rodada: abre às 7h do primeiro dia do bimestre
 * (ou na próxima hora cheia, se o bimestre já começou) e fica 15 dias no ar,
 * fechando às 23h59 do último dia.
 */
export function janelaSugerida(b: Bimestre, agora: Date): { abre: Date; fecha: Date } {
  const seteDaManha = new Date(inicioDoBimestre(b).getTime() + 7 * HORA_MS)
  const proximaHora = new Date(Math.ceil(agora.getTime() / HORA_MS) * HORA_MS)
  const abre = seteDaManha > agora ? seteDaManha : proximaHora

  const ultimoDia = relogioBrasilia(new Date(abre.getTime() + (DIAS_NO_AR - 1) * DIA_MS))
  const fecha = new Date(
    `${ultimoDia.getUTCFullYear()}-${pad(ultimoDia.getUTCMonth() + 1)}-${pad(ultimoDia.getUTCDate())}T23:59:00${FUSO_BRASILIA}`,
  )
  return { abre, fecha }
}

/** `<input type="datetime-local">` fala hora sem fuso. No painel, é sempre Brasília. */
export function paraCampoDataHora(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return relogioBrasilia(d).toISOString().slice(0, 16)
}

export function deCampoDataHora(valor: string | null | undefined): string | null {
  if (!valor || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) return null
  const d = new Date(`${valor}:00${FUSO_BRASILIA}`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

const FORMATO_DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const FORMATO_DATA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '-' : FORMATO_DATA_HORA.format(d)
}

export function formatarData(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '-' : FORMATO_DATA.format(d)
}
