import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, requirePermission } from '@/lib/auth/api-auth'

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'parceiro')
  if (auth instanceof NextResponse) return auth

  const supabase = getAdminClient()
  try {
    const { data, error } = await supabase
      .from('codigo_parceiro')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('[v0] Error fetching partner codes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch partner codes' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'parceiro')
  if (auth instanceof NextResponse) return auth

  const supabase = getAdminClient()
  try {
    const { codigo, nome_parceiro } = await request.json()
    
    if (!codigo || !nome_parceiro) {
      return NextResponse.json(
        { error: 'Código e nome do parceiro são obrigatórios' },
        { status: 400 }
      )
    }
    
    const { data, error } = await supabase
      .from('codigo_parceiro')
      .insert([
        {
          codigo: codigo.toUpperCase().trim(),
          nome_parceiro: nome_parceiro.trim(),
          ativo: true,
          created_at: new Date().toISOString(),
        }
      ])
      .select()
    
    if (error) throw error
    
    return NextResponse.json({ 
      data: data?.[0],
      message: 'Código criado com sucesso'
    })
  } catch (error) {
    console.error('[v0] Error creating partner code:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create partner code' },
      { status: 500 }
    )
  }
}
