import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, hashPassword } from '@/lib/auth/api-auth'
import {
  insiderFormSchema,
  firstZodError,
  validateSenha,
  maskCpf,
  onlyDigits,
} from '@/lib/insider/validation'
import { cpfCandidates, buildInsiderRow } from '@/lib/insider/insider-mapper'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const BUCKET = 'insider-fotos'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const campo = (nome: string) => String(formData.get(nome) ?? '').trim()

    const parsed = insiderFormSchema.safeParse({
      cpf: campo('cpf'),
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
      consent_lgpd: campo('consent_lgpd') === 'true',
      consent_imagem: campo('consent_imagem') === 'true',
    })

    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 })
    }

    const supabase = getAdminClient()

    // 1. Já existe cadastro para esse CPF?
    const { data: encontrados, error: findError } = await supabase
      .from('dados_insiders')
      .select('id')
      .in('cpf', cpfCandidates(parsed.data.cpf))
      .limit(1)

    if (findError) {
      console.error('[insiders/register] find error:', findError)
      return NextResponse.json({ error: 'Erro ao consultar o cadastro.' }, { status: 500 })
    }

    const existente = encontrados?.[0] ?? null

    // 2. Senha é obrigatória enquanto não houver credencial salva
    let temSenha = false
    if (existente) {
      const { data: credencial } = await supabase
        .from('insider_credentials')
        .select('insider_id')
        .eq('insider_id', existente.id)
        .maybeSingle()
      temSenha = Boolean(credencial)
    }

    const senha = String(formData.get('senha') ?? '')
    const senhaConfirmacao = String(formData.get('senha_confirmacao') ?? '')
    const erroSenha = validateSenha(senha, senhaConfirmacao, !temSenha)
    if (erroSenha) {
      return NextResponse.json({ error: erroSenha }, { status: 400 })
    }

    // 3. Foto de perfil (opcional)
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

      const ext = foto.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${onlyDigits(parsed.data.cpf)}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, await foto.arrayBuffer(), { contentType: foto.type, upsert: true })

      if (uploadError) {
        console.error('[insiders/register] upload error:', uploadError)
        return NextResponse.json({ error: 'Erro ao enviar a foto.' }, { status: 500 })
      }

      fotoUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
    }

    // 4. Grava o cadastro
    const row = buildInsiderRow(parsed.data)
    row.atualizado_em = new Date().toISOString()
    if (fotoUrl) row.foto_url = fotoUrl

    let insiderId: string

    if (existente) {
      // Não sobrescreve o cpf: a grafia gravada é usada por outras telas.
      const { error: updateError } = await supabase
        .from('dados_insiders')
        .update(row)
        .eq('id', existente.id)

      if (updateError) {
        console.error('[insiders/register] update error:', updateError)
        return NextResponse.json({ error: 'Erro ao salvar o cadastro.' }, { status: 500 })
      }
      insiderId = existente.id
    } else {
      const { data: inserido, error: insertError } = await supabase
        .from('dados_insiders')
        .insert({ ...row, cpf: maskCpf(parsed.data.cpf) })
        .select('id')
        .single()

      if (insertError || !inserido) {
        console.error('[insiders/register] insert error:', insertError)
        return NextResponse.json({ error: 'Erro ao criar o cadastro.' }, { status: 500 })
      }
      insiderId = inserido.id
    }

    // 5. Senha (só quando informada)
    if (senha) {
      const senhaHash = await hashPassword(senha)
      const { error: credError } = await supabase.from('insider_credentials').upsert(
        {
          insider_id: insiderId,
          senha_hash: senhaHash,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: 'insider_id' }
      )

      if (credError) {
        console.error('[insiders/register] credential error:', credError)
        return NextResponse.json(
          { error: 'Cadastro salvo, mas houve erro ao gravar a senha.' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ success: true, atualizado: Boolean(existente) })
  } catch (err) {
    console.error('[insiders/register] unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
