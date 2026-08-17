/**
 * Listas de colunas que o cliente pode gravar em cada tabela.
 *
 * Vivem aqui, e não dentro dos route handlers, porque o App Router só aceita
 * exports com nomes de método HTTP (GET, POST, …) e algumas configs — qualquer
 * outro export quebra a checagem de tipos das rotas geradas pelo Next.
 *
 * Tudo que não está na lista é descartado, então um corpo de requisição
 * malicioso não consegue gravar colunas que a UI não deveria tocar.
 */

export const MEMBROS_PAGE_SIZE = 50

function pick<T extends readonly string[]>(body: unknown, columns: T): Record<string, unknown> {
  if (!body || typeof body !== 'object') return {}
  const source = body as Record<string, unknown>
  const result: Record<string, unknown> = {}
  for (const column of columns) {
    if (source[column] !== undefined) result[column] = source[column]
  }
  return result
}

const MEMBER_COLUMNS = [
  'nome_completo',
  'email',
  'cpf',
  'data_nascimento',
  'whatsapp',
] as const

const INSIDER_COLUMNS = [
  'nome',
  'cpf',
  'tamanho_camisa',
  'evolve',
  'dopahmina',
  'tex_barbearia',
  'big_box',
  'cupom_loja_somma',
  'assessoria_somma',
  'estamina_recovery',
  'email',
  'telefone',
  'data_nascimento',
  'sexo',
  'cep',
  'logradouro',
  'numero',
  'complemento',
  'bairro',
  'cidade',
  'estado',
  'foto_url',
  'ativo',
] as const

export const pickMemberFields = (body: unknown) => pick(body, MEMBER_COLUMNS)
export const pickInsiderFields = (body: unknown) => pick(body, INSIDER_COLUMNS)
