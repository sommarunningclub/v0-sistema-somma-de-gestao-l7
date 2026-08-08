import uFuzzy from '@leeoniya/ufuzzy'

/**
 * Busca do painel.
 *
 * O que a busca precisa acertar aqui, e que a versão anterior (um `includes`
 * de substring) errava:
 *
 * 1. **Acentos.** Em português, exigir o acento certo inviabiliza a busca:
 *    ninguém digita "Fabrício" com acento no meio da operação. Buscar "fabricio"
 *    tem de achar "Fabrício", e buscar "JOSÉ" tem de achar "jose".
 * 2. **Ordem das palavras.** "silva maria" precisa achar "Maria da Silva".
 *    Antes, a consulta inteira era comparada como uma única substring.
 * 3. **Erro de digitação.** "rodrigues" vs "rodriges" — um caractere a mais ou
 *    a menos não pode zerar o resultado.
 * 4. **Documentos e telefones.** "05326833743" precisa achar "053.268.337-43",
 *    e "61996" achar "(61) 99996-8034". Formatação é ruído, não informação.
 * 5. **Relevância.** Quem digita "ana" espera "Ana Paula" antes de
 *    "Mariana Fernandes" — ordenar por índice do banco entrega o contrário.
 *
 * O motor é o uFuzzy: ~8KB, feito para filtrar listas grandes rapidamente, com
 * `latinize()` nativo para diacríticos. A alternativa (Fuse.js) é mais lenta em
 * listas do tamanho da base de membros e não traz vantagem aqui.
 */

/** Termos com menos caracteres que isto não recebem tolerância a erro de digitação. */
const MIN_CHARS_FUZZY = 4
/** Sequências de dígitos a partir daqui são tratadas como CPF/telefone. */
const MIN_DIGITS_BUSCA = 3

/**
 * Uma instância por configuração, reaproveitada entre chamadas — construir o
 * regex do uFuzzy a cada tecla seria desperdício.
 *
 * `intraMode: 1` é o modo de erro único do uFuzzy: cada palavra tolera UMA
 * inserção, substituição, transposição ou omissão. Acima disso a busca começa
 * a trazer ruído. O padrão `intraSlice` mantém a primeira letra obrigatória —
 * quem digita "rod" não quer ver "Pedro".
 */
const fuzzy = new uFuzzy({
  intraMode: 1,
  intraIns: 1,
  intraSub: 1,
  intraTrn: 1,
  intraDel: 1,
})

/** Instância estrita, sem tolerância a erro — usada para termos curtos. */
const estrito = new uFuzzy({ intraMode: 0 })

export function normalizeSearchQuery(query: string): string {
  return query.toLowerCase().trim()
}

export function stripNonDigits(value: string): string {
  return value.replace(/\D/g, '')
}

/** Escapa caracteres especiais do operador ilike do Postgres/Supabase */
export function escapeIlike(term: string): string {
  return term.replace(/[%_\\]/g, '\\$&')
}

/** Minúsculas + sem acentos. É a forma em que tudo é comparado. */
export function foldText(value: string | null | undefined): string {
  if (!value) return ''
  return uFuzzy.latinize([value.toLowerCase()])[0]
}

type Campos = (string | null | undefined)[]

/**
 * Diz se um registro atende à busca.
 *
 * Mantém a assinatura antiga de propósito: os nove módulos que já a usavam
 * ganham acentuação, ordem livre e busca por documento sem precisar mudar uma
 * linha. Para listas onde a ORDEM importa, prefira `searchAndRank`.
 */
export function matchesTextSearch(query: string, fields: Campos): boolean {
  const termos = tokenize(query)
  if (termos.length === 0) return true

  const texto = fields.map(foldText).filter(Boolean).join(' ')
  if (!texto) return false
  const digitos = fields.map((f) => stripNonDigits(f ?? '')).join(' ')

  // Todo termo precisa aparecer em algum lugar do registro (E entre termos).
  return termos.every((termo) => termoCasaTexto(termo, texto, digitos))
}

function tokenize(query: string): string[] {
  return foldText(query).split(/\s+/).filter(Boolean)
}

function termoCasaTexto(termo: string, texto: string, digitos: string): boolean {
  if (texto.includes(termo)) return true

  // CPF/telefone: compara só os dígitos, ignorando pontuação dos dois lados.
  const termoDigitos = stripNonDigits(termo)
  if (termoDigitos.length >= MIN_DIGITS_BUSCA && digitos.includes(termoDigitos)) {
    return true
  }

  /*
   * Erro de digitação, só para termos longos o bastante.
   *
   * `filter` devolve um ARRAY VAZIO quando não encontra nada — não `null`.
   * Testar apenas `!== null` fazia toda busca casar com todo registro, o que
   * transformava a tolerância a erro em "aceita qualquer coisa".
   */
  if (termo.length >= MIN_CHARS_FUZZY) {
    const achados = fuzzy.filter([texto], termo)
    return achados !== null && achados.length > 0
  }

  return false
}

export interface ResultadoBusca<T> {
  item: T
  /** Menor é melhor. Usado só para ordenar. */
  posicao: number
}

/**
 * Filtra E ordena por relevância.
 *
 * Diferente de `matchesTextSearch`, aqui o uFuzzy pontua os resultados: prefixo
 * vence meio de palavra, início do campo vence fim, e menos lacunas entre os
 * caracteres vence mais lacunas.
 *
 * `getFields` deve retornar os campos na ordem de importância — o primeiro
 * costuma ser o nome, e é ele que o usuário tem em mente ao digitar.
 */
export function searchAndRank<T>(
  items: T[],
  query: string,
  getFields: (item: T) => Campos,
): T[] {
  const termos = tokenize(query)
  if (termos.length === 0) return items
  if (items.length === 0) return items

  const camposPorItem = items.map(getFields)
  const haystack = camposPorItem.map((campos) => campos.map(foldText).filter(Boolean).join(' ⋅ '))
  const digitos = camposPorItem.map((campos) =>
    campos.map((c) => stripNonDigits(c ?? '')).join(' '),
  )

  const agulha = termos.join(' ')
  const motor = agulha.length >= MIN_CHARS_FUZZY ? fuzzy : estrito

  /*
   * `outOfOrder = 1`: "silva maria" acha "Maria da Silva". O custo cresce com o
   * número de permutações, então o uFuzzy limita internamente a poucos termos —
   * suficiente para nomes.
   */
  const [idxs, info, order] = motor.search(haystack, agulha, 1)

  const encontrados = new Map<number, number>()

  if (idxs && info && order) {
    order.forEach((posicaoOrdenada, i) => {
      encontrados.set(info.idx[posicaoOrdenada], i)
    })
  } else if (idxs) {
    idxs.forEach((idx, i) => encontrados.set(idx, i))
  }

  /*
   * Documentos entram por fora: o uFuzzy trabalha com palavras e trataria
   * "053.268.337-43" como vários tokens. Comparar dígito a dígito é mais
   * direto e mais previsível para quem cola um CPF do WhatsApp.
   */
  const termoDigitos = stripNonDigits(query)
  if (termoDigitos.length >= MIN_DIGITS_BUSCA) {
    digitos.forEach((d, idx) => {
      if (d.includes(termoDigitos) && !encontrados.has(idx)) {
        // Casamento exato de documento é forte: vai para o topo.
        encontrados.set(idx, -1)
      }
    })
  }

  return [...encontrados.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([idx]) => items[idx])
}

/**
 * Variantes acentuadas para busca no Postgres.
 *
 * O banco não tem a extensão `unaccent` habilitada, e `ilike` não normaliza
 * diacríticos — então "jose" nunca acharia "José" no lado do servidor. A saída
 * é transformar o termo num regex onde cada vogal aceita suas variantes, e usar
 * o operador `~*` (case-insensitive) do PostgREST.
 */
const VARIANTES: Record<string, string> = {
  a: 'aáàâãä',
  e: 'eéèêë',
  i: 'iíìîï',
  o: 'oóòôõö',
  u: 'uúùûü',
  c: 'cç',
  n: 'nñ',
}

/** Escapa o que é especial em regex do Postgres. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function toAccentInsensitiveRegex(term: string): string {
  return escapeRegex(term.toLowerCase())
    .split('')
    .map((ch) => (VARIANTES[ch] ? `[${VARIANTES[ch]}]` : ch))
    .join('')
}

/** Quebra a consulta em termos já prontos para o `~*` do Postgres. */
export function toSearchTerms(query: string): string[] {
  return normalizeSearchQuery(query).split(/\s+/).filter(Boolean)
}
