/**
 * Script de setup OAuth2 para Google Calendar
 *
 * Execute UMA VEZ para obter o refresh_token da conta contato@sommaclub.com.br.
 * Depois adicione as 3 variáveis de ambiente no Vercel.
 *
 * Pré-requisitos:
 *   1. No Google Cloud Console → APIs & Services → Credentials:
 *      Criar OAuth 2.0 Client ID → tipo: "Desktop app" → baixar JSON
 *   2. Preencher CLIENT_ID e CLIENT_SECRET abaixo (ou passar como args)
 *   3. Rodar: node scripts/google-oauth-setup.mjs
 *   4. Abrir a URL no browser, logar como contato@sommaclub.com.br, copiar o código
 *   5. Colar o código quando solicitado
 */

import { createInterface } from 'readline'
import { createServer } from 'http'

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || process.argv[2] || ''
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.argv[3] || ''

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌  Uso: node scripts/google-oauth-setup.mjs <CLIENT_ID> <CLIENT_SECRET>')
  console.error('   Ou defina GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_CLIENT_SECRET como env vars')
  process.exit(1)
}

const SCOPE = 'https://www.googleapis.com/auth/calendar'
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob' // OOB = manual copy-paste (Desktop app)

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth` +
  `?client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPE)}` +
  `&access_type=offline` +
  `&prompt=consent`

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('  Setup Google Calendar OAuth2')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('\n1. Abra esta URL no browser (logue como contato@sommaclub.com.br):')
console.log('\n' + authUrl + '\n')
console.log('2. Autorize o acesso → Google mostrará um código de autorização.')
console.log('3. Copie o código e cole abaixo.\n')

const rl = createInterface({ input: process.stdin, output: process.stdout })

rl.question('Cole o código de autorização: ', async (code) => {
  rl.close()
  code = code.trim()

  if (!code) {
    console.error('❌  Código não informado.')
    process.exit(1)
  }

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    })

    const data = await res.json()

    if (!res.ok || data.error) {
      console.error('❌  Erro ao trocar código por token:', data)
      process.exit(1)
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('  ✅  Sucesso! Adicione estas variáveis no Vercel:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    console.log(`GOOGLE_OAUTH_CLIENT_ID=${CLIENT_ID}`)
    console.log(`GOOGLE_OAUTH_CLIENT_SECRET=${CLIENT_SECRET}`)
    console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${data.refresh_token}`)
    console.log(`GOOGLE_CALENDAR_ORGANIZER_EMAIL=contato@sommaclub.com.br`)
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('  Guarde o refresh_token com segurança — ele não expira.')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  } catch (err) {
    console.error('❌  Erro de rede:', err)
    process.exit(1)
  }
})
