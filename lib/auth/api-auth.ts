import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getSessionFromRequest,
  hasModulePermission,
  createSessionToken,
  attachSessionCookie,
} from './session'
import type { ModulePermissions, PermissionKey, SessionPayload } from './types'
export { hashPassword, verifyPassword, isBcryptHash } from './password'

export function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Supabase admin credentials not configured')
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function requireAuth(
  req: NextRequest
): Promise<{ session: SessionPayload } | NextResponse> {
  const session = await getSessionFromRequest(req)
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const supabase = getAdminClient()
  const { data: user } = await supabase
    .from('users')
    .select('is_active')
    .eq('id', session.sub)
    .single()

  if (!user?.is_active) {
    return NextResponse.json({ error: 'Usuário inativo' }, { status: 403 })
  }

  return { session }
}

export async function requirePermission(
  req: NextRequest,
  permission: PermissionKey
): Promise<{ session: SessionPayload } | NextResponse> {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  if (!hasModulePermission(auth.session, permission)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  return auth
}

export async function requireAdmin(
  req: NextRequest
): Promise<{ session: SessionPayload } | NextResponse> {
  return requirePermission(req, 'admin')
}

export async function refreshSessionCookie(
  user: {
    id: string
    email: string
    full_name: string
    role: string
    permissions: ModulePermissions | null
  },
  response: NextResponse
): Promise<NextResponse> {
  const token = await createSessionToken(user)
  return attachSessionCookie(response, token)
}
