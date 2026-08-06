import {
  areAsaasQueryParamsAllowed,
  isAsaasEndpointAllowed,
  normalizeAsaasEndpoint,
} from '../proxy-policy'

describe('asaas proxy-policy', () => {
  it('normalizes endpoint paths', () => {
    expect(normalizeAsaasEndpoint('customers')).toBe('/customers')
    expect(normalizeAsaasEndpoint('/customers?limit=10')).toBe('/customers')
  })

  it('allows customer operations used by the app', () => {
    expect(isAsaasEndpointAllowed('GET', '/customers')).toBe(true)
    expect(isAsaasEndpointAllowed('POST', '/customers')).toBe(true)
    expect(isAsaasEndpointAllowed('PUT', '/customers/cus_123')).toBe(true)
    expect(isAsaasEndpointAllowed('DELETE', '/customers/cus_123')).toBe(true)
  })

  it('allows payment operations used by the app', () => {
    expect(isAsaasEndpointAllowed('GET', '/payments')).toBe(true)
    expect(isAsaasEndpointAllowed('POST', '/payments')).toBe(true)
    expect(isAsaasEndpointAllowed('DELETE', '/payments/pay_123')).toBe(true)
    expect(isAsaasEndpointAllowed('POST', '/payments/pay_123/refund')).toBe(true)
  })

  it('allows subscription operations used by the app', () => {
    expect(isAsaasEndpointAllowed('GET', '/subscriptions')).toBe(true)
    expect(isAsaasEndpointAllowed('POST', '/subscriptions')).toBe(true)
  })

  it('blocks dangerous proxy paths', () => {
    expect(isAsaasEndpointAllowed('GET', '/transfers')).toBe(false)
    expect(isAsaasEndpointAllowed('POST', '/transfers')).toBe(false)
    expect(isAsaasEndpointAllowed('GET', '/financialTransactions')).toBe(false)
    expect(isAsaasEndpointAllowed('GET', '/../customers')).toBe(false)
    expect(isAsaasEndpointAllowed('POST', '/payments/pay_123/refund/extra')).toBe(false)
  })

  it('validates allowed query params', () => {
    expect(areAsaasQueryParamsAllowed({ limit: '100', customer: 'cus_1' })).toBe(true)
    expect(areAsaasQueryParamsAllowed({ limit: '100', evil: '1' })).toBe(false)
  })
})
