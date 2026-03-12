import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function PATCH(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
  try {
    const { cpf, validated } = await request.json()

    if (!cpf) {
      return NextResponse.json(
        { error: 'CPF é obrigatório' },
        { status: 400 }
      )
    }

    if (typeof validated !== 'boolean') {
      return NextResponse.json(
        { error: 'Status de validação deve ser um booleano' },
        { status: 400 }
      )
    }

    // Formatar CPF para padrão do Supabase (remover caracteres não numéricos)
    const cleanCpf = cpf.replace(/\D/g, '')
    
    // Tentar ambos os formatos: com pontuação e sem
    const formattedCpf = `${cleanCpf.slice(0, 3)}.${cleanCpf.slice(3, 6)}.${cleanCpf.slice(6, 9)}-${cleanCpf.slice(9, 11)}`

    // Primeiro, buscar o registro pelo CPF (tentar ambos os formatos)
    const { data: existingRecords, error: searchError } = await supabase
      .from('checkins')
      .select('*')
      .or(`cpf.eq.${cleanCpf},cpf.eq.${formattedCpf}`)

    if (searchError) throw searchError

    if (!existingRecords || existingRecords.length === 0) {
      return NextResponse.json(
        { error: 'Check-in não encontrado para este CPF' },
        { status: 404 }
      )
    }

    // Atualizar o registro encontrado
    const recordToUpdate = existingRecords[0]
    const { data, error } = await supabase
      .from('checkins')
      .update({
        validated,
        validated_at: validated ? new Date().toISOString() : null
      })
      .eq('cpf', recordToUpdate.cpf)
      .select()

    if (error) throw error

    return NextResponse.json({
      data: data?.[0],
      message: `Check-in ${validated ? 'validado' : 'invalidado'} com sucesso`
    })
  } catch (error) {
    console.error('[v0] Error updating check-in validation:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update check-in validation' },
      { status: 500 }
    )
  }
}
