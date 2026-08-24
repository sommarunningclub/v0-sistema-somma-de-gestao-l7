import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { isValidAttachmentUrl } from '@/lib/services/attachment-url'
import { getTaskAttachments, createTaskAttachment, deleteTaskAttachment } from '@/lib/services/tarefas'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const attachments = await getTaskAttachments(id)
  return NextResponse.json(attachments)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'tarefas')
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params
    const body = await req.json()

    if (!body.file_name || !body.file_url) {
      return NextResponse.json({ error: 'Dados do arquivo são obrigatórios' }, { status: 400 })
    }

    if (!isValidAttachmentUrl(body.file_url)) {
      return NextResponse.json({ error: 'URL do arquivo inválida' }, { status: 400 })
    }

    const attachment = await createTaskAttachment({
      task_id: id,
      file_name: body.file_name,
      file_url: body.file_url,
      file_type: body.file_type || '',
      file_size: body.file_size || 0,
      // Autoria vem da sessão: o body do client não define quem enviou.
      uploaded_by: auth.session.full_name || auth.session.email,
    })

    if (!attachment) {
      return NextResponse.json({ error: 'Erro ao criar anexo' }, { status: 500 })
    }

    return NextResponse.json(attachment, { status: 201 })
  } catch (err) {
    console.error('[v0] tarefas attachments POST error:', err)
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

    const success = await deleteTaskAttachment(attachmentId)

    if (!success) {
      return NextResponse.json({ error: 'Erro ao deletar anexo' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[v0] tarefas attachments DELETE error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
