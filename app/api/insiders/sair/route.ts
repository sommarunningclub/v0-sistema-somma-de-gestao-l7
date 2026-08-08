import { NextResponse } from 'next/server'
import { clearInsiderCookie } from '@/lib/auth/insider-session'

export async function POST() {
  return clearInsiderCookie(NextResponse.json({ success: true }))
}
