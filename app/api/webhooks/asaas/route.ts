import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'


/*
 * Este endpoint NÃO faz parte do painel — é o ponto de entrada que o Asaas
 * chama para notificar eventos de pagamento. Ele apenas RECEBE e grava em
 * `webhook_events` e `payments`; nunca consulta a API do Asaas.
 *
 * Toda a camada Asaas do admin (proxy, serviços, tipos, telas de cobrança) foi
 * removida por decisão de produto. Este arquivo permanece de propósito: apagá-lo
 * faria o Asaas receber 404 e o registro de pagamentos deixaria de existir em
 * silêncio. Antes de removê-lo, desative a notificação no painel do Asaas.
 */

export async function POST(request: NextRequest) {
  // Fail-closed, igual a app/api/cron/*: sem token configurado ninguém entra.
  // Pular a checagem quando ASAAS_WEBHOOK_TOKEN falta transformaria um deploy
  // com env incompleta em endpoint público de escrita em `payments`.
  const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN
  if (!webhookToken) {
    console.error('[v0] ASAAS_WEBHOOK_TOKEN não configurado — webhook recusado')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const incoming =
    request.headers.get('asaas-access-token') ||
    request.headers.get('x-asaas-access-token')
  if (incoming !== webhookToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('[v0] Credenciais Supabase ausentes — webhook recusado')
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  try {
    const payload = await request.json()
    
    const eventType = payload.event
    const payment = payload.payment
    const subscription = payload.subscription

    console.log('[v0] Webhook received:', eventType)

    // Verificar se evento já foi processado (idempotência)
    const eventId = payload.id || `${eventType}-${Date.now()}`
    
    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('id')
      .eq('event_id', eventId)
      .single()

    if (existingEvent) {
      console.log('[v0] Webhook event already processed:', eventId)
      return NextResponse.json({ ok: true, message: 'Event already processed' })
    }

    // Registrar evento
    await supabase.from('webhook_events').insert([{
      event_id: eventId,
      event_type: eventType,
      payment_id: payment?.id,
      customer_id: payment?.customer || subscription?.customer,
      payload,
      status: 'processing',
    }])

    // Processar eventos de pagamento
    if (payment) {
      const paymentData = {
        asaas_id: payment.id,
        customer_asaas_id: payment.customer,
        value: payment.value,
        net_value: payment.netValue,
        description: payment.description,
        billing_type: payment.billingType,
        status: payment.status,
        due_date: payment.dueDate,
        payment_date: payment.paymentDate,
        confirmed_date: payment.confirmedDate,
        credit_date: payment.creditDate,
        external_reference: payment.externalReference,
        raw_data: payment,
        updated_at: new Date().toISOString(),
      }

      // Upsert pagamento
      const { error: paymentError } = await supabase
        .from('payments')
        .upsert(paymentData, { onConflict: 'asaas_id' })

      if (paymentError) {
        console.error('[v0] Error upserting payment:', paymentError)
      }
    }

    // Processar eventos de assinatura
    if (subscription) {
      console.log('[v0] Subscription event:', subscription.id, eventType)
      // Implementar lógica de assinatura conforme necessário
    }

    // Marcar evento como processado
    await supabase
      .from('webhook_events')
      .update({ status: 'processed', processed_at: new Date().toISOString() })
      .eq('event_id', eventId)

    return NextResponse.json({ 
      ok: true, 
      event: eventType, 
      hasPayment: !!payment, 
      hasSubscription: !!subscription 
    })
  } catch (error) {
    console.error('[v0] Webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
