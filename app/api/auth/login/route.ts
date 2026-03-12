import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error("Supabase admin credentials not configured")
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

// POST /api/auth/login
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email e senha são obrigatórios" }, { status: 400 })
    }

    const supabase = getAdminClient()

    // Buscar usuário pelo email (server-side, bypassa RLS)
    const { data: user, error } = await supabase
      .from("users")
      .select("id, email, full_name, role, is_active, permissions, password_hash")
      .eq("email", email.toLowerCase().trim())
      .single()

    if (error || !user) {
      return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 })
    }

    if (!user.is_active) {
      return NextResponse.json({ error: "Usuário desativado. Contate o administrador." }, { status: 403 })
    }

    // Verificar senha server-side (password_hash nunca sai do servidor)
    const inputHash = await hashPassword(password)
    if (user.password_hash !== inputHash) {
      return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 })
    }

    // Retornar apenas dados de sessão (sem password_hash)
    return NextResponse.json({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      permissions: user.permissions,
    })
  } catch (err) {
    console.error("[auth/login] Error:", err)
    return NextResponse.json({ error: "Erro interno ao autenticar" }, { status: 500 })
  }
}
