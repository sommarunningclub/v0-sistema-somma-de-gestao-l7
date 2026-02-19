'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Plus, Trash2, Check } from 'lucide-react'
import { getMembers } from '@/lib/services/members'
import { getMemberCharges, updateChargeStatus, deleteCharge } from '@/lib/services/charges'
import { ChargesDashboard } from '@/components/charges-dashboard'
import type { CadastroSite } from '@/lib/supabase-client'
import type { CobrancaMembro } from '@/lib/services/charges'

export default function ChargesManagementPage() {
  const [members, setMembers] = useState<CadastroSite[]>([])
  const [selectedMember, setSelectedMember] = useState<CadastroSite | null>(null)
  const [charges, setCharges] = useState<CobrancaMembro[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'dashboard' | 'manage'>('dashboard')

  useEffect(() => {
    loadMembers()
  }, [])

  useEffect(() => {
    if (selectedMember) {
      loadCharges(selectedMember.id)
    }
  }, [selectedMember])

  const loadMembers = async () => {
    setLoading(true)
    const data = await getMembers()
    setMembers(data)
    setLoading(false)
  }

  const loadCharges = async (memberId: number) => {
    const data = await getMemberCharges(memberId)
    setCharges(data)
  }

  const filteredMembers = members.filter((member) =>
    member.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleMarkAsPaid = async (chargeId: number) => {
    await updateChargeStatus(chargeId, 'pago', new Date().toISOString())
    if (selectedMember) {
      await loadCharges(selectedMember.id)
    }
  }

  const handleDelete = async (chargeId: number) => {
    if (confirm('Tem certeza que deseja deletar esta cobrança?')) {
      await deleteCharge(chargeId)
      if (selectedMember) {
        await loadCharges(selectedMember.id)
      }
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pago':
        return <Badge className="bg-green-600/20 text-green-400 border-green-600/30">Pago</Badge>
      case 'pendente':
        return <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600/30">Pendente</Badge>
      case 'atrasada':
        return <Badge className="bg-red-600/20 text-red-400 border-red-600/30">Atrasada</Badge>
      case 'cancelada':
        return <Badge className="bg-gray-600/20 text-gray-400 border-gray-600/30">Cancelada</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-neutral-400">
        Carregando...
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-wider">GERENCIAMENTO DE COBRANÇAS</h1>
        <p className="text-neutral-400 mt-1">Visualize, crie e gerencie cobranças de membros</p>
      </div>

      {/* View Tabs */}
      <div className="flex gap-2">
        <Button
          onClick={() => setView('dashboard')}
          className={`${
            view === 'dashboard'
              ? 'bg-orange-500 text-white'
              : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
          }`}
        >
          Dashboard
        </Button>
        <Button
          onClick={() => setView('manage')}
          className={`${
            view === 'manage'
              ? 'bg-orange-500 text-white'
              : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
          }`}
        >
          Gerenciar
        </Button>
      </div>

      {/* Dashboard View */}
      {view === 'dashboard' && (
        <ChargesDashboard />
      )}

      {/* Management View */}
      {view === 'manage' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Members List */}
          <Card className="bg-neutral-900 border-neutral-700 lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-sm text-white">Membros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-neutral-400" />
                <Input
                  placeholder="Buscar membro..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 bg-neutral-800 border-neutral-600 text-white"
                />
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredMembers.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => setSelectedMember(member)}
                    className={`w-full text-left p-2 rounded-lg transition-colors ${
                      selectedMember?.id === member.id
                        ? 'bg-orange-500/20 border border-orange-500/50'
                        : 'bg-neutral-800 hover:bg-neutral-700 border border-neutral-700'
                    }`}
                  >
                    <p className="text-xs font-medium text-white truncate">
                      {member.nome_completo}
                    </p>
                    <p className="text-xs text-neutral-400 truncate">
                      {member.email}
                    </p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Charges List */}
          <Card className="bg-neutral-900 border-neutral-700 lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-sm text-white">
                {selectedMember
                  ? `Cobranças - ${selectedMember.nome_completo}`
                  : 'Selecione um membro'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedMember ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-700">
                        <th className="text-left py-3 px-4 text-neutral-400 font-medium">
                          Descrição
                        </th>
                        <th className="text-left py-3 px-4 text-neutral-400 font-medium">
                          Valor
                        </th>
                        <th className="text-left py-3 px-4 text-neutral-400 font-medium">
                          Vencimento
                        </th>
                        <th className="text-left py-3 px-4 text-neutral-400 font-medium">
                          Status
                        </th>
                        <th className="text-right py-3 px-4 text-neutral-400 font-medium">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {charges.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-6 text-neutral-400">
                            Nenhuma cobrança para este membro
                          </td>
                        </tr>
                      ) : (
                        charges.map((charge) => (
                          <tr key={charge.id} className="border-b border-neutral-700 hover:bg-neutral-800/50">
                            <td className="py-3 px-4 text-white text-sm">
                              {charge.descricao}
                            </td>
                            <td className="py-3 px-4 text-white font-medium">
                              R$ {charge.valor.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-neutral-400">
                              {new Date(charge.data_vencimento).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="py-3 px-4">
                              {getStatusBadge(charge.status)}
                            </td>
                            <td className="py-3 px-4 text-right space-x-2">
                              {charge.status === 'pendente' && (
                                <Button
                                  size="sm"
                                  onClick={() => handleMarkAsPaid(charge.id)}
                                  className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs"
                                >
                                  <Check className="w-3 h-3 mr-1" />
                                  Pago
                                </Button>
                              )}
                              <Button
                                size="sm"
                                onClick={() => handleDelete(charge.id)}
                                className="bg-red-600 hover:bg-red-700 text-white h-7 text-xs"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-neutral-400">
                  Selecione um membro para visualizar suas cobranças
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
