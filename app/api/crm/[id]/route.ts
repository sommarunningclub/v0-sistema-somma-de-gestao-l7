import { NextRequest, NextResponse } from 'next/server'
import { getLeadById, updateLead, deleteLead, moveLeadToStage, CRM_STAGES } from '@/lib/services/crm'
import type { CRMStage } from '@/lib/services/crm'

const VALID_STAGES = CRM_STAGES.map((s) => s.id)

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const lead = await getLeadById(id)

  if (!lead) {
    return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
  }

  return NextResponse.json(lead)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    // Validate stage if provided
    if (body.stage && !VALID_STAGES.includes(body.stage)) {
      return NextResponse.json({ error: 'Etapa inválida' }, { status: 400 })
    }

    // If only stage is being updated, use moveLeadToStage for position management
    if (body.stage && Object.keys(body).length === 1) {
      const success = await moveLeadToStage(id, body.stage as CRMStage)
      if (!success) {
        return NextResponse.json({ error: 'Erro ao mover lead' }, { status: 500 })
      }
      const updated = await getLeadById(id)
      return NextResponse.json(updated)
    }

    const lead = await updateLead(id, body)

    if (!lead) {
      return NextResponse.json({ error: 'Erro ao atualizar lead' }, { status: 500 })
    }

    return NextResponse.json(lead)
  } catch (err) {
    console.error('[v0] CRM PATCH error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const success = await deleteLead(id)

  if (!success) {
    return NextResponse.json({ error: 'Erro ao deletar lead' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
