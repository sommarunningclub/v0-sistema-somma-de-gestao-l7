'use client'

import * as React from 'react'
import { Building2, Edit2, Mail, MessageCircle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ResponsiveModal, SectionTitle, StatusPill, Well } from '@/components/somma'
import type { Partner } from '@/lib/services/partners'
import {
  formatCNPJ,
  partnerBenefitLabel,
  partnerStatusLabel,
  partnerStatusTone,
} from '@/components/partner-utils'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="ds-eyebrow">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-ink">{children}</dd>
    </div>
  )
}

export interface PartnerDetailModalProps {
  partner: Partner | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (partner: Partner) => void
  onDelete: (partner: Partner) => void
  onWhatsApp: (partner: Partner) => void
}

/** Ficha completa do parceiro. Substitui o painel lateral fixo por um modal responsivo. */
export function PartnerDetailModal({
  partner,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onWhatsApp,
}: PartnerDetailModalProps) {
  if (!partner) return null

  const address = [partner.company_address, partner.company_city, partner.company_state]
    .filter(Boolean)
    .join(' · ')

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={partner.company_name}
      description={formatCNPJ(partner.cnpj)}
      footer={
        <>
          <Button
            variant="secondary"
            block
            className="sm:w-auto"
            onClick={() => onEdit(partner)}
          >
            <Edit2 aria-hidden="true" />
            Editar
          </Button>
          <Button block className="sm:w-auto" onClick={() => onWhatsApp(partner)}>
            <MessageCircle aria-hidden="true" />
            WhatsApp
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-border bg-brand-soft"
          >
            <Building2 className="h-5 w-5 text-brand" />
          </span>
          <StatusPill tone={partnerStatusTone(partner.status)} size="md">
            {partnerStatusLabel(partner.status)}
          </StatusPill>
        </div>

        <section aria-labelledby="detalhe-empresa">
          <SectionTitle as="h3" title="Dados da empresa" />
          <Well className="p-4">
            <dl className="grid gap-4 sm:grid-cols-2">
              {partner.company_legal_name ? (
                <Field label="Razão social">{partner.company_legal_name}</Field>
              ) : null}
              {partner.company_email ? (
                <Field label="E-mail">
                  <a
                    href={`mailto:${partner.company_email}`}
                    className="text-brand underline-offset-2 hover:underline"
                  >
                    {partner.company_email}
                  </a>
                </Field>
              ) : null}
              {partner.company_phone ? (
                <Field label="Telefone">{partner.company_phone}</Field>
              ) : null}
              {address ? <Field label="Endereço">{address}</Field> : null}
              <Field label="CNPJ">
                <span className="font-mono">{formatCNPJ(partner.cnpj)}</span>
              </Field>
            </dl>
          </Well>
        </section>

        <section>
          <SectionTitle as="h3" title="Responsável" />
          <Well className="p-4">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome">{partner.responsible_name}</Field>
              {partner.responsible_cpf ? (
                <Field label="CPF">
                  <span className="font-mono">{partner.responsible_cpf}</span>
                </Field>
              ) : null}
              <Field label="E-mail">
                <a
                  href={`mailto:${partner.responsible_email}`}
                  className="text-brand underline-offset-2 hover:underline"
                >
                  {partner.responsible_email}
                </a>
              </Field>
              <Field label="Telefone">{partner.responsible_phone}</Field>
            </dl>
          </Well>
        </section>

        {partner.benefit ? (
          <section>
            <SectionTitle as="h3" title="Benefício da parceria" />
            <div className="rounded-lg border border-brand-border bg-brand-soft p-4">
              <StatusPill tone="brand" dot={false}>
                {partnerBenefitLabel(partner.benefit_type)}
              </StatusPill>
              <p className="mt-2 text-sm leading-relaxed text-ink">{partner.benefit}</p>
            </div>
          </section>
        ) : null}

        {partner.notes ? (
          <section>
            <SectionTitle as="h3" title="Observações" />
            <Well className="p-4">
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink-muted">
                {partner.notes}
              </p>
            </Well>
          </section>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          <Button asChild variant="outline" size="sm">
            <a href={`mailto:${partner.responsible_email}`}>
              <Mail aria-hidden="true" />
              Enviar e-mail
            </a>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-danger hover:text-danger"
            onClick={() => onDelete(partner)}
          >
            <Trash2 aria-hidden="true" />
            Excluir parceiro
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  )
}
