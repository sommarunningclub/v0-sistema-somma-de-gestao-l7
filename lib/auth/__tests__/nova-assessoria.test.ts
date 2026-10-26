import { getRequiredPermission } from '../route-permissions'
import { getPagePermission, getSpaRedirect, SECTION_PERMISSIONS, SECTION_LABELS } from '../page-routes'
import { NAV_ITEMS, getNavItem } from '@/lib/nav'
import {
  contatosEmCsv,
  inicioDoPeriodo,
  origemDe,
  resumir,
  type EventoBora,
} from '@/lib/nova-assessoria/resumo'

describe('rotas do módulo Nova Assessoria', () => {
  it('exige a permissão novaAssessoria na API e na página', () => {
    expect(getRequiredPermission('/api/nova-assessoria')).toBe('novaAssessoria')
    expect(getPagePermission('/nova-assessoria')).toBe('novaAssessoria')
  })

  it('redireciona /nova-assessoria para a seção da SPA', () => {
    expect(getSpaRedirect('/nova-assessoria', '')).toBe('/?section=novaAssessoria')
  })

  it('registra a seção novaAssessoria', () => {
    expect(SECTION_PERMISSIONS.novaAssessoria).toBe('novaAssessoria')
    expect(SECTION_LABELS.novaAssessoria).toBe('Nova Assessoria')
    expect(getNavItem('novaAssessoria')?.permission).toBe('novaAssessoria')
    expect(NAV_ITEMS.some((item) => item.id === 'novaAssessoria')).toBe(true)
  })
})

function evento(parcial: Partial<EventoBora>): EventoBora {
  return {
    id: 1,
    criado_em: '2026-10-26T13:00:00.000Z',
    tipo: 'visita',
    pagina: 'assessoria',
    professor: null,
    professor_nome: null,
    professor_whatsapp: null,
    rodizio_posicao: null,
    repetido: false,
    nome: null,
    whatsapp: null,
    visitante_id: null,
    sessao_id: null,
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_term: null,
    utm_content: null,
    click_ids: null,
    referrer: null,
    url: null,
    primeiro_toque: null,
    dispositivo: null,
    navegador: null,
    sistema: null,
    user_agent: null,
    tela: null,
    idioma: null,
    fuso: null,
    ip: null,
    cidade: null,
    regiao: null,
    pais: null,
    ...parcial,
  }
}

describe('origem de um evento', () => {
  it('usa a UTM quando há', () => {
    expect(origemDe(evento({ utm_source: 'instagram', utm_medium: 'bio' }))).toBe('instagram / bio')
  })

  it('sem UTM, usa o click id do anúncio', () => {
    expect(origemDe(evento({ click_ids: { fbclid: 'x' } }))).toBe('Meta (fbclid)')
    expect(origemDe(evento({ click_ids: { gclid: 'x' } }))).toBe('Google Ads (gclid)')
  })

  it('sem UTM nem click id, usa o domínio do referrer, e sem nada é direto', () => {
    expect(origemDe(evento({ referrer: 'https://l.instagram.com/?u=abc' }))).toBe('l.instagram.com')
    expect(origemDe(evento({}))).toBe('direto')
  })
})

describe('resumo do período', () => {
  const eventos = [
    evento({ id: 1, visitante_id: 'a' }),
    evento({ id: 2, visitante_id: 'a' }),
    evento({ id: 3, visitante_id: 'b' }),
    evento({ id: 4, tipo: 'contato', professor: 'joseph', rodizio_posicao: 1, whatsapp: '5561999998888', nome: 'Maria' }),
    evento({ id: 5, tipo: 'contato', professor: 'joseph', repetido: true, whatsapp: '5561999998888', nome: 'Maria' }),
    evento({ id: 6, tipo: 'contato', professor: 'mateus', pagina: 'bio-mateus', whatsapp: '5561988887777', nome: 'João' }),
  ]
  const r = resumir(eventos)

  it('conta visitas, pessoas e conversão', () => {
    expect(r.visitas).toBe(3)
    expect(r.visitantes).toBe(2)
    expect(r.contatos).toBe(3)
    expect(r.pessoas).toBe(2)
    expect(r.conversao).toBe(1)
  })

  it('separa rodízio, link e repetidos por professor', () => {
    const joseph = r.porProfessor.find((p) => p.slug === 'joseph')
    expect(joseph).toMatchObject({ total: 2, rodizio: 1, link: 0, repetidos: 1 })
    expect(r.porProfessor.find((p) => p.slug === 'mateus')).toMatchObject({ total: 1, link: 1 })
    // Professor sem contato continua na lista, com zero.
    expect(r.porProfessor.find((p) => p.slug === 'alexandre')?.total).toBe(0)
  })

  it('conta a hora no horário de Brasília', () => {
    // 13h UTC = 10h em Brasília.
    expect(r.porHora[10]).toBe(3)
  })

  it('exporta só os contatos, com separador ponto e vírgula', () => {
    const linhas = contatosEmCsv(eventos).split('\r\n')
    expect(linhas).toHaveLength(4)
    expect(linhas[0].startsWith('data_hora;nome;whatsapp;professor')).toBe(true)
  })
})

describe('início do período', () => {
  it('começa à meia-noite de Brasília', () => {
    // 26/10 às 01h em Brasília (04h UTC): "hoje" começa 26/10 03h UTC.
    expect(inicioDoPeriodo('hoje', new Date('2026-10-26T04:00:00.000Z'))).toBe('2026-10-26T03:00:00.000Z')
    // 26/10 às 01h UTC ainda é 25/10 em Brasília.
    expect(inicioDoPeriodo('hoje', new Date('2026-10-26T01:00:00.000Z'))).toBe('2026-10-25T03:00:00.000Z')
    expect(inicioDoPeriodo('7d', new Date('2026-10-26T04:00:00.000Z'))).toBe('2026-10-20T03:00:00.000Z')
    expect(inicioDoPeriodo('tudo')).toBeNull()
  })
})
