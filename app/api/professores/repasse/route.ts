import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase-client"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get("action")

    if (action === "list") {
      // Listar todas as configurações de repasse com dados do professor
      const { data, error } = await supabase
        .from("professor_repasse_settings")
        .select(`
          id,
          professor_id,
          enable_repasse,
          notes,
          created_at,
          updated_at,
          professors:professor_id (
            id,
            name,
            email,
            status
          )
        `)
        .order("created_at", { ascending: false })

      if (error) throw error
      return NextResponse.json({ data })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (err: any) {
    console.error("[v0] Error in repasse API:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action, professor_id, enable_repasse, notes } = await req.json()

    if (action === "toggle") {
      const { data: existing } = await supabase
        .from("professor_repasse_settings")
        .select("id")
        .eq("professor_id", professor_id)
        .single()

      if (existing) {
        const { data, error } = await supabase
          .from("professor_repasse_settings")
          .update({ enable_repasse, notes, updated_at: new Date().toISOString() })
          .eq("professor_id", professor_id)
          .select()

        if (error) throw error
        return NextResponse.json({ data: data?.[0] })
      } else {
        const { data, error } = await supabase
          .from("professor_repasse_settings")
          .insert([{ professor_id, enable_repasse, notes }])
          .select()

        if (error) throw error
        return NextResponse.json({ data: data?.[0] })
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (err: any) {
    console.error("[v0] Error in repasse API:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
