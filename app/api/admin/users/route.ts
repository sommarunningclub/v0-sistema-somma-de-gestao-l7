import { NextRequest, NextResponse } from "next/server"
import {
  getAdminClient,
  hashPassword,
  requireAdmin,
} from "@/lib/auth/api-auth"

// GET /api/admin/users — list all users
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  try {
    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from("users")
      .select("id, email, full_name, role, is_active, created_at, permissions")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[admin/users] GET error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error("[admin/users] GET exception:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST /api/admin/users — create user
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()
    const { email, full_name, role, password, permissions } = body

    if (!email || !full_name || !password) {
      return NextResponse.json({ error: "Email, nome e senha são obrigatórios" }, { status: 400 })
    }

    const finalHash = await hashPassword(password)

    const supabase = getAdminClient()
    const { error } = await supabase.from("users").insert([
      {
        email: String(email).toLowerCase().trim(),
        full_name,
        role: role || "user",
        is_active: true,
        permissions,
        password_hash: finalHash,
        created_at: new Date().toISOString(),
      },
    ])

    if (error) {
      console.error("[admin/users] POST error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[admin/users] POST exception:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
