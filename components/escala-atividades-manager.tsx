'use client'

import { useCallback, useEffect, useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import { ErrorBanner } from '@/components/ui/error-banner'
import { PageLoading } from '@/components/ui/page-loading'
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
    await apiFetch(`/api/escala/atividades/${atividade.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !atividade.ativo }),
    })
    await carregar()
  }

  const remover = async (id: string) => {
    const res = await apiFetch(`/api/escala/atividades/${id}`, { method: 'DELETE' })
    const body = await res.json()
    if (body.resultado === 'inativada') {
      setErro('A atividade já foi usada na escala, então foi apenas inativada.')
    }
    await carregar()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end md:items-center md:justify-center" onClick={onFechar}>
      <div
        className="w-full md:max-w-lg max-h-[90vh] overflow-auto bg-neutral-900 border border-neutral-700 rounded-t-2xl md:rounded-2xl p-4 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold">Atividades</h2>
          <button onClick={onFechar} className="p-1 text-neutral-400 hover:text-white" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        {erro && <ErrorBanner message={erro} />}

        <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-3 space-y-2">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome da atividade (ex.: Montagem)"
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-500"
          />
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descrição (opcional)"
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-500"
          />
          <div className="flex items-center gap-2">
            {ATIVIDADE_CORES.map((c) => (
              <button
                key={c}
                onClick={() => setCor(c)}
                aria-label={`Cor ${c}`}
                className={`w-6 h-6 rounded-full border-2 transition-all ${
                  cor === c ? 'border-white scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button
            onClick={criar}
            disabled={salvando || !nome.trim()}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {salvando ? 'Criando...' : 'Criar atividade'}
          </button>
        </div>

        {loading ? (
          <PageLoading label="Carregando atividades..." />
        ) : (
          <div className="space-y-1.5">
            {atividades.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-2 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: a.cor }} />
                  <div className="min-w-0">
                    <p className={`text-sm truncate ${a.ativo ? 'text-white' : 'text-neutral-500 line-through'}`}>
                      {a.nome}
                    </p>
                    {a.descricao && <p className="text-xs text-neutral-500 truncate">{a.descricao}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => alternarAtivo(a)}
                    className="text-xs text-neutral-400 hover:text-white px-2 py-1"
                  >
                    {a.ativo ? 'Inativar' : 'Reativar'}
                  </button>
                  <button
                    onClick={() => remover(a.id)}
                    className="p-1.5 text-neutral-500 hover:text-red-400"
                    aria-label={`Remover ${a.nome}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {atividades.length === 0 && (
              <p className="text-sm text-neutral-500">Nenhuma atividade cadastrada ainda.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
