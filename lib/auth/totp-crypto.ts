import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

/**
 * Cifra do segredo do Google Authenticator em repouso (AES-256-GCM).
 *
 * O segredo TOTP é, na prática, a segunda senha da conta: quem o tem gera os
 * códigos. Guardá-lo em claro faria um vazamento da tabela (ou um dump de
 * backup) anular a segunda etapa de todo mundo. Cifrado, o banco sozinho não
 * basta — falta `MFA_ENCRYPTION_KEY`, que só existe no ambiente do servidor.
 *
 * Chave própria, separada de `SESSION_SECRET`: girar uma não pode invalidar a
 * outra. Sem a chave, tudo aqui lança — falha fechado, nunca grava em claro.
 *
 * Formato gravado: `v1:<iv b64>:<tag b64>:<cifrado b64>`.
 */

const VERSAO = 'v1'

function chave(): Buffer {
  const bruta = process.env.MFA_ENCRYPTION_KEY
  if (!bruta || bruta.length < 32) {
    throw new Error(
      'MFA_ENCRYPTION_KEY não configurada (mínimo 32 caracteres aleatórios). Sem ela o login em duas etapas não funciona.'
    )
  }
  // SHA-256 normaliza qualquer texto longo para os 32 bytes do AES-256.
  return createHash('sha256').update(bruta).digest()
}

export function cifrarSegredo(segredo: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', chave(), iv)
  const cifrado = Buffer.concat([cipher.update(segredo, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSAO, iv.toString('base64'), tag.toString('base64'), cifrado.toString('base64')].join(':')
}

export function decifrarSegredo(gravado: string): string {
  const [versao, iv, tag, cifrado] = gravado.split(':')
  if (versao !== VERSAO || !iv || !tag || !cifrado) throw new Error('Segredo 2FA em formato desconhecido')
  const decipher = createDecipheriv('aes-256-gcm', chave(), Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(cifrado, 'base64')), decipher.final()]).toString('utf8')
}
