'use client'

import { useMemo, useState } from 'react'
import { Download, MessageSquareHeart, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  EmptyState,
  MobileRecordCard,
  NoResultsState,
  SearchInput,
  SegmentedControl,
  StatusPill,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableFrame,
  Toolbar,
} from '@/components/somma'
import { STATUS_TRATATIVA } from '@/lib/nps/estado'
import { formatarDataHora } from '@/lib/nps/periodo'
import type { CategoriaNps, RespostaResumida, Rodada } from '@/lib/nps/tipos'
import { CATEGORIA } from './visual'

type Filtro = 'todas' | CategoriaNps

function normalizar(texto: string | null | undefined): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

/** Professor com a origem quando não veio do cadastro: quem lê sabe o peso da informação. */
function Professor({ r }: { r: RespostaResumida }) {
  if (!r.professor) return <span className="text-ink-muted">Não identificado</span>
  return (
    <span className="text-ink">
      {r.professor}
      {r.professor_origem === 'informado' ? <span className="block text-meta text-ink-muted">marcado pelo aluno</span> : null}
    </span>
  )
}

export function NpsRespostas({
  rodada,
  respostas,
  onAbrir,
  onEditar,
  onApagar,
}: {
  rodada: Rodada
  respostas: RespostaResumida[]
  onAbrir: (id: string) => void
  onEditar: (id: string) => void
  onApagar: (resposta: RespostaResumida) => void
}) {
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todas')

  const lista = useMemo(() => {
    const termo = normalizar(busca.trim())
    return respostas
      .filter((r) => filtro === 'todas' || r.nps_category === filtro)
      .filter(
        (r) =>
          !termo ||
          normalizar(r.full_name).includes(termo) ||
          normalizar(r.professor).includes(termo) ||
          normalizar(r.nps_reason).includes(termo),
      )
  }, [respostas, busca, filtro])

  if (respostas.length === 0) {
    return (
      <EmptyState
        icon={MessageSquareHeart}
        title="Nenhuma resposta nesta rodada"
        description="Quando os alunos responderem, cada resposta aparece aqui com a ficha completa."
      />
    )
  }

  const contagem = (c: CategoriaNps) => respostas.filter((r) => r.nps_category === c).length

  return (
    <div className="space-y-4">
      <Toolbar>
        <SearchInput value={busca} onValueChange={setBusca} placeholder="Buscar por nome, professor ou motivo" />
        <SegmentedControl<Filtro>
          label="Filtrar por categoria"
          value={filtro}
          onChange={setFiltro}
          options={[
            { value: 'todas', label: `Todas (${respostas.length})`, shortLabel: 'Todas' },
            { value: 'detractor', label: `Detratores (${contagem('detractor')})`, shortLabel: 'Detr.' },
            { value: 'passive', label: `Neutros (${contagem('passive')})`, shortLabel: 'Neutros' },
            { value: 'promoter', label: `Promotores (${contagem('promoter')})`, shortLabel: 'Prom.' },
          ]}
        />
        <Button variant="outline" asChild>
          <a href={`/api/nps/rodadas/${rodada.id}/csv`} download={`nps-${rodada.slug}.csv`}>
            <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Exportar CSV
          </a>
        </Button>
      </Toolbar>

      {lista.length === 0 ? (
        <NoResultsState query={busca} onClear={() => { setBusca(''); setFiltro('todas') }} />
      ) : (
        <>
          <div className="hidden lg:block">
            <TableFrame>
              <Table caption={`Respostas da rodada ${rodada.title}`}>
                <THead>
                  <TH>Aluno</TH>
                  <TH>Professor</TH>
                  <TH align="right">NPS</TH>
                  <TH align="right">Renovar</TH>
                  <TH>Motivo da nota</TH>
                  <TH>Tratativa</TH>
                  <TH>Enviada em</TH>
                  <TH align="right">
                    <span className="sr-only">Ações</span>
                  </TH>
                </THead>
                <TBody>
                  {lista.map((r) => (
                    <TR key={r.id} onClick={() => onAbrir(r.id)}>
                      <TD>
                        <span className="font-medium text-ink-strong">{r.full_name}</span>
                      </TD>
                      <TD>
                        <Professor r={r} />
                      </TD>
                      <TD align="right">
                        <span className="inline-flex items-center gap-2">
                          <span className="font-mono font-semibold tabular-nums text-ink-strong">{r.nps_score}</span>
                          <StatusPill tone={CATEGORIA[r.nps_category].tone}>{CATEGORIA[r.nps_category].rotulo}</StatusPill>
                        </span>
                      </TD>
                      <TD align="right">
                        <span className="font-mono tabular-nums">{r.renewal_probability}/10</span>
                      </TD>
                      <TD className="max-w-[320px]">
                        <span className="line-clamp-2 text-meta text-ink">{r.nps_reason ?? <span className="text-ink-muted">Sem motivo</span>}</span>
                      </TD>
                      <TD>
                        {r.precisa_tratativa || r.tratativa_status ? (
                          <StatusPill tone={STATUS_TRATATIVA[r.tratativa_status ?? 'pending'].tone}>
                            {STATUS_TRATATIVA[r.tratativa_status ?? 'pending'].rotulo}
                          </StatusPill>
                        ) : (
                          <span className="text-meta text-ink-muted">-</span>
                        )}
                      </TD>
                      <TD>
                        <span className="whitespace-nowrap text-meta text-ink-muted">{formatarDataHora(r.submitted_at)}</span>
                      </TD>
                      <TD align="right" className="py-2">
                        {/* Os botões param o clique e o Enter: a linha inteira abre a ficha. */}
                        <span className="inline-flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Editar resposta de ${r.full_name}`}
                            title="Editar nome ou professor"
                            onClick={(e) => {
                              e.stopPropagation()
                              onEditar(r.id)
                            }}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Apagar resposta de ${r.full_name}`}
                            title="Apagar resposta"
                            className="text-ink-muted hover:text-danger"
                            onClick={(e) => {
                              e.stopPropagation()
                              onApagar(r)
                            }}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </span>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableFrame>
          </div>

          {/* No celular, editar e apagar ficam na ficha: o cartão inteiro já é um botão. */}
          <div className="space-y-3 lg:hidden">
            {lista.map((r) => (
              <MobileRecordCard
                key={r.id}
                title={r.full_name}
                subtitle={
                  r.professor
                    ? `${r.professor}${r.professor_origem === 'informado' ? ' (marcado pelo aluno)' : ''}`
                    : 'Professor não identificado'
                }
                status={<StatusPill tone={CATEGORIA[r.nps_category].tone}>{`${r.nps_score} · ${CATEGORIA[r.nps_category].rotulo}`}</StatusPill>}
                fields={[
                  { label: 'Renovar', value: `${r.renewal_probability}/10` },
                  {
                    label: 'Tratativa',
                    value: r.precisa_tratativa || r.tratativa_status ? STATUS_TRATATIVA[r.tratativa_status ?? 'pending'].rotulo : '-',
                  },
                  { label: 'Motivo', value: r.nps_reason ?? 'Sem motivo' },
                  { label: 'Enviada', value: formatarDataHora(r.submitted_at) },
                ]}
                onClick={() => onAbrir(r.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
