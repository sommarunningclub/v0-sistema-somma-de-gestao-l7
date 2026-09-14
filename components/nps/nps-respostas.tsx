'use client'

import { useMemo, useState } from 'react'
import { Download, MessageSquareHeart } from 'lucide-react'
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

export function NpsRespostas({
  rodada,
  respostas,
  onAbrir,
}: {
  rodada: Rodada
  respostas: RespostaResumida[]
  onAbrir: (id: string) => void
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
          normalizar(r.professor_name).includes(termo) ||
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
                </THead>
                <TBody>
                  {lista.map((r) => (
                    <TR key={r.id} onClick={() => onAbrir(r.id)}>
                      <TD>
                        <span className="font-medium text-ink-strong">{r.full_name}</span>
                      </TD>
                      <TD>
                        <span className={r.professor_name ? 'text-ink' : 'text-ink-muted'}>{r.professor_name ?? 'Não identificado'}</span>
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
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableFrame>
          </div>

          <div className="space-y-3 lg:hidden">
            {lista.map((r) => (
              <MobileRecordCard
                key={r.id}
                title={r.full_name}
                subtitle={r.professor_name ?? 'Professor não identificado'}
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
