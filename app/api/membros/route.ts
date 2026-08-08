import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, requirePermission } from '@/lib/auth/api-auth'
import { stripNonDigits, toAccentInsensitiveRegex, toSearchTerms } from '@/lib/search-utils'
import { MEMBROS_PAGE_SIZE, pickMemberFields } from '@/lib/api/writable-fields'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// A tabela `cadastro_site` tem RLS ligada e nenhuma policy para a role `anon`.
// O admin não usa Supabase Auth (a sessão é um JWT próprio em cookie), então o
// cliente do browser é sempre `anon` e enxerga zero linhas — sem erro, apenas
// uma lista vazia. Por isso a leitura acontece aqui, no servidor, com service
// role, protegida pela permissão de módulo `membros`.

const LIST_COLUMNS = 'id, nome_completo, email, cpf, whatsapp, data_nascimento'

/**
 * Filtro de busca de membros — a única busca do painel que roda no banco, sobre
 * milhares de registros. Três decisões importam aqui:
 *
 * 1. **`imatch` (`~*`) no lugar de `ilike`.** O banco não tem a extensão
 *    `unaccent`, e `ilike` não normaliza diacríticos: buscar "jose" jamais
 *    acharia "José". O termo vira um regex onde cada vogal aceita suas
 *    variantes acentuadas (ver `toAccentInsensitiveRegex`).
 * 2. **Um `.or()` por termo.** O PostgREST une parâmetros repetidos com AND,
 *    então "maria silva" exige que AMBOS apareçam — em qualquer campo e em
 *    qualquer ordem. Antes a frase inteira era comparada como uma substring
 *    única, e "silva maria" não achava "Maria da Silva".
 * 3. **Documento e telefone comparados por dígitos.** Quem cola um CPF traz a
 *    pontuação junto; quem digita, não. Se o termo é uma sequência de dígitos,
 *    ela também é procurada de forma tolerante à formatação do campo.
 */
function applySearch<T extends { or: (filter: string) => T }>(query: T, term: string): T {
  let q = query

  for (const termo of toSearchTerms(term)) {
    const regex = toAccentInsensitiveRegex(termo)
    const condicoes = [
      `nome_completo.imatch.${regex}`,
      `email.imatch.${regex}`,
      `cpf.imatch.${regex}`,
      `whatsapp.imatch.${regex}`,
    ]

    /*
     * Para dígitos, monta um padrão que aceita qualquer pontuação entre eles:
     * "05326833743" casa com "053.268.337-43" e vice-versa.
     */
    const digitos = stripNonDigits(termo)
    if (digitos.length >= 3) {
      const comPontuacao = digitos.split('').join('[^0-9]*')
      condicoes.push(`cpf.imatch.${comPontuacao}`, `whatsapp.imatch.${comPontuacao}`)
    }

    q = q.or(condicoes.join(','))
  }

  return q
}

// GET /api/membros?page=0&q=termo        -> { data }
// GET /api/membros?countOnly=1&q=termo   -> { count }
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'membros')
  if (auth instanceof NextResponse) return auth

  try {
    const params = request.nextUrl.searchParams
    const term = (params.get('q') || '').trim()
    const supabase = getAdminClient()

    if (params.get('countOnly') === '1') {
      let query = supabase.from('cadastro_site').select('*', { count: 'exact', head: true })
      if (term) query = applySearch(query, term)

      const { count, error } = await query
      if (error) {
        console.error('[membros] Erro ao contar membros:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ count: count || 0 })
    }

    const page = Math.max(0, Number.parseInt(params.get('page') || '0', 10) || 0)
    const start = page * MEMBROS_PAGE_SIZE
    const end = start + MEMBROS_PAGE_SIZE - 1

    let query = supabase.from('cadastro_site').select(LIST_COLUMNS)
    if (term) query = applySearch(query, term)

    const { data, error } = await query.order('id', { ascending: false }).range(start, end)

    if (error) {
      console.error('[membros] Erro ao buscar membros:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (err) {
    console.error('[membros] Erro inesperado no GET:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}

// POST /api/membros -> cria um membro
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'membros')
  if (auth instanceof NextResponse) return auth

  try {
    const fields = pickMemberFields(await request.json())

    if (!fields.nome_completo || !fields.email) {
      return NextResponse.json(
        { error: 'nome_completo e email são obrigatórios' },
        { status: 400 }
      )
    }

    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from('cadastro_site')
      .insert([fields])
      .select(LIST_COLUMNS)
      .single()

    if (error) {
      console.error('[membros] Erro ao criar membro:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[membros] Erro inesperado no POST:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
