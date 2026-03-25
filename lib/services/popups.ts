// lib/services/popups.ts
import { createClient } from '@supabase/supabase-js'

// IMPORTANT: must use service role key — same pattern as lib/services/crm.ts
// Do NOT import from lib/supabase-client.ts (that uses the anon key)
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type PopupFrequency = 'uma_vez' | 'sessao' | 'sempre'

export interface Popup {
  id: string
  title: string
  image_url: string
  redirect_link: string
  is_active: boolean
  start_date: string
  end_date: string | null
  pages: string[]
  frequency: PopupFrequency
  created_at: string
  updated_at: string
}

export interface PopupWithStats extends Popup {
  clicks_7d: number
}

export interface PopupClick {
  id: string
  popup_id: string
  user_session_id: string
  clicked_at: string
  page: string
  device_type: 'mobile' | 'desktop'
}

export interface PopupStats {
  total_clicks: number
  clicks_today: number
  mobile_clicks: number
  desktop_clicks: number
  daily_series: { date: string; clicks: number }[]
  recent_events: PopupClick[]
}

export interface CreatePopupInput {
  title: string
  image_url: string
  redirect_link: string
  is_active: boolean
  start_date: string
  end_date: string | null
  pages: string[]
  frequency: PopupFrequency
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getPopups(): Promise<PopupWithStats[]> {
  const supabase = getSupabase()

  const { data: popups, error } = await supabase
    .from('popups')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[popups] getPopups error:', error)
    return []
  }
  if (!popups?.length) return []

  // Fetch 7-day clicks for all popups in one query
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: clicks } = await supabase
    .from('popup_clicks')
    .select('popup_id')
    .gte('clicked_at', since)

  const clicksMap: Record<string, number> = {}
  clicks?.forEach((c) => {
    clicksMap[c.popup_id] = (clicksMap[c.popup_id] || 0) + 1
  })

  return popups.map((p) => ({ ...p, clicks_7d: clicksMap[p.id] || 0 }))
}

export async function getPopupById(id: string): Promise<Popup | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('popups')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('[popups] getPopupById error:', error)
    return null
  }
  return data
}

export async function createPopup(input: CreatePopupInput): Promise<Popup | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('popups')
    .insert(input)
    .select()
    .single()

  if (error) {
    console.error('[popups] createPopup error:', error)
    return null
  }
  return data
}

export async function updatePopup(
  id: string,
  input: Partial<CreatePopupInput>
): Promise<Popup | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('popups')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[popups] updatePopup error:', error)
    return null
  }
  return data
}

export async function deletePopup(id: string): Promise<boolean> {
  const supabase = getSupabase()
  const { error } = await supabase.from('popups').delete().eq('id', id)
  if (error) {
    console.error('[popups] deletePopup error:', error)
    return false
  }
  return true
}

export async function getPopupStats(id: string): Promise<PopupStats | null> {
  const supabase = getSupabase()

  // Fetch last 30 days of clicks — bounded by date, no arbitrary row cap
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: clicks, error } = await supabase
    .from('popup_clicks')
    .select('*')
    .eq('popup_id', id)
    .gte('clicked_at', thirtyDaysAgo)
    .order('clicked_at', { ascending: false })

  if (error) {
    console.error('[popups] getPopupStats error:', error)
    return null
  }

  const allClicks = clicks || []
  const todayStr = new Date().toISOString().slice(0, 10)

  const total_clicks = allClicks.length
  const clicks_today = allClicks.filter(
    (c) => c.clicked_at.slice(0, 10) === todayStr
  ).length
  const mobile_clicks = allClicks.filter((c) => c.device_type === 'mobile').length
  const desktop_clicks = allClicks.filter((c) => c.device_type === 'desktop').length

  // Build daily series for last 30 days
  const daily: Record<string, number> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    daily[d.toISOString().slice(0, 10)] = 0
  }
  allClicks.forEach((c) => {
    const day = c.clicked_at.slice(0, 10)
    if (day in daily) daily[day]++
  })

  const daily_series = Object.entries(daily).map(([date, clicks]) => ({ date, clicks }))
  const recent_events = allClicks.slice(0, 50)

  return { total_clicks, clicks_today, mobile_clicks, desktop_clicks, daily_series, recent_events }
}
