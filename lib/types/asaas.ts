// Tipos para integração com Asaas

export interface AsaasCustomer {
  id: number
  asaas_id: string
  name: string
  cpf_cnpj: string
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  external_reference: string | null
  raw_data: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface AsaasPayment {
  id: number
  asaas_id: string
  customer_asaas_id: string
  value: number
  net_value: number | null
  description: string | null
  billing_type: string
  status: string
  due_date: string
  payment_date: string | null
  confirmed_date: string | null
  credit_date: string | null
  external_reference: string | null
  raw_data: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface AsaasSubscription {
  id: string
  customer: string
  value: number
  nextDueDate: string
  cycle: string
  description: string | null
  billingType: string
  status: string
  fine: Record<string, unknown> | null
  interest: Record<string, unknown> | null
  discount: Record<string, unknown> | null
}

export interface AsaasCoupon {
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

export interface DashboardMetrics {
  month: string
  received: number
  awaiting: number
  overdue: number
  mrr: number
  activeSubscriptions: number
  churnRate: number
}

export interface CustomerCreatePayload {
  name: string
  cpfCnpj: string
  email?: string
  mobilePhone?: string
  phone?: string
  postalCode?: string
  address?: string
  addressNumber?: string
  complement?: string
  province?: string
  city?: string
  state?: string
  groupName?: string // Grupo do cliente no Asaas
}

export interface AsaasCustomerGroup {
  object: string
  id: string
  name: string
  deleted: boolean
}

export interface ChargeCreatePayload {
  customer: string
  value: number
  dueDate: string
  billingType: 'BOLETO' | 'CREDIT_CARD' | 'PIX'
  description?: string
  externalReference?: string
  fine?: { value: number }
  interest?: { value: number }
  discount?: { value: number; dueDateLimitDays?: number }
}

export interface SubscriptionCreatePayload {
  customer: string
  value: number
  nextDueDate: string
  cycle: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'YEARLY'
  description?: string
  billingType?: 'BOLETO' | 'CREDIT_CARD' | 'PIX'
  fine?: { value: number }
  interest?: { value: number }
  discount?: { value: number; dueDateLimitDays?: number }
}

export interface CouponCreatePayload {
  code: string
  type: 'PERCENTAGE' | 'FIXED'
  value: number
  expiration_date?: string
  usage_limit?: number
}

export type PaymentStatus = 
  | 'PENDING'
  | 'RECEIVED'
  | 'CONFIRMED'
  | 'OVERDUE'
  | 'REFUNDED'
  | 'RECEIVED_IN_CASH'
  | 'REFUND_REQUESTED'
  | 'CHARGEBACK_REQUESTED'
  | 'CHARGEBACK_DISPUTE'
  | 'AWAITING_CHARGEBACK_REVERSAL'
  | 'DUNNING_REQUESTED'
  | 'DUNNING_RECEIVED'
  | 'AWAITING_RISK_ANALYSIS'

export type SubscriptionStatus = 
  | 'ACTIVE'
  | 'INACTIVE'
  | 'EXPIRED'

export type BillingType = 'BOLETO' | 'CREDIT_CARD' | 'PIX' | 'UNDEFINED'
