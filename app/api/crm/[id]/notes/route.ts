import { NextRequest, NextResponse } from 'next/server'
import { getLeadNotes, createLeadNote, deleteLeadNote } from '@/lib/services/crm'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const notes = await getLeadNotes(id)
  return NextResponse.json(notes)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    if (!body.content || !body.created_by) {
      return NextResponse.json({ error: 'Conteúdo e criador são obrigatórios' }, { status: 400 })
    }

    const note = await createLeadNote({
      lead_id: id,
      content: body.content,
      created_by: body.created_by,
    })

    if (!note) {
      return NextResponse.json({ error: 'Erro ao criar nota' }, { status: 500 })
    }

    return NextResponse.json(note, { status: 201 })
  } catch (err) {
    console.error('[v0] CRM notes POST error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const noteId = searchParams.get('noteId')

    if (!noteId) {
      return NextResponse.json({ error: 'noteId é obrigatório' }, { status: 400 })
    }

    const success = await deleteLeadNote(noteId)

    if (!success) {
      return NextResponse.json({ error: 'Erro ao deletar nota' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[v0] CRM notes DELETE error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
