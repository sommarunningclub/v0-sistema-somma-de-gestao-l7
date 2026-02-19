import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

interface Coupon {
  id: string
  code: string
  type: 'PERCENTAGE' | 'FIXED'
  value: number
  expiration_date: string | null
  usage_limit: number | null
  usage_count: number
  status: 'ACTIVE' | 'EXPIRED' | 'DISABLED'
  created_at: string
  updated_at: string
}

interface CouponValidationResult {
  valid: boolean
  coupon?: Coupon
  discount?: number
  discountedValue?: number
  error?: string
}

// GET - Validar um cupom e calcular desconto
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const originalValue = searchParams.get('value')

  if (!code) {
    return NextResponse.json({ error: 'Codigo do cupom obrigatorio' }, { status: 400 })
  }

  try {
    // Buscar cupom pelo codigo
    const { data: coupon, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', code.toUpperCase())
      .single()

    if (error || !coupon) {
      return NextResponse.json<CouponValidationResult>({
        valid: false,
        error: 'Cupom nao encontrado'
      })
    }

    // Verificar se o cupom esta ativo
    if (coupon.status !== 'ACTIVE') {
      return NextResponse.json<CouponValidationResult>({
        valid: false,
        error: coupon.status === 'EXPIRED' ? 'Cupom expirado' : 'Cupom desativado'
      })
    }

    // Verificar data de expiracao
    if (coupon.expiration_date && new Date(coupon.expiration_date) < new Date()) {
      // Atualizar status para expirado
      await supabase
        .from('coupons')
        .update({ status: 'EXPIRED', updated_at: new Date().toISOString() })
        .eq('id', coupon.id)
      
      return NextResponse.json<CouponValidationResult>({
        valid: false,
        error: 'Cupom expirado'
      })
    }

    // Verificar limite de uso
    if (coupon.usage_limit !== null && coupon.usage_count >= coupon.usage_limit) {
      // Atualizar status para desativado
      await supabase
        .from('coupons')
        .update({ status: 'DISABLED', updated_at: new Date().toISOString() })
        .eq('id', coupon.id)
      
      return NextResponse.json<CouponValidationResult>({
        valid: false,
        error: 'Cupom atingiu o limite de uso'
      })
    }

    // Calcular desconto se valor original foi fornecido
    let discount = 0
    let discountedValue = 0

    if (originalValue) {
      const value = parseFloat(originalValue)
      if (coupon.type === 'PERCENTAGE') {
        discount = (value * coupon.value) / 100
      } else {
        discount = coupon.value
      }
      // Desconto nao pode ser maior que o valor original
      discount = Math.min(discount, value)
      discountedValue = Math.max(0, value - discount)
    }

    return NextResponse.json<CouponValidationResult>({
      valid: true,
      coupon,
      discount: Math.round(discount * 100) / 100,
      discountedValue: Math.round(discountedValue * 100) / 100
    })
  } catch (err) {
    console.error('[v0] Error validating coupon:', err)
    return NextResponse.json({ error: 'Erro ao validar cupom' }, { status: 500 })
  }
}

// POST - Aplicar/resgatar um cupom (registrar uso)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      couponCode, 
      originalValue, 
      customerId,
      asaasCustomerId,
      asaasPaymentId 
    } = body

    if (!couponCode || !originalValue) {
      return NextResponse.json({ 
        error: 'Codigo do cupom e valor original sao obrigatorios' 
      }, { status: 400 })
    }

    // Validar cupom primeiro
    const { data: coupon, error: couponError } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', couponCode.toUpperCase())
      .single()

    if (couponError || !coupon) {
      return NextResponse.json({ 
        success: false, 
        error: 'Cupom nao encontrado' 
      })
    }

    // Verificacoes de validade
    if (coupon.status !== 'ACTIVE') {
      return NextResponse.json({ 
        success: false, 
        error: 'Cupom nao esta ativo' 
      })
    }

    if (coupon.expiration_date && new Date(coupon.expiration_date) < new Date()) {
      return NextResponse.json({ 
        success: false, 
        error: 'Cupom expirado' 
      })
    }

    if (coupon.usage_limit !== null && coupon.usage_count >= coupon.usage_limit) {
      return NextResponse.json({ 
        success: false, 
        error: 'Cupom atingiu limite de uso' 
      })
    }

    // Calcular desconto
    let discount = 0
    if (coupon.type === 'PERCENTAGE') {
      discount = (originalValue * coupon.value) / 100
    } else {
      discount = coupon.value
    }
    discount = Math.min(discount, originalValue)
    const finalValue = Math.max(0, originalValue - discount)

    // Registrar resgate do cupom
    const redemptionData: {
      coupon_id: string
      discount_applied: number
      asaas_customer_id?: string
      asaas_payment_id?: string
      customer_id?: string
    } = {
      coupon_id: coupon.id,
      discount_applied: Math.round(discount * 100) / 100,
    }

    if (asaasCustomerId) {
      redemptionData.asaas_customer_id = asaasCustomerId
    }
    if (asaasPaymentId) {
      redemptionData.asaas_payment_id = asaasPaymentId
    }
    if (customerId) {
      redemptionData.customer_id = customerId
    }

    const { error: redemptionError } = await supabase
      .from('coupon_redemptions')
      .insert(redemptionData)

    if (redemptionError) {
      console.error('[v0] Error recording coupon redemption:', redemptionError)
      // Continuar mesmo se falhar o registro - o trigger vai atualizar o contador
    }

    // Retornar resultado para usar no Asaas
    return NextResponse.json({
      success: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value
      },
      originalValue,
      discount: Math.round(discount * 100) / 100,
      finalValue: Math.round(finalValue * 100) / 100,
      // Dados para usar no desconto do Asaas
      asaasDiscount: {
        value: Math.round(discount * 100) / 100,
        dueDateLimitDays: 0, // Desconto valido ate a data de vencimento
        type: coupon.type // PERCENTAGE ou FIXED
      }
    })
  } catch (err) {
    console.error('[v0] Error applying coupon:', err)
    return NextResponse.json({ error: 'Erro ao aplicar cupom' }, { status: 500 })
  }
}
