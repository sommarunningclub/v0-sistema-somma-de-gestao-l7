import { NextResponse } from 'next/server'
import { listInsiders } from '@/lib/services/escala'

export const dynamic = 'force-dynamic'

export async function GET() {
  const insiders = await listInsiders()
  return NextResponse.json(insiders)
}
