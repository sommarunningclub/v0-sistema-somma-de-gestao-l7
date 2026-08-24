import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, requireAuth } from '@/lib/auth/api-auth'

// Catálogo de tags para autocompletar. Mesma regra de acesso de
// /api/entity-tags: basta sessão válida.
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('tag_definitions')
    .select('*')
    .order('tag', { ascending: true })

  if (error) {
    console.error('[entity-tags/definitions] GET error:', error)
    return NextResponse.json({ error: 'Erro ao buscar definições' }, { status: 500 })
  }

  return NextResponse.json({ data: data || [] })
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    const body = await request.json()
    const tag = typeof body.tag === 'string' ? body.tag.trim().replace(/^#/, '') : ''
    const color = typeof body.color === 'string' && body.color ? body.color : 'blue'

    if (!tag) {
      return NextResponse.json({ error: 'tag é obrigatória' }, { status: 400 })
    }

    const supabase = getAdminClient()
    const { error } = await supabase.from('tag_definitions').insert({ tag, color })

    // 23505 = unique_violation: a definição já existe, o que não é erro aqui.
    if (error && error.code !== '23505') {
      console.error('[entity-tags/definitions] POST error:', error)
      return NextResponse.json({ error: 'Erro ao salvar definição' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    console.error('[entity-tags/definitions] POST exception:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
