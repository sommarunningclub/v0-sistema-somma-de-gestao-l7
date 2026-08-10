import { audienceSchema } from '../validation'

describe('audienceSchema', () => {
  it('rejeita mais de 50 destinatários individuais', () => {
    const individuais = Array.from({ length: 51 }, (_, i) => ({
      email: `pessoa${i}@x.com`,
      nome: null,
    }))
    const result = audienceSchema.safeParse({ bases: [], individuais })
    expect(result.success).toBe(false)
  })

  it('rejeita quando bases e individuais estão ambos vazios', () => {
    const result = audienceSchema.safeParse({ bases: [], individuais: [] })
    expect(result.success).toBe(false)
  })
})
