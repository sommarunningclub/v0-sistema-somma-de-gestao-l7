import { NextRequest } from 'next/server'
import { proxyToPos } from '@/lib/pdv/client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  return proxyToPos(request, '/api/pos/diagnostics')
}
