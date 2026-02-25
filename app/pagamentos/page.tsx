"use client"

import PaymentsDashboard from "./dashboard/page"
import ClientesAsaas from "./clientes/page"
import ListaEspera from "./listaespera/page"
import Cobrancas from "./cobrancas/page"
import Assinaturas from "./assinaturas/page"
import Contratos from "./contratos/page"
import Cupons from "./cupons/page"
import Sincronizacao from "./sincronizacao/page"

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
      {activeTab === "contratos" && <Contratos />}
      {activeTab === "cupons" && <Cupons />}
      {activeTab === "sincronizacao" && <Sincronizacao />}
    </div>
  )
}
