import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Supabase admin credentials not configured')
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = getAdminClient()
    const now = new Date().toISOString()

    // 1. Open: bloqueado → aberto (when checkin_abertura has passed)
    const { data: opened, error: openErr } = await supabase
      .from('eventos')
      .update({ checkin_status: 'aberto' })
      .eq('checkin_status', 'bloqueado')
      .not('checkin_abertura', 'is', null)
      .lte('checkin_abertura', now)
      .select('id, titulo')

    if (openErr) console.error('[v0] Cron open error:', openErr)

    // 2. Close: aberto → encerrado (when checkin_fechamento has passed)
    const { data: closed, error: closeErr } = await supabase
      .from('eventos')
      .update({ checkin_status: 'encerrado' })
      .eq('checkin_status', 'aberto')
      .not('checkin_fechamento', 'is', null)
      .lte('checkin_fechamento', now)
      .select('id, titulo')

    if (closeErr) console.error('[v0] Cron close error:', closeErr)

    console.log(`[v0] Cron executed: opened=${opened?.length || 0}, closed=${closed?.length || 0}`)

    return NextResponse.json({
      opened: opened || [],
      closed: closed || [],
      timestamp: now,
    })
  } catch (error) {
    console.error('[v0] Cron error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Cron failed' },
      { status: 500 }
    )
  }
}
