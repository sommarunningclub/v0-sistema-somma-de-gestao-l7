'use client'

import { useCallback, useEffect, useState } from 'react'
import { X, Plus, Trash2, Edit3 } from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import { ErrorBanner } from '@/components/ui/error-banner'
import { PageLoading } from '@/components/ui/page-loading'
import { EscalaInsiderPicker } from '@/components/escala-insider-picker'
import { CORES_ESTADO } from '@/lib/escala-ui'
import { ESCALA_STATUS_LABELS, type EscalaStatus } from '@/lib/escala-constants'
import type {
  EscalaAtividade,
  EscalaDia,
  EscalaInsider,
  InsiderOption,
} from '@/lib/types/escala'

interface EscalaDiaPanelProps {
  eventoId: string
  onFechar: () => void
  /** chamado depois de qualquer gravação, para o calendário recarregar */
  onAlterado: () => void
}

interface Rascunho {
  insider: InsiderOption
  status: EscalaStatus
  pelotao: string
  motivo: string
  atividadeIds: string[]
}

export function EscalaDiaPanel({ eventoId, onFechar, onAlterado }: EscalaDiaPanelProps) {
  const [escala, setEscala] = useState<EscalaDia | null>(null)
  const [insiders, setInsiders] = useState<InsiderOption[]>([])
  const [atividades, setAtividades] = useState<EscalaAtividade[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [rascunho, setRascunho] = useState<Rascunho | null>(null)
  const [salvando, setSalvando] = useState(false)

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

  const salvar = async () => {
    if (!rascunho) return
    setSalvando(true)
    setErro(null)
    try {
      const res = await apiFetch(`/api/escala/evento/${eventoId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insider_id: rascunho.insider.id,
          status: rascunho.status,
          pelotao: rascunho.status === 'corre' ? rascunho.pelotao : null,
          motivo: rascunho.status === 'nao_vai' ? rascunho.motivo : null,
          atividade_ids: rascunho.status === 'nao_vai' ? [] : rascunho.atividadeIds,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Erro ao salvar')
      setRascunho(null)
      await carregar()
      onAlterado()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  const remover = async (id: string) => {
    setErro(null)
    const res = await apiFetch(`/api/escala/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      setErro('Erro ao remover a escalação')
      return
    }
    await carregar()
    onAlterado()
  }

  const linhaInsider = (item: EscalaInsider) => (
    <div
      key={item.id}
      className="flex items-center justify-between gap-2 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2"
    >
      <div className="min-w-0">
        <p className="text-sm text-white truncate">{item.insider_nome}</p>
        <div className="flex flex-wrap gap-1 mt-1">
          {item.atividades.map((a) => (
            <span
              key={a.id}
              className="text-[10px] px-1.5 py-0.5 rounded-full border"
              style={{ color: a.cor, borderColor: `${a.cor}55`, backgroundColor: `${a.cor}1A` }}
            >
              {a.nome}
            </span>
          ))}
          {item.motivo && <span className="text-[10px] text-neutral-400">{item.motivo}</span>}
        </div>
      </div>
      <button
        onClick={() =>
          setRascunho({
            insider: { id: item.insider_id, nome: item.insider_nome },
            status: item.status,
            pelotao: item.pelotao ?? '',
            motivo: item.motivo ?? '',
            atividadeIds: item.atividades.map((a) => a.id),
          })
        }
        className="p-1.5 text-neutral-500 hover:text-orange-400 transition-colors flex-shrink-0"
        aria-label={`Editar ${item.insider_nome}`}
      >
        <Edit3 className="w-4 h-4" />
      </button>
      <button
        onClick={() => remover(item.id)}
        className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors flex-shrink-0"
        aria-label={`Remover ${item.insider_nome} da escala`}
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end md:items-center md:justify-center" onClick={onFechar}>
      <div
        className="w-full md:max-w-2xl max-h-[90vh] overflow-auto bg-neutral-900 border border-neutral-700 rounded-t-2xl md:rounded-2xl p-4 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-white font-bold">
              {escala ? escala.titulo : 'Escala do dia'}
            </h2>
            {escala && (
              <p className="text-xs text-neutral-400">
                {new Date(`${escala.data_evento}T12:00:00`).toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                })}{' '}
                · {escala.horario_inicio}
              </p>
            )}
          </div>
          <button onClick={onFechar} className="p-1 text-neutral-400 hover:text-white" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        {erro && <ErrorBanner message={erro} />}

        {loading || !escala ? (
          <PageLoading label="Carregando o dia..." />
        ) : (
          <>
            {/* Pelotões */}
            <div className="space-y-2">
              {escala.pelotoes_resumo.map((resumo) => {
                const cores = CORES_ESTADO[resumo.estado]
                const corredores = escala.insiders.filter(
                  (i) => i.status === 'corre' && i.pelotao === resumo.pelotao
                )
                return (
                  <div key={resumo.pelotao} className={`rounded-lg border p-2.5 space-y-2 ${cores.borda} ${cores.fundo}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">{resumo.pelotao}</span>
                      <span className={`text-xs font-bold ${cores.texto}`}>
                        {resumo.escalados}/{resumo.meta}
                      </span>
                    </div>
                    {corredores.map(linhaInsider)}
                    {corredores.length === 0 && (
                      <p className="text-xs text-neutral-500">Ninguém escalado neste pelotão.</p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Apoio */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-neutral-400 tracking-wide">APOIO (NÃO CORRE)</h3>
              {escala.insiders.filter((i) => i.status === 'apoio').map(linhaInsider)}
              {escala.apoio === 0 && <p className="text-xs text-neutral-500">Ninguém no apoio.</p>}
            </div>

            {/* Ausências */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-neutral-400 tracking-wide">NÃO VAI</h3>
              {escala.insiders.filter((i) => i.status === 'nao_vai').map(linhaInsider)}
              {escala.nao_vai === 0 && <p className="text-xs text-neutral-500">Nenhuma ausência registrada.</p>}
            </div>

            {/* Formulário */}
            {rascunho ? (
              <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-3 space-y-3">
                <p className="text-sm text-white font-bold">{rascunho.insider.nome}</p>

                <div className="flex gap-2">
                  {(Object.keys(ESCALA_STATUS_LABELS) as EscalaStatus[]).map((status) => (
                    <button
                      key={status}
                      onClick={() => setRascunho({ ...rascunho, status })}
                      className={`flex-1 text-xs py-2 rounded-lg border transition-colors ${
                        rascunho.status === status
                          ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-neutral-900 text-neutral-300 border-neutral-700 hover:border-neutral-500'
                      }`}
                    >
                      {ESCALA_STATUS_LABELS[status]}
                    </button>
                  ))}
                </div>

                {rascunho.status === 'corre' && (
                  <select
                    value={rascunho.pelotao}
                    onChange={(e) => setRascunho({ ...rascunho, pelotao: e.target.value })}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="">Selecione o pelotão</option>
                    {escala.pelotoes.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                )}

                {rascunho.status === 'nao_vai' && (
                  <input
                    value={rascunho.motivo}
                    onChange={(e) => setRascunho({ ...rascunho, motivo: e.target.value })}
                    placeholder="Motivo da ausência"
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-500"
                  />
                )}

                {rascunho.status !== 'nao_vai' && atividades.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {atividades.map((a) => {
                      const marcada = rascunho.atividadeIds.includes(a.id)
                      return (
                        <button
                          key={a.id}
                          onClick={() =>
                            setRascunho({
                              ...rascunho,
                              atividadeIds: marcada
                                ? rascunho.atividadeIds.filter((id) => id !== a.id)
                                : [...rascunho.atividadeIds, a.id],
                            })
                          }
                          className="text-xs px-2 py-1 rounded-full border transition-all"
                          style={{
                            color: a.cor,
                            borderColor: a.cor,
                            backgroundColor: marcada ? `${a.cor}33` : 'transparent',
                            opacity: marcada ? 1 : 0.6,
                          }}
                        >
                          {a.nome}
                        </button>
                      )
                    })}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={salvar}
                    disabled={salvando}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-bold py-2 rounded-lg transition-colors"
                  >
                    {salvando ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button
                    onClick={() => setRascunho(null)}
                    className="px-4 text-sm text-neutral-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <details className="bg-neutral-800 border border-neutral-700 rounded-lg p-3">
                <summary className="text-sm text-orange-400 cursor-pointer flex items-center gap-1.5">
                  <Plus className="w-4 h-4" /> Escalar insider
                </summary>
                <div className="pt-3">
                  <EscalaInsiderPicker
                    insiders={insiders}
                    jaEscalados={escala.insiders.map((i) => i.insider_id)}
                    onSelecionar={(insider) =>
                      setRascunho({
                        insider,
                        status: 'corre',
                        pelotao: '',
                        motivo: '',
                        atividadeIds: [],
                      })
                    }
                  />
                </div>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  )
}
