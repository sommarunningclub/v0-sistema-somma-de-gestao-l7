import { createClient } from '@supabase/supabase-js'
import { CRM_STAGES } from '@/lib/crm-constants'
import type { CRMStage } from '@/lib/crm-constants'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

export { CRM_STAGES, type CRMStage }

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CRMLead {
  id: string
  name: string
  phone: string
  email: string
  company_name: string
  cnpj: string
  description: string
  stage: CRMStage
  position: number
  created_at: string
  updated_at: string
  created_by: string
}

export interface CRMLeadNote {
  id: string
  lead_id: string
  content: string
  created_by: string
  created_at: string
}

export interface CRMLeadAttachment {
  id: string
  lead_id: string
  file_name: string
  file_url: string
  file_type: string
  file_size: number
  uploaded_by: string
  uploaded_at: string
}

// ─── Leads CRUD ──────────────────────────────────────────────────────────────

export async function getLeads(): Promise<CRMLead[]> {
  const { data, error } = await getSupabase()
    .from('crm_leads')
    .select('*')
    .order('position', { ascending: true })

  if (error) {
    console.error('[v0] Error fetching CRM leads:', error)
    return []
  }
  return data || []
}

export async function getLeadById(id: string): Promise<CRMLead | null> {
  const { data, error } = await getSupabase()
    .from('crm_leads')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('[v0] Error fetching CRM lead:', error)
    return null
  }
  return data
}

export async function createLead(lead: Omit<CRMLead, 'id' | 'created_at' | 'updated_at' | 'position'>): Promise<CRMLead | null> {
  // Get max position for the stage
  const { data: existing } = await getSupabase()
    .from('crm_leads')
    .select('position')
    .eq('stage', lead.stage)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0

  const { data, error } = await getSupabase()
    .from('crm_leads')
    .insert({
      ...lead,
      position: nextPosition,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('[v0] Error creating CRM lead:', error)
    return null
  }
  return data
}

export async function updateLead(id: string, updates: Partial<CRMLead>): Promise<CRMLead | null> {
  const { data, error } = await getSupabase()
    .from('crm_leads')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[v0] Error updating CRM lead:', error)
    return null
  }
  return data
}

export async function deleteLead(id: string): Promise<boolean> {
  // Delete related notes and attachments first
  await getSupabase().from('crm_lead_notes').delete().eq('lead_id', id)
  await getSupabase().from('crm_lead_attachments').delete().eq('lead_id', id)

  const { error } = await getSupabase()
    .from('crm_leads')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[v0] Error deleting CRM lead:', error)
    return false
  }
  return true
}

export async function moveLeadToStage(id: string, newStage: CRMStage): Promise<boolean> {
  // Get max position in target stage
  const { data: existing } = await getSupabase()
    .from('crm_leads')
    .select('position')
    .eq('stage', newStage)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0

  const { error } = await getSupabase()
    .from('crm_leads')
    .update({ stage: newStage, position: nextPosition, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('[v0] Error moving CRM lead:', error)
    return false
  }
  return true
}

// ─── Notes CRUD ──────────────────────────────────────────────────────────────

export async function getLeadNotes(leadId: string): Promise<CRMLeadNote[]> {
  const { data, error } = await getSupabase()
    .from('crm_lead_notes')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[v0] Error fetching CRM lead notes:', error)
    return []
  }
  return data || []
}

export async function createLeadNote(note: Omit<CRMLeadNote, 'id' | 'created_at'>): Promise<CRMLeadNote | null> {
  const { data, error } = await getSupabase()
    .from('crm_lead_notes')
    .insert({
      ...note,
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('[v0] Error creating CRM lead note:', error)
    return null
  }
  return data
}

export async function deleteLeadNote(id: string): Promise<boolean> {
  const { error } = await getSupabase()
    .from('crm_lead_notes')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[v0] Error deleting CRM lead note:', error)
    return false
  }
  return true
}

// ─── Attachments CRUD ────────────────────────────────────────────────────────

export async function getLeadAttachments(leadId: string): Promise<CRMLeadAttachment[]> {
  const { data, error } = await getSupabase()
    .from('crm_lead_attachments')
    .select('*')
    .eq('lead_id', leadId)
    .order('uploaded_at', { ascending: false })

  if (error) {
    console.error('[v0] Error fetching CRM lead attachments:', error)
    return []
  }
  return data || []
}

export async function createLeadAttachment(attachment: Omit<CRMLeadAttachment, 'id' | 'uploaded_at'>): Promise<CRMLeadAttachment | null> {
  const { data, error } = await getSupabase()
    .from('crm_lead_attachments')
    .insert({
      ...attachment,
      uploaded_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('[v0] Error creating CRM lead attachment:', error)
    return null
  }
  return data
}

export async function deleteLeadAttachment(id: string): Promise<boolean> {
  const { error } = await getSupabase()
    .from('crm_lead_attachments')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[v0] Error deleting CRM lead attachment:', error)
    return false
  }
  return true
}

