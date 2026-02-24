import { NextRequest, NextResponse } from "next/server"

function getClicksignConfig() {
  const accessToken = process.env.CLICKSIGN_ACCESS_TOKEN || ""
  const baseUrl = process.env.CLICKSIGN_BASE_URL || "https://sandbox.clicksign.com"
  return { accessToken, baseUrl }
}

// GET - Buscar documentos ou status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get("endpoint")
  const config = getClicksignConfig()

  if (!config.accessToken) {
    return NextResponse.json(
      { error: "CLICKSIGN_ACCESS_TOKEN não configurado." },
      { status: 500 }
    )
  }

  if (!endpoint) {
    return NextResponse.json({ error: "Endpoint requerido" }, { status: 400 })
  }

  try {
    const url = `${config.baseUrl}/api/v1${endpoint}?access_token=${config.accessToken}`
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || "Erro na API Clicksign", details: data },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return NextResponse.json({ error: "Erro ao conectar com Clicksign", details: message }, { status: 500 })
  }
}

// POST - Criar documento, adicionar signatário, enviar para assinatura
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get("endpoint")
  const config = getClicksignConfig()

  if (!config.accessToken) {
    return NextResponse.json(
      { error: "CLICKSIGN_ACCESS_TOKEN não configurado." },
      { status: 500 }
    )
  }

  if (!endpoint) {
    return NextResponse.json({ error: "Endpoint requerido" }, { status: 400 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const url = `${config.baseUrl}/api/v1${endpoint}?access_token=${config.accessToken}`

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || "Erro na API Clicksign", details: data },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return NextResponse.json({ error: "Erro ao conectar com Clicksign", details: message }, { status: 500 })
  }
}

// PATCH - Finalizar/fechar documento para assinatura
export async function PATCH(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get("endpoint")
  const config = getClicksignConfig()

  if (!config.accessToken) {
    return NextResponse.json(
      { error: "CLICKSIGN_ACCESS_TOKEN não configurado." },
      { status: 500 }
    )
  }

  if (!endpoint) {
    return NextResponse.json({ error: "Endpoint requerido" }, { status: 400 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const url = `${config.baseUrl}/api/v1${endpoint}?access_token=${config.accessToken}`

    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || "Erro na API Clicksign", details: data },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return NextResponse.json({ error: "Erro ao conectar com Clicksign", details: message }, { status: 500 })
  }
}

// DELETE - Cancelar documento
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get("endpoint")
  const config = getClicksignConfig()

  if (!config.accessToken) {
    return NextResponse.json(
      { error: "CLICKSIGN_ACCESS_TOKEN não configurado." },
      { status: 500 }
    )
  }

  if (!endpoint) {
    return NextResponse.json({ error: "Endpoint requerido" }, { status: 400 })
  }

  try {
    const url = `${config.baseUrl}/api/v1${endpoint}?access_token=${config.accessToken}`

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    })

    if (response.status === 204) {
      return NextResponse.json({ success: true })
    }

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || "Erro na API Clicksign", details: data },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return NextResponse.json({ error: "Erro ao conectar com Clicksign", details: message }, { status: 500 })
  }
}
