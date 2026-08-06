import { isPublicApiRoute, getRequiredPermission } from '../route-permissions'
import { isOpenPage, isPublicPage, getSpaRedirect, getPagePermission } from '../page-routes'

describe('rotas públicas do /insider', () => {
  it('libera lookup e register sem sessão', () => {
    expect(isPublicApiRoute('/api/insiders/lookup', 'POST')).toBe(true)
    expect(isPublicApiRoute('/api/insiders/register', 'POST')).toBe(true)
  })

  it('não libera outros métodos nessas rotas', () => {
    expect(isPublicApiRoute('/api/insiders/lookup', 'GET')).toBe(false)
    expect(isPublicApiRoute('/api/insiders/register', 'DELETE')).toBe(false)
  })

  it('mantém a rota interna /api/insider protegida', () => {
    expect(isPublicApiRoute('/api/insider/eventos', 'GET')).toBe(false)
    expect(getRequiredPermission('/api/insider/eventos')).toBe('pagamentos')
  })

  it('/insider é página aberta, não página de visitante', () => {
    expect(isOpenPage('/insider')).toBe(true)
    expect(isPublicPage('/insider')).toBe(false)
    expect(isOpenPage('/login')).toBe(false)
    expect(isOpenPage('/crm')).toBe(false)
  })

  it('/insider não redireciona para a SPA nem exige permissão', () => {
    expect(getSpaRedirect('/insider', '')).toBeNull()
    expect(getPagePermission('/insider')).toBeNull()
  })
})
