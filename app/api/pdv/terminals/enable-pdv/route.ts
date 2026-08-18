import { NextRequest } from 'next/server'
import { proxyToPos } from '@/lib/pdv/client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: NextRequest) {
  return proxyToPos(request, '/api/pos/terminals/enable-pdv')
}
