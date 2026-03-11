import { NextRequest, NextResponse } from 'next/server'
import { getLeadAttachments, createLeadAttachment, deleteLeadAttachment } from '@/lib/services/crm'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const attachments = await getLeadAttachments(id)
  return NextResponse.json(attachments)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    if (!body.file_name || !body.file_url || !body.uploaded_by) {
      return NextResponse.json({ error: 'Dados do arquivo são obrigatórios' }, { status: 400 })
    }

    const attachment = await createLeadAttachment({
      lead_id: id,
      file_name: body.file_name,
      file_url: body.file_url,
      file_type: body.file_type || '',
      file_size: body.file_size || 0,
      uploaded_by: body.uploaded_by,
    })

    if (!attachment) {
      return NextResponse.json({ error: 'Erro ao criar anexo' }, { status: 500 })
    }

    return NextResponse.json(attachment, { status: 201 })
  } catch (err) {
    console.error('[v0] CRM attachments POST error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const attachmentId = searchParams.get('attachmentId')

    if (!attachmentId) {
      return NextResponse.json({ error: 'attachmentId é obrigatório' }, { status: 400 })
    }

    const success = await deleteLeadAttachment(attachmentId)

    if (!success) {
      return NextResponse.json({ error: 'Erro ao deletar anexo' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[v0] CRM attachments DELETE error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
