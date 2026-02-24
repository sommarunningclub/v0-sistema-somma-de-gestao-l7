import { NextRequest, NextResponse } from "next/server"

function getClicksignConfig() {
  const accessToken = process.env.CLICKSIGN_ACCESS_TOKEN || ""
  const baseUrl = (process.env.CLICKSIGN_BASE_URL || "https://sandbox.clicksign.com").replace(/\/$/, "")
  return { accessToken, baseUrl }
}

async function callClicksign(
  baseUrl: string,
  accessToken: string,
  endpoint: string,
  method: string,
  body?: unknown
) {
  const url = `${baseUrl}/api/v3${endpoint}`
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/vnd.api+json",
      Accept: "application/vnd.api+json",
      Authorization: `Bearer ${accessToken}`,
    },
  }
  if (body !== undefined) {
    options.body = JSON.stringify(body)
  }

  console.log(`[v0] Clicksign ${method} ${url}`)
  const response = await fetch(url, options)

  // 204 No Content
  if (response.status === 204) {
    return { ok: true, status: 204, data: { success: true } }
  }

  let data: unknown
  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    data = await response.json()
  } else {
    const text = await response.text()
    data = { raw: text }
  }

  console.log(`[v0] Clicksign response status: ${response.status}`, JSON.stringify(data).slice(0, 300))

  return { ok: response.ok, status: response.status, data }
}

// GET - Buscar envelope/documento/status
export async function GET(request: NextRequest) {
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
