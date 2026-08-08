'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import { ErrorBanner } from '@/components/ui/error-banner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  CardListSkeleton,
  EmptyState,
  ResponsiveModal,
  SectionTitle,
  Well,
  confirmAction,
  notify,
} from '@/components/somma'
import { ATIVIDADE_CORES, ATIVIDADE_COR_PADRAO } from '@/lib/escala-constants'
import type { EscalaAtividade } from '@/lib/types/escala'

export function EscalaAtividadesManager({ onFechar }: { onFechar: () => void }) {
  const [atividades, setAtividades] = useState<EscalaAtividade[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [cor, setCor] = useState<string>(ATIVIDADE_COR_PADRAO)
  const [salvando, setSalvando] = useState(false)

  const uid = useId()
  const id = (name: string) => `${uid}-${name}`

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const res = await apiFetch('/api/escala/atividades?incluir_inativas=1')
      if (!res.ok) throw new Error('Não foi possível carregar as atividades')
      setAtividades(await res.json())
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const criar = async () => {
    setSalvando(true)
    setErro(null)
    try {
      const res = await apiFetch('/api/escala/atividades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, descricao, cor }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Erro ao criar atividade')
      notify.success('Atividade criada.', { description: nome })
      setNome('')
      setDescricao('')
      setCor(ATIVIDADE_COR_PADRAO)
      await carregar()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar atividade')
    } finally {
      setSalvando(false)
    }
  }

  const alternarAtivo = async (atividade: EscalaAtividade) => {
    setErro(null)
    try {
      const res = await apiFetch(`/api/escala/atividades/${atividade.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !atividade.ativo }),
      })
      if (!res.ok) {
        setErro('Erro ao atualizar a atividade')
        return
      }
      notify.success(atividade.ativo ? 'Atividade inativada.' : 'Atividade reativada.', {
        description: atividade.nome,
      })
      await carregar()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao atualizar a atividade')
    }
  }

  const remover = async (atividade: EscalaAtividade) => {
    const ok = await confirmAction({
      title: 'Excluir esta atividade?',
      description:
        'Se a atividade já tiver sido usada em alguma escala, ela é apenas inativada em vez de excluída.',
      detail: atividade.nome,
      tone: 'danger',
      confirmLabel: 'Excluir atividade',
    })
    if (!ok) return

    setErro(null)
    const res = await apiFetch(`/api/escala/atividades/${atividade.id}`, { method: 'DELETE' })
    const body = await res.json()
    if (!res.ok) {
      const mensagem = body.error || 'Erro ao remover atividade'
      setErro(mensagem)
      notify.error(mensagem)
      return
    }
    if (body.resultado === 'inativada') {
      notify.info('A atividade já foi usada na escala, então foi apenas inativada.', {
        description: atividade.nome,
      })
    } else {
      notify.success('Atividade excluída.', { description: atividade.nome })
    }
    await carregar()
  }

  return (
    <ResponsiveModal
      open
      onOpenChange={(aberto) => {
        if (!aberto && !salvando) onFechar()
      }}
      dismissible={!salvando}
      size="md"
      title="Atividades"
      description="Etiquetas que descrevem o que cada insider faz no dia — montagem, foto, apoio de percurso."
    >
      <div className="space-y-5">
        {erro ? <ErrorBanner message={erro} /> : null}

        <Well className="space-y-3 p-3">
          <SectionTitle as="h3" title="Nova atividade" className="mb-0" />

          <div>
            <label htmlFor={id('nome')} className="mb-1.5 block text-meta font-medium text-ink-muted">
              Nome *
            </label>
            <Input
              id={id('nome')}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Montagem"
              required
              aria-required="true"
            />
          </div>

          <div>
            <label htmlFor={id('descricao')} className="mb-1.5 block text-meta font-medium text-ink-muted">
              Descrição
            </label>
            <Input
              id={id('descricao')}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <fieldset>
            <legend className="mb-1.5 text-meta font-medium text-ink-muted">Cor</legend>
            <div role="radiogroup" aria-label="Cor da atividade" className="flex flex-wrap items-center gap-1">
              {ATIVIDADE_CORES.map((c) => {
                const selecionada = cor === c
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={selecionada}
                    onClick={() => setCor(c)}
                    aria-label={`Cor ${c}${selecionada ? ' (selecionada)' : ''}`}
                    className="ds-tap flex items-center justify-center rounded-lg transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                  >
                    <span
                      aria-hidden="true"
                      className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-[0.625rem] font-bold text-white ${
                        selecionada ? 'border-ink-strong' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {selecionada ? '✓' : ''}
                    </span>
                  </button>
                )
              })}
            </div>
          </fieldset>

          <Button block onClick={criar} loading={salvando} disabled={!nome.trim()}>
            {salvando ? null : <Plus aria-hidden="true" />}
            Criar atividade
          </Button>
        </Well>

        <section>
          <SectionTitle as="h3" title="Cadastradas" meta={loading ? undefined : `${atividades.length}`} />

          {loading ? (
            <div aria-busy="true">
              <CardListSkeleton count={3} />
            </div>
          ) : atividades.length === 0 ? (
            <EmptyState
              compact
              title="Nenhuma atividade cadastrada"
              description="Crie a primeira acima para poder marcá-la nas escalações do dia."
            />
          ) : (
            <ul className="space-y-1.5">
              {atividades.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-raised px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: a.cor }}
                    />
                    <div className="min-w-0">
                      <p
                        className={`truncate text-sm ${
                          a.ativo ? 'font-medium text-ink-strong' : 'text-ink-subtle line-through'
                        }`}
                      >
                        {a.nome}
                        {a.ativo ? null : <span className="sr-only"> (inativa)</span>}
                      </p>
                      {a.descricao ? (
                        <p className="truncate text-meta text-ink-muted">{a.descricao}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => alternarAtivo(a)}
                      aria-label={`${a.ativo ? 'Inativar' : 'Reativar'} ${a.nome}`}
                    >
                      {a.ativo ? 'Inativar' : 'Reativar'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => remover(a)}
                      aria-label={`Excluir ${a.nome}`}
                      className="hover:bg-danger-soft hover:text-danger"
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </ResponsiveModal>
  )
}
