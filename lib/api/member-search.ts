import { stripNonDigits, toAccentInsensitiveRegex, toSearchTerms } from '@/lib/search-utils'

// `toAccentInsensitiveRegex` já vive em `@/lib/search-utils` (com testes próprios
// em `lib/__tests__/search-utils.test.ts`) — reexportada aqui para que quem
// consome este módulo não precise saber disso.
export { toAccentInsensitiveRegex }

/**
 * Filtro de busca de membros — a única busca do painel que roda no banco, sobre
 * milhares de registros. Três decisões importam aqui:
 *
 * 1. **`imatch` (`~*`) no lugar de `ilike`.** O banco não tem a extensão
 *    `unaccent`, e `ilike` não normaliza diacríticos: buscar "jose" jamais
 *    acharia "José". O termo vira um regex onde cada vogal aceita suas
 *    variantes acentuadas (ver `toAccentInsensitiveRegex`).
 * 2. **Um `.or()` por termo.** O PostgREST une parâmetros repetidos com AND,
 *    então "maria silva" exige que AMBOS apareçam — em qualquer campo e em
 *    qualquer ordem. Antes a frase inteira era comparada como uma substring
 *    única, e "silva maria" não achava "Maria da Silva".
 * 3. **Documento e telefone comparados por dígitos.** Quem cola um CPF traz a
 *    pontuação junto; quem digita, não. Se o termo é uma sequência de dígitos,
 *    ela também é procurada de forma tolerante à formatação do campo.
 *
 * Usada por `/api/membros` (edição de cadastro, precisa da permissão `membros`)
 * e por `/api/email-audiences/pessoas` (autocomplete do envio individual de
 * e-mail, só precisa da permissão `email`) — o filtro é o mesmo, o que muda é
 * quem pode chamá-lo e quais colunas a rota devolve.
 */
export function applyMemberSearch<T extends { or: (filter: string) => T }>(
  query: T,
  term: string,
): T {
  let q = query

  for (const termo of toSearchTerms(term)) {
    const regex = toAccentInsensitiveRegex(termo)
    const condicoes = [
      `nome_completo.imatch.${regex}`,
      `email.imatch.${regex}`,
      `cpf.imatch.${regex}`,
      `whatsapp.imatch.${regex}`,
    ]

    /*
     * Para dígitos, monta um padrão que aceita qualquer pontuação entre eles:
     * "05326833743" casa com "053.268.337-43" e vice-versa.
     */
    const digitos = stripNonDigits(termo)
    if (digitos.length >= 3) {
      const comPontuacao = digitos.split('').join('[^0-9]*')
      condicoes.push(`cpf.imatch.${comPontuacao}`, `whatsapp.imatch.${comPontuacao}`)
    }

    q = q.or(condicoes.join(','))
  }

  return q
}
