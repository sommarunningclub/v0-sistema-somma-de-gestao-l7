import { NextRequest, NextResponse } from "next/server"
import {
  getAdminClient,
  hashPassword,
  verifyPassword,
} from "@/lib/auth/api-auth"
import {
  createSessionToken,
  attachSessionCookie,
} from "@/lib/auth/session"

// POST /api/auth/login
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email e senha são obrigatórios" }, { status: 400 })
    }

    const supabase = getAdminClient()

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

    const { valid, needsRehash } = await verifyPassword(password, user.password_hash)
    if (!valid) {
      return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 })
    }

    if (needsRehash) {
      const newHash = await hashPassword(password)
      await supabase.from("users").update({ password_hash: newHash }).eq("id", user.id)
    }

    const token = await createSessionToken({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      permissions: user.permissions,
    })

    const response = NextResponse.json({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      permissions: user.permissions,
    })

    return attachSessionCookie(response, token)
  } catch (err) {
    console.error("[auth/login] Error:", err)
    return NextResponse.json({ error: "Erro interno ao autenticar" }, { status: 500 })
  }
}
