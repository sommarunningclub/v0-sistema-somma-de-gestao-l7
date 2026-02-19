'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, Mail, Phone } from 'lucide-react'
import type { CadastroSite } from '@/lib/supabase-client'

interface MembersCardListProps {
  members: CadastroSite[]
  onSelectMember: (member: CadastroSite) => void
}

export function MembersCardList({ members, onSelectMember }: MembersCardListProps) {
  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`
    }
    return phone
  }

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="text-4xl mb-3">🔍</div>
        <p className="text-center text-sm text-neutral-400">Nenhum membro encontrado</p>
      </div>
    )
  }

  return (
    <div className="lg:hidden space-y-2">
      {members.map((member) => (
        <Card
          key={member.id}
          className="bg-neutral-900 border-neutral-700 hover:border-orange-500/50 transition-colors cursor-pointer active:bg-neutral-800"
          onClick={() => onSelectMember(member)}
        >
          <CardContent className="p-3">
            {/* Top Section - Name and Actions */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{member.nome_completo}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-neutral-400 hover:text-orange-500 p-1 flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectMember(member)
                }}
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </div>

            {/* Contact Info */}
            <div className="space-y-1.5 text-xs">
              {/* Email */}
              <div className="flex items-center gap-2 text-neutral-300">
                <Mail className="w-3.5 h-3.5 text-neutral-500 flex-shrink-0" />
                <span className="truncate">{member.email}</span>
              </div>

              {/* WhatsApp */}
              <div className="flex items-center gap-2 text-neutral-300">
                <Phone className="w-3.5 h-3.5 text-neutral-500 flex-shrink-0" />
                <span>{formatPhone(member.whatsapp)}</span>
              </div>
            </div>

            {/* Footer - Meta Info */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-800">
              <div className="text-xs text-neutral-500">
                ID: <span className="font-mono">{member.id}</span>
              </div>
              <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/10 rounded text-xs font-bold text-green-400">
                ✓ Ativo
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
