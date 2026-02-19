import { supabase } from '@/lib/supabase-client'
import type { AsaasCustomer, AsaasPayment, AsaasCoupon, DashboardMetrics } from '@/lib/types/asaas'

// Clientes do banco local
export async function getCustomersFromDB(): Promise<AsaasCustomer[]> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[v0] Error fetching customers:', error)
      return []
    }

    return data || []
  } catch (err) {
    console.error('[v0] Unexpected error fetching customers:', err)
    return []
  }
}

export async function getCustomerById(id: number): Promise<AsaasCustomer | null> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('[v0] Error fetching customer:', error)
      return null
    }

    return data
  } catch (err) {
    console.error('[v0] Unexpected error fetching customer:', err)
    return null
  }
}

export async function saveCustomerToDB(customer: Partial<AsaasCustomer>): Promise<AsaasCustomer | null> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .insert([customer])
      .select()
      .single()

    if (error) {
      console.error('[v0] Error saving customer:', error)
      return null
    }

    return data
  } catch (err) {
    console.error('[v0] Unexpected error saving customer:', err)
    return null
  }
}

// Pagamentos do banco local
export async function getPaymentsFromDB(filters?: {
  status?: string
  customer_asaas_id?: string
}): Promise<AsaasPayment[]> {
  try {
    let query = supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false })

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }
    if (filters?.customer_asaas_id) {
      query = query.eq('customer_asaas_id', filters.customer_asaas_id)
    }

    const { data, error } = await query

    if (error) {
      console.error('[v0] Error fetching payments:', error)
      return []
    }

    return data || []
  } catch (err) {
    console.error('[v0] Unexpected error fetching payments:', err)
    return []
  }
}

export async function getPaymentById(id: number): Promise<AsaasPayment | null> {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('[v0] Error fetching payment:', error)
      return null
    }

    return data
  } catch (err) {
    console.error('[v0] Unexpected error fetching payment:', err)
    return null
  }
}

export async function savePaymentToDB(payment: Partial<AsaasPayment>): Promise<AsaasPayment | null> {
  try {
    const { data, error } = await supabase
      .from('payments')
      .insert([payment])
      .select()
      .single()

    if (error) {
      console.error('[v0] Error saving payment:', error)
      return null
    }

    return data
  } catch (err) {
    console.error('[v0] Unexpected error saving payment:', err)
    return null
  }
}

// Cupons
export async function getCouponsFromDB(): Promise<AsaasCoupon[]> {
  try {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[v0] Error fetching coupons:', error)
      return []
    }

    return (data || []) as AsaasCoupon[]
  } catch (err) {
    console.error('[v0] Unexpected error fetching coupons:', err)
    return []
  }
}

export async function saveCouponToDB(coupon: Partial<AsaasCoupon>): Promise<AsaasCoupon | null> {
  try {
    const { data, error } = await supabase
      .from('coupons')
      .insert([coupon])
      .select()
      .single()

    if (error) {
      console.error('[v0] Error saving coupon:', error)
      return null
    }

    return data as AsaasCoupon
  } catch (err) {
    console.error('[v0] Unexpected error saving coupon:', err)
    return null
  }
}

export async function updateCouponInDB(id: string, updates: Partial<AsaasCoupon>): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('coupons')
      .update(updates)
      .eq('id', id)

    if (error) {
      console.error('[v0] Error updating coupon:', error)
      return false
    }

    return true
  } catch (err) {
    console.error('[v0] Unexpected error updating coupon:', err)
    return false
  }
}

// Dashboard Metrics - Busca DIRETO da API Asaas
export async function calculateDashboardMetrics(month: string): Promise<DashboardMetrics> {
  console.log('[v0] Fetching dashboard metrics from Asaas API...')
  try {
    const startDate = `${month}-01`
    const [year, monthNum] = month.split('-').map(Number)
    const endDate = new Date(year, monthNum, 0).toISOString().split('T')[0]

    // Buscar TODOS os pagamentos do Asaas no período
    const paymentsResponse = await fetch(`/api/asaas?endpoint=/payments&dateCreated[ge]=${startDate}&dateCreated[le]=${endDate}&limit=1000`)
    const paymentsData = await paymentsResponse.json()
    const allPayments = paymentsData.data || []

    console.log('[v0] Asaas payments fetched:', allPayments.length)

    // Calcular métricas dos pagamentos
    const received = allPayments
      .filter((p: any) => ['RECEIVED', 'CONFIRMED'].includes(p.status))
      .reduce((sum: number, p: any) => sum + (p.value || 0), 0)

    const awaiting = allPayments
      .filter((p: any) => p.status === 'PENDING')
      .reduce((sum: number, p: any) => sum + (p.value || 0), 0)

    const overdue = allPayments
      .filter((p: any) => p.status === 'OVERDUE')
      .reduce((sum: number, p: any) => sum + (p.value || 0), 0)

    // Buscar TODAS as assinaturas ATIVAS do Asaas
    const subscriptionsResponse = await fetch(`/api/asaas?endpoint=/subscriptions&status=ACTIVE&limit=1000`)
    const subscriptionsData = await subscriptionsResponse.json()
    const activeSubscriptions = subscriptionsData.data || []

    console.log('[v0] Active subscriptions from Asaas:', activeSubscriptions.length)

    // Calcular MRR baseado nas assinaturas ativas
    const mrr = activeSubscriptions.reduce((sum: number, sub: any) => {
      const value = sub.value || 0
      // Normalizar para mensal conforme o ciclo
      if (sub.cycle === 'MONTHLY') {
        return sum + value
      } else if (sub.cycle === 'YEARLY') {
        return sum + (value / 12)
      } else if (sub.cycle === 'QUARTERLY') {
        return sum + (value / 3)
      } else if (sub.cycle === 'SEMIANNUALLY') {
        return sum + (value / 6)
      }
      return sum + value // Default: considera mensal
    }, 0)

    // Buscar assinaturas canceladas para calcular Churn
    const canceledResponse = await fetch(`/api/asaas?endpoint=/subscriptions&status=INACTIVE&limit=1000`)
    const canceledData = await canceledResponse.json()
    const canceledSubs = canceledData.data || []

    // Filtrar canceladas no mês
    const canceledInMonth = canceledSubs.filter((sub: any) => {
      if (!sub.endDate) return false
      const endDate = sub.endDate.substring(0, 7) // YYYY-MM
      return endDate === month
    })

    const totalSubs = activeSubscriptions.length + canceledInMonth.length
    const churnRate = totalSubs > 0 ? (canceledInMonth.length / totalSubs) * 100 : 0

    console.log('[v0] Dashboard metrics calculated:', { received, awaiting, overdue, mrr, activeSubscriptions: activeSubscriptions.length, churnRate })

    return {
      month,
      received,
      awaiting,
      overdue,
      mrr,
      activeSubscriptions: activeSubscriptions.length,
      churnRate,
    }
  } catch (err) {
    console.error('[v0] Unexpected error calculating dashboard metrics:', err)
    return {
      month,
      received: 0,
      awaiting: 0,
      overdue: 0,
      mrr: 0,
      activeSubscriptions: 0,
      churnRate: 0,
    }
  }
}

// Sincronização
export async function logSync(entityType: string, entityId: string, action: string, status: string, errorMessage?: string) {
  try {
    await supabase.from('sync_log').insert([{
      entity_type: entityType,
      entity_id: entityId,
      action,
      status,
      error_message: errorMessage,
    }])
  } catch (err) {
    console.error('[v0] Error logging sync:', err)
  }
}

export async function getSyncLogs(limit = 50) {
  try {
    const { data, error } = await supabase
      .from('sync_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[v0] Error fetching sync logs:', error)
      return []
    }

    return data || []
  } catch (err) {
    console.error('[v0] Unexpected error fetching sync logs:', err)
    return []
  }
}
