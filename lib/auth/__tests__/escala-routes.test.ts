import { getRequiredPermission } from '../route-permissions'
import { getPagePermission, getSpaRedirect, SECTION_PERMISSIONS, SECTION_LABELS } from '../page-routes'

describe('rotas do módulo Escala', () => {
  it('exige a permissão escala nas rotas de API', () => {
    expect(getRequiredPermission('/api/escala')).toBe('escala')
    expect(getRequiredPermission('/api/escala/atividades')).toBe('escala')
    expect(getRequiredPermission('/api/escala/evento/abc-123')).toBe('escala')
  })

  it('não afeta as rotas de outros módulos', () => {
    expect(getRequiredPermission('/api/checkin')).toBe('checkin')
    expect(getRequiredPermission('/api/tarefas/tasks')).toBe('tarefas')
  })

  it('exige a permissão escala na página', () => {
    expect(getPagePermission('/escala')).toBe('escala')
  })

  it('redireciona /escala para a seção da SPA', () => {
    expect(getSpaRedirect('/escala', '')).toBe('/?section=escala')
  })

  it('registra a seção escala', () => {
    expect(SECTION_PERMISSIONS.escala).toBe('escala')
    expect(SECTION_LABELS.escala).toBe('Escala')
  })
})
