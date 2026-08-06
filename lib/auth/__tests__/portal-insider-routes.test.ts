import { isOpenPage, isPublicPage, getPagePermission } from '../page-routes'
import { isPublicApiRoute, getRequiredPermission } from '../route-permissions'

describe('páginas do portal', () => {
  it('/insider e /insider/painel são páginas abertas', () => {
    expect(isOpenPage('/insider')).toBe(true)
    expect(isOpenPage('/insider/painel')).toBe(true)
  })

  it('não são páginas de visitante nem exigem permissão', () => {
    expect(isPublicPage('/insider/painel')).toBe(false)
    expect(getPagePermission('/insider/painel')).toBeNull()
  })

  it('não abre a página interna /insiders (plural)', () => {
    expect(isOpenPage('/insiders')).toBe(false)
  })
})

describe('rotas de API do portal', () => {
  it('libera entrar e sair', () => {
    expect(isPublicApiRoute('/api/insiders/entrar', 'POST')).toBe(true)
    expect(isPublicApiRoute('/api/insiders/sair', 'POST')).toBe(true)
  })

  it('libera as rotas eu* do gate do middleware', () => {
    expect(isPublicApiRoute('/api/insiders/eu', 'GET')).toBe(true)
    expect(isPublicApiRoute('/api/insiders/eu/eventos', 'GET')).toBe(true)
  })

  it('mantém as rotas internas /api/insider protegidas', () => {
    expect(isPublicApiRoute('/api/insider/eventos', 'GET')).toBe(false)
    expect(getRequiredPermission('/api/insider/eventos')).toBe('pagamentos')
  })

  it('não libera nada fora do portal', () => {
    expect(isPublicApiRoute('/api/insiders', 'GET')).toBe(false)
    expect(isPublicApiRoute('/api/admin/users', 'GET')).toBe(false)
  })
})
