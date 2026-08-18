import { NextRequest } from 'next/server'
import { proxyToPos } from '@/lib/pdv/client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return proxyToPos(request, `/api/pos/sales/${encodeURIComponent(id)}/retry-sync`)
}
