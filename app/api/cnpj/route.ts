import { NextRequest, NextResponse } from 'next/server'
import { fetchCNPJData, getPartnerByCNPJ } from '@/lib/services/partners'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs' // Usar nodejs runtime para evitar limitacoes de edge

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const cnpj = searchParams.get('cnpj')

    if (!cnpj) {
      return NextResponse.json(
        { error: 'CNPJ e obrigatorio' },
        { status: 400 }
      )
    }

    const cleanCNPJ = cnpj.replace(/\D/g, '')
    if (cleanCNPJ.length !== 14) {
      return NextResponse.json(
        { error: 'CNPJ deve conter 14 digitos' },
        { status: 400 }
      )
    }

    console.log('[v0] Fetching CNPJ data for:', cleanCNPJ)

    // Busca dados da empresa
    const cnpjData = await fetchCNPJData(cleanCNPJ)

    if (!cnpjData) {
      return NextResponse.json(
        { error: 'CNPJ nao encontrado. Verifique se o numero esta correto.' },
        { status: 404 }
      )
    }

    // Verifica se o parceiro ja existe
    const existingPartner = await getPartnerByCNPJ(cleanCNPJ)

    console.log('[v0] CNPJ data fetched successfully:', {
      cnpj: cnpjData.cnpj,
      name: cnpjData.name,
      exists: !!existingPartner
    })

    return NextResponse.json({
      company: {
        cnpj: cnpjData.cnpj,
        name: cnpjData.name,
        legal_name: cnpjData.legal_name,
        email: cnpjData.email,
        phone: cnpjData.phone,
        status: cnpjData.status,
        address: cnpjData.address
      },
      exists: !!existingPartner,
      existing_partner: existingPartner || null
    })
  } catch (error) {
    console.error('[v0] Error fetching CNPJ:', error)

    const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar CNPJ'
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
