'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  CreditCard,
  ExternalLink,
  RefreshCw,
  ShoppingBag,
  Smartphone,
  Store,
  Webhook,
} from 'lucide-react'

import { apiFetch } from '@/lib/api-client'
import {
  formatPdvBRL,
  formatPdvWhen,
  pdvFrontUrl,
  type PdvDiagnostics,
  type PdvOrderDiagnostics,
} from '@/lib/pdv/types'
import { ErrorBanner } from '@/components/ui/error-banner'
import { Button } from '@/components/ui/button'
import {
  EmptyState,
  PageHeader,
  PageShell,
  Panel,
  PanelHeader,
  SectionTitle,
  StatGrid,
  StatGridSkeleton,
  StatTile,
  StatusPill,
  Well,
  confirmAction,
  notify,
  type StatusTone,
} from '@/components/somma'

function toneForOk(ok: boolean): StatusTone {
  return ok ? 'success' : 'warning'
}

function readOrder(status: string | null): { tone: StatusTone; text: string } {
  switch (status) {
    case 'created':
    case 'ready':
      return {
        tone: 'warning',
        text: 'O Mercado Pago criou a cobrança, mas ainda não a entregou à maquininha. Na Point, toque em Atualizar.',
      }
    case 'at_terminal':
      return {
        tone: 'success',
        text: 'A cobrança chegou à Point. Se não aparecer, confira se a tela de frente de caixa está aberta.',
      }
    case 'expired':
      return {
        tone: 'danger',
        text: 'A cobrança expirou (validade de 10 minutos). É preciso criar uma nova pela frente de caixa.',
      }
    case 'processed':
      return { tone: 'success', text: 'Pagamento processado.' }
    case 'canceled':
      return { tone: 'danger', text: 'Cobrança cancelada.' }
    default:
      return { tone: 'neutral', text: '' }
  }
}

export function PdvModule() {
  const [data, setData] = useState<PdvDiagnostics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [order, setOrder] = useState<PdvOrderDiagnostics | null>(null)
  const [orderError, setOrderError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/pdv/diagnostics')
      const body = (await res.json().catch(() => ({}))) as PdvDiagnostics & { error?: string }
      if (!res.ok) {
        setError(body.error || 'Não foi possível carregar o diagnóstico do PDV.')
        setData(null)
        return
      }
      setData(body)
      setError(null)
    } catch {
      setError('Falha de conexão com o PDV.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function postJson(url: string, body: unknown, key: string) {
    setBusy(key)
    try {
      const res = await apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        notify.error('Não foi possível concluir a operação', {
          description: payload.error || res.statusText,
        })
        return false
      }
      await load()
      return true
    } catch {
      notify.error('Falha de conexão com o PDV')
      return false
    } finally {
      setBusy(null)
    }
  }

  async function selectTerminal(terminalId: string) {
    const ok = await postJson('/api/pdv/terminals/select', { terminalId }, `sel-${terminalId}`)
    if (ok) notify.success('Maquininha selecionada')
  }

  async function enablePdv(terminalId: string) {
    const confirmed = await confirmAction({
      title: 'Ativar o modo PDV integrado?',
      description:
        'A maquininha deixa de operar no modo autônomo e passa a receber apenas cobranças enviadas pela frente de caixa. Não digite valor nela.',
      confirmLabel: 'Ativar modo PDV',
    })
    if (!confirmed) return
    const ok = await postJson(
      '/api/pdv/terminals/enable-pdv',
      { terminalId, confirm: true },
      `pdv-${terminalId}`,
    )
    if (ok) notify.success('Modo PDV confirmado no Mercado Pago')
  }

  async function retrySync(saleId: string) {
    const ok = await postJson(`/api/pdv/sales/${saleId}/retry-sync`, {}, `retry-${saleId}`)
    if (ok) notify.success('Sincronização com a Shopify reenviada')
  }

  async function consultOrder() {
    setBusy('order')
    setOrderError(null)
    try {
      const res = await apiFetch('/api/pdv/order-status')
      const body = (await res.json().catch(() => ({}))) as PdvOrderDiagnostics & { error?: string }
      if (!res.ok) {
        setOrder(null)
        setOrderError(body.error || 'Não foi possível consultar o Mercado Pago.')
        return
      }
      setOrder(body)
    } catch {
      setOrder(null)
      setOrderError('Falha de conexão ao consultar o Mercado Pago.')
    } finally {
      setBusy(null)
    }
  }

  const frontUrl = pdvFrontUrl()
  const openCashier = (
    <Button asChild>
      <a href={frontUrl} target="_blank" rel="noreferrer">
        <ExternalLink aria-hidden="true" />
        Abrir frente de caixa
      </a>
    </Button>
  )

  return (
    <PageShell>
      <PageHeader
        eyebrow="Operação"
        title="PDV"
        description="Integração da frente de caixa com a Shopify e a maquininha Mercado Pago Point. Cobrar continua sendo só no PDV."
        meta={
          data ? (
            <>
              <span>{data.shopify.shop?.name ?? 'Shopify'}</span>
              <span>
                {data.mercadoPago.pdvModeReady ? 'Point em modo PDV' : 'Point pendente'}
              </span>
            </>
          ) : null
        }
        primaryAction={openCashier}
        actions={
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            <RefreshCw aria-hidden="true" />
            Atualizar
          </Button>
        }
      />

      {error ? (
        <div className="mb-5">
          <ErrorBanner message={error} onRetry={load} />
        </div>
      ) : null}

      {loading && !data ? (
        <StatGridSkeleton count={4} />
      ) : data ? (
        <div className="space-y-5">
          <StatGrid>
            <StatTile
              label="Shopify"
              value={data.shopify.auth === 'ok' ? 'OK' : 'Erro'}
              hint={data.shopify.shop?.name ?? data.shopify.authError ?? 'sem loja'}
              icon={Store}
              tone={data.shopify.auth === 'ok' ? 'brand' : 'default'}
            />
            <StatTile
              label="Mercado Pago"
              value={data.mercadoPago.apiAuth === 'ok' ? 'OK' : 'Aguardando'}
              hint={
                data.mercadoPago.accessTokenConfigured
                  ? 'Access token configurado'
                  : 'Access token ausente'
              }
              icon={CreditCard}
            />
            <StatTile
              label="Modo PDV"
              value={data.mercadoPago.pdvModeReady ? 'Pronto' : 'Pendente'}
              hint={data.mercadoPago.selected?.operating_mode ?? 'nenhuma maquininha'}
              icon={Smartphone}
            />
            <StatTile
              label="Sync Shopify"
              value={data.activity.pendingShopifySync.length}
              hint="pagos aguardando pedido"
              icon={ShoppingBag}
            />
          </StatGrid>

          <Panel>
            <PanelHeader
              title="Shopify"
              description="Catálogo, estoque e pedidos oficiais da loja."
              icon={Store}
            />
            <dl className="divide-y divide-line-soft px-4 py-1 sm:px-5">
              <DiagRow label="Autenticação">
                <StatusPill tone={toneForOk(data.shopify.auth === 'ok')}>
                  {data.shopify.auth === 'ok' ? 'OK' : 'erro'}
                </StatusPill>
              </DiagRow>
              <DiagRow label="Loja">{data.shopify.shop?.name ?? '—'}</DiagRow>
              <DiagRow label="myshopifyDomain">
                <code className="text-xs">{data.shopify.shop?.myshopifyDomain ?? '—'}</code>
              </DiagRow>
              <DiagRow label="Moeda">{data.shopify.shop?.currencyCode ?? '—'}</DiagRow>
              <DiagRow label="Versão da API">{data.shopify.apiVersion}</DiagRow>
              <DiagRow label="Location">{data.shopify.location?.name ?? '—'}</DiagRow>
              <DiagRow label="Location ID">
                <code className="break-all text-xs">{data.shopify.locationId}</code>
              </DiagRow>
            </dl>
          </Panel>

          <Panel>
            <PanelHeader
              title="Mercado Pago Point"
              description="Escolha a maquininha e confirme o modo PDV integrado."
              icon={CreditCard}
            />
            <dl className="divide-y divide-line-soft px-4 py-1 sm:px-5">
              <DiagRow label="Access Token">
                <StatusPill tone={toneForOk(data.mercadoPago.accessTokenConfigured)}>
                  {data.mercadoPago.accessTokenConfigured ? 'configurado' : 'ausente'}
                </StatusPill>
              </DiagRow>
              <DiagRow label="Webhook Secret">
                <StatusPill tone={toneForOk(data.mercadoPago.webhookSecretConfigured)}>
                  {data.mercadoPago.webhookSecretConfigured ? 'configurado' : 'ausente'}
                </StatusPill>
              </DiagRow>
              <DiagRow label="API">
                <StatusPill tone={toneForOk(data.mercadoPago.apiAuth === 'ok')}>
                  {data.mercadoPago.apiAuth === 'ok' ? 'OK' : 'aguardando credencial'}
                </StatusPill>
              </DiagRow>
            </dl>

            <div className="space-y-3 border-t border-line px-4 py-4 sm:px-5">
              <p className="text-meta font-semibold text-ink-muted">
                Maquininhas encontradas ({data.mercadoPago.terminals.length})
              </p>
              {data.mercadoPago.terminals.length === 0 ? (
                <EmptyState
                  icon={Smartphone}
                  title="Nenhuma maquininha encontrada"
                  description="Ative a Point Smart 2 no app do Mercado Pago da conta dona do token e atualize esta tela."
                />
              ) : (
                data.mercadoPago.terminals.map((terminal) => {
                  const selected = data.mercadoPago.selected?.terminal_id === terminal.id
                  return (
                    <Well key={terminal.id} className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <code className="text-xs text-ink-strong">{terminal.masked}</code>
                          <p className="mt-1 text-meta text-ink-muted">
                            store {terminal.store_id ?? '—'} · caixa {terminal.pos_id ?? '—'}
                          </p>
                        </div>
                        <StatusPill tone={terminal.operating_mode === 'PDV' ? 'success' : 'warning'}>
                          {terminal.operating_mode}
                        </StatusPill>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          variant={selected ? 'secondary' : 'default'}
                          size="sm"
                          disabled={selected || busy !== null}
                          onClick={() => void selectTerminal(terminal.id)}
                        >
                          {selected ? 'Selecionada' : 'Usar esta maquininha'}
                        </Button>
                        {terminal.operating_mode !== 'PDV' ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={busy !== null}
                            onClick={() => void enablePdv(terminal.id)}
                          >
                            Ativar modo PDV integrado
                          </Button>
                        ) : null}
                      </div>
                    </Well>
                  )
                })
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Como operar a Point Smart 2"
              description="A cobrança só aparece se a maquininha estiver na tela de frente de caixa."
              icon={Smartphone}
            />
            <ol className="list-decimal space-y-2 px-4 py-4 pl-9 text-sm leading-relaxed text-ink sm:px-5 sm:pl-10">
              <li>Confirme que Vincular frente de caixa está ativado nos ajustes da Point.</li>
              <li>
                Na tela inicial, toque em <strong>Inserir valor</strong> — e não digite nenhum valor.
              </li>
              <li>
                Deixe aberta a tela <em>Inicie a operação pelo sistema de frente de caixa</em>.
              </li>
              <li>Cobre pelo SOMMA PDV. Se a operação não aparecer, toque em Atualizar na Point.</li>
            </ol>
          </Panel>

          <Panel>
            <PanelHeader
              title="Webhook"
              description="Configure esta URL no Mercado Pago Developers, evento Order (Mercado Pago)."
              icon={Webhook}
            />
            <div className="space-y-3 px-4 py-4 sm:px-5">
              <Well className="break-all p-3 font-mono text-xs text-ink">
                {data.webhook.url ?? 'defina POS_PUBLIC_URL no PDV para gerar a URL definitiva'}
              </Well>
              {data.webhook.last ? (
                <p className="text-meta text-ink-muted">
                  Último evento: {data.webhook.last.action ?? data.webhook.last.topic} ·{' '}
                  {formatPdvWhen(data.webhook.last.received_at)} ·{' '}
                  {data.webhook.last.processed_at ? 'processado' : 'não processado'}
                </p>
              ) : (
                <p className="text-meta text-ink-muted">Nenhum evento recebido ainda.</p>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Atividade"
              description="Última cobrança, último pedido Shopify e recuperações pendentes."
              icon={ShoppingBag}
            />
            <dl className="divide-y divide-line-soft px-4 py-1 sm:px-5">
              <DiagRow label="Última order MP">
                <code className="break-all text-xs">
                  {data.activity.lastMercadoPagoOrder?.mercadopago_order_id ?? '—'}
                </code>
              </DiagRow>
              <DiagRow label="Último pedido Shopify">
                {data.activity.lastShopifyOrder?.shopify_order_name ?? '—'}
              </DiagRow>
              <DiagRow label="Aguardando sincronização">
                <StatusPill
                  tone={data.activity.pendingShopifySync.length > 0 ? 'warning' : 'success'}
                >
                  {data.activity.pendingShopifySync.length}
                </StatusPill>
              </DiagRow>
            </dl>

            {data.activity.pendingShopifySync.length > 0 ? (
              <div className="space-y-3 border-t border-line px-4 py-4 sm:px-5">
                <SectionTitle title="Pagos com Shopify pendente" />
                {data.activity.pendingShopifySync.map((sale) => (
                  <Well key={sale.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-ink-strong">{sale.external_reference}</p>
                      <p className="mt-1 text-meta text-ink-muted">
                        {formatPdvBRL(sale.total_amount)} · tentativas {sale.retry_count}
                        {sale.last_error_message ? ` · ${sale.last_error_message}` : ''}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy !== null}
                      onClick={() => void retrySync(sale.id)}
                    >
                      Tentar sincronizar
                    </Button>
                  </Well>
                ))}
              </div>
            ) : null}

            {data.activity.recentErrors.length > 0 ? (
              <div className="space-y-2 border-t border-line px-4 py-4 sm:px-5">
                <p className="text-meta font-semibold text-ink-muted">Erros recentes</p>
                {data.activity.recentErrors.map((item) => (
                  <p key={item.external_reference} className="text-meta text-ink-muted">
                    <code>{item.external_reference}</code> · {item.status} · {item.last_error_code}
                  </p>
                ))}
              </div>
            ) : null}
          </Panel>

          <Panel>
            <PanelHeader
              title="Diagnóstico da última cobrança"
              description="Consulta somente leitura no Mercado Pago. Não altera, não cancela e não cria cobrança."
              icon={AlertTriangle}
              actions={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void consultOrder()}
                  disabled={busy !== null}
                >
                  {busy === 'order' ? 'Consultando...' : 'Consultar status'}
                </Button>
              }
            />
            <div className="space-y-4 px-4 py-4 sm:px-5">
              {orderError ? (
                <p className="rounded border border-danger-border bg-danger-soft px-3 py-2 text-sm text-danger">
                  {orderError}
                </p>
              ) : null}

              {order ? <OrderResult data={order} /> : null}
            </div>
          </Panel>
        </div>
      ) : null}
    </PageShell>
  )
}

function OrderResult({ data }: { data: PdvOrderDiagnostics }) {
  const note = readOrder(data.order.status)
  const payment = data.order.payments[0]

  return (
    <div className="space-y-4">
      {note.text ? (
        <p
          className={
            note.tone === 'success'
              ? 'rounded border border-success-border bg-success-soft px-3 py-2 text-sm text-success'
              : note.tone === 'danger'
                ? 'rounded border border-danger-border bg-danger-soft px-3 py-2 text-sm text-danger'
                : 'rounded border border-warning-border bg-warning-soft px-3 py-2 text-sm text-warning'
          }
        >
          {note.text}
        </p>
      ) : null}

      <dl className="space-y-2 text-sm">
        <DiagRow label="Order ID">
          <code className="text-xs">{data.order.id ?? '—'}</code>
        </DiagRow>
        <DiagRow label="Status">
          <StatusPill tone={note.tone}>{data.order.status ?? '—'}</StatusPill>
        </DiagRow>
        <DiagRow label="Status detail">{data.order.status_detail ?? '—'}</DiagRow>
        <DiagRow label="Type">{data.order.type ?? '—'}</DiagRow>
        <DiagRow label="Processing mode">{data.order.processing_mode ?? '—'}</DiagRow>
        <DiagRow label="Application ID">{data.order.application_id ?? '—'}</DiagRow>
        <DiagRow label="Criada em">{formatPdvWhen(data.order.created_date)}</DiagRow>
        <DiagRow label="Última atualização">{formatPdvWhen(data.order.last_updated_date)}</DiagRow>
        <DiagRow label="Validade">{data.order.expiration_time ?? '—'}</DiagRow>
        <DiagRow label="Valor">{formatPdvBRL(data.sale.total_amount)}</DiagRow>
      </dl>

      <div className="border-t border-line pt-3">
        <p className="mb-2 text-meta font-semibold text-ink-muted">Terminal</p>
        <dl className="space-y-2 text-sm">
          <DiagRow label="Na order">
            <code className="break-all text-xs">{data.order.config_point.terminal_id ?? '—'}</code>
          </DiagRow>
          <DiagRow label="Esperado">
            <code className="break-all text-xs">{data.sale.terminal_id_esperado ?? '—'}</code>
          </DiagRow>
          <DiagRow label="Conferem">
            <StatusPill tone={data.terminal_confere ? 'success' : 'danger'}>
              {data.terminal_confere ? 'sim' : 'NÃO'}
            </StatusPill>
          </DiagRow>
          <DiagRow label="Impressão">{data.order.config_point.print_on_terminal ?? '—'}</DiagRow>
        </dl>
      </div>

      <div className="border-t border-line pt-3">
        <p className="mb-2 text-meta font-semibold text-ink-muted">Pagamento</p>
        {payment ? (
          <dl className="space-y-2 text-sm">
            <DiagRow label="Payment ID">
              <code className="text-xs">{payment.id ?? '—'}</code>
            </DiagRow>
            <DiagRow label="Valor">{payment.amount ?? '—'}</DiagRow>
            <DiagRow label="Status">{payment.status ?? '—'}</DiagRow>
            <DiagRow label="Status detail">{payment.status_detail ?? '—'}</DiagRow>
          </dl>
        ) : (
          <p className="text-sm text-ink-muted">Nenhum pagamento associado — ninguém passou o cartão ainda.</p>
        )}
      </div>

      <div className="border-t border-line pt-3">
        <dl className="space-y-2 text-sm">
          <DiagRow label="External reference">
            <code className="break-all text-xs">{data.sale.external_reference}</code>
          </DiagRow>
          <DiagRow label="Status local">{data.sale.status_local}</DiagRow>
        </dl>
      </div>
    </div>
  )
}

function DiagRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-sm text-ink-muted">{label}</dt>
      <dd className="text-right text-sm font-medium text-ink">{children}</dd>
    </div>
  )
}
