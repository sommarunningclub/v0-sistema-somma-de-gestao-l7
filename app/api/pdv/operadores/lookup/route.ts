import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { isValidCpf, onlyDigits } from '@/lib/insider/validation'
import { buscarInsiderPorCpf, buscarNomePorCpf, operadorPorCpf } from '@/lib/pdv/operadores-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/*
 * GET /api/pdv/operadores/lookup?cpf=... — nome sugerido para o formulário.
 *
 * Existe para o formulário preencher o nome assim que o CPF fica completo,
 * e avisar na hora se aquele CPF já tem acesso. A rota de membros faria o
 * mesmo, mas exige a permissão `membros`, que quem cuida do PDV nem sempre tem.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'pdv')
  if (auth instanceof NextResponse) return auth

  const cpf = onlyDigits(request.nextUrl.searchParams.get('cpf') ?? '')
  if (!isValidCpf(cpf)) return NextResponse.json({ error: 'CPF inválido.' }, { status: 400 })

  try {
    const [existente, insider, nome] = await Promise.all([
      operadorPorCpf(cpf),
      buscarInsiderPorCpf(cpf),
      buscarNomePorCpf(cpf),
    ])
    return NextResponse.json({
      nome: existente?.nome ?? insider?.nome ?? nome,
      ja_cadastrado: existente !== null,
      // Insider com senha: o formulário oferece liberar a entrada pela senha
      // dele e mostra desde quando o registro existe, para quem libera conferir.
      insider: Boolean(insider?.comSenha),
      insider_desde: insider?.comSenha ? insider.desde : null,
    })
  } catch (err) {
    console.error('[pdv/operadores] Erro na consulta de CPF:', err)
    return NextResponse.json({ error: 'Erro ao consultar o CPF' }, { status: 500 })
  }
}
