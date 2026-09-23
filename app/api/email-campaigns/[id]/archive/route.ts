import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { getCampaignById, setCampaignArchived } from '@/lib/services/email-campaigns'
import { motivoNaoArquivavel, podeArquivar } from '@/lib/email/arquivar'

// Arquivar (POST) e desarquivar (DELETE) uma campanha.
//
// Fica fora do PATCH de edição de propósito: lá o schema exige o pacote
// completo de campos válidos de uma campanha, e arquivar não edita conteúdo
// nenhum — é só tirar da listagem. Nada do histórico é tocado.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(req, 'email')
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  const campanha = await getCampaignById(id)
  if (!campanha) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })

  // Uma campanha agendada que sumisse da tela dispararia sozinha dias depois;
  // uma em envio está sendo processada pelo cron agora.
  if (!podeArquivar(campanha.status)) {
    return NextResponse.json({ error: motivoNaoArquivavel(campanha.status) }, { status: 409 })
  }

  const atualizada = await setCampaignArchived(id, true)
  if (!atualizada) return NextResponse.json({ error: 'Erro ao arquivar campanha' }, { status: 500 })

  console.log('[email-campaigns] Campanha', campanha.nome, 'arquivada por', auth.session.email)
  return NextResponse.json(atualizada)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(req, 'email')
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  // Desarquivar não precisa de checagem de status: devolver à listagem uma
  // campanha terminada nunca dispara nada.
  const atualizada = await setCampaignArchived(id, false)
  if (!atualizada) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })

  console.log('[email-campaigns] Campanha', atualizada.nome, 'desarquivada por', auth.session.email)
  return NextResponse.json(atualizada)
}
