import { getRequiredPermission } from '../route-permissions'
import { getPagePermission, getSpaRedirect, SECTION_PERMISSIONS, SECTION_LABELS } from '../page-routes'
import { NAV_ITEMS, getNavItem } from '@/lib/nav'

describe('rotas do módulo NPS Assessoria', () => {
  it('exige a permissão nps nas rotas de API', () => {
    expect(getRequiredPermission('/api/nps/rodadas')).toBe('nps')
    expect(getRequiredPermission('/api/nps/rodadas/6f1c2a3e-1b2c-4d5e-8f90-123456789abc/relatorio')).toBe('nps')
    expect(getRequiredPermission('/api/nps/respostas/6f1c2a3e-1b2c-4d5e-8f90-123456789abc/tratativa')).toBe('nps')
  })

  it('não captura prefixos parecidos', () => {
    expect(getRequiredPermission('/api/npsx/qualquer')).toBeNull()
  })

  it('exige a permissão nps na página e redireciona para a SPA', () => {
    expect(getPagePermission('/nps')).toBe('nps')
    expect(getSpaRedirect('/nps', '')).toBe('/?section=nps')
  })

  it('registra a seção nps', () => {
    expect(SECTION_PERMISSIONS.nps).toBe('nps')
    expect(SECTION_LABELS.nps).toBe('NPS Assessoria')
    expect(getNavItem('nps')?.permission).toBe('nps')
    expect(NAV_ITEMS.filter((item) => item.id === 'nps')).toHaveLength(1)
  })
})
