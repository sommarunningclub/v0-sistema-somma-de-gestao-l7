import { NextRequest, NextResponse } from "next/server"

function getClicksignConfig() {
  const accessToken = (process.env.CLICKSIGN_ACCESS_TOKEN || "").trim()
  const baseUrl = (process.env.CLICKSIGN_BASE_URL || "https://sandbox.clicksign.com").replace(/\/$/, "")

  if (!accessToken) {
    console.error("[v0] CLICKSIGN_ACCESS_TOKEN not set!")
  } else {
    console.log(`[v0] Clicksign config OK - baseUrl: ${baseUrl}, token prefix: ${accessToken.slice(0, 8)}...`)
  }

  return { accessToken, baseUrl }
}

async function callClicksign(
  baseUrl: string,
  accessToken: string,
  endpoint: string,
  method: string,
  body?: unknown
) {
  // A API Clicksign v3 aceita autenticação via query string (?access_token=) ou Bearer header
  // Usamos query string pois é mais confiável em ambientes com proxies
  const separator = endpoint.includes("?") ? "&" : "?"
  const url = `${baseUrl}/api/v3${endpoint}${separator}access_token=${accessToken}`

  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/vnd.api+json",
      Accept: "application/vnd.api+json",
    },
  }
  if (body !== undefined) {
    options.body = JSON.stringify(body)
  }

  console.log(`[v0] Clicksign ${method} ${baseUrl}/api/v3${endpoint} (token: ${accessToken ? "set" : "MISSING"})`)
  const response = await fetch(url, options)

  // 204 No Content
  if (response.status === 204) {
    return { ok: true, status: 204, data: { success: true } }
  }

  let data: unknown
  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("json")) {
    data = await response.json()
  } else {
    const text = await response.text()
    data = { raw: text }
  }

  console.log(`[v0] Clicksign response ${response.status}:`, JSON.stringify(data).slice(0, 400))

  return { ok: response.ok, status: response.status, data }
}

// GET - Buscar envelope/documento/status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get("endpoint")
  const config = getClicksignConfig()

  if (!config.accessToken) {
    return NextResponse.json(
      { 
        error: "CLICKSIGN_ACCESS_TOKEN não configurado.",
        hint: "Configure a variável CLICKSIGN_ACCESS_TOKEN nas variáveis de ambiente da Vercel.",
        baseUrl: config.baseUrl,
      },
      { status: 500 }
    )
  }

  // Diagnóstico: retorna status da configuração sem fazer chamada à API
  if (endpoint === "/diagnostico") {
    return NextResponse.json({
      ok: true,
      tokenConfigured: true,
      tokenPrefix: config.accessToken.slice(0, 8) + "...",
      baseUrl: config.baseUrl,
    })
  }

  if (!endpoint) {
    return NextResponse.json({ error: "Endpoint requerido" }, { status: 400 })
  }

  try {
    const result = await callClicksign(config.baseUrl, config.accessToken, endpoint, "GET")
    if (!result.ok) {
      return NextResponse.json(
        { error: "Erro na API Clicksign", details: result.data },
        { status: result.status }
      )
    }
    return NextResponse.json(result.data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    console.error("[v0] Clicksign GET error:", message)
    return NextResponse.json({ error: "Erro ao conectar com Clicksign", details: message }, { status: 500 })
  }
}

// POST - Criar envelope, adicionar documento, signatário, etc.
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get("endpoint")
  const config = getClicksignConfig()

  if (!config.accessToken) {
    return NextResponse.json(
      { error: "CLICKSIGN_ACCESS_TOKEN não configurado. Configure a variável de ambiente." },
      { status: 500 }
    )
  }
  if (!endpoint) {
    return NextResponse.json({ error: "Endpoint requerido" }, { status: 400 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const result = await callClicksign(config.baseUrl, config.accessToken, endpoint, "POST", body)
    if (!result.ok) {
      return NextResponse.json(
        { error: "Erro na API Clicksign", details: result.data },
        { status: result.status }
      )
    }
    return NextResponse.json(result.data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    console.error("[v0] Clicksign POST error:", message)
    return NextResponse.json({ error: "Erro ao conectar com Clicksign", details: message }, { status: 500 })
  }
}

// PATCH - Ativar envelope, atualizar documento
export async function PATCH(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get("endpoint")
  const config = getClicksignConfig()

  if (!config.accessToken) {
    return NextResponse.json(
      { error: "CLICKSIGN_ACCESS_TOKEN não configurado. Configure a variável de ambiente." },
      { status: 500 }
    )
  }
  if (!endpoint) {
    return NextResponse.json({ error: "Endpoint requerido" }, { status: 400 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const result = await callClicksign(config.baseUrl, config.accessToken, endpoint, "PATCH", body)
    if (!result.ok) {
      return NextResponse.json(
        { error: "Erro na API Clicksign", details: result.data },
        { status: result.status }
      )
    }
    return NextResponse.json(result.data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    console.error("[v0] Clicksign PATCH error:", message)
    return NextResponse.json({ error: "Erro ao conectar com Clicksign", details: message }, { status: 500 })
  }
}

// DELETE - Cancelar envelope/documento
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get("endpoint")
  const config = getClicksignConfig()

  if (!config.accessToken) {
    return NextResponse.json(
      { error: "CLICKSIGN_ACCESS_TOKEN não configurado. Configure a variável de ambiente." },
      { status: 500 }
    )
  }
  if (!endpoint) {
    return NextResponse.json({ error: "Endpoint requerido" }, { status: 400 })
  }

  try {
    const result = await callClicksign(config.baseUrl, config.accessToken, endpoint, "DELETE")
    if (!result.ok) {
      return NextResponse.json(
        { error: "Erro na API Clicksign", details: result.data },
        { status: result.status }
      )
    }
    return NextResponse.json(result.data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    console.error("[v0] Clicksign DELETE error:", message)
    return NextResponse.json({ error: "Erro ao conectar com Clicksign", details: message }, { status: 500 })
  }
}
