import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, requirePermission } from '@/lib/auth/api-auth'

const MAX_SIZE = 5 * 1024 * 1024 // 5MB

/*
 * O `Content-Type` do multipart é escolhido pelo cliente: aceitar só ele
 * deixava subir qualquer conteúdo (HTML, SVG com script, executável) num
 * bucket público, bastando rotular como `image/png`. A validação abaixo lê os
 * primeiros bytes e confirma a assinatura real do arquivo.
 *
 * SVG fica de fora de propósito — é XML executável servido do mesmo domínio.
 */
const MAGIC_BYTES: Array<{ mime: string; ext: string; match: (b: Uint8Array) => boolean }> = [
  {
    mime: 'image/jpeg',
    ext: 'jpg',
    match: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: 'image/png',
    ext: 'png',
    match: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  {
    mime: 'image/gif',
    ext: 'gif',
    // "GIF87a" ou "GIF89a"
    match: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38,
  },
  {
    mime: 'image/webp',
    ext: 'webp',
    // "RIFF" .... "WEBP"
    match: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
]

function detectarImagem(bytes: Uint8Array): { mime: string; ext: string } | null {
  return MAGIC_BYTES.find((f) => f.match(bytes)) ?? null
}

// Todo upload cai sob `uploads/`. O DELETE só aceita esse prefixo com nome
// gerado por nós — sem `..`, sem barra extra, sem path absoluto — para que um
// path arbitrário no query string não apague outros objetos do bucket.
const PATH_PERMITIDO = /^uploads\/[A-Za-z0-9._-]+$/

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'popups')
  if (auth instanceof NextResponse) return auth

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Arquivo obrigatório' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Arquivo deve ter no máximo 5MB' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const formato = detectarImagem(new Uint8Array(arrayBuffer.slice(0, 12)))
    if (!formato) {
      return NextResponse.json({ error: 'Tipo de arquivo não suportado. Use JPG, PNG, WebP ou GIF.' }, { status: 400 })
    }

    const supabase = getAdminClient()
    // Nome e extensão vêm do formato detectado, não do nome enviado.
    const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${formato.ext}`

    const { error: uploadError } = await supabase.storage
      .from('popup-images')
      .upload(path, arrayBuffer, { contentType: formato.mime })

    if (uploadError) {
      console.error('[popups/upload] upload error:', uploadError)
      return NextResponse.json({ error: 'Erro ao fazer upload da imagem' }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage
      .from('popup-images')
      .getPublicUrl(path)

    return NextResponse.json({ url: publicUrl, path }, { status: 201 })
  } catch (err) {
    console.error('[popups/upload] unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requirePermission(req, 'popups')
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(req.url)
    const path = searchParams.get('path')

    if (!path) {
      return NextResponse.json({ error: 'path é obrigatório' }, { status: 400 })
    }

    if (!PATH_PERMITIDO.test(path)) {
      return NextResponse.json({ error: 'path inválido' }, { status: 400 })
    }

    const supabase = getAdminClient()
    const { error } = await supabase.storage.from('popup-images').remove([path])

    if (error) {
      console.error('[popups/upload] delete error:', error)
      return NextResponse.json({ error: 'Erro ao deletar imagem' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[popups/upload] delete unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
