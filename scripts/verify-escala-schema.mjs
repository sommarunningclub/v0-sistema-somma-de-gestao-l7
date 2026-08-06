// Confere que as tabelas da Escala existem e que o RLS esconde os dados da chave anon.
// Uso: set -a; . ./.env.local; set +a; node scripts/verify-escala-schema.mjs
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const headers = (key, extra = {}) => ({
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
  ...extra,
})

let falhou = false
const falha = (msg) => { falhou = true; console.log(`FALHA ${msg}`) }

// 1. As três tabelas existem e respondem à service role
for (const tabela of ['escala_atividades', 'escala_insiders', 'escala_insider_atividades']) {
  const res = await fetch(`${url}/rest/v1/${tabela}?select=*&limit=1`, { headers: headers(serviceKey) })
  if (res.status === 200) console.log(`OK    ${tabela} existe`)
  else falha(`${tabela}: service role recebeu ${res.status}`)
}

// 2. Linha-sonda: a chave anon não pode enxergá-la
const NOME_SONDA = '__sonda_rls__'
const criada = await fetch(`${url}/rest/v1/escala_atividades`, {
  method: 'POST',
  headers: headers(serviceKey, { Prefer: 'return=representation' }),
  body: JSON.stringify({ nome: NOME_SONDA }),
})

if (criada.status !== 201) {
  falha(`não consegui criar a linha-sonda (status ${criada.status})`)
} else {
  const [sonda] = await criada.json()

  const viaAnon = await fetch(
    `${url}/rest/v1/escala_atividades?select=id&nome=eq.${NOME_SONDA}`,
    { headers: headers(anonKey) }
  )
  const visiveis = viaAnon.status === 200 ? await viaAnon.json() : []

  if (viaAnon.status === 200 && visiveis.length > 0) {
    falha('a chave anon está lendo escala_atividades — RLS não está protegendo')
  } else {
    console.log(`OK    RLS esconde os dados da chave anon (status ${viaAnon.status})`)
  }

  await fetch(`${url}/rest/v1/escala_atividades?id=eq.${sonda.id}`, {
    method: 'DELETE',
    headers: headers(serviceKey),
  })
  console.log('OK    linha-sonda removida')
}

console.log(falhou ? '\nSchema ou RLS com problema.' : '\nSchema e RLS OK.')
process.exit(falhou ? 1 : 0)
