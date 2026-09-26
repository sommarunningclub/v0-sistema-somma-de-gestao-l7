import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { validarNovoOperador } from '@/lib/pdv/operadores'
import {
  OperadorJaCadastrado,
  buscarInsiderPorCpf,
  buscarNomePorCpf,
  criarOperador,
  listarOperadores,
} from '@/lib/pdv/operadores-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/*
 * Operadores da frente de caixa — listagem e cadastro.
 *
 * Diferente das outras rotas /api/pdv, esta não passa pelo somma-pdv-point:
 * o cadastro vive no Supabase Auth + admin_roles, que os dois apps
 * compartilham, e o painel tem a chave de serviço. O PDV só precisa que o
 * usuário exista com papel `operator` — é o que ele já checava antes.
 *
 * O código de acesso volta UMA vez, na resposta do POST. Não fica em lugar
 * nenhum além do Auth (como hash); perdeu, gera outro.
 *
 * Se o CPF é de um SOMMA Insider com senha, não há código: `codigo` volta
 * null e a pessoa entra no PDV com a senha do Insider Connect.
 */

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'pdv')
  if (auth instanceof NextResponse) return auth

  try {
    const operadores = await listarOperadores()
    return NextResponse.json({ operadores })
  } catch (err) {
    console.error('[pdv/operadores] Erro ao listar:', err)
    return NextResponse.json({ error: 'Erro ao listar os operadores' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'pdv')
  if (auth instanceof NextResponse) return auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 })
  }

  const validacao = validarNovoOperador(body)
  if (!validacao.ok) return NextResponse.json({ error: validacao.erro }, { status: 400 })
  const { cpf } = validacao.entrada

  try {
    const insider = await buscarInsiderPorCpf(cpf)

    // Sem nome no formulário, a base do clube responde (Insider primeiro, que
    // é o cadastro mais recente). Quem não é membro ainda pode operar o caixa —
    // aí o nome precisa vir digitado.
    const nome = validacao.entrada.nome ?? insider?.nome ?? (await buscarNomePorCpf(cpf))
    if (!nome) {
      return NextResponse.json(
        {
          error: 'Este CPF não está na base do clube. Informe o nome do operador.',
          code: 'nome_obrigatorio',
        },
        { status: 400 }
      )
    }

    // O vínculo guarda o id do registro Insider que JÁ tinha senha agora. O PDV
    // só aceita a senha do Insider se o registro atual do CPF for este — uma
    // senha criada depois (o portal Insider é de auto-cadastro) não vale.
    const insiderId =
      validacao.entrada.senhaInsider && insider?.comSenha ? insider.id : null

    const { operador, codigo } = await criarOperador({
      cpf,
      nome,
      criadoPor: auth.session.email ?? null,
      insiderId,
    })

    console.log(
      '[pdv/operadores] Operador',
      operador.id,
      operador.insider ? '(Insider, sem código)' : '(com código)',
      'cadastrado por',
      auth.session.email
    )
    return NextResponse.json({ operador, codigo }, { status: 201 })
  } catch (err) {
    if (err instanceof OperadorJaCadastrado) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    console.error('[pdv/operadores] Erro ao cadastrar:', err)
    return NextResponse.json({ error: 'Erro ao cadastrar o operador' }, { status: 500 })
  }
}
