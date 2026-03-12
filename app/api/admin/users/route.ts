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

// GET /api/admin/users — list all users
export async function GET() {
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
  try {
    const body = await req.json()
    const { email, full_name, role, password_hash, permissions } = body

    if (!email || !full_name || !password_hash) {
      return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 })
    }

    const supabase = getAdminClient()
    const { error } = await supabase.from("users").insert([
      {
        email,
        full_name,
        role,
        is_active: true,
        permissions,
        password_hash,
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
