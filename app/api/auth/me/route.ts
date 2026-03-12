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

// GET /api/auth/me?id=<userId>
// Retorna dados atualizados do usuário (incluindo permissões) do banco
export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "ID do usuário ausente" }, { status: 400 })
    }

    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from("users")
      .select("id, email, full_name, role, is_active, permissions")
      .eq("id", id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }

    if (!data.is_active) {
      return NextResponse.json({ error: "Usuário inativo" }, { status: 403 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error("[auth/me] Error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
