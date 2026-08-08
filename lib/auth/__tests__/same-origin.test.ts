/**
 * @jest-environment node
 */
import { isSameOrigin } from '../same-origin'

function req(headers: Record<string, string>): Request {
  return new Request('https://admin.sommaclub.com.br/api/insiders/entrar', {
    method: 'POST',
    headers,
  })
}

describe('isSameOrigin', () => {
  it('aceita quando o Origin bate com o host', () => {
    expect(isSameOrigin(req({
      origin: 'https://admin.sommaclub.com.br',
      host: 'admin.sommaclub.com.br',
    }))).toBe(true)
  })

  it('recusa quando o Origin é de outro site', () => {
    expect(isSameOrigin(req({
      origin: 'https://site-malicioso.com',
      host: 'admin.sommaclub.com.br',
    }))).toBe(false)
  })

  it('recusa quando o Origin tem o host como sufixo', () => {
    expect(isSameOrigin(req({
      origin: 'https://admin.sommaclub.com.br.malicioso.com',
      host: 'admin.sommaclub.com.br',
    }))).toBe(false)
  })

  it('aceita quando não há Origin mas o Referer é do mesmo host', () => {
    expect(isSameOrigin(req({
      referer: 'https://admin.sommaclub.com.br/insider',
      host: 'admin.sommaclub.com.br',
    }))).toBe(true)
  })

  it('recusa quando o Referer é de outro site', () => {
    expect(isSameOrigin(req({
      referer: 'https://site-malicioso.com/pagina',
      host: 'admin.sommaclub.com.br',
    }))).toBe(false)
  })

  it('recusa quando não há nem Origin nem Referer', () => {
    expect(isSameOrigin(req({ host: 'admin.sommaclub.com.br' }))).toBe(false)
  })

  it('recusa quando não há host', () => {
    expect(isSameOrigin(req({ origin: 'https://admin.sommaclub.com.br' }))).toBe(false)
  })

  it('usa x-forwarded-host quando presente, como atrás de proxy', () => {
    expect(isSameOrigin(req({
      origin: 'https://admin.sommaclub.com.br',
      host: 'localhost:3000',
      'x-forwarded-host': 'admin.sommaclub.com.br',
    }))).toBe(true)
  })

  it('ignora Origin malformado sem lançar', () => {
    expect(isSameOrigin(req({ origin: 'nao-e-url', host: 'admin.sommaclub.com.br' }))).toBe(false)
  })
})
