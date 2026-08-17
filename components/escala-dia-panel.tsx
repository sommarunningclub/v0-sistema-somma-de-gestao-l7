'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { Trash2, Edit3, UserPlus, X } from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import { ErrorBanner } from '@/components/ui/error-banner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EscalaInsiderPicker } from '@/components/escala-insider-picker'
import {
  CardListSkeleton,
  ResponsiveModal,
  SectionTitle,
  Skeleton,
  StatusPill,
  Well,
  confirmAction,
  notify,
  type StatusTone,
} from '@/components/somma'
import { ESCALA_STATUS_LABELS, type EscalaStatus } from '@/lib/escala-constants'
import type {
  EscalaAtividade,
  EscalaDia,
  EscalaInsider,
  EstadoPreenchimento,
  InsiderOption,
} from '@/lib/types/escala'

interface EscalaDiaPanelProps {
  eventoId: string
  onFechar: () => void
  /** chamado depois de qualquer gravação, para o calendário recarregar */
  onAlterado: () => void
}

/** Um rascunho vale para todos os insiders escolhidos — a escalação é a mesma. */
interface Rascunho {
  insiders: InsiderOption[]
  status: EscalaStatus
  pelotao: string
  motivo: string
  atividadeIds: string[]
}

/** Frase de apoio do formulário, conforme quantos insiders estão no rascunho. */
function dicaDoRascunho(total: number): string {
  if (total === 0) return 'Cancele e marque ao menos um insider.'
  if (total === 1) return 'Escolha onde este insider entra.'
  return 'Todos entram na mesma presença, pelotão e atividades.'
}

/** Nomes para o toast: cita os primeiros e resume o resto, para não virar um parágrafo. */
function resumirNomes(insiders: InsiderOption[]): string {
  if (insiders.length <= 3) return insiders.map((i) => i.nome).join(', ')
  const primeiros = insiders.slice(0, 3).map((i) => i.nome).join(', ')
  return `${primeiros} e mais ${insiders.length - 3}`
}

const TOM_ESTADO: Record<EstadoPreenchimento, StatusTone> = {
  completo: 'success',
  parcial: 'warning',
  vazio: 'danger',
}

const ROTULO_ESTADO: Record<EstadoPreenchimento, string> = {
  completo: 'Completo',
  parcial: 'Parcial',
  vazio: 'Vazio',
}

export function EscalaDiaPanel({ eventoId, onFechar, onAlterado }: EscalaDiaPanelProps) {
  const [escala, setEscala] = useState<EscalaDia | null>(null)
  const [insiders, setInsiders] = useState<InsiderOption[]>([])
  const [atividades, setAtividades] = useState<EscalaAtividade[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [rascunho, setRascunho] = useState<Rascunho | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [mostrarPicker, setMostrarPicker] = useState(false)
  const [selecionados, setSelecionados] = useState<InsiderOption[]>([])

  const uid = useId()
  const id = (name: string) => `${uid}-${name}`

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const [resEscala, resInsiders, resAtividades] = await Promise.all([
        apiFetch(`/api/escala/evento/${eventoId}`),
        apiFetch('/api/escala/insiders'),
        apiFetch('/api/escala/atividades'),
      ])
      if (!resEscala.ok) throw new Error('Não foi possível carregar a escala deste dia')
      setEscala(await resEscala.json())
      setInsiders(resInsiders.ok ? await resInsiders.json() : [])
      setAtividades(resAtividades.ok ? await resAtividades.json() : [])
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [eventoId])

  useEffect(() => {
    carregar()
  }, [carregar])

  const alternarSelecao = (insider: InsiderOption) => {
    setSelecionados((atual) =>
      atual.some((i) => i.id === insider.id)
        ? atual.filter((i) => i.id !== insider.id)
        : [...atual, insider]
    )
  }

  /** Tira o insider do rascunho e também da lista marcada, para o picker não desencontrar. */
  const tirarDoRascunho = (insiderId: string) => {
    setRascunho((atual) =>
      atual ? { ...atual, insiders: atual.insiders.filter((i) => i.id !== insiderId) } : atual
    )
    setSelecionados((atual) => atual.filter((i) => i.id !== insiderId))
  }

  const salvar = async () => {
    if (!rascunho || rascunho.insiders.length === 0) return
    setSalvando(true)
    setErro(null)
    try {
      const res = await apiFetch(`/api/escala/evento/${eventoId}/lote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insider_ids: rascunho.insiders.map((i) => i.id),
          status: rascunho.status,
          pelotao: rascunho.status === 'corre' ? rascunho.pelotao : null,
          motivo: rascunho.status === 'nao_vai' ? rascunho.motivo : null,
          atividade_ids: rascunho.status === 'nao_vai' ? [] : rascunho.atividadeIds,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Erro ao salvar')
      const total = rascunho.insiders.length
      notify.success(total === 1 ? 'Escalação salva.' : `${total} escalações salvas.`, {
        description: resumirNomes(rascunho.insiders),
      })
      setRascunho(null)
      setSelecionados([])
      setMostrarPicker(false)
      await carregar()
      onAlterado()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  const remover = async (item: EscalaInsider) => {
    const ok = await confirmAction({
      title: 'Remover da escala?',
      description: 'O insider deixa de aparecer na escala deste dia. Você pode escalá-lo de novo depois.',
      detail: item.insider_nome,
      tone: 'danger',
      confirmLabel: 'Remover',
    })
    if (!ok) return

    setErro(null)
    const res = await apiFetch(`/api/escala/${item.id}`, { method: 'DELETE' })
    if (!res.ok) {
      notify.error('Erro ao remover a escalação')
      setErro('Erro ao remover a escalação')
      return
    }
    notify.success('Removido da escala.', { description: item.insider_nome })
    await carregar()
    onAlterado()
  }

  const linhaInsider = (item: EscalaInsider) => (
    <li key={item.id}>
      <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-raised px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink-strong">{item.insider_nome}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {item.atividades.map((a) => (
              <span
                key={a.id}
                className="rounded-full border px-1.5 py-0.5 text-micro font-medium"
                style={{ color: a.cor, borderColor: `${a.cor}55`, backgroundColor: `${a.cor}1A` }}
              >
                {a.nome}
              </span>
            ))}
            {item.motivo ? <span className="text-micro text-ink-muted">{item.motivo}</span> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() =>
              setRascunho({
                insiders: [{ id: item.insider_id, nome: item.insider_nome }],
                status: item.status,
                pelotao: item.pelotao ?? '',
                motivo: item.motivo ?? '',
                atividadeIds: item.atividades.map((a) => a.id),
              })
            }
            aria-label={`Editar escalação de ${item.insider_nome}`}
          >
            <Edit3 aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => remover(item)}
            aria-label={`Remover ${item.insider_nome} da escala`}
            className="hover:bg-danger-soft hover:text-danger"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>
    </li>
  )

  const dataFormatada = escala
    ? new Date(`${escala.data_evento}T12:00:00`).toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
      })
    : null

  return (
    <ResponsiveModal
      open
      onOpenChange={(aberto) => {
        if (!aberto && !salvando) onFechar()
      }}
      dismissible={!salvando}
      size="lg"
      title={escala ? escala.titulo : 'Escala do dia'}
      description={
        escala && dataFormatada ? (
          <span className="capitalize">{dataFormatada} · {escala.horario_inicio}</span>
        ) : (
          'Carregando as informações do dia...'
        )
      }
    >
      <div className="space-y-5">
        {erro ? <ErrorBanner message={erro} /> : null}

        {loading || !escala ? (
          <div aria-busy="true" className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <CardListSkeleton count={3} />
          </div>
        ) : (
          <>
            {/* Pelotões */}
            <section>
              <SectionTitle
                as="h3"
                title="Pelotões"
                meta={`${escala.corredores}/${escala.meta_total} corredores`}
              />
              <div className="space-y-2">
                {escala.pelotoes_resumo.length === 0 ? (
                  <p className="text-meta text-ink-muted">Este evento não tem pelotões definidos.</p>
                ) : null}
                {escala.pelotoes_resumo.map((resumo) => {
                  const corredores = escala.insiders.filter(
                    (i) => i.status === 'corre' && i.pelotao === resumo.pelotao
                  )
                  return (
                    <Well key={resumo.pelotao} className="space-y-2 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-ink-strong">{resumo.pelotao}</span>
                        <StatusPill tone={TOM_ESTADO[resumo.estado]}>
                          {resumo.escalados}/{resumo.meta} · {ROTULO_ESTADO[resumo.estado]}
                        </StatusPill>
                      </div>
                      {corredores.length > 0 ? (
                        <ul className="space-y-1.5">{corredores.map(linhaInsider)}</ul>
                      ) : (
                        <p className="text-meta text-ink-subtle">Ninguém escalado neste pelotão.</p>
                      )}
                    </Well>
                  )
                })}
              </div>
            </section>

            {/* Apoio */}
            <section>
              <SectionTitle as="h3" title="Apoio (não corre)" meta={`${escala.apoio}`} />
              {escala.apoio === 0 ? (
                <p className="text-meta text-ink-subtle">Ninguém no apoio.</p>
              ) : (
                <ul className="space-y-1.5">
                  {escala.insiders.filter((i) => i.status === 'apoio').map(linhaInsider)}
                </ul>
              )}
            </section>

            {/* Ausências */}
            <section>
              <SectionTitle as="h3" title="Não vai" meta={`${escala.nao_vai}`} />
              {escala.nao_vai === 0 ? (
                <p className="text-meta text-ink-subtle">Nenhuma ausência registrada.</p>
              ) : (
                <ul className="space-y-1.5">
                  {escala.insiders.filter((i) => i.status === 'nao_vai').map(linhaInsider)}
                </ul>
              )}
            </section>

            {/* Formulário */}
            {rascunho ? (
              <Well className="space-y-3 p-3">
                {rascunho.insiders.length === 1 ? (
                  <p className="text-sm font-semibold text-ink-strong">{rascunho.insiders[0].nome}</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-ink-strong">
                      {rascunho.insiders.length === 0
                        ? 'Nenhum insider selecionado'
                        : `${rascunho.insiders.length} insiders selecionados`}
                    </p>
                    <ul className="flex flex-wrap gap-1.5">
                      {rascunho.insiders.map((insider) => (
                        <li
                          key={insider.id}
                          className="flex items-center gap-1 rounded-full border border-line bg-surface-raised py-0.5 pl-2.5 pr-1 text-xs text-ink"
                        >
                          <span className="truncate">{insider.nome}</span>
                          <button
                            type="button"
                            onClick={() => tirarDoRascunho(insider.id)}
                            aria-label={`Tirar ${insider.nome} da seleção`}
                            className="rounded-full p-0.5 text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                          >
                            <X aria-hidden="true" className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-meta text-ink-muted">{dicaDoRascunho(rascunho.insiders.length)}</p>

                <fieldset>
                  <legend className="mb-1.5 text-meta font-medium text-ink-muted">Presença</legend>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(ESCALA_STATUS_LABELS) as EscalaStatus[]).map((status) => {
                      const selecionado = rascunho.status === status
                      return (
                        <button
                          key={status}
                          type="button"
                          aria-pressed={selecionado}
                          onClick={() => setRascunho({ ...rascunho, status })}
                          className={[
                            'ds-tap flex-1 rounded-lg border px-3 text-[0.8125rem] font-medium transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
                            selecionado
                              ? 'border-brand-border bg-brand-soft text-brand-strong'
                              : 'border-line bg-surface-raised text-ink-muted hover:border-line-strong hover:text-ink',
                          ].join(' ')}
                        >
                          {ESCALA_STATUS_LABELS[status]}
                        </button>
                      )
                    })}
                  </div>
                </fieldset>

                {rascunho.status === 'corre' ? (
                  <div>
                    <label htmlFor={id('pelotao')} className="mb-1.5 block text-meta font-medium text-ink-muted">
                      Pelotão
                    </label>
                    <select
                      id={id('pelotao')}
                      value={rascunho.pelotao}
                      onChange={(e) => setRascunho({ ...rascunho, pelotao: e.target.value })}
                      className="h-11 w-full rounded-lg border border-line bg-surface-sunken px-3 text-base text-ink transition-colors hover:border-line-strong focus-visible:border-brand focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand lg:h-10"
                    >
                      <option value="">Selecione o pelotão</option>
                      {escala.pelotoes.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {rascunho.status === 'nao_vai' ? (
                  <div>
                    <label htmlFor={id('motivo')} className="mb-1.5 block text-meta font-medium text-ink-muted">
                      Motivo da ausência
                    </label>
                    <Input
                      id={id('motivo')}
                      value={rascunho.motivo}
                      onChange={(e) => setRascunho({ ...rascunho, motivo: e.target.value })}
                      placeholder="Ex.: viagem, lesão, trabalho"
                    />
                  </div>
                ) : null}

                {rascunho.status !== 'nao_vai' && atividades.length > 0 ? (
                  <fieldset>
                    <legend className="mb-1.5 text-meta font-medium text-ink-muted">Atividades</legend>
                    <div className="flex flex-wrap gap-1.5">
                      {atividades.map((a) => {
                        const marcada = rascunho.atividadeIds.includes(a.id)
                        return (
                          <button
                            key={a.id}
                            type="button"
                            aria-pressed={marcada}
                            onClick={() =>
                              setRascunho({
                                ...rascunho,
                                atividadeIds: marcada
                                  ? rascunho.atividadeIds.filter((atvId) => atvId !== a.id)
                                  : [...rascunho.atividadeIds, a.id],
                              })
                            }
                            className="min-h-[36px] rounded-full border px-3 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                            style={{
                              color: a.cor,
                              borderColor: a.cor,
                              backgroundColor: marcada ? `${a.cor}33` : 'transparent',
                              opacity: marcada ? 1 : 0.65,
                            }}
                          >
                            {marcada ? '✓ ' : ''}{a.nome}
                          </button>
                        )
                      })}
                    </div>
                  </fieldset>
                ) : null}

                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  <Button
                    variant="secondary"
                    onClick={() => setRascunho(null)}
                    disabled={salvando}
                    block
                    className="sm:w-auto"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={salvar}
                    loading={salvando}
                    disabled={rascunho.insiders.length === 0}
                    block
                    className="sm:flex-1"
                  >
                    {rascunho.insiders.length > 1
                      ? `Salvar ${rascunho.insiders.length} escalações`
                      : 'Salvar escalação'}
                  </Button>
                </div>
              </Well>
            ) : mostrarPicker ? (
              <Well className="space-y-3 p-3">
                <div className="flex items-center justify-between gap-2">
                  <SectionTitle as="h3" title="Escalar insiders" className="mb-0" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setMostrarPicker(false)
                      setSelecionados([])
                    }}
                  >
                    Fechar
                  </Button>
                </div>

                <EscalaInsiderPicker
                  insiders={insiders}
                  jaEscalados={escala.insiders.map((i) => i.insider_id)}
                  selecionados={selecionados.map((i) => i.id)}
                  onAlternar={alternarSelecao}
                />

                <div className="flex flex-col-reverse gap-2 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-meta text-ink-muted" aria-live="polite">
                    {selecionados.length === 0
                      ? 'Marque um ou mais insiders.'
                      : `${selecionados.length} selecionado${selecionados.length > 1 ? 's' : ''}`}
                  </p>
                  <div className="flex gap-2">
                    {selecionados.length > 0 ? (
                      <Button variant="secondary" size="sm" onClick={() => setSelecionados([])}>
                        Limpar
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      disabled={selecionados.length === 0}
                      onClick={() =>
                        setRascunho({
                          insiders: selecionados,
                          status: 'corre',
                          pelotao: '',
                          motivo: '',
                          atividadeIds: [],
                        })
                      }
                    >
                      Definir presença
                    </Button>
                  </div>
                </div>
              </Well>
            ) : (
              <Button variant="secondary" block onClick={() => setMostrarPicker(true)}>
                <UserPlus aria-hidden="true" />
                Escalar insiders
              </Button>
            )}
          </>
        )}
      </div>
    </ResponsiveModal>
  )
}
