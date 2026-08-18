export type PdvStatusTone = 'neutral' | 'success' | 'warning' | 'danger'

export type PdvDiagnostics = {
  shopify: {
    auth: 'ok' | 'error'
    authError: string | null
    apiVersion: string
    shop: { name: string; myshopifyDomain: string; currencyCode: string } | null
    location: { name: string; id: string } | null
    locationId: string
  }
  mercadoPago: {
    accessTokenConfigured: boolean
    webhookSecretConfigured: boolean
    apiAuth: 'ok' | 'unavailable'
    apiError: string | null
    terminals: Array<{
      id: string
      masked: string
      store_id: string | number | null
      pos_id: string | number | null
      operating_mode: string
    }>
    selected: {
      terminal_id: string
      masked: string
      store_id: string | null
      pos_id: string | null
      operating_mode: string
    } | null
    pdvModeReady: boolean
  }
  webhook: {
    url: string | null
    event: string
    last: {
      action: string | null
      topic: string | null
      resource_id: string | null
      received_at: string
      processed_at: string | null
      process_error: string | null
    } | null
  }
  activity: {
    lastMercadoPagoOrder: {
      external_reference: string
      mercadopago_order_id: string
      status: string
      created_at: string
    } | null
    lastShopifyOrder: {
      shopify_order_name: string | null
      shopify_order_id: string | null
      shopify_synced_at: string | null
    } | null
    pendingShopifySync: Array<{
      id: string
      external_reference: string
      total_amount: number
      paid_at: string | null
      retry_count: number
      last_error_message: string | null
    }>
    recentErrors: Array<{
      external_reference: string
      status: string
      last_error_code: string | null
      last_error_message: string | null
      updated_at: string
    }>
  }
}

export type PdvOrderDiagnostics = {
  sale: {
    sale_id: string
    external_reference: string
    mercadopago_order_id: string
    terminal_id_esperado: string | null
    total_amount: number
    status_local: string
    created_at: string
  }
  order: {
    id: string | null
    type: string | null
    status: string | null
    status_detail: string | null
    processing_mode: string | null
    expiration_time: string | null
    created_date: string | null
    last_updated_date: string | null
    external_reference: string | null
    config_point: { terminal_id: string | null; print_on_terminal: string | null }
    application_id: string | null
    payments: Array<{
      id: string | null
      amount: string | null
      status: string | null
      status_detail: string | null
    }>
  }
  terminal_confere: boolean
}

export function formatPdvBRL(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${sign}R$ ${whole},${String(abs % 100).padStart(2, '0')}`
}

export function formatPdvWhen(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR')
}

export function joinPosUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
}

export function pdvFrontUrl(): string {
  return (process.env.NEXT_PUBLIC_POS_FRONT_URL || 'https://somma-pdv-point.vercel.app/pdv').replace(
    /\/$/,
    '',
  )
}
