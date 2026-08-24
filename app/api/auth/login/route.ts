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
import { checkRateLimit, clientKey } from "@/lib/auth/rate-limit"

// Força bruta: 10 tentativas por IP e 5 por e-mail a cada 60s. O balde por
// e-mail existe para que uma botnet distribuída não contorne o limite por IP;
// o por IP, para que um atacante não trave contas alheias em massa.
const TENTATIVAS_POR_IP = 10
const TENTATIVAS_POR_EMAIL = 5
const JANELA_MS = 60_000

function limiteExcedido(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Muitas tentativas. Aguarde um instante e tente novamente." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  )
}

// POST /api/auth/login
export async function POST(req: NextRequest) {
  try {
    const ip = clientKey(req)
    const porIp = checkRateLimit(`login:ip:${ip}`, TENTATIVAS_POR_IP, JANELA_MS)
    if (!porIp.allowed) {
      console.warn("[auth/login] rate limit por IP excedido")
      return limiteExcedido(porIp.retryAfterSeconds)
    }

    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email e senha são obrigatórios" }, { status: 400 })
    }

    const emailNormalizado = String(email).toLowerCase().trim()
    const porEmail = checkRateLimit(
      `login:email:${emailNormalizado}`,
      TENTATIVAS_POR_EMAIL,
      JANELA_MS
    )
    if (!porEmail.allowed) {
      console.warn("[auth/login] rate limit por e-mail excedido")
      return limiteExcedido(porEmail.retryAfterSeconds)
    }

    const supabase = getAdminClient()

    const { data: user, error } = await supabase
      .from("users")
      .select("id, email, full_name, role, is_active, permissions, password_hash")
      .eq("email", emailNormalizado)
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
