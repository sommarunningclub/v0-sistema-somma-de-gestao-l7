import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/api-auth'
import { redefinirMfa } from '@/lib/auth/mfa'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * DELETE /api/admin/users/[id]/mfa — redefine o Google Authenticator.
 *
 * Para quem trocou ou perdeu o celular: apaga o segredo cadastrado, e no
 * próximo login a pessoa vê o QR code de novo. Sessões já abertas continuam
 * valendo até expirar; para cortar o acesso agora, revogue o usuário.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Usuário inválido' }, { status: 400 })

  try {
    await redefinirMfa(id)
    console.log('[admin/users/mfa] 2FA redefinido para', id, 'por', auth.session.email)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/users/mfa] DELETE error:', err)
    return NextResponse.json({ error: 'Erro ao redefinir o 2FA' }, { status: 500 })
  }
}
