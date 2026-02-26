"use client"

import PaymentsDashboard from "./dashboard/page"
import ClientesAsaas from "./clientes/page"
import ListaEspera from "./listaespera/page"
import Cobrancas from "./cobrancas/page"
import Assinaturas from "./assinaturas/page"
import PixAutomatico from "./pix-automatico/page"
import Sincronizacao from "./sincronizacao/page"
import InsidersPage from "./insiders/page"
import LinkPagamento from "./link-pagamento/page"

interface PagamentosPageProps {
  activeTab?: string
}

export default function PagamentosPage({ activeTab = "dashboard" }: PagamentosPageProps) {
  return (
    <div className="flex-1 overflow-auto bg-neutral-900 h-full">
      {activeTab === "dashboard" && <PaymentsDashboard />}
      {activeTab === "clientes" && <ClientesAsaas />}
      {activeTab === "listaespera" && <ListaEspera />}
      {activeTab === "cobrancas" && <Cobrancas />}
      {activeTab === "assinaturas" && <Assinaturas />}
      {activeTab === "pix-automatico" && <PixAutomatico />}
      {activeTab === "link-pagamento" && <LinkPagamento />}
      {activeTab === "sincronizacao" && <Sincronizacao />}
      {activeTab === "insiders" && <InsidersPage />}
    </div>
  )
}
