'use client'

import { supabase } from '@/lib/supabase-client'
import { createCharge } from './asaas-api'

export interface CobrancaMembro {
  id: number
  membro_id: number
  valor: number
  data_vencimento: string
  descricao: string
  status: 'pendente' | 'pago' | 'cancelada' | 'atrasada'
  asaas_payment_id?: string
  data_criacao: string
  data_pagamento?: string
}

// Buscar cobranças de um membro
export async function getMemberCharges(memberId: number): Promise<CobrancaMembro[]> {
  try {
    const { data, error } = await supabase
      .from('cobrancas_membros')
      .select('*')
      .eq('membro_id', memberId)
      .order('data_vencimento', { ascending: false })

    if (error) throw error
    return data || []
  } catch (err) {
    console.error('[v0] Erro ao buscar cobranças:', err)
    return []
  }
}

// Criar nova cobrança vinculada ao Asaas
export async function createMemberCharge(chargeData: Omit<CobrancaMembro, 'id' | 'data_criacao'>, memberData?: { asaas_customer_id?: string; nome_completo: string; email?: string }) {
  try {
    // Primeiro criar no Supabase
    const { data: chargeRecord, error: insertError } = await supabase
      .from('cobrancas_membros')
      .insert([chargeData])
      .select()

    if (insertError) throw insertError
    const newCharge = chargeRecord?.[0]

    // Se houver customer ID do Asaas, criar também lá
    if (memberData?.asaas_customer_id) {
      try {
        const { data: asaasCharge, error: asaasError } = await createCharge({
          customer: memberData.asaas_customer_id,
          value: chargeData.valor,
          dueDate: chargeData.data_vencimento,
          billingType: 'BOLETO',
          description: chargeData.descricao,
          externalReference: `MEMBRO_${chargeData.membro_id}_${newCharge?.id || ''}`,
        })

        // Se sucesso, atualizar o registro local com o ID do Asaas
        if (asaasCharge?.id && newCharge?.id) {
          await supabase
            .from('cobrancas_membros')
            .update({ asaas_payment_id: asaasCharge.id })
            .eq('id', newCharge.id)

          console.log('[v0] Cobrança criada no Asaas:', asaasCharge.id)
        }
      } catch (asaasErr) {
        console.warn('[v0] Não foi possível criar cobrança no Asaas:', asaasErr)
        // Mesmo que falhe no Asaas, a cobrança local foi criada
      }
    }

    return newCharge || null
  } catch (err) {
    console.error('[v0] Erro ao criar cobrança:', err)
    throw err
  }
}

// Atualizar status de cobrança
export async function updateChargeStatus(
  chargeId: number,
  status: 'pendente' | 'pago' | 'cancelada' | 'atrasada',
  dataPagamento?: string
) {
  try {
    const updateData: any = { status }
    if (status === 'pago' && dataPagamento) {
      updateData.data_pagamento = dataPagamento
    }

    const { data, error } = await supabase
      .from('cobrancas_membros')
      .update(updateData)
      .eq('id', chargeId)
      .select()

    if (error) throw error
    return data?.[0] || null
  } catch (err) {
    console.error('[v0] Erro ao atualizar cobrança:', err)
    throw err
  }
}

// Deletar cobrança
export async function deleteCharge(chargeId: number) {
  try {
    const { error } = await supabase
      .from('cobrancas_membros')
      .delete()
      .eq('id', chargeId)

    if (error) throw error
    return true
  } catch (err) {
    console.error('[v0] Erro ao deletar cobrança:', err)
    return false
  }
}

// Buscar cobranças vencidas
export async function getOverdueCharges(): Promise<CobrancaMembro[]> {
  try {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('cobrancas_membros')
      .select('*')
      .eq('status', 'pendente')
      .lt('data_vencimento', today)
      .order('data_vencimento', { ascending: true })

    if (error) throw error
    return data || []
  } catch (err) {
    console.error('[v0] Erro ao buscar cobranças vencidas:', err)
    return []
  }
}

// Buscar cobranças próximas do vencimento (próximos 7 dias)
export async function getUpcomingCharges(): Promise<CobrancaMembro[]> {
  try {
    const today = new Date()
    const sevenDaysLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

    const todayStr = today.toISOString().split('T')[0]
    const sevenDaysStr = sevenDaysLater.toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('cobrancas_membros')
      .select('*')
      .eq('status', 'pendente')
      .gte('data_vencimento', todayStr)
      .lte('data_vencimento', sevenDaysStr)
      .order('data_vencimento', { ascending: true })

    if (error) throw error
    return data || []
  } catch (err) {
    console.error('[v0] Erro ao buscar cobranças próximas:', err)
    return []
  }
}
