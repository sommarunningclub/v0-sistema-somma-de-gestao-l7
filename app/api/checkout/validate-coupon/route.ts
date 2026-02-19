import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// CORS headers para permitir chamadas do checkout externo
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

// GET - Validar cupom (para uso no checkout)
// Exemplo: /api/checkout/validate-coupon?code=DESCONTO10&value=100
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const originalValue = searchParams.get('value')

  if (!code) {
    return NextResponse.json(
      { valid: false, error: 'Codigo do cupom e obrigatorio' },
      { status: 400, headers: corsHeaders }
    )
  }

  try {
    // Buscar cupom pelo codigo
    const { data: coupon, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', code.toUpperCase())
      .single()

    if (error || !coupon) {
      return NextResponse.json(
        { valid: false, error: 'Cupom nao encontrado' },
        { headers: corsHeaders }
      )
    }

    // Verificar se o cupom esta ativo
    if (coupon.status !== 'ACTIVE') {
      return NextResponse.json(
        { 
          valid: false, 
          error: coupon.status === 'EXPIRED' ? 'Cupom expirado' : 'Cupom desativado' 
        },
        { headers: corsHeaders }
      )
    }

    // Verificar data de expiracao
    if (coupon.expiration_date && new Date(coupon.expiration_date) < new Date()) {
      // Atualizar status para expirado
      await supabase
        .from('coupons')
        .update({ status: 'EXPIRED', updated_at: new Date().toISOString() })
        .eq('id', coupon.id)
      
      return NextResponse.json(
        { valid: false, error: 'Cupom expirado' },
        { headers: corsHeaders }
      )
    }

    // Verificar limite de uso
    if (coupon.usage_limit !== null && coupon.usage_count >= coupon.usage_limit) {
      return NextResponse.json(
        { valid: false, error: 'Cupom esgotado' },
        { headers: corsHeaders }
      )
    }

    // Calcular desconto se valor original foi fornecido
    let discount = 0
    let finalValue = 0
    const value = originalValue ? parseFloat(originalValue) : 0

    if (value > 0) {
      if (coupon.type === 'PERCENTAGE') {
        discount = (value * coupon.value) / 100
      } else {
        discount = coupon.value
      }
      // Desconto nao pode ser maior que o valor original
      discount = Math.min(discount, value)
      finalValue = Math.max(0, value - discount)
    }

    // Resposta com dados para usar no checkout
    return NextResponse.json({
      valid: true,
      coupon: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        description: coupon.type === 'PERCENTAGE' 
          ? `${coupon.value}% de desconto`
          : `R$ ${coupon.value.toFixed(2)} de desconto`
      },
      calculation: value > 0 ? {
        originalValue: value,
        discount: Math.round(discount * 100) / 100,
        finalValue: Math.round(finalValue * 100) / 100
      } : null,
      // Formato para usar no Asaas ao criar cobranca
      asaasDiscount: {
        value: coupon.type === 'PERCENTAGE' 
          ? Math.round(discount * 100) / 100 
          : coupon.value,
        dueDateLimitDays: 0,
        type: 'FIXED' // Asaas aceita FIXED ou PERCENTAGE
      }
    }, { headers: corsHeaders })

  } catch (err) {
    console.error('[API] Error validating coupon:', err)
    return NextResponse.json(
      { valid: false, error: 'Erro ao validar cupom' },
      { status: 500, headers: corsHeaders }
    )
  }
}

// POST - Aplicar cupom e registrar uso (apos pagamento confirmado)
// Body: { code: string, value: number, customerId?: string, paymentId?: string }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, value, customerId, paymentId } = body

    if (!code || !value) {
      return NextResponse.json(
        { success: false, error: 'Codigo e valor sao obrigatorios' },
        { status: 400, headers: corsHeaders }
      )
    }

    // Buscar e validar cupom
    const { data: coupon, error: couponError } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', code.toUpperCase())
      .single()

    if (couponError || !coupon) {
      return NextResponse.json(
        { success: false, error: 'Cupom nao encontrado' },
        { headers: corsHeaders }
      )
    }

    // Verificacoes de validade
    if (coupon.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: 'Cupom nao esta ativo' },
        { headers: corsHeaders }
      )
    }

    if (coupon.expiration_date && new Date(coupon.expiration_date) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Cupom expirado' },
        { headers: corsHeaders }
      )
    }

    if (coupon.usage_limit !== null && coupon.usage_count >= coupon.usage_limit) {
      return NextResponse.json(
        { success: false, error: 'Cupom esgotado' },
        { headers: corsHeaders }
      )
    }

    // Calcular desconto
    let discount = 0
    if (coupon.type === 'PERCENTAGE') {
      discount = (value * coupon.value) / 100
    } else {
      discount = coupon.value
    }
    discount = Math.min(discount, value)
    const finalValue = Math.max(0, value - discount)

    // Registrar uso do cupom
    const { error: redemptionError } = await supabase
      .from('coupon_redemptions')
      .insert({
        coupon_id: coupon.id,
        discount_applied: Math.round(discount * 100) / 100,
        asaas_customer_id: customerId || null,
        asaas_payment_id: paymentId || null,
      })

    if (redemptionError) {
      console.error('[API] Error recording coupon redemption:', redemptionError)
    }

    // Incrementar contador de uso
    await supabase
      .from('coupons')
      .update({ 
        usage_count: coupon.usage_count + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', coupon.id)

    return NextResponse.json({
      success: true,
      coupon: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value
      },
      originalValue: value,
      discount: Math.round(discount * 100) / 100,
      finalValue: Math.round(finalValue * 100) / 100
    }, { headers: corsHeaders })

  } catch (err) {
    console.error('[API] Error applying coupon:', err)
    return NextResponse.json(
      { success: false, error: 'Erro ao aplicar cupom' },
      { status: 500, headers: corsHeaders }
    )
  }
}
