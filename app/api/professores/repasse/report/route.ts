import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase-client"

interface RepasseLineItem {
  aluno_asaas_id: string
  aluno_nome: string
  professor_id: string
  professor_nome: string
  total_pago: number
  somma_taxa_cobrada: number
  professor_repasse: number
  take_somma_fee: boolean
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get("action")

    if (action === "generate") {
      // Buscar todos os professores com clientes e suas cobranças
      const { data: professores, error: profErr } = await supabase
        .from("professors")
        .select("id, name, email")
        .eq("status", "active")

      if (profErr) throw profErr

      // Buscar configurações de repasse
      const { data: repasseSettings, error: settingsErr } = await supabase
        .from("professor_repasse_settings")
        .select("professor_id, enable_repasse")

      if (settingsErr) throw settingsErr

      const repasseMap = new Map(
        repasseSettings?.map((s: any) => [s.professor_id, s.enable_repasse]) || []
      )

      // Buscar clientes vinculados aos professores
      const { data: professorClients, error: clientsErr } = await supabase
        .from("professor_clients")
        .select("professor_id, asaas_customer_id, customer_name")
        .eq("status", "active")

      if (clientsErr) throw clientsErr

      // Buscar pagamentos do Asaas para os clientes
      const customerIds = [...new Set(professorClients?.map(pc => pc.asaas_customer_id) || [])]
      
      const { data: payments, error: paymentsErr } = await supabase
        .from("payments")
        .select("customer_asaas_id, value, status")
        .in("customer_asaas_id", customerIds)
        .eq("status", "confirmed")

      if (paymentsErr) throw paymentsErr

      // Buscar configuração de taxa fixa do Somma
      const { data: commissionConfig } = await supabase
        .from("commission_config")
        .select("somma_fixed_fee")
        .single()

      const sommaFixedFee = (commissionConfig?.somma_fixed_fee as number) || 0

      // Montar relatório
      const reportLines: RepasseLineItem[] = []
      const groupedByProfessor: Record<string, any> = {}

      professorClients?.forEach(pc => {
        const professor = professores?.find(p => p.id === pc.professor_id)
        const clientPayments = payments?.filter(p => p.customer_asaas_id === pc.asaas_customer_id) || []
        const totalPago = clientPayments.reduce((sum, p) => sum + (p.value || 0), 0)
        const takeSommaFee = repasseMap.get(pc.professor_id) !== false // Por padrão cobra taxa
        const sommaTaxaCobrada = takeSommaFee ? sommaFixedFee : 0
        const professorRepasse = totalPago - sommaTaxaCobrada

        reportLines.push({
          aluno_asaas_id: pc.asaas_customer_id,
          aluno_nome: pc.customer_name,
          professor_id: pc.professor_id,
          professor_nome: professor?.name || "Desconhecido",
          total_pago: totalPago,
          somma_taxa_cobrada: sommaTaxaCobrada,
          professor_repasse: professorRepasse,
          take_somma_fee: takeSommaFee,
        })

        // Agregar por professor
        if (!groupedByProfessor[pc.professor_id]) {
          groupedByProfessor[pc.professor_id] = {
            professor_id: pc.professor_id,
            professor_nome: professor?.name || "Desconhecido",
            professor_email: professor?.email,
            total_alunos: 0,
            total_pago: 0,
            total_taxa_somma: 0,
            total_repasse: 0,
            alunos_com_repasse: 0,
            alunos_sem_repasse: 0,
          }
        }

        groupedByProfessor[pc.professor_id].total_alunos += 1
        groupedByProfessor[pc.professor_id].total_pago += totalPago
        groupedByProfessor[pc.professor_id].total_taxa_somma += sommaTaxaCobrada
        groupedByProfessor[pc.professor_id].total_repasse += professorRepasse

        if (takeSommaFee) {
          groupedByProfessor[pc.professor_id].alunos_com_repasse += 1
        } else {
          groupedByProfessor[pc.professor_id].alunos_sem_repasse += 1
        }
      })

      return NextResponse.json({
        reportLines,
        summary: Object.values(groupedByProfessor),
        generatedAt: new Date().toISOString(),
      })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (err: any) {
    console.error("[v0] Error generating repasse report:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
