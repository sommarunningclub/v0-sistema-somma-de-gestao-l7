/**
 * Regressões das correções de segurança: cada caso aqui corresponde a um
 * comportamento que já esteve errado em produção.
 */
import { getRequiredPermission } from '../route-permissions'
import { validatePasswordPolicy, SENHA_MIN_LENGTH } from '../password-policy'
import { checkRateLimit, clientKey } from '../rate-limit'
import { isValidAttachmentUrl } from '@/lib/services/attachment-url'

describe('permissões de rota (defesa em profundidade no middleware)', () => {
  it('exige parceiro no lookup de CNPJ', () => {
    expect(getRequiredPermission('/api/cnpj')).toBe('parceiro')
  })

  it('cobre os módulos que antes ficavam só na checagem do handler', () => {
    expect(getRequiredPermission('/api/membros')).toBe('membros')
    expect(getRequiredPermission('/api/membros/123')).toBe('membros')
    expect(getRequiredPermission('/api/vagas')).toBe('vagas')
    expect(getRequiredPermission('/api/command-center/metrics')).toBe('dashboard')
  })

  it('não muda os prefixos já existentes', () => {
    expect(getRequiredPermission('/api/admin/users')).toBe('admin')
    expect(getRequiredPermission('/api/coupons')).toBe('pagamentos')
    expect(getRequiredPermission('/api/partner-codes')).toBe('parceiro')
    expect(getRequiredPermission('/api/auth/me')).toBeNull()
  })
})

describe('política de senha do painel', () => {
  it('recusa a senha de 6 caracteres que a UI antiga aceitava', () => {
    expect(validatePasswordPolicy('123456')).not.toBeNull()
  })

  it('recusa senha ausente ou de tipo errado', () => {
    expect(validatePasswordPolicy('')).not.toBeNull()
    expect(validatePasswordPolicy(undefined)).not.toBeNull()
    expect(validatePasswordPolicy(12345678901234)).not.toBeNull()
  })

  it('aceita a partir do mínimo e recusa acima do teto do bcrypt', () => {
    expect(validatePasswordPolicy('a'.repeat(SENHA_MIN_LENGTH))).toBeNull()
    expect(validatePasswordPolicy('a'.repeat(72))).toBeNull()
    expect(validatePasswordPolicy('a'.repeat(73))).not.toBeNull()
  })
})

function fakeRequest(headers: Record<string, string>): Request {
  return {
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  } as unknown as Request
}

describe('clientKey', () => {
  it('prefere o cabeçalho escrito pela plataforma ao x-forwarded-for do cliente', () => {
    const req = fakeRequest({
      'x-vercel-forwarded-for': '1.1.1.1',
      'x-real-ip': '2.2.2.2',
      'x-forwarded-for': '6.6.6.6',
    })
    expect(clientKey(req)).toBe('1.1.1.1')
  })

  it('usa x-real-ip antes do x-forwarded-for forjável', () => {
    const req = fakeRequest({ 'x-real-ip': '2.2.2.2', 'x-forwarded-for': '6.6.6.6' })
    expect(clientKey(req)).toBe('2.2.2.2')
  })

  it('ainda aceita x-forwarded-for quando é o único disponível', () => {
    expect(clientKey(fakeRequest({ 'x-forwarded-for': '3.3.3.3, 4.4.4.4' }))).toBe('3.3.3.3')
  })
})

describe('rate limit do login admin', () => {
  it('bloqueia a partir da tentativa que excede o limite, com Retry-After', () => {
    const chave = `login:ip:test-${Math.random()}`
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit(chave, 10, 60_000).allowed).toBe(true)
    }
    const bloqueado = checkRateLimit(chave, 10, 60_000)
    expect(bloqueado.allowed).toBe(false)
    expect(bloqueado.retryAfterSeconds).toBeGreaterThan(0)
  })
})

describe('URL de anexo', () => {
  const original = process.env.NEXT_PUBLIC_SUPABASE_URL

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = original
  })

  it('recusa esquemas que não são https', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://projeto.supabase.co'
    expect(isValidAttachmentUrl('javascript:alert(1)')).toBe(false)
    expect(isValidAttachmentUrl('http://projeto.supabase.co/x.png')).toBe(false)
    expect(isValidAttachmentUrl('data:text/html,<script>')).toBe(false)
  })

  it('recusa host fora do projeto Supabase', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://projeto.supabase.co'
    expect(isValidAttachmentUrl('https://evil.example/x.png')).toBe(false)
  })

  it('aceita a URL pública do próprio storage', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://projeto.supabase.co'
    expect(
      isValidAttachmentUrl('https://projeto.supabase.co/storage/v1/object/public/crm-attachments/a.png')
    ).toBe(true)
  })

  it('recusa lixo e strings gigantes', () => {
    expect(isValidAttachmentUrl('')).toBe(false)
    expect(isValidAttachmentUrl('nao-e-url')).toBe(false)
    expect(isValidAttachmentUrl(null)).toBe(false)
    expect(isValidAttachmentUrl(`https://projeto.supabase.co/${'a'.repeat(3000)}`)).toBe(false)
  })
})
