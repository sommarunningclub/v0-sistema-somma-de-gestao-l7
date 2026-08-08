'use client'

import { memo } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TD, TR } from '@/components/somma'
import type { CadastroSite } from '@/lib/supabase-client'

interface MembersTableRowProps {
  member: CadastroSite
  selected?: boolean
  onSelect: (member: CadastroSite) => void
  formatCPF: (cpf: string) => string
  formatDate: (date: string) => string
}

export const MembersTableRow = memo(function MembersTableRow({
  member,
  selected = false,
  onSelect,
  formatCPF,
  formatDate,
}: MembersTableRowProps) {
  return (
    <TR selected={selected} onClick={() => onSelect(member)}>
      <TD className="font-medium text-ink-strong">
        <span className="block max-w-[22ch] truncate">{member.nome_completo}</span>
      </TD>
      <TD className="hidden text-ink-muted md:table-cell">
        <span className="block max-w-[26ch] truncate">{member.email || '—'}</span>
      </TD>
      <TD className="hidden font-mono tabular-nums text-ink-muted lg:table-cell">
        {member.cpf ? formatCPF(member.cpf) : '—'}
      </TD>
      <TD className="hidden text-ink-muted xl:table-cell">
        {formatDate(member.data_nascimento)}
      </TD>
      <TD className="hidden font-mono tabular-nums text-ink-muted sm:table-cell">
        {member.whatsapp || '—'}
      </TD>
      <TD align="right">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Abrir detalhes de ${member.nome_completo}`}
          onClick={(event) => {
            event.stopPropagation()
            onSelect(member)
          }}
        >
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </TD>
    </TR>
  )
})

MembersTableRow.displayName = 'MembersTableRow'
