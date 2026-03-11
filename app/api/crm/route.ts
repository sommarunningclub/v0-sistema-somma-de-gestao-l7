import { NextRequest, NextResponse } from 'next/server'
import { getLeads, createLead, CRM_STAGES } from '@/lib/services/crm'
import type { CRMStage } from '@/lib/services/crm'

const VALID_STAGES = CRM_STAGES.map((s) => s.id)

export async function GET() {
  const leads = await getLeads()
  return NextResponse.json(leads)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const { name, phone, email, company_name, cnpj, description, stage, created_by } = body

    if (!name || !created_by) {
      return NextResponse.json({ error: 'Nome e criador são obrigatórios' }, { status: 400 })
    }

    const validStage = VALID_STAGES.includes(stage) ? (stage as CRMStage) : 'novo_lead'

    const lead = await createLead({
      name,
      phone: phone || '',
      email: email || '',
      company_name: company_name || '',
      cnpj: cnpj || '',
      description: description || '',
      stage: validStage,
      created_by,
    })

    if (!lead) {
      return NextResponse.json({ error: 'Erro ao criar lead' }, { status: 500 })
    }

    return NextResponse.json(lead, { status: 201 })
  } catch (err) {
    console.error('[v0] CRM POST error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
