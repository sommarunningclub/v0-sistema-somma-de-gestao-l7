/**
 * Nome do aluno para o link pessoal.
 *
 * A gestão guarda `customer_name` como veio do Asaas (às vezes tudo em
 * maiúsculas, às vezes com espaço sobrando). O convite pré-preenche nome e
 * sobrenome na pesquisa, então vale apresentar do jeito que a pessoa escreveria.
 * Mesma regra de `lib/assessoria-nps/nome.ts` no site.
 */

const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'di', 'del', 'du', 'd'])

export function capitalizarNome(raw: string | null | undefined): string {
  const limpo = String(raw ?? '')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
  if (!limpo) return ''

  const temMinuscula = limpo !== limpo.toLocaleUpperCase('pt-BR')
  const temMaiuscula = limpo !== limpo.toLocaleLowerCase('pt-BR')
  // Caixa mista ("McArthur", "de Souza") é escolha de quem escreveu.
  if (temMinuscula && temMaiuscula) return limpo

  return limpo
    .toLocaleLowerCase('pt-BR')
    .split(' ')
    .map((p, i) =>
      i > 0 && PARTICULAS.has(p)
        ? p
        : p.replace(/(^|[-'’])(\p{L})/gu, (_, sep: string, letra: string) => sep + letra.toLocaleUpperCase('pt-BR')),
    )
    .join(' ')
}

export function separarNomeCompleto(completo: string | null | undefined): { nome: string; sobrenome: string } {
  const partes = capitalizarNome(completo).split(' ').filter(Boolean)
  if (partes.length === 0) return { nome: '', sobrenome: '' }
  return { nome: partes[0], sobrenome: partes.slice(1).join(' ') }
}
