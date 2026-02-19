import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-client"

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')

    let query = supabase
      .from("lista_vip_assessoria")
      .select("*")
      .order("data_hora", { ascending: false })

    if (search) {
      query = query.or(`nome.ilike.%${search}%,email.ilike.%${search}%,whatsapp.ilike.%${search}%,cidade.ilike.%${search}%`)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: data || [],
      total: data?.length || 0,
    })
  } catch (error) {
    console.error("[v0] Erro ao buscar lista VIP:", error)
    return NextResponse.json(
      { success: false, error: "Falha ao buscar lista VIP" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { nome, email, whatsapp, sexo, cidade } = body

    if (!nome || !email || !whatsapp || !sexo || !cidade) {
      return NextResponse.json(
        { success: false, error: "Todos os campos são obrigatórios" },
        { status: 400 }
      )
    }

    const supabase = createClient()

    const { data, error } = await supabase
      .from("lista_vip_assessoria")
      .insert([
        {
          nome,
          email,
          whatsapp,
          sexo,
          cidade,
          data_hora: new Date().toISOString(),
        },
      ])
      .select()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: data?.[0],
      message: "Registro adicionado com sucesso",
    })
  } catch (error) {
    console.error("[v0] Erro ao criar registro:", error)
    return NextResponse.json(
      { success: false, error: "Falha ao criar registro" },
      { status: 500 }
    )
  }
}
