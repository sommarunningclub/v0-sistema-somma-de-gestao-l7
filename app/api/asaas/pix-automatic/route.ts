import { NextRequest, NextResponse } from "next/server"

const ASAAS_BASE = "https://api.asaas.com/v3"

function getHeaders() {
  const apiKey = (process.env.ASAAS_API_KEY || "").trim()
  return {
    "Content-Type": "application/json",
    "User-Agent": "somma-sistema",
    "access_token": apiKey,
  }
}

async function asaasRequest(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string>
) {
  const url = new URL(`${ASAAS_BASE}${path}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => { if (v) url.searchParams.set(k, v) })
  }

  const opts: RequestInit = { method, headers: getHeaders() }
  if (body) opts.body = JSON.stringify(body)

  // Retry 2x com backoff exponencial (igual ao client.py do README)
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url.toString(), opts)
      const data = await res.json().catch(() => ({}))
      if (!res.ok && res.status !== 429 && res.status < 500) {
        return { ok: false, status: res.status, data }
      }
      if (!res.ok) {
        lastError = data
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)))
        continue
      }
      return { ok: true, status: res.status, data }
    } catch (err) {
      lastError = err
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)))
    }
  }
  return { ok: false, status: 504, data: { message: String(lastError) } }
}

// GET  /api/asaas/pix-automatic?action=list&status=...&customerId=...&offset=...&limit=...
// GET  /api/asaas/pix-automatic?action=get&id=...
// GET  /api/asaas/pix-automatic?action=instructions&authorizationId=...&customerId=...&status=...
// POST /api/asaas/pix-automatic  body: { customerId, contractId, frequency, startDate, value, ... }
// DELETE /api/asaas/pix-automatic?id=...

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get("action") || "list"
  const apiKey = (process.env.ASAAS_API_KEY || "").trim()

  if (!apiKey) {
    return NextResponse.json({ error: "ASAAS_API_KEY não configurada" }, { status: 500 })
  }

  if (action === "get") {
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 })
    const result = await asaasRequest("GET", `/pix/automatic/authorizations/${id}`)
    if (!result.ok) return NextResponse.json(result.data, { status: result.status })
    const data = result.data?.data ?? result.data
    
    // Remove payload and encodedImage fields to reduce response size
    if (data && typeof data === 'object') {
      data.payload = null
      data.encodedImage = null
    }
    
    return NextResponse.json(data)
  }

  if (action === "instructions") {
    const params: Record<string, string> = {}
    ;["authorizationId", "customerId", "paymentId", "status", "offset", "limit"].forEach(k => {
      const v = searchParams.get(k)
      if (v) params[k] = v
    })
    const result = await asaasRequest("GET", "/pix/automatic/payment-instructions", undefined, params)
    if (!result.ok) return NextResponse.json(result.data, { status: result.status })
    return NextResponse.json(result.data)
  }

  // action === "list"
  const params: Record<string, string> = {}
  ;["status", "customerId", "offset", "limit"].forEach(k => {
    const v = searchParams.get(k)
    if (v) params[k] = v
  })
  const result = await asaasRequest("GET", "/pix/automatic/authorizations", undefined, params)
  if (!result.ok) return NextResponse.json(result.data, { status: result.status })
  
  // Clean up response: set payload and encodedImage to null for all items
  const response = result.data
  if (response && Array.isArray(response.data)) {
    response.data = response.data.map((item: any) => ({
      ...item,
      payload: null,
      encodedImage: null
    }))
  }
  
  return NextResponse.json(response)
}

export async function POST(request: NextRequest) {
  const apiKey = (process.env.ASAAS_API_KEY || "").trim()
  if (!apiKey) {
    return NextResponse.json({ error: "ASAAS_API_KEY não configurada" }, { status: 500 })
  }

  const body = await request.json().catch(() => ({}))

  // Auto-preenche immediateQrCode.originalValue se não informado (igual ao pix_automatic.py)
  if (!body.immediateQrCode) body.immediateQrCode = {}
  if (!body.immediateQrCode.originalValue && body.value) {
    body.immediateQrCode.originalValue = body.value
  }
  if (!body.immediateQrCode.expirationSeconds) {
    body.immediateQrCode.expirationSeconds = 86400
  }

  const result = await asaasRequest("POST", "/pix/automatic/authorizations", body)
  if (!result.ok) return NextResponse.json(result.data, { status: result.status })
  return NextResponse.json(result.data)
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  const apiKey = (process.env.ASAAS_API_KEY || "").trim()

  if (!apiKey) {
    return NextResponse.json({ error: "ASAAS_API_KEY não configurada" }, { status: 500 })
  }
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 })

  const result = await asaasRequest("DELETE", `/pix/automatic/authorizations/${id}`)
  if (!result.ok) return NextResponse.json(result.data, { status: result.status })
  return NextResponse.json({ deleted: true, id })
}
