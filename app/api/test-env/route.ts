import { NextResponse } from 'next/server'

export async function GET() {
  const asaasApiKey = process.env.ASAAS_API_KEY
  const asaasApiUrl = process.env.NEXT_PUBLIC_ASAAS_API_URL
  const asaasWalletId = process.env.ASAAS_WALLET_ID
  
  return NextResponse.json({
    hasApiKey: !!asaasApiKey,
    apiKeyLength: asaasApiKey?.length || 0,
    apiKeyPrefix: asaasApiKey?.substring(0, 20) || 'NONE',
    hasApiUrl: !!asaasApiUrl,
    apiUrl: asaasApiUrl || 'NONE',
    hasWalletId: !!asaasWalletId,
    walletId: asaasWalletId || 'NONE',
    allEnvKeys: Object.keys(process.env).filter(k => k.includes('ASAAS'))
  })
}
