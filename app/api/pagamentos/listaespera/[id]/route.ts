import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-client"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const supabase = createClient()

    const { data, error } = await supabase
      .from("lista_vip_assessoria")
      .select("*")
      .eq("id", id)
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    console.error("[v0] Erro ao buscar registro:", error)
    return NextResponse.json(
      { success: false, error: "Falha ao buscar registro" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const supabase = createClient()

    const { error } = await supabase
      .from("lista_vip_assessoria")
      .delete()
      .eq("id", id)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: "Registro removido com sucesso",
    })
  } catch (error) {
    console.error("[v0] Erro ao remover registro:", error)
    return NextResponse.json(
      { success: false, error: "Falha ao remover registro" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { nome, email, whatsapp, sexo, cidade } = body

    const supabase = createClient()

    const updateData: any = {}
    if (nome) updateData.nome = nome
    if (email) updateData.email = email
    if (whatsapp) updateData.whatsapp = whatsapp
    if (sexo) updateData.sexo = sexo
    if (cidade) updateData.cidade = cidade

    const { data, error } = await supabase
      .from("lista_vip_assessoria")
      .update(updateData)
      .eq("id", id)
      .select()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: data?.[0],
      message: "Registro atualizado com sucesso",
    })
  } catch (error) {
    console.error("[v0] Erro ao atualizar registro:", error)
    return NextResponse.json(
      { success: false, error: "Falha ao atualizar registro" },
      { status: 500 }
    )
  }
}
