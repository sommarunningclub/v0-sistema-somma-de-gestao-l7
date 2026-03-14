/**
 * Google Calendar Service
 *
 * Suporta dois métodos de autenticação (em ordem de prioridade):
 *
 * 1. OAuth2 Refresh Token (RECOMENDADO quando service account keys estão bloqueadas)
 *    Vars: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN
 *    Setup: rode `node scripts/google-oauth-setup.mjs` uma vez para obter o refresh token
 *
 * 2. Service Account com Domain-Wide Delegation (requer chave JSON — pode estar bloqueada)
 *    Vars: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
 *
 * Var comum (opcional):
 *    GOOGLE_CALENDAR_ORGANIZER_EMAIL — padrão: contato@sommaclub.com.br
 */

import { createSign } from 'crypto'

const ORGANIZER_EMAIL =
  process.env.GOOGLE_CALENDAR_ORGANIZER_EMAIL || 'contato@sommaclub.com.br'

export function isGoogleCalendarConfigured(): boolean {
  const hasOAuth =
    !!(process.env.GOOGLE_OAUTH_CLIENT_ID &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
      process.env.GOOGLE_OAUTH_REFRESH_TOKEN)
  const hasServiceAccount =
    !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)
  return hasOAuth || hasServiceAccount
}

// ─── Auth: OAuth2 Refresh Token ───────────────────────────────────────────────

async function getAccessTokenOAuth2(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google OAuth2 refresh token error: ${err}`)
  }

  const { access_token } = await res.json()
  return access_token as string
}

// ─── Auth: Service Account JWT ───────────────────────────────────────────────

async function getAccessTokenServiceAccount(): Promise<string> {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!.replace(/\\n/g, '\n')

  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + 3600

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const claimSet = Buffer.from(
    JSON.stringify({
      iss: serviceAccountEmail,
      sub: ORGANIZER_EMAIL,
      scope: 'https://www.googleapis.com/auth/calendar',
      aud: 'https://oauth2.googleapis.com/token',
      iat,
      exp,
    })
  ).toString('base64url')

  const signingInput = `${header}.${claimSet}`
  const signer = createSign('RSA-SHA256')
  signer.update(signingInput)
  const signature = signer.sign(privateKey, 'base64url')

  const jwt = `${signingInput}.${signature}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google Service Account token error: ${err}`)
  }

  const { access_token } = await res.json()
  return access_token as string
}

// ─── Auth: selector ───────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  // OAuth2 refresh token takes priority (works when service account keys are blocked)
  if (
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
    process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  ) {
    return getAccessTokenOAuth2()
  }

  if (
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  ) {
    return getAccessTokenServiceAccount()
  }

  throw new Error('Google Calendar credentials not configured')
}

// ─── Calendar API ─────────────────────────────────────────────────────────────

export interface CalendarEventInput {
  summary: string
  description?: string
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
  location?: string
  attendees: { email: string }[]
}

export async function createCalendarEvent(input: CalendarEventInput): Promise<string> {
  const accessToken = await getAccessToken()
  const calendarId = encodeURIComponent(ORGANIZER_EMAIL)

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?sendUpdates=all`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: input.summary,
        description: input.description,
        start: input.start,
        end: input.end,
        location: input.location,
        attendees: input.attendees,
        organizer: { email: ORGANIZER_EMAIL },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google Calendar create event error: ${err}`)
  }

  const event = await res.json()
  return event.id as string
}

export async function updateCalendarEvent(
  eventId: string,
  input: CalendarEventInput
): Promise<void> {
  const accessToken = await getAccessToken()
  const calendarId = encodeURIComponent(ORGANIZER_EMAIL)

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}?sendUpdates=all`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: input.summary,
        description: input.description,
        start: input.start,
        end: input.end,
        location: input.location,
        attendees: input.attendees,
      }),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google Calendar update event error: ${err}`)
  }
}

export async function cancelCalendarEvent(eventId: string): Promise<void> {
  const accessToken = await getAccessToken()
  const calendarId = encodeURIComponent(ORGANIZER_EMAIL)

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}?sendUpdates=all`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'cancelled' }),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google Calendar cancel event error: ${err}`)
  }
}
