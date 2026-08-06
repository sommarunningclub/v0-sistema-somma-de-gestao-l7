import { NextRequest, NextResponse } from "next/server"
import {
  getAdminClient,
  hashPassword,
  requireAdmin,
} from "@/lib/auth/api-auth"

const ALLOWED_PATCH_FIELDS = new Set([
  "full_name",
  "role",
  "is_active",
  "permissions",
  "password",
])

// PATCH /api/admin/users/[id] — update user fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: "ID do usuário ausente" }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(body)) {
      if (!ALLOWED_PATCH_FIELDS.has(key)) continue
      if (key === "password") {
        updates.password_hash = await hashPassword(String(value))
      } else {
        updates[key] = value
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nenhum campo válido para atualizar" }, { status: 400 })
    }

    const supabase = getAdminClient()
    const { error } = await supabase.from("users").update(updates).eq("id", id)

    if (error) {
      console.error("[admin/users/[id]] PATCH error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[admin/users/[id]] PATCH exception:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// DELETE /api/admin/users/[id] — delete user
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: "ID do usuário ausente" }, { status: 400 })
    }

    if (id === auth.session.sub) {
      return NextResponse.json({ error: "Não é possível deletar o próprio usuário" }, { status: 400 })
    }

    const supabase = getAdminClient()
    const { error } = await supabase.from("users").delete().eq("id", id)

    if (error) {
      console.error("[admin/users/[id]] DELETE error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[admin/users/[id]] DELETE exception:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
