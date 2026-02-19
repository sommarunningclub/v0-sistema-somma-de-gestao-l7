'use client'

import { useEffect, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trash2, Check, Clock, AlertCircle } from 'lucide-react'
import { getMemberCharges, updateChargeStatus, deleteCharge } from '@/lib/services/charges'
import type { CobrancaMembro } from '@/lib/services/charges'

interface MemberChargesListProps {
  memberId: number
}

export function MemberChargesList({ memberId }: MemberChargesListProps) {
  const [charges, setCharges] = useState<CobrancaMembro[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCharges()
  }, [memberId])

  const loadCharges = async () => {
    setLoading(true)
    const data = await getMemberCharges(memberId)
    setCharges(data)
    setLoading(false)
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

  const handleMarkAsPaid = async (chargeId: number) => {
    await updateChargeStatus(chargeId, 'pago', new Date().toISOString())
    await loadCharges()
  }

  const handleDelete = async (chargeId: number) => {
    if (confirm('Tem certeza que deseja deletar esta cobrança?')) {
      await deleteCharge(chargeId)
      await loadCharges()
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pago':
        return <Check className="w-4 h-4 text-green-500" />
      case 'atrasada':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'pendente':
        return <Clock className="w-4 h-4 text-yellow-500" />
      default:
        return null
    }
  }

  if (loading) {
    return <div className="text-neutral-400 text-sm">Carregando cobranças...</div>
  }

  if (charges.length === 0) {
    return <div className="text-neutral-400 text-sm">Nenhuma cobrança criada para este membro</div>
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-neutral-700 hover:bg-transparent">
            <TableHead className="text-neutral-300">Descrição</TableHead>
            <TableHead className="text-neutral-300">Valor</TableHead>
            <TableHead className="text-neutral-300">Vencimento</TableHead>
            <TableHead className="text-neutral-300">Status</TableHead>
            <TableHead className="text-neutral-300 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {charges.map((charge) => (
            <TableRow key={charge.id} className="border-neutral-700 hover:bg-neutral-800/50">
              <TableCell className="text-neutral-200 text-sm">
                <div className="flex items-center gap-2">
                  {getStatusIcon(charge.status)}
                  {charge.descricao}
                </div>
              </TableCell>
              <TableCell className="text-neutral-200 font-medium">
                R$ {charge.valor.toFixed(2)}
              </TableCell>
              <TableCell className="text-neutral-400 text-sm">
                {new Date(charge.data_vencimento).toLocaleDateString('pt-BR')}
              </TableCell>
              <TableCell>
                {getStatusBadge(charge.status)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {charge.status === 'pendente' && (
                    <Button
                      size="sm"
                      onClick={() => handleMarkAsPaid(charge.id)}
                      className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs"
                    >
                      Marcar Pago
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => handleDelete(charge.id)}
                    className="bg-red-600 hover:bg-red-700 text-white h-7 text-xs"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
