'use client'

import { CardListSkeleton, MobileRecordCard } from '@/components/somma'
import type { CadastroSite } from '@/lib/supabase-client'

interface MembersCardListProps {
  members: CadastroSite[]
  onSelectMember: (member: CadastroSite) => void
  loading?: boolean
  selectedId?: number | null
}

function formatPhone(phone: string) {
  const cleaned = (phone || '').replace(/\D/g, '')
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`
  }
  return phone || '—'
}

function formatCPF(cpf: string) {
  const cleaned = (cpf || '').replace(/\D/g, '')
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`
  }
  return cpf || '—'
}

/**
 * Lista de membros no celular. Substitui a tabela — nada de rolagem
 * horizontal: cada registro vira um cartão com o toque na linha inteira.
 */
export function MembersCardList({
  members,
  onSelectMember,
  loading = false,
  selectedId = null,
}: MembersCardListProps) {
  if (loading) {
    return (
      <div className="lg:hidden" aria-busy="true">
        <CardListSkeleton count={5} />
      </div>
    )
  }

  if (members.length === 0) return null

  return (
    <ul className="space-y-2.5 lg:hidden">
      {members.map((member) => (
        <li key={member.id}>
          <MobileRecordCard
            title={member.nome_completo}
            subtitle={member.email || 'Sem e-mail cadastrado'}
            onClick={() => onSelectMember(member)}
            className={selectedId === member.id ? 'border-brand-border bg-brand-soft' : undefined}
            fields={[
              { label: 'WhatsApp', value: formatPhone(member.whatsapp) },
              { label: 'CPF', value: <span className="font-mono tabular-nums">{formatCPF(member.cpf)}</span> },
            ]}
          />
        </li>
      ))}
    </ul>
  )
}
