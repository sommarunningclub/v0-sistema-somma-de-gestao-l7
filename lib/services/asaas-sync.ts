import { supabase } from '@/lib/supabase-client'
import { asaasRequest } from './asaas-api'

export interface SyncLog {
  id?: string
  sync_type: 'full' | 'incremental'
  status: 'started' | 'success' | 'failed'
  total_customers: number
  synced_customers: number
  error_message?: string
  started_at?: string
  completed_at?: string
}

export interface AsaasCustomerSync {
  id?: string
  asaas_id: string
  name: string
  email: string
  phone?: string
  cpf_cnpj?: string
  status: string
  address?: {
    street?: string
    number?: string
    complement?: string
    neighborhood?: string
    city?: string
    state?: string
    postal_code?: string
  }
  additional_emails?: string[]
  billing_type?: string
  due_date?: number
  subscription_status?: string
  last_synced_at: string
  created_at: string
  updated_at: string
}

/**
 * Busca clientes do Asaas e sincroniza com Supabase
 */
export async function syncCustomersFromAsaas(limit: number = 100, offset: number = 0): Promise<SyncLog> {
  const syncLog: SyncLog = {
    sync_type: 'full',
    status: 'started',
    total_customers: 0,
    synced_customers: 0,
    started_at: new Date().toISOString(),
  }

  try {
    console.log('[v0] Iniciando sincronização de clientes do Asaas')

    // Buscar clientes do Asaas
    const response = await asaasRequest<{
      data: Array<{
        id: string
        name: string
        email: string
        phone?: string
        cpfCnpj?: string
        status: string
        address?: {
          street?: string
          number?: string
          complement?: string
          neighborhood?: string
          city?: string
          state?: string
          postalCode?: string
        }
        additionalEmails?: string[]
        billingType?: string
        dueDate?: number
        subscriptionStatus?: string
      }>
      totalCount: number
    }>('GET', '/customers', undefined, {
      limit: limit.toString(),
      offset: offset.toString(),
    })

    if (response.error || !response.data) {
      throw new Error(`Erro ao buscar clientes do Asaas: ${response.error}`)
    }

    const { data: customersData, totalCount } = response.data
    syncLog.total_customers = totalCount

    console.log(`[v0] ${customersData.length} clientes encontrados no Asaas`)

    // Preparar dados para sincronização
    const customersToSync: AsaasCustomerSync[] = customersData.map((customer) => ({
      asaas_id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      cpf_cnpj: customer.cpfCnpj,
      status: customer.status,
      address: {
        street: customer.address?.street,
        number: customer.address?.number,
        complement: customer.address?.complement,
        neighborhood: customer.address?.neighborhood,
        city: customer.address?.city,
        state: customer.address?.state,
        postal_code: customer.address?.postalCode,
      },
      additional_emails: customer.additionalEmails,
      billing_type: customer.billingType,
      due_date: customer.dueDate,
      subscription_status: customer.subscriptionStatus,
      last_synced_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))

    // Sincronizar no Supabase
    for (const customer of customersToSync) {
      try {
        // Verificar se cliente já existe
        const { data: existingCustomer, error: selectError } = await supabase
          .from('asaas_customers_sync')
          .select('id')
          .eq('asaas_id', customer.asaas_id)
          .single()

        if (selectError && selectError.code !== 'PGRST116') {
          throw selectError
        }

        if (existingCustomer) {
          // Atualizar cliente existente
          const { error: updateError } = await supabase
            .from('asaas_customers_sync')
            .update({
              name: customer.name,
              email: customer.email,
              phone: customer.phone,
              cpf_cnpj: customer.cpf_cnpj,
              status: customer.status,
              address: customer.address,
              additional_emails: customer.additional_emails,
              billing_type: customer.billing_type,
              due_date: customer.due_date,
              subscription_status: customer.subscription_status,
              last_synced_at: customer.last_synced_at,
              updated_at: new Date().toISOString(),
            })
            .eq('asaas_id', customer.asaas_id)

          if (updateError) throw updateError
        } else {
          // Inserir novo cliente
          const { error: insertError } = await supabase
            .from('asaas_customers_sync')
            .insert([customer])

          if (insertError) throw insertError
        }

        syncLog.synced_customers++
      } catch (err) {
        console.error(`[v0] Erro ao sincronizar cliente ${customer.asaas_id}:`, err)
      }
    }

    syncLog.status = 'success'
    syncLog.completed_at = new Date().toISOString()

    // Registrar log de sincronização
    await saveSyncLog(syncLog)

    console.log(`[v0] Sincronização concluída: ${syncLog.synced_customers}/${syncLog.total_customers}`)
  } catch (error) {
    syncLog.status = 'failed'
    syncLog.error_message = error instanceof Error ? error.message : 'Erro desconhecido'
    syncLog.completed_at = new Date().toISOString()

    console.error('[v0] Erro durante sincronização:', error)

    await saveSyncLog(syncLog)
  }

  return syncLog
}

/**
 * Salva log de sincronização no Supabase
 */
export async function saveSyncLog(log: SyncLog): Promise<void> {
  try {
    const { error } = await supabase
      .from('asaas_sync_logs')
      .insert([{
        sync_type: log.sync_type,
        status: log.status,
        total_customers: log.total_customers,
        synced_customers: log.synced_customers,
        error_message: log.error_message,
        started_at: log.started_at,
        completed_at: log.completed_at,
      }])

    if (error) {
      console.error('[v0] Erro ao salvar log de sincronização:', error)
    }
  } catch (err) {
    console.error('[v0] Erro inesperado ao salvar log:', err)
  }
}

/**
 * Busca clientes sincronizados do Supabase
 */
export async function getSyncedCustomers(limit: number = 100, offset: number = 0): Promise<AsaasCustomerSync[]> {
  try {
    const { data, error } = await supabase
      .from('asaas_customers_sync')
      .select('*')
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[v0] Erro ao buscar clientes sincronizados:', error)
      return []
    }

    return data || []
  } catch (err) {
    console.error('[v0] Erro inesperado ao buscar clientes sincronizados:', err)
    return []
  }
}

/**
 * Busca logs de sincronização
 */
export async function getSyncLogs(limit: number = 50): Promise<SyncLog[]> {
  try {
    const { data, error } = await supabase
      .from('asaas_sync_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[v0] Erro ao buscar logs de sincronização:', error)
      return []
    }

    return data || []
  } catch (err) {
    console.error('[v0] Erro inesperado ao buscar logs:', err)
    return []
  }
}

/**
 * Busca contagem total de clientes sincronizados
 */
export async function getSyncedCustomersCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('asaas_customers_sync')
      .select('*', { count: 'exact', head: true })

    if (error) {
      console.error('[v0] Erro ao contar clientes sincronizados:', error)
      return 0
    }

    return count || 0
  } catch (err) {
    console.error('[v0] Erro inesperado ao contar clientes:', err)
    return 0
  }
}

/**
 * Filtra clientes sincronizados
 */
export async function filterSyncedCustomers(
  searchTerm?: string,
  status?: string,
  limit: number = 100,
  offset: number = 0
): Promise<AsaasCustomerSync[]> {
  try {
    let query = supabase
      .from('asaas_customers_sync')
      .select('*')

    if (searchTerm) {
      query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,cpf_cnpj.ilike.%${searchTerm}%`)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[v0] Erro ao filtrar clientes:', error)
      return []
    }

    return data || []
  } catch (err) {
    console.error('[v0] Erro inesperado ao filtrar clientes:', err)
    return []
  }
}
