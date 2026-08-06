import { redirect } from 'next/navigation'
import { getAdminClient } from '@/lib/auth/api-auth'
import { getInsiderFromCookies } from '@/lib/auth/insider-session'
import { INSIDER_PUBLIC_COLUMNS } from '@/lib/insider/insider-mapper'
import { montarBeneficios, BENEFICIO_COLUNAS } from '@/lib/insider/beneficios'
import { PortalHeader } from '@/components/insider/portal-header'
import { PortalBeneficios } from '@/components/insider/portal-beneficios'

export const metadata = {
  title: 'Área do Insider — Somma Club',
}

// A sessão é conferida a cada requisição; nada aqui pode ser pré-renderizado.
export const dynamic = 'force-dynamic'

export default async function PainelPage() {
  const sessao = await getInsiderFromCookies()
  if (!sessao) {
    redirect('/insider')
  }

  const supabase = getAdminClient()
  const { data: row, error } = await supabase
    .from('dados_insiders')
    .select(`${INSIDER_PUBLIC_COLUMNS}, ${BENEFICIO_COLUNAS}`)
    .eq('id', sessao.sub)
    .maybeSingle()

  if (error) {
    console.error('[insider/painel] select error:', error)
  }

  // Cadastro removido depois do login, ou falha de leitura: volta para a entrada.
  if (!row) {
    redirect('/insider')
  }

  const beneficios = montarBeneficios(row as Record<string, unknown>)

  return (
    <main className="mx-auto max-w-[1000px] px-5 py-14 md:py-20">
      <PortalHeader nome={sessao.nome} />

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Seus benefícios</h2>
        <p className="mt-1 text-sm text-white/70">
          Apresente o cupom na compra para garantir o desconto.
        </p>
        <div className="mt-6">
          <PortalBeneficios beneficios={beneficios} />
        </div>
      </section>
    </main>
  )
}
