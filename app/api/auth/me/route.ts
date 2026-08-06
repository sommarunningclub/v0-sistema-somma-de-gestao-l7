import { NextRequest, NextResponse } from "next/server"
import {
  getAdminClient,
  requireAuth,
  refreshSessionCookie,
} from "@/lib/auth/api-auth"

// GET /api/auth/me — retorna usuário autenticado via cookie de sessão
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (auth instanceof NextResponse) return auth

    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from("users")
      .select("id, email, full_name, role, is_active, permissions, created_at")
      .eq("id", auth.session.sub)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }

    if (!data.is_active) {
      return NextResponse.json({ error: "Usuário inativo" }, { status: 403 })
    }

    const response = NextResponse.json(data)
    return refreshSessionCookie(data, response)
  } catch (err) {
    console.error("[auth/me] Error:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

// PATCH /api/auth/me — o usuário edita o próprio perfil.
// O id vem sempre da sessão, nunca do corpo da requisição: assim ninguém
// consegue alterar o perfil de outra pessoa mandando outro id.
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (auth instanceof NextResponse) return auth

    const body = await req.json()
    const fullName = typeof body?.full_name === "string" ? body.full_name.trim() : ""

    if (!fullName) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 })
    }

    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from("users")
      .update({ full_name: fullName, updated_at: new Date().toISOString() })
      .eq("id", auth.session.sub)
      .select("id, email, full_name, role, is_active, permissions, created_at")
      .single()

    if (error || !data) {
      console.error("[auth/me] PATCH error:", error)
      return NextResponse.json({ error: "Erro ao atualizar perfil" }, { status: 500 })
    }

    // O nome vive dentro do token de sessão, então ele precisa ser reemitido —
    // senão a UI volta a mostrar o nome antigo no próximo carregamento.
    const response = NextResponse.json(data)
    return refreshSessionCookie(data, response)
  } catch (err) {
    console.error("[auth/me] PATCH exception:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
