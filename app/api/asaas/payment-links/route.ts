import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const revalidate = 0

const ASAAS_BASE_URL = "https://api.asaas.com/v3"

function getApiKey() {
  const key = process.env.ASAAS_API_KEY || ""
  if (!key) console.error("[v0] ASAAS_API_KEY not configured")
  return key.trim()
}

async function asaasRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  params?: Record<string, string>
) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error("ASAAS_API_KEY not configured")

  const url = new URL(`${ASAAS_BASE_URL}${path}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v))
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      access_token: apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, data }
}

// GET — listar ou recuperar um único link
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  const offset = searchParams.get("offset") || "0"
  const limit = searchParams.get("limit") || "20"
  const active = searchParams.get("active")
  const name = searchParams.get("name")

  const apiKey = getApiKey()
  if (!apiKey) {
    return NextResponse.json({ error: "ASAAS_API_KEY not configured" }, { status: 500 })
  }

  try {
    if (id) {
      const result = await asaasRequest("GET", `/paymentLinks/${id}`)
      if (!result.ok) return NextResponse.json({ error: result.data }, { status: result.status })
      return NextResponse.json(result.data)
    }

    const params: Record<string, string> = { offset, limit }
    if (active !== null && active !== undefined) params.active = active
    if (name) params.name = name

    const result = await asaasRequest("GET", "/paymentLinks", undefined, params)
    if (!result.ok) return NextResponse.json({ error: result.data }, { status: result.status })
    return NextResponse.json(result.data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST — criar novo link
export async function POST(request: NextRequest) {
  const apiKey = getApiKey()
  if (!apiKey) {
    return NextResponse.json({ error: "ASAAS_API_KEY not configured" }, { status: 500 })
  }

  try {
    const body = await request.json()
    const result = await asaasRequest("POST", "/paymentLinks", body)
    if (!result.ok) return NextResponse.json({ error: result.data }, { status: result.status })
    return NextResponse.json(result.data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH — atualizar (ativar/desativar) um link
export async function PATCH(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  const action = searchParams.get("action") // "activate" | "deactivate"

  const apiKey = getApiKey()
  if (!apiKey) {
    return NextResponse.json({ error: "ASAAS_API_KEY not configured" }, { status: 500 })
  }

  if (!id) {
    return NextResponse.json({ error: "ID do link é obrigatório" }, { status: 400 })
  }

  try {
    // Asaas usa POST para activate/deactivate
    if (action === "activate" || action === "deactivate") {
      const result = await asaasRequest("POST", `/paymentLinks/${id}/${action}`)
      if (!result.ok) return NextResponse.json({ error: result.data }, { status: result.status })
      return NextResponse.json(result.data)
    }

    const body = await request.json().catch(() => ({}))
    const result = await asaasRequest("PUT", `/paymentLinks/${id}`, body)
    if (!result.ok) return NextResponse.json({ error: result.data }, { status: result.status })
    return NextResponse.json(result.data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE — remover link
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  const apiKey = getApiKey()
  if (!apiKey) {
    return NextResponse.json({ error: "ASAAS_API_KEY not configured" }, { status: 500 })
  }

  if (!id) {
    return NextResponse.json({ error: "ID do link é obrigatório" }, { status: 400 })
  }

  try {
    const result = await asaasRequest("DELETE", `/paymentLinks/${id}`)
    if (!result.ok) return NextResponse.json({ error: result.data }, { status: result.status })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
