import { randomInt, randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAdminClient } from '@/lib/auth/api-auth'
import { cpfCandidates } from '@/lib/insider/insider-mapper'
import {
  CODIGO_ACESSO_ALFABETO,
  CODIGO_ACESSO_TAMANHO,
  emailDoOperador,
  type Operador,
} from './operadores'

/**
 * Persistência dos operadores da frente de caixa.
 *
 * Três lugares mudam juntos a cada cadastro, e a ordem importa:
 *
 *   1. `auth.users`     — o usuário que o PDV autentica (e-mail sintético,
 *                         senha = código de acesso);
 *   2. `admin_roles`    — a autorização que o PDV checa em toda requisição;
 *   3. `pos_operators`  — o cadastro visível no painel (CPF, nome, status).
 *
 * Sem o 3 o usuário fica órfão e invisível; sem o 2 o login passa e o PDV
 * recusa em seguida. Por isso qualquer falha depois do passo 1 desfaz o que
 * já foi criado — nunca fica um usuário do Auth que ninguém vê.
 */

export const TABELA_OPERADORES = 'pos_operators'
const TABELA_PAPEIS = 'admin_roles'
const PAPEL_OPERADOR = 'operator'
const CAMPOS = 'id, cpf, name, user_id, active, code_issued_at, created_by, created_at, insider_id'

/** Longo o bastante para valer como "desativado". Reativar zera. */
const BANIMENTO = '876000h'

type Linha = {
  id: string
  cpf: string
  name: string
  user_id: string
  active: boolean
  code_issued_at: string
  created_by: string | null
  created_at: string
  /** dados_insiders.id vinculado na liberação; null = só entra por código. */
  insider_id: string | null
}

export class OperadorJaCadastrado extends Error {
  constructor() {
    super('Este CPF já tem acesso ao PDV.')
    this.name = 'OperadorJaCadastrado'
  }
}

export class OperadorNaoEncontrado extends Error {
  constructor() {
    super('Operador não encontrado.')
    this.name = 'OperadorNaoEncontrado'
  }
}

/** Aleatoriedade criptográfica e uniforme; `Math.random()` não serviria para uma senha. */
function gerarAleatorio(tamanho: number): string {
  let saida = ''
  for (let i = 0; i < tamanho; i += 1) {
    saida += CODIGO_ACESSO_ALFABETO[randomInt(0, CODIGO_ACESSO_ALFABETO.length)]
  }
  return saida
}

export function gerarCodigoAcesso(): string {
  return gerarAleatorio(CODIGO_ACESSO_TAMANHO)
}

/**
 * Senha do usuário do Auth quando o operador é Insider e não recebe código:
 * precisa existir (o Auth exige), mas ninguém a usa — o Insider entra só com
 * o CPF, e um "novo código" a substitui se for preciso.
 */
export function gerarSegredoInterno(): string {
  return gerarAleatorio(32)
}

/**
 * Entra só com o CPF (Insider) quem foi vinculado na liberação E cujo
 * registro Insider atual é o mesmo (e está ativo). `aptos` mapeia CPF em
 * dígitos → id do Insider apto hoje.
 */
function paraOperador(linha: Linha, ultimoAcesso: string | null, aptos: Map<string, string>): Operador {
  // Id preenchido de verdade: ausente e null não podem casar com um `get` vazio.
  const insider = Boolean(linha.insider_id) && aptos.get(linha.cpf) === linha.insider_id
  return {
    id: linha.id,
    cpf: linha.cpf,
    nome: linha.name,
    ativo: linha.active,
    insider,
    codigo_gerado_em: linha.code_issued_at,
    ultimo_acesso_em: ultimoAcesso,
    criado_em: linha.created_at,
    criado_por: linha.created_by,
  }
}

async function ultimoAcesso(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.getUserById(userId)
  if (error || !data?.user) return null
  return data.user.last_sign_in_at ?? null
}

async function obterLinha(supabase: SupabaseClient, id: string): Promise<Linha> {
  const { data, error } = await supabase
    .from(TABELA_OPERADORES)
    .select(CAMPOS)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new OperadorNaoEncontrado()
  return data as Linha
}

type LinhaInsider = {
  id: string
  cpf: string | null
  nome: string | null
  ativo: boolean | null
  criado_em?: string | null
}

/**
 * Insider ativo: é quem consegue entrar no PDV só com o CPF, como no Insider
 * Connect em produção (lá o CPF basta; quase ninguém tem senha).
 */
function insiderApto(linha: LinhaInsider | undefined | null): boolean {
  return Boolean(linha) && linha?.ativo !== false
}

/** `desde`: quando o registro Insider foi criado — o painel mostra, para quem libera conferir. */
export type InsiderResumo = { id: string; nome: string | null; apto: boolean; desde: string | null }

/** O CPF é de um SOMMA Insider? Só leitura, nas duas grafias de CPF do banco. */
export async function buscarInsiderPorCpf(cpf: string): Promise<InsiderResumo | null> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('dados_insiders')
    .select('id, cpf, nome, ativo, criado_em')
    .in('cpf', cpfCandidates(cpf))
    .limit(1)
  if (error) throw error

  const linha = (data?.[0] ?? null) as LinhaInsider | null
  if (!linha) return null
  const nome = typeof linha.nome === 'string' && linha.nome.trim() ? linha.nome.trim() : null
  return { id: linha.id, nome, apto: insiderApto(linha), desde: linha.criado_em ?? null }
}

/** CPF (em dígitos) → id do Insider apto, numa única consulta para a listagem. */
async function insidersAptos(supabase: SupabaseClient, cpfs: string[]): Promise<Map<string, string>> {
  if (cpfs.length === 0) return new Map()
  const { data, error } = await supabase
    .from('dados_insiders')
    .select('id, cpf, nome, ativo')
    .in('cpf', cpfs.flatMap((c) => cpfCandidates(c)))
  if (error) throw error

  const aptos = new Map<string, string>()
  for (const linha of (data ?? []) as LinhaInsider[]) {
    const digitos = String(linha.cpf ?? '').replace(/\D/g, '')
    if (insiderApto(linha)) aptos.set(digitos, linha.id)
  }
  return aptos
}

export async function listarOperadores(): Promise<Operador[]> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from(TABELA_OPERADORES)
    .select(CAMPOS)
    .order('created_at', { ascending: false })
  if (error) throw error

  const linhas = (data ?? []) as Linha[]
  // Poucos operadores (é a equipe do balcão): uma consulta ao Auth por linha
  // é mais simples do que paginar todos os usuários do projeto.
  const [acessos, insiders] = await Promise.all([
    Promise.all(linhas.map((l) => ultimoAcesso(supabase, l.user_id))),
    insidersAptos(
      supabase,
      linhas.map((l) => l.cpf)
    ),
  ])
  return linhas.map((linha, i) => paraOperador(linha, acessos[i], insiders))
}

export async function operadorPorCpf(cpf: string): Promise<Operador | null> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from(TABELA_OPERADORES)
    .select(CAMPOS)
    .eq('cpf', cpf)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const insiders = await insidersAptos(supabase, [cpf])
  return paraOperador(data as Linha, null, insiders)
}

/**
 * Nome pelo CPF na base do clube — `cadastro_site` (formulário do site) e,
 * na falta, `checkins` (quem só apareceu em evento). As duas grafias de CPF
 * convivem no banco; `cpfCandidates` cobre ambas. Somente leitura.
 */
export async function buscarNomePorCpf(cpf: string): Promise<string | null> {
  const supabase = getAdminClient()
  const variantes = cpfCandidates(cpf)

  const cadastro = await supabase
    .from('cadastro_site')
    .select('nome_completo')
    .in('cpf', variantes)
    .limit(1)
  const nomeCadastro = cadastro.data?.[0]?.nome_completo
  if (typeof nomeCadastro === 'string' && nomeCadastro.trim()) return nomeCadastro.trim()

  const checkin = await supabase
    .from('checkins')
    .select('nome_completo')
    .in('cpf', variantes)
    .order('data_hora_checkin', { ascending: false, nullsFirst: false })
    .limit(1)
  const nomeCheckin = checkin.data?.[0]?.nome_completo
  if (typeof nomeCheckin === 'string' && nomeCheckin.trim()) return nomeCheckin.trim()

  return null
}

/**
 * Insider (`insiderId` preenchido) não recebe código: entra no PDV só com o
 * CPF, e o PDV confere que o registro Insider atual é ESTE. O usuário do Auth
 * nasce com um segredo interno que ninguém conhece; `codigo` volta null.
 * "Novo código" continua valendo para ele, se um dia precisar.
 */
export async function criarOperador(input: {
  cpf: string
  nome: string
  criadoPor: string | null
  insiderId: string | null
}): Promise<{ operador: Operador; codigo: string | null }> {
  const insider = input.insiderId !== null
  const supabase = getAdminClient()

  const { data: existente, error: erroBusca } = await supabase
    .from(TABELA_OPERADORES)
    .select('id')
    .eq('cpf', input.cpf)
    .maybeSingle()
  if (erroBusca) throw erroBusca
  if (existente) throw new OperadorJaCadastrado()

  const email = emailDoOperador(input.cpf)
  const codigo = insider ? null : gerarCodigoAcesso()

  const { data: criado, error: erroAuth } = await supabase.auth.admin.createUser({
    email,
    password: codigo ?? gerarSegredoInterno(),
    email_confirm: true,
    user_metadata: { nome: input.nome, cpf: input.cpf, origem: 'pdv_operador', insider },
  })
  if (erroAuth || !criado?.user) {
    throw new Error(`Falha ao criar o usuário do operador no Auth: ${erroAuth?.message ?? 'sem usuário'}`)
  }
  const userId = criado.user.id

  try {
    const { error: erroPapel } = await supabase
      .from(TABELA_PAPEIS)
      .insert({ id: randomUUID(), user_id: userId, email, role: PAPEL_OPERADOR })
    if (erroPapel) throw erroPapel

    const { data: linha, error: erroLinha } = await supabase
      .from(TABELA_OPERADORES)
      .insert({
        cpf: input.cpf,
        name: input.nome,
        user_id: userId,
        created_by: input.criadoPor,
        insider_id: input.insiderId,
      })
      .select(CAMPOS)
      .single()
    if (erroLinha) throw erroLinha

    const aptos = new Map<string, string>(input.insiderId ? [[input.cpf, input.insiderId]] : [])
    return { operador: paraOperador(linha as Linha, null, aptos), codigo }
  } catch (err) {
    // Desfaz o que já existe: um usuário sem linha aqui ficaria invisível ao
    // painel e, com papel, ainda conseguiria entrar no PDV.
    await supabase.from(TABELA_PAPEIS).delete().eq('user_id', userId)
    await supabase.auth.admin.deleteUser(userId)
    throw err
  }
}

/** Troca a senha no Auth: o código anterior deixa de valer na hora. */
export async function regenerarCodigo(id: string): Promise<{ operador: Operador; codigo: string }> {
  const supabase = getAdminClient()
  const linha = await obterLinha(supabase, id)

  const codigo = gerarCodigoAcesso()
  const { error: erroAuth } = await supabase.auth.admin.updateUserById(linha.user_id, {
    password: codigo,
  })
  if (erroAuth) throw new Error(`Falha ao trocar o código no Auth: ${erroAuth.message}`)

  const agora = new Date().toISOString()
  const { data, error } = await supabase
    .from(TABELA_OPERADORES)
    .update({ code_issued_at: agora, updated_at: agora })
    .eq('id', id)
    .select(CAMPOS)
    .single()
  if (error) throw error

  const [acesso, insiders] = await Promise.all([
    ultimoAcesso(supabase, linha.user_id),
    insidersAptos(supabase, [linha.cpf]),
  ])
  return { operador: paraOperador(data as Linha, acesso, insiders), codigo }
}

/**
 * Desativar tira o papel (o PDV recusa a próxima requisição, mesmo com
 * sessão aberta) e bane o usuário (o login recusa). Reativar desfaz os dois.
 */
export async function definirAtivo(id: string, ativo: boolean): Promise<Operador> {
  const supabase = getAdminClient()
  const linha = await obterLinha(supabase, id)
  const email = emailDoOperador(linha.cpf)

  if (ativo) {
    const { error: erroAuth } = await supabase.auth.admin.updateUserById(linha.user_id, {
      ban_duration: 'none',
    })
    if (erroAuth) throw new Error(`Falha ao reativar no Auth: ${erroAuth.message}`)

    // Sem unique em admin_roles.user_id: apaga antes para não duplicar.
    await supabase.from(TABELA_PAPEIS).delete().eq('user_id', linha.user_id)
    const { error: erroPapel } = await supabase
      .from(TABELA_PAPEIS)
      .insert({ id: randomUUID(), user_id: linha.user_id, email, role: PAPEL_OPERADOR })
    if (erroPapel) throw erroPapel
  } else {
    const { error: erroPapel } = await supabase
      .from(TABELA_PAPEIS)
      .delete()
      .eq('user_id', linha.user_id)
    if (erroPapel) throw erroPapel

    const { error: erroAuth } = await supabase.auth.admin.updateUserById(linha.user_id, {
      ban_duration: BANIMENTO,
    })
    if (erroAuth) throw new Error(`Falha ao desativar no Auth: ${erroAuth.message}`)
  }

  const { data, error } = await supabase
    .from(TABELA_OPERADORES)
    .update({ active: ativo, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(CAMPOS)
    .single()
  if (error) throw error

  const [acesso, insiders] = await Promise.all([
    ultimoAcesso(supabase, linha.user_id),
    insidersAptos(supabase, [linha.cpf]),
  ])
  return paraOperador(data as Linha, acesso, insiders)
}

/**
 * Remove de vez: papel, usuário do Auth e cadastro. As vendas continuam em
 * `pos_sales`, mas `operator_user_id` vira null (FK `on delete set null`).
 */
export async function removerOperador(id: string): Promise<void> {
  const supabase = getAdminClient()
  const linha = await obterLinha(supabase, id)

  const { error: erroPapel } = await supabase
    .from(TABELA_PAPEIS)
    .delete()
    .eq('user_id', linha.user_id)
  if (erroPapel) throw erroPapel

  const { error: erroAuth } = await supabase.auth.admin.deleteUser(linha.user_id)
  if (erroAuth) throw new Error(`Falha ao remover o usuário do Auth: ${erroAuth.message}`)

  // O cascade da FK já apaga a linha; repetir aqui é só garantia.
  const { error } = await supabase.from(TABELA_OPERADORES).delete().eq('id', id)
  if (error) throw error
}
