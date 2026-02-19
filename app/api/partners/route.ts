import { NextRequest, NextResponse } from 'next/server'
import {
  createPartner,
  getAllPartners,
  getPartnerByCNPJ,
  updatePartner,
  deletePartner,
  type Partner
} from '@/lib/services/partners'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const cnpj = searchParams.get('cnpj')
    const status = searchParams.get('status') as 'active' | 'inactive' | 'pending' | null

    if (cnpj) {
      // Busca parceiro específico por CNPJ
      const partner = await getPartnerByCNPJ(cnpj)
      if (!partner) {
        return NextResponse.json(
          { error: 'Parceiro não encontrado' },
          { status: 404 }
        )
      }
      return NextResponse.json(partner)
    }

    // Lista todos os parceiros
    const partners = await getAllPartners(status || undefined)
    return NextResponse.json({
      data: partners,
      count: partners.length
    })
  } catch (error) {
    console.error('[v0] Error fetching partners:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar parceiros' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    console.log('[v0] Creating partner with CNPJ:', body.cnpj)

    // Validação básica
    if (!body.cnpj || !body.company_name || !body.responsible_name || !body.responsible_cpf || !body.responsible_email || !body.responsible_phone) {
      return NextResponse.json(
        { error: 'Campos obrigatórios faltando' },
        { status: 400 }
      )
    }

    // Verifica se parceiro já existe
    const existing = await getPartnerByCNPJ(body.cnpj)
    if (existing) {
      return NextResponse.json(
        { error: 'Parceiro com este CNPJ já existe' },
        { status: 409 }
      )
    }

    const partner = await createPartner({
      cnpj: body.cnpj.replace(/\D/g, ''),
      company_name: body.company_name,
      company_legal_name: body.company_legal_name,
      company_email: body.company_email,
      company_phone: body.company_phone,
      company_address: body.company_address,
      company_city: body.company_city,
      company_state: body.company_state,
      responsible_name: body.responsible_name,
      responsible_cpf: body.responsible_cpf.replace(/\D/g, ''),
      responsible_email: body.responsible_email,
      responsible_phone: body.responsible_phone.replace(/\D/g, ''),
      status: body.status || 'active',
      notes: body.notes
    })

    if (!partner) {
      return NextResponse.json(
        { error: 'Erro ao criar parceiro' },
        { status: 500 }
      )
    }

    console.log('[v0] Partner created successfully:', partner.id)

    return NextResponse.json(partner, { status: 201 })
  } catch (error) {
    console.error('[v0] Error creating partner:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao criar parceiro' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID do parceiro é obrigatório' },
        { status: 400 }
      )
    }

    const body = await request.json()

    console.log('[v0] Updating partner:', id)

    const partner = await updatePartner(id, body)

    if (!partner) {
      return NextResponse.json(
        { error: 'Erro ao atualizar parceiro' },
        { status: 500 }
      )
    }

    console.log('[v0] Partner updated successfully:', id)

    return NextResponse.json(partner)
  } catch (error) {
    console.error('[v0] Error updating partner:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar parceiro' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID do parceiro é obrigatório' },
        { status: 400 }
      )
    }

    console.log('[v0] Deleting partner:', id)

    const success = await deletePartner(id)

    if (!success) {
      return NextResponse.json(
        { error: 'Erro ao deletar parceiro' },
        { status: 500 }
      )
    }

    console.log('[v0] Partner deleted successfully:', id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Error deleting partner:', error)
    return NextResponse.json(
      { error: 'Erro ao deletar parceiro' },
      { status: 500 }
    )
  }
}
