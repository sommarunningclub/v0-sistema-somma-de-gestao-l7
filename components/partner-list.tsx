'use client'

import * as React from 'react'
import { Building2, Edit2, Gift, Mail, MessageCircle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  MobileRecordCard,
  StatusPill,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableFrame,
  TablePagination,
  type SortDirection,
} from '@/components/somma'
import type { Partner } from '@/lib/services/partners'
import {
  formatCNPJ,
  partnerBenefitLabel,
  partnerStatusLabel,
  partnerStatusTone,
} from '@/components/partner-utils'

export type PartnerSortKey = 'company_name' | 'responsible_name' | 'status'

export interface PartnerListProps {
  partners: Partner[]
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  sortKey: PartnerSortKey
  sortDirection: Exclude<SortDirection, null>
  onSort: (key: PartnerSortKey) => void
  onSelect: (partner: Partner) => void
  onEdit: (partner: Partner) => void
  onDelete: (partner: Partner) => void
  onWhatsApp: (partner: Partner) => void
  selectedId?: string | null
  busy?: boolean
}

function directionFor(
  key: PartnerSortKey,
  sortKey: PartnerSortKey,
  direction: Exclude<SortDirection, null>,
): SortDirection {
  return key === sortKey ? direction : null
}

/**
 * Listagem de parceiros.
 *
 * Tabela no desktop e cards no celular — a mesma informação, dois formatos,
 * com as mesmas ações em ambos.
 */
export function PartnerList({
  partners,
  page,
  pageSize,
  total,
  onPageChange,
  sortKey,
  sortDirection,
  onSort,
  onSelect,
  onEdit,
  onDelete,
  onWhatsApp,
  selectedId,
  busy = false,
}: PartnerListProps) {
  return (
    <>
      {/* Celular: lista de cards */}
      <ul className="space-y-3 lg:hidden" aria-busy={busy || undefined}>
        {partners.map((partner) => (
          <li key={partner.id ?? partner.cnpj}>
            <MobileRecordCard
              title={partner.company_name}
              subtitle={formatCNPJ(partner.cnpj)}
              status={
                <StatusPill tone={partnerStatusTone(partner.status)}>
                  {partnerStatusLabel(partner.status)}
                </StatusPill>
              }
              fields={[
                { label: 'Responsável', value: partner.responsible_name },
                {
                  label: 'Benefício',
                  value: partner.benefit ? partnerBenefitLabel(partner.benefit_type) : '—',
                },
              ]}
              onClick={() => onSelect(partner)}
              actions={
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation()
                      onWhatsApp(partner)
                    }}
                  >
                    <MessageCircle aria-hidden="true" />
                    WhatsApp
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation()
                      onEdit(partner)
                    }}
                  >
                    <Edit2 aria-hidden="true" />
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Excluir ${partner.company_name}`}
                    className="ml-auto text-danger hover:text-danger"
                    onClick={(event) => {
                      event.stopPropagation()
                      onDelete(partner)
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </>
              }
            />
          </li>
        ))}
      </ul>

      {/* Desktop: tabela */}
      <TableFrame className="hidden lg:block" busy={busy}>
        <Table caption="Parceiros comerciais cadastrados, com responsável, contato, status e benefício.">
          <THead>
            <TH
              sortable
              direction={directionFor('company_name', sortKey, sortDirection)}
              onSort={() => onSort('company_name')}
            >
              Empresa
            </TH>
            <TH
              sortable
              direction={directionFor('responsible_name', sortKey, sortDirection)}
              onSort={() => onSort('responsible_name')}
            >
              Responsável
            </TH>
            <TH>Contato</TH>
            <TH
              sortable
              direction={directionFor('status', sortKey, sortDirection)}
              onSort={() => onSort('status')}
            >
              Status
            </TH>
            <TH>Benefício</TH>
            <TH align="right">Ações</TH>
          </THead>
          <TBody>
            {partners.map((partner) => (
              <TR
                key={partner.id ?? partner.cnpj}
                selected={!!selectedId && partner.id === selectedId}
                onClick={() => onSelect(partner)}
              >
                <TD>
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-sunken"
                    >
                      <Building2 className="h-4 w-4 text-brand" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink-strong">
                        {partner.company_name}
                      </span>
                      <span className="block font-mono text-micro text-ink-subtle">
                        {formatCNPJ(partner.cnpj)}
                      </span>
                    </span>
                  </div>
                </TD>
                <TD>
                  <span className="block max-w-[14rem] truncate">{partner.responsible_name}</span>
                </TD>
                <TD>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Enviar WhatsApp para ${partner.responsible_name}`}
                      title={`WhatsApp: ${partner.responsible_phone}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        onWhatsApp(partner)
                      }}
                    >
                      <MessageCircle aria-hidden="true" />
                    </Button>
                    <Button asChild variant="ghost" size="icon-sm">
                      <a
                        href={`mailto:${partner.responsible_email}`}
                        aria-label={`Enviar e-mail para ${partner.responsible_name}`}
                        title={partner.responsible_email}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Mail aria-hidden="true" />
                      </a>
                    </Button>
                  </div>
                </TD>
                <TD>
                  <StatusPill tone={partnerStatusTone(partner.status)}>
                    {partnerStatusLabel(partner.status)}
                  </StatusPill>
                </TD>
                <TD>
                  {partner.benefit ? (
                    <span
                      className="flex items-center gap-1.5 text-ink-muted"
                      title={partner.benefit}
                    >
                      <Gift aria-hidden="true" className="h-3.5 w-3.5 text-brand" />
                      <span className="max-w-[9rem] truncate">
                        {partnerBenefitLabel(partner.benefit_type)}
                      </span>
                    </span>
                  ) : (
                    <span className="text-ink-subtle">—</span>
                  )}
                </TD>
                <TD align="right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Editar ${partner.company_name}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        onEdit(partner)
                      }}
                    >
                      <Edit2 aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Excluir ${partner.company_name}`}
                      className="text-danger hover:text-danger"
                      onClick={(event) => {
                        event.stopPropagation()
                        onDelete(partner)
                      }}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={onPageChange}
        />
      </TableFrame>

      <div className="lg:hidden">
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={onPageChange}
          className="rounded-xl border border-line bg-surface-raised"
        />
      </div>
    </>
  )
}
