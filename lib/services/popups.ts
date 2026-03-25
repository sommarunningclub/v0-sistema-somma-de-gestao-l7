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
  views_7d: number
}

export interface PopupClick {
  id: string
  popup_id: string
  user_session_id: string
  clicked_at: string
  page: string
  device_type: 'mobile' | 'desktop'
  referrer: string
  utm_source: string
  utm_medium: string
  utm_campaign: string
  browser: string
  viewport_width: number | null
}

export interface PopupStats {
  total_clicks: number
  clicks_today: number
  mobile_clicks: number
  desktop_clicks: number
  total_views: number
  total_dismissals: number
  ctr: number
  daily_series: { date: string; clicks: number; views: number; dismissals: number }[]
  recent_events: PopupClick[]
  referrer_breakdown: { referrer: string; count: number }[]
  browser_breakdown: { browser: string; count: number }[]
  utm_source_breakdown: { utm_source: string; count: number }[]
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

  // Fetch 7-day clicks and views for all popups in one query each
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: clicks } = await supabase
    .from('popup_clicks')
    .select('popup_id')
    .gte('clicked_at', since)

  const { data: views } = await supabase
    .from('popup_views')
    .select('popup_id')
    .gte('viewed_at', since)

  const clicksMap: Record<string, number> = {}
  clicks?.forEach((c) => {
    clicksMap[c.popup_id] = (clicksMap[c.popup_id] || 0) + 1
  })

  const viewsMap: Record<string, number> = {}
  views?.forEach((v) => {
    viewsMap[v.popup_id] = (viewsMap[v.popup_id] || 0) + 1
  })

  return popups.map((p) => ({
    ...p,
    clicks_7d: clicksMap[p.id] || 0,
    views_7d: viewsMap[p.id] || 0,
  }))
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

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch clicks, views, and dismissals in parallel
  const [
    { data: clicks, error: clicksError },
    { data: views },
    { data: dismissals },
  ] = await Promise.all([
    supabase
      .from('popup_clicks')
      .select('*')
      .eq('popup_id', id)
      .gte('clicked_at', thirtyDaysAgo)
      .order('clicked_at', { ascending: false }),
    supabase
      .from('popup_views')
      .select('*')
      .eq('popup_id', id)
      .gte('viewed_at', thirtyDaysAgo),
    supabase
      .from('popup_dismissals')
      .select('*')
      .eq('popup_id', id)
      .gte('dismissed_at', thirtyDaysAgo),
  ])

  if (clicksError) {
    console.error('[popups] getPopupStats error:', clicksError)
    return null
  }

  const allClicks: PopupClick[] = clicks || []
  const allViews = views || []
  const allDismissals = dismissals || []

  const todayStr = new Date().toISOString().slice(0, 10)

  const total_clicks = allClicks.length
  const clicks_today = allClicks.filter(
    (c) => c.clicked_at.slice(0, 10) === todayStr
  ).length
  const mobile_clicks = allClicks.filter((c) => c.device_type === 'mobile').length
  const desktop_clicks = allClicks.filter((c) => c.device_type === 'desktop').length

  const total_views = allViews.length
  const total_dismissals = allDismissals.length

  const ctr =
    total_views > 0
      ? Math.round((total_clicks / total_views) * 100 * 10) / 10
      : 0

  // Build daily series for last 30 days (clicks, views, dismissals)
  const dailyClicks: Record<string, number> = {}
  const dailyViews: Record<string, number> = {}
  const dailyDismissals: Record<string, number> = {}

  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    dailyClicks[key] = 0
    dailyViews[key] = 0
    dailyDismissals[key] = 0
  }

  allClicks.forEach((c) => {
    const day = c.clicked_at.slice(0, 10)
    if (day in dailyClicks) dailyClicks[day]++
  })
  allViews.forEach((v: { viewed_at: string }) => {
    const day = v.viewed_at.slice(0, 10)
    if (day in dailyViews) dailyViews[day]++
  })
  allDismissals.forEach((d: { dismissed_at: string }) => {
    const day = d.dismissed_at.slice(0, 10)
    if (day in dailyDismissals) dailyDismissals[day]++
  })

  const daily_series = Object.keys(dailyClicks).map((date) => ({
    date,
    clicks: dailyClicks[date],
    views: dailyViews[date],
    dismissals: dailyDismissals[date],
  }))

  // Referrer breakdown (top 10, '' → 'Direto')
  const referrerCount: Record<string, number> = {}
  allClicks.forEach((c) => {
    const key = c.referrer || 'Direto'
    referrerCount[key] = (referrerCount[key] || 0) + 1
  })
  const referrer_breakdown = Object.entries(referrerCount)
    .map(([referrer, count]) => ({ referrer, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Browser breakdown
  const browserCount: Record<string, number> = {}
  allClicks.forEach((c) => {
    const key = c.browser || 'Unknown'
    browserCount[key] = (browserCount[key] || 0) + 1
  })
  const browser_breakdown = Object.entries(browserCount)
    .map(([browser, count]) => ({ browser, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // UTM source breakdown (skip empty)
  const utmCount: Record<string, number> = {}
  allClicks.forEach((c) => {
    if (c.utm_source) {
      utmCount[c.utm_source] = (utmCount[c.utm_source] || 0) + 1
    }
  })
  const utm_source_breakdown = Object.entries(utmCount)
    .map(([utm_source, count]) => ({ utm_source, count }))
    .sort((a, b) => b.count - a.count)

  const recent_events = allClicks.slice(0, 50)

  return {
    total_clicks,
    clicks_today,
    mobile_clicks,
    desktop_clicks,
    total_views,
    total_dismissals,
    ctr,
    daily_series,
    recent_events,
    referrer_breakdown,
    browser_breakdown,
    utm_source_breakdown,
  }
}
