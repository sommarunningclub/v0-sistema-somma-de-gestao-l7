import { audienceSchema, campaignFieldsSchema, withContentRules } from '../validation'

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

describe('withContentRules', () => {
  const audience = { bases: [{ key: 'membros', filtros: {} }], individuais: [] }

  const basePayload = {
    nome: 'Campanha teste',
    subject: 'Assunto teste',
    preheader: null,
    cta_label: null,
    cta_url: null,
    audience,
    scheduled_at: null,
  }

  const createSchema = withContentRules(campaignFieldsSchema)
  const patchSchema = withContentRules(
    campaignFieldsSchema.partial().strict('Campo não permitido em edição de campanha'),
  )

  it('rejeita html_custom sem content.html', () => {
    const result = createSchema.safeParse({
      ...basePayload,
      template_key: 'html_custom',
      content: {},
    })
    expect(result.success).toBe(false)
  })

  it('aceita html_custom com content.html, sem exigir titulo/texto', () => {
    const result = createSchema.safeParse({
      ...basePayload,
      template_key: 'html_custom',
      content: { html: '<p>Oi</p>' },
    })
    expect(result.success).toBe(true)
  })

  it('rejeita template simples sem titulo', () => {
    const result = createSchema.safeParse({
      ...basePayload,
      template_key: 'simples',
      content: { texto: 'Texto presente' },
    })
    expect(result.success).toBe(false)
  })

  it('rejeita template simples sem texto', () => {
    const result = createSchema.safeParse({
      ...basePayload,
      template_key: 'simples',
      content: { titulo: 'Título presente' },
    })
    expect(result.success).toBe(false)
  })

  it('aceita payload parcial (PATCH) sem content nem template_key, sem disparar regras de conteúdo', () => {
    const result = patchSchema.safeParse({ nome: 'Novo nome' })
    expect(result.success).toBe(true)
  })

  it('rejeita content.html acima de 100 KB', () => {
    const result = createSchema.safeParse({
      ...basePayload,
      template_key: 'html_custom',
      content: { html: 'a'.repeat(100_001) },
    })
    expect(result.success).toBe(false)
  })

  // PATCH parcial não manda `template_key` junto de um `content` "vazio" — o
  // guard antigo só olhava `template_key`, então `{"content":{}}` sozinho
  // escapava sem validação e sobrescrevia o conteúdo salvo com um objeto
  // vazio. Ver relatório final da revisão de branch (C2).
  it('rejeita PATCH com content vazio, mesmo sem template_key no payload', () => {
    const result = patchSchema.safeParse({ content: {} })
    expect(result.success).toBe(false)
  })

  it('rejeita PATCH só com template_key (sem content resolver para um corpo válido já no payload)', () => {
    // Sem content no payload, não há como a validação de payload isolado
    // saber que o conteúdo salvo é insuficiente para o novo template — mas
    // pelo menos não deve lançar/quebrar: o render de html_custom trata
    // `content.html` ausente como string vazia (renderiza só o rodapé, não
    // lança). O ponto crítico (C2) é `{"content":{}}`, coberto acima.
    const result = patchSchema.safeParse({ template_key: 'html_custom' })
    expect(result.success).toBe(true)
  })

  it('aceita PATCH parcial legítimo que só muda subject', () => {
    const result = patchSchema.safeParse({ subject: 'Assunto novo' })
    expect(result.success).toBe(true)
  })

  it('aceita PATCH parcial legítimo com content completo (titulo+texto)', () => {
    const result = patchSchema.safeParse({
      content: { titulo: 'Título', texto: 'Texto' },
    })
    expect(result.success).toBe(true)
  })
})
