import { getAdminClient } from './api-auth'
import { cifrarSegredo, decifrarSegredo } from './totp-crypto'
import { gerarSegredoTotp, verificarTotp } from './totp'
import type { EtapaMfa } from './session'

/**
 * Persistência do Google Authenticator por usuário (`public.user_totp`).
 *
 * O segredo só sai daqui decifrado para conferir um código ou para montar o
 * QR code do cadastro — nunca vai para o banco em claro.
 */

const TABELA = 'user_totp'

type Linha = {
  user_id: string
  secret_enc: string
  enabled_at: string | null
  last_used_step: number | null
}

async function obterLinha(userId: string): Promise<Linha | null> {
  const { data, error } = await getAdminClient()
    .from(TABELA)
    .select('user_id, secret_enc, enabled_at, last_used_step')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (data as Linha | null) ?? null
}

/** Etapa que o login por senha deve pedir: cadastrar o autenticador ou digitar o código. */
export async function etapaDoUsuario(userId: string): Promise<EtapaMfa> {
  const linha = await obterLinha(userId)
  return linha?.enabled_at ? 'codigo' : 'cadastro'
}

/**
 * Começa (ou recomeça) o cadastro com um segredo NOVO a cada chamada. Reusar
 * um segredo não confirmado deixaria quem iniciou o cadastro antes — talvez
 * outra pessoa com a senha — conhecer o segredo que o dono vai confirmar.
 *
 * Recusa se a conta já tem autenticador confirmado: trocar exige que um
 * administrador redefina o 2FA antes.
 */
export async function iniciarCadastro(userId: string): Promise<{ segredo: string } | { jaConfirmado: true }> {
  const linha = await obterLinha(userId)
  if (linha?.enabled_at) return { jaConfirmado: true }

  const segredo = gerarSegredoTotp()
  const agora = new Date().toISOString()
  const { error } = await getAdminClient()
    .from(TABELA)
    .upsert(
      {
        user_id: userId,
        secret_enc: cifrarSegredo(segredo),
        enabled_at: null,
        last_used_step: null,
        updated_at: agora,
      },
      { onConflict: 'user_id' }
    )
  if (error) throw error
  return { segredo }
}

export type ResultadoCodigo = 'ok' | 'invalido' | 'estado_mudou'

/**
 * Confere o código da etapa pendente e, se valer, grava o passo usado.
 *
 *   'cadastro'  confirma o autenticador recém-escaneado (enabled_at passa a valer)
 *   'codigo'    login normal; código de passo já usado é recusado
 *
 * As gravações são condicionais: duas requisições com o mesmo código ao mesmo
 * tempo não passam as duas — só uma encontra a linha no estado esperado.
 */
export async function conferirCodigo(userId: string, etapa: EtapaMfa, codigo: string): Promise<ResultadoCodigo> {
  const linha = await obterLinha(userId)
  if (!linha) return 'estado_mudou'
  if (etapa === 'cadastro' && linha.enabled_at) return 'estado_mudou'
  if (etapa === 'codigo' && !linha.enabled_at) return 'estado_mudou'

  const passo = verificarTotp(decifrarSegredo(linha.secret_enc), codigo, {
    ultimoPassoUsado: linha.last_used_step,
  })
  if (passo === null) return 'invalido'

  const agora = new Date().toISOString()
  let consulta = getAdminClient()
    .from(TABELA)
    .update(
      etapa === 'cadastro'
        ? { enabled_at: agora, last_used_step: passo, updated_at: agora }
        : { last_used_step: passo, updated_at: agora }
    )
    .eq('user_id', userId)
    // Mesmo segredo que foi conferido: um recadastro no meio do caminho invalida.
    .eq('secret_enc', linha.secret_enc)

  consulta =
    etapa === 'cadastro'
      ? consulta.is('enabled_at', null)
      : consulta.or(`last_used_step.is.null,last_used_step.lt.${passo}`)

  const { data, error } = await consulta.select('user_id')
  if (error) throw error
  return data && data.length > 0 ? 'ok' : 'invalido'
}

/** "Redefinir 2FA" do painel: a pessoa cadastra um autenticador novo no próximo login. */
export async function redefinirMfa(userId: string): Promise<void> {
  const { error } = await getAdminClient().from(TABELA).delete().eq('user_id', userId)
  if (error) throw error
}

/** user_id → já tem autenticador confirmado. Para a lista de usuários do painel. */
export async function usuariosComMfa(): Promise<Set<string>> {
  const { data, error } = await getAdminClient()
    .from(TABELA)
    .select('user_id')
    .not('enabled_at', 'is', null)
  if (error) throw error
  return new Set((data ?? []).map((l: { user_id: string }) => l.user_id))
}
