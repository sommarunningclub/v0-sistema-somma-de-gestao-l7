import { NextRequest, NextResponse } from 'next/server'
import { getPopupById, updatePopup, deletePopup } from '@/lib/services/popups'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const popup = await getPopupById(id)
    if (!popup) return NextResponse.json({ error: 'Popup não encontrado' }, { status: 404 })
    return NextResponse.json(popup)
  } catch (err) {
    console.error('[popups/[id]] GET error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    const popup = await updatePopup(id, body)
    if (!popup) {
      return NextResponse.json({ error: 'Erro ao atualizar popup' }, { status: 500 })
    }

    return NextResponse.json(popup)
  } catch (err) {
    console.error('[popups/[id]] PATCH error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Get image path before deleting the record
    const supabase = getSupabase()
    const { data: popup } = await supabase
      .from('popups')
      .select('image_url')
      .eq('id', id)
      .single()

    const deleted = await deletePopup(id)
    if (!deleted) {
      return NextResponse.json({ error: 'Erro ao deletar popup' }, { status: 500 })
    }

    // Clean up image from storage if it's in our bucket
    if (popup?.image_url) {
      try {
        const url = new URL(popup.image_url)
        const pathMatch = url.pathname.match(/popup-images\/(.+)$/)
        if (pathMatch) {
          await supabase.storage.from('popup-images').remove([pathMatch[1]])
        }
      } catch {
        // Non-critical — popup was already deleted
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[popups/[id]] DELETE error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
