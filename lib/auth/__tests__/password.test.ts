import { createHash } from 'crypto'
import { hashPassword, verifyPassword, isBcryptHash } from '../password'

describe('password', () => {
  it('should hash with bcrypt', async () => {
    const hash = await hashPassword('senha123')
    expect(isBcryptHash(hash)).toBe(true)
  })

  it('should verify bcrypt password', async () => {
    const hash = await hashPassword('senha123')
    const result = await verifyPassword('senha123', hash)
    expect(result.valid).toBe(true)
    expect(result.needsRehash).toBe(false)
  })

  it('should verify legacy sha256 and flag rehash', async () => {
    const legacy = createHash('sha256').update('senha123').digest('hex')

    const result = await verifyPassword('senha123', legacy)
    expect(result.valid).toBe(true)
    expect(result.needsRehash).toBe(true)
  })

  it('should reject wrong password', async () => {
    const hash = await hashPassword('senha123')
    const result = await verifyPassword('errada', hash)
    expect(result.valid).toBe(false)
  })
})
