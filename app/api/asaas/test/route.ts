import { NextResponse } from 'next/server'

export async function GET() {
  const ASAAS_API_KEY = process.env.ASAAS_API_KEY
  const ASAAS_BASE_URL = process.env.ASAAS_BASE_URL || 'https://api.asaas.com/v3'
  const ASAAS_WALLET_ID = process.env.ASAAS_WALLET_ID

  console.log('[v0] Testing Asaas API Key...')
  console.log('[v0] ASAAS_API_KEY exists:', !!ASAAS_API_KEY)
  console.log('[v0] ASAAS_API_KEY length:', ASAAS_API_KEY?.length || 0)
  console.log('[v0] ASAAS_BASE_URL:', ASAAS_BASE_URL)
  console.log('[v0] ASAAS_WALLET_ID:', ASAAS_WALLET_ID)

  if (!ASAAS_API_KEY) {
    return NextResponse.json({
      success: false,
      error: 'ASAAS_API_KEY not found in environment',
      envVars: {
        ASAAS_API_KEY: 'missing',
        ASAAS_BASE_URL,
        ASAAS_WALLET_ID: ASAAS_WALLET_ID ? 'present' : 'missing',
      },
    }, { status: 500 })
  }

  try {
    // Test API call to Asaas
    const response = await fetch(`${ASAAS_BASE_URL}/customers?limit=1`, {
      method: 'GET',
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[v0] Asaas API test failed:', data)
      return NextResponse.json({
        success: false,
        error: 'Asaas API returned error',
        status: response.status,
        details: data,
        envVars: {
          ASAAS_API_KEY: 'present (length: ' + ASAAS_API_KEY.length + ')',
          ASAAS_BASE_URL,
          ASAAS_WALLET_ID: ASAAS_WALLET_ID ? 'present' : 'missing',
        },
      }, { status: 500 })
    }

    console.log('[v0] Asaas API test successful!')
    return NextResponse.json({
      success: true,
      message: 'Asaas API connection successful',
      totalCustomers: data.totalCount || 0,
      envVars: {
        ASAAS_API_KEY: 'present (length: ' + ASAAS_API_KEY.length + ')',
        ASAAS_BASE_URL,
        ASAAS_WALLET_ID: ASAAS_WALLET_ID ? 'present' : 'missing',
      },
    })
  } catch (error) {
    console.error('[v0] Error testing Asaas API:', error)
    return NextResponse.json({
      success: false,
      error: 'Exception during test',
      details: error instanceof Error ? error.message : String(error),
      envVars: {
        ASAAS_API_KEY: 'present (length: ' + ASAAS_API_KEY.length + ')',
        ASAAS_BASE_URL,
        ASAAS_WALLET_ID: ASAAS_WALLET_ID ? 'present' : 'missing',
      },
    }, { status: 500 })
  }
}
