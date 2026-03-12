import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
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
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
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
