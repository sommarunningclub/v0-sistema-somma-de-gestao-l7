import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error("Supabase admin credentials not configured")
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// PATCH /api/admin/users/[id] — update user fields (permissions, role, is_active)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const { id } = params

    if (!id) {
      return NextResponse.json({ error: "ID do usuário ausente" }, { status: 400 })
    }

    const supabase = getAdminClient()
    const { error } = await supabase.from("users").update(body).eq("id", id)

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
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    if (!id) {
      return NextResponse.json({ error: "ID do usuário ausente" }, { status: 400 })
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
