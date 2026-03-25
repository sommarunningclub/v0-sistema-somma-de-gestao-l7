import { NextRequest, NextResponse } from 'next/server'
import { getPopups, createPopup } from '@/lib/services/popups'

export async function GET() {
  const popups = await getPopups()
  return NextResponse.json(popups)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, image_url, redirect_link, is_active, start_date, end_date, pages, frequency } = body

    if (!title || !redirect_link || !start_date) {
      return NextResponse.json(
        { error: 'title, redirect_link e start_date são obrigatórios' },
        { status: 400 }
      )
    }

    if (!['uma_vez', 'sessao', 'sempre'].includes(frequency)) {
      return NextResponse.json({ error: 'frequency inválido' }, { status: 400 })
    }

    const popup = await createPopup({
      title,
      image_url: image_url || '',
      redirect_link,
      is_active: is_active ?? false,
      start_date,
      end_date: end_date || null,
      pages: pages || [],
      frequency,
    })

    if (!popup) {
      return NextResponse.json({ error: 'Erro ao criar popup' }, { status: 500 })
    }

    return NextResponse.json(popup, { status: 201 })
  } catch (err) {
    console.error('[popups] POST error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
