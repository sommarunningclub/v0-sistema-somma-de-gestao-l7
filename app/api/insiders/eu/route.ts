import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/auth/api-auth'
import { getInsiderFromRequest } from '@/lib/auth/insider-session'
import { INSIDER_PUBLIC_COLUMNS, toInsiderPublic, buildInsiderRow } from '@/lib/insider/insider-mapper'
import { montarBeneficios, BENEFICIO_COLUNAS } from '@/lib/insider/beneficios'
import { insiderFormSchema, firstZodError, onlyDigits } from '@/lib/insider/validation'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    // A identidade vem do cookie assinado. Nunca de parâmetro do cliente.
    const sessao = await getInsiderFromRequest(req)
    if (!sessao) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const supabase = getAdminClient()

    const { data: row, error } = await supabase
      .from('dados_insiders')
      .select(`${INSIDER_PUBLIC_COLUMNS}, ${BENEFICIO_COLUNAS}`)
      .eq('id', sessao.sub)
      .maybeSingle()

    if (error) {
      console.error('[insiders/eu] select error:', error)
      return NextResponse.json({ error: 'Erro ao carregar seus dados.' }, { status: 500 })
    }

    if (!row) {
      // Cadastro removido depois do login: a sessão não vale mais nada.
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const linha = row as Record<string, unknown>

    const { data: credencial, error: credError } = await supabase
      .from('insider_credentials')
      .select('insider_id')
      .eq('insider_id', sessao.sub)
      .maybeSingle()

    // Falha fechado: um erro real de consulta nunca pode virar "sem senha" —
    // isso destravaria o campo senha_atual escondido e o usuário levaria um
    // 401 sem conseguir corrigir.
    let temSenha: boolean
    if (credError) {
      console.error('[insiders/eu] credential error:', credError)
      temSenha = true
    } else {
      temSenha = Boolean(credencial)
    }

    return NextResponse.json(
      {
        insider: toInsiderPublic(linha, temSenha),
        beneficios: montarBeneficios(linha),
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, no-store',
        },
      }
    )
  } catch (err) {
    console.error('[insiders/eu] unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const BUCKET = 'insider-fotos'

export async function PUT(req: NextRequest) {
  try {
    // A identidade vem do cookie assinado. O CPF não é aceito do cliente e
    // não muda por esta rota: outras telas do admin dependem da grafia gravada.
    const sessao = await getInsiderFromRequest(req)
    if (!sessao) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const formData = await req.formData()
    const campo = (nome: string) => String(formData.get(nome) ?? '').trim()

    const parsed = insiderFormSchema.safeParse({
      cpf: sessao.cpf,
      nome: campo('nome'),
      email: campo('email'),
      telefone: campo('telefone'),
      data_nascimento: campo('data_nascimento'),
      sexo: campo('sexo'),
      cep: campo('cep'),
      logradouro: campo('logradouro'),
      numero: campo('numero'),
      complemento: campo('complemento'),
      bairro: campo('bairro'),
      cidade: campo('cidade'),
      estado: campo('estado'),
      consent_lgpd: true,
      consent_imagem: true,
    })

    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 })
    }

    const supabase = getAdminClient()

    let fotoUrl: string | null = null
    const foto = formData.get('foto')
    if (foto instanceof File && foto.size > 0) {
      if (foto.size > MAX_SIZE) {
        return NextResponse.json({ error: 'A foto deve ter no máximo 5MB.' }, { status: 400 })
      }
      if (!ALLOWED_TYPES.includes(foto.type)) {
        return NextResponse.json(
          { error: 'Formato de foto não suportado. Use JPG, PNG ou WebP.' },
          { status: 400 }
        )
      }

      const ext = EXT_BY_MIME[foto.type] || 'jpg'
      const path = `${onlyDigits(sessao.cpf)}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, await foto.arrayBuffer(), { contentType: foto.type, upsert: true })

      if (uploadError) {
        console.error('[insiders/eu] upload error:', uploadError)
        return NextResponse.json({ error: 'Erro ao enviar a foto.' }, { status: 500 })
      }

      fotoUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
    }

    const row = buildInsiderRow(parsed.data)
    // O consentimento já foi dado no cadastro; esta tela não o renegocia.
    delete row.consent_lgpd
    delete row.consent_imagem
    row.atualizado_em = new Date().toISOString()
    if (fotoUrl) row.foto_url = fotoUrl

    const { error: updateError } = await supabase
      .from('dados_insiders')
      .update(row)
      .eq('id', sessao.sub)

    if (updateError) {
      console.error('[insiders/eu] update error:', updateError)
      return NextResponse.json({ error: 'Erro ao salvar seus dados.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[insiders/eu] unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
