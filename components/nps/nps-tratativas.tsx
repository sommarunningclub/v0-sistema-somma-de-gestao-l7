'use client'

import { useMemo, useState } from 'react'
import { ChevronRight, ClipboardCheck } from 'lucide-react'
import { EmptyState, Panel, SegmentedControl, StatusPill } from '@/components/somma'
import { STATUS_TRATATIVA } from '@/lib/nps/estado'
import { motivosDaTratativa } from '@/lib/nps/relatorio'
import type { RespostaResumida, StatusTratativa } from '@/lib/nps/tipos'

type Filtro = 'abertas' | 'fechadas' | 'todas'

const ABERTAS: StatusTratativa[] = ['pending', 'in_progress']

/**
 * Fila de tratativas: todo detrator e todo aluno com nota 6 ou menos para a
 * chance de renovar. A fila se forma sozinha a partir das respostas; aqui o
 * time só marca quem cuida e o que aconteceu.
 */
export function NpsTratativas({ respostas, onAbrir }: { respostas: RespostaResumida[]; onAbrir: (id: string) => void }) {
  const [filtro, setFiltro] = useState<Filtro>('abertas')

  const fila = useMemo(
    () =>
      respostas
        .filter((r) => r.precisa_tratativa || r.tratativa_status)
        // Pior primeiro: nota mais baixa, depois menor chance de renovar.
        .sort((a, b) => a.nps_score - b.nps_score || a.renewal_probability - b.renewal_probability),
    [respostas],
  )

  const status = (r: RespostaResumida): StatusTratativa => r.tratativa_status ?? 'pending'
  const contar = (lista: StatusTratativa[]) => fila.filter((r) => lista.includes(status(r))).length

  const visiveis = fila.filter((r) =>
    filtro === 'todas' ? true : filtro === 'abertas' ? ABERTAS.includes(status(r)) : !ABERTAS.includes(status(r)),
  )

  if (fila.length === 0) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="Nenhum aluno precisa de tratativa"
        description="Entram aqui detratores (nota 0 a 6) e quem deu 6 ou menos para a chance de renovar."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl<Filtro>
          label="Filtrar tratativas"
          value={filtro}
          onChange={setFiltro}
          options={[
            { value: 'abertas', label: `Abertas (${contar(ABERTAS)})`, shortLabel: 'Abertas' },
            { value: 'fechadas', label: `Fechadas (${contar(['resolved', 'no_action'])})`, shortLabel: 'Fechadas' },
            { value: 'todas', label: `Todas (${fila.length})`, shortLabel: 'Todas' },
          ]}
        />
        <p className="text-meta text-ink-muted">
          {contar(['pending'])} pendentes · {contar(['in_progress'])} em contato
        </p>
      </div>

      {visiveis.length === 0 ? (
        <p className="text-meta text-ink-muted">
          {filtro === 'abertas' ? 'Todas as tratativas desta rodada foram fechadas.' : 'Nenhuma tratativa fechada ainda.'}
        </p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {visiveis.map((r) => {
            const s = STATUS_TRATATIVA[status(r)]
            return (
              <li key={r.id}>
                <Panel className="h-full">
                  <button
                    type="button"
                    onClick={() => onAbrir(r.id)}
                    className="ds-tap flex h-full w-full items-start gap-3 p-4 text-left transition-colors hover:bg-surface-hover"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-ink-strong">{r.full_name}</span>
                        <StatusPill tone={s.tone}>{s.rotulo}</StatusPill>
                      </div>
                      <p className="mt-1 text-meta text-ink-muted">
                        {r.professor ?? 'Professor não identificado'}
                        {r.tratativa_responsavel ? ` · com ${r.tratativa_responsavel}` : ''}
                      </p>
                      <p className="mt-2 flex flex-wrap gap-1.5">
                        {motivosDaTratativa(r).map((m) => (
                          <span key={m} className="rounded-sm border border-line bg-surface-sunken px-1.5 py-0.5 font-mono text-[0.6875rem] text-ink">
                            {m}
                          </span>
                        ))}
                      </p>
                      {r.nps_reason ? <p className="mt-2 line-clamp-2 text-meta text-ink">“{r.nps_reason}”</p> : null}
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                  </button>
                </Panel>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
