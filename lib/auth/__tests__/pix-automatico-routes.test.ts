import { getRequiredPermission } from '../route-permissions'
import { getPagePermission, getSpaRedirect, SECTION_PERMISSIONS, SECTION_LABELS } from '../page-routes'
import { gerarCodigo, VALIDADE_HORAS } from '@/lib/pix-automatico/tokens'
import { NAV_ITEMS, getNavItem } from '@/lib/nav'

describe('rotas do módulo Pix Automático', () => {
  it('exige a permissão pixAutomatico nas rotas de API', () => {
    expect(getRequiredPermission('/api/pix-automatico/tokens')).toBe('pixAutomatico')
  })

  it('não afeta as rotas de outros módulos', () => {
    expect(getRequiredPermission('/api/pdv/diagnostics')).toBe('pdv')
    expect(getRequiredPermission('/api/admin/users')).toBe('admin')
  })

  it('exige a permissão pixAutomatico na página', () => {
    expect(getPagePermission('/pix-automatico')).toBe('pixAutomatico')
  })

  it('redireciona /pix-automatico para a seção da SPA', () => {
    expect(getSpaRedirect('/pix-automatico', '')).toBe('/?section=pixAutomatico')
  })

  it('registra a seção pixAutomatico', () => {
    expect(SECTION_PERMISSIONS.pixAutomatico).toBe('pixAutomatico')
    expect(SECTION_LABELS.pixAutomatico).toBe('Pix Automático')
    expect(getNavItem('pixAutomatico')?.permission).toBe('pixAutomatico')
    expect(NAV_ITEMS.some((item) => item.id === 'pixAutomatico')).toBe(true)
  })
})

describe('códigos de liberação', () => {
  it('gera no formato XXXX-XXXX', () => {
    for (let i = 0; i < 50; i++) {
      expect(gerarCodigo()).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/)
    }
  })

  it('não usa caracteres que se confundem ao ditar por telefone', () => {
    const amostra = Array.from({ length: 200 }, () => gerarCodigo()).join('')
    expect(amostra).not.toMatch(/[IO01]/)
  })

  it('vale por um dia', () => {
    expect(VALIDADE_HORAS).toBe(24)
  })
})
