/*
 * Política de senha do painel, isolada de `password.ts` porque a UI de
 * `/systems` também precisa dela e não pode arrastar `bcryptjs`/`crypto` para
 * o bundle do browser.
 *
 * O mínimo era 6 e só era conferido na UI, então bastava um POST direto em
 * /api/admin/users para criar acesso administrativo com senha de um caractere.
 * 12 é o piso; 72 é o teto do bcrypt, que trunca silenciosamente acima disso.
 */
export const SENHA_MIN_LENGTH = 12
export const SENHA_MAX_LENGTH = 72

/** Devolve a mensagem de erro, ou null se a senha for aceitável. */
export function validatePasswordPolicy(password: unknown): string | null {
  if (typeof password !== 'string' || !password) {
    return 'Senha é obrigatória.'
  }
  if (password.length < SENHA_MIN_LENGTH) {
    return `A senha deve ter ao menos ${SENHA_MIN_LENGTH} caracteres.`
  }
  if (password.length > SENHA_MAX_LENGTH) {
    return `A senha deve ter no máximo ${SENHA_MAX_LENGTH} caracteres.`
  }
  return null
}
