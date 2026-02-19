'use client'

import { memo } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CadastroSite } from '@/lib/supabase-client'

interface MembersTableRowProps {
  member: CadastroSite
  index: number
  onSelect: (member: CadastroSite) => void
  formatCPF: (cpf: string) => string
  formatDate: (date: string) => string
}

export const MembersTableRow = memo(function MembersTableRow({
  member,
  index,
  onSelect,
  formatCPF,
  formatDate,
}: MembersTableRowProps) {
  return (
    <tr
      className={`border-b border-neutral-800 hover:bg-neutral-800 transition-colors cursor-pointer ${
        index % 2 === 0 ? 'bg-neutral-900' : 'bg-neutral-850'
      }`}
      onClick={() => onSelect(member)}
    >
      <td className="py-2 sm:py-3 px-3 sm:px-4 text-white font-medium truncate">{member.nome_completo}</td>
      <td className="py-2 sm:py-3 px-3 sm:px-4 text-neutral-300 hidden md:table-cell truncate">{member.email}</td>
      <td className="py-2 sm:py-3 px-3 sm:px-4 text-neutral-300 font-mono hidden lg:table-cell truncate">
        {formatCPF(member.cpf)}
      </td>
      <td className="py-2 sm:py-3 px-3 sm:px-4 text-neutral-300 hidden xl:table-cell">{formatDate(member.data_nascimento)}</td>
      <td className="py-2 sm:py-3 px-3 sm:px-4 text-neutral-300 hidden sm:table-cell truncate">{member.whatsapp}</td>
      <td className="py-2 sm:py-3 px-3 sm:px-4">
        <Button
          variant="ghost"
          size="icon"
          className="text-neutral-400 hover:text-orange-500 p-1"
          onClick={(e) => {
            e.stopPropagation()
            onSelect(member)
          }}
        >
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </td>
    </tr>
  )
})

MembersTableRow.displayName = 'MembersTableRow'
