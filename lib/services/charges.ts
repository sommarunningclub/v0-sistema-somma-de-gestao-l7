'use client'

import { apiFetch } from '@/lib/api-client'

// As consultas passam por /api/cobrancas-membros, que roda no servidor com
// service role. Antes isso ia direto ao Supabase pelo browser com a anon key
// (sujeito ao RLS), e a criação no Asaas rodava no cliente, onde
// ASAAS_API_KEY não existe.

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

async function readJson(res: Response): Promise<any> {
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body?.error || `Falha na requisição (HTTP ${res.status})`)
  }
  return body
}

// Buscar cobranças de um membro
export async function getMemberCharges(memberId: number): Promise<CobrancaMembro[]> {
  try {
    const res = await apiFetch(`/api/cobrancas-membros?membro_id=${memberId}`)
    const body = await readJson(res)
    return body.data || []
  } catch (err) {
    console.error('[cobrancas] Erro ao buscar cobranças:', err)
    return []
  }
}

// Criar nova cobrança (o servidor cuida do vínculo com o Asaas)
export async function createMemberCharge(
  chargeData: Omit<CobrancaMembro, 'id' | 'data_criacao'>,
  memberData?: { asaas_customer_id?: string; nome_completo: string; email?: string }
): Promise<CobrancaMembro | null> {
  const res = await apiFetch('/api/cobrancas-membros', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...chargeData,
      asaas_customer_id: memberData?.asaas_customer_id,
    }),
  })
  const body = await readJson(res)

  if (body.warning) {
    console.warn('[cobrancas]', body.warning)
  }

  return body.data || null
}

// Atualizar status de cobrança
export async function updateChargeStatus(
  chargeId: number,
  status: 'pendente' | 'pago' | 'cancelada' | 'atrasada',
  dataPagamento?: string
): Promise<CobrancaMembro | null> {
  const updates: Record<string, unknown> = { status }
  if (status === 'pago' && dataPagamento) {
    updates.data_pagamento = dataPagamento
  }

  const res = await apiFetch(`/api/cobrancas-membros/${chargeId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  const body = await readJson(res)
  return body.data || null
}

// Deletar cobrança
export async function deleteCharge(chargeId: number): Promise<boolean> {
  try {
    const res = await apiFetch(`/api/cobrancas-membros/${chargeId}`, { method: 'DELETE' })
    await readJson(res)
    return true
  } catch (err) {
    console.error('[cobrancas] Erro ao deletar cobrança:', err)
    return false
  }
}

// Buscar cobranças vencidas
export async function getOverdueCharges(): Promise<CobrancaMembro[]> {
  try {
    const res = await apiFetch('/api/cobrancas-membros?filter=overdue')
    const body = await readJson(res)
    return body.data || []
  } catch (err) {
    console.error('[cobrancas] Erro ao buscar cobranças vencidas:', err)
    return []
  }
}

// Buscar cobranças próximas do vencimento (próximos 7 dias)
export async function getUpcomingCharges(): Promise<CobrancaMembro[]> {
  try {
    const res = await apiFetch('/api/cobrancas-membros?filter=upcoming')
    const body = await readJson(res)
    return body.data || []
  } catch (err) {
    console.error('[cobrancas] Erro ao buscar cobranças próximas:', err)
    return []
  }
}
