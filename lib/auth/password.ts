import { createHash } from 'crypto'
import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12
const BCRYPT_PREFIX = '$2'

function sha256Legacy(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

export function isBcryptHash(hash: string): boolean {
  return hash.startsWith(BCRYPT_PREFIX)
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (isBcryptHash(storedHash)) {
    const valid = await bcrypt.compare(password, storedHash)
    return { valid, needsRehash: false }
  }

  const legacy = sha256Legacy(password)
  const valid = legacy === storedHash
  return { valid, needsRehash: valid }
}
