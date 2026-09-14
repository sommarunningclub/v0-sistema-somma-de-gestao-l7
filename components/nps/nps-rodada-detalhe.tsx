'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Copy, ExternalLink, Pencil, RefreshCw } from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { ErrorBanner } from '@/components/ui/error-banner'
import {
  PageHeader,
  PageShell,
  SegmentedControl,
  StatGridSkeleton,
  StatusPill,
  TableSkeleton,
  confirmAction,
  notify,
} from '@/components/somma'
import { cn } from '@/lib/utils'
import { ESTADOS, estadoDaRodada } from '@/lib/nps/estado'
import { linkDaRodada } from '@/lib/nps/links'
import { FUSO_BRASILIA, formatarDataHora, rotuloDaReferencia } from '@/lib/nps/periodo'
import type { Relatorio } from '@/lib/nps/relatorio'
import type { RespostaResumida, Rodada } from '@/lib/nps/tipos'
import { NpsResultados } from './nps-resultados'
import { NpsRespostas } from './nps-respostas'
import { NpsTratativas } from './nps-tratativas'
import { NpsDivulgacao } from './nps-divulgacao'
import { NpsQuestionario } from './nps-questionario'
import { NpsRespostaModal, type ModoFicha } from './nps-resposta-modal'
import { NpsRodadaForm } from './nps-rodada-form'

export const ABAS_RODADA = ['resultados', 'respostas', 'tratativas', 'divulgacao', 'questionario'] as const
export type AbaRodada = (typeof ABAS_RODADA)[number]

export interface DadosRodada {
  rodada: Rodada
  relatorio: Relatorio
  respostas: RespostaResumida[]
  anterior: { id: string; slug: string; reference_period: string } | null
  alunos_ativos: number
}

/** Sete dias a partir de hoje, fechando às 23h59 de Brasília. */
function fechamentoEmSeteDias(): string {
  const local = new Date(Date.now() - 3 * 3600_000 + 7 * 86400_000)
  const dia = local.toISOString().slice(0, 10)
  return new Date(`${dia}T23:59:00${FUSO_BRASILIA}`).toISOString()
}

export function NpsRodadaDetalhe({
  id,
  aba,
  onAba,
  onVoltar,
}: {
  id: string
  aba: AbaRodada
  onAba: (aba: AbaRodada) => void
  onVoltar: () => void
}) {
  const [dados, setDados] = useState<DadosRodada | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  const [agindo, setAgindo] = useState(false)
  const [respostaAberta, setRespostaAberta] = useState<{ id: string; modo: ModoFicha } | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const res = await apiFetch(`/api/nps/rodadas/${id}/relatorio`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Não foi possível carregar a rodada.')
      setDados(data)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível carregar a rodada.')
    } finally {
      setCarregando(false)
    }
  }, [id])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const abrirResposta = useCallback((respostaId: string) => setRespostaAberta({ id: respostaId, modo: 'ver' }), [])
  const editarResposta = useCallback((respostaId: string) => setRespostaAberta({ id: respostaId, modo: 'editar' }), [])

  const rodada = dados?.rodada
  const estado = rodada ? estadoDaRodada(rodada) : null
  const link = rodada ? linkDaRodada(rodada.slug) : ''
  const rotulo = rodada ? rotuloDaReferencia(rodada.reference_period) : ''

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(link)
      notify.success('Link copiado', { description: link })
    } catch {
      notify.error('Não foi possível copiar')
    }
  }

  /** Apagar tira a resposta da lista, do NPS e das tratativas. Pede confirmação. */
  async function apagarResposta(respostaId: string, nome: string) {
    const ok = await confirmAction({
      title: 'Apagar esta resposta?',
      description:
        'Ela sai da lista, do NPS e do relatório desta rodada, junto com a tratativa e o histórico. Não dá para desfazer.',
      detail: nome,
      confirmLabel: 'Apagar resposta',
      tone: 'danger',
    })
    if (!ok) return

    try {
      const res = await apiFetch(`/api/nps/respostas/${respostaId}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Não foi possível apagar a resposta.')
      setRespostaAberta((atual) => (atual?.id === respostaId ? null : atual))
      notify.success('Resposta apagada', { description: nome })
      await carregar()
    } catch (err) {
      notify.error('Não foi possível apagar', { description: err instanceof Error ? err.message : undefined })
    }
  }

  async function executar(acao: 'publicar' | 'encerrar' | 'reabrir' | 'voltar_rascunho') {
    if (!rodada) return
    const textos = {
      publicar: {
        title: 'Publicar a rodada?',
        description: `O link passa a aceitar respostas a partir de ${formatarDataHora(rodada.opens_at)}.`,
        confirmLabel: 'Publicar',
      },
      encerrar: {
        title: 'Encerrar a rodada agora?',
        description: 'Ninguém mais consegue enviar resposta por este link. As respostas recebidas continuam no relatório.',
        confirmLabel: 'Encerrar',
      },
      reabrir: {
        title: 'Reabrir por 7 dias?',
        description: 'O link volta a aceitar respostas e fecha às 23h59 do sétimo dia.',
        confirmLabel: 'Reabrir',
      },
      voltar_rascunho: {
        title: 'Voltar para rascunho?',
        description: 'O link deixa de abrir. Só é possível enquanto a rodada não tem respostas.',
        confirmLabel: 'Voltar para rascunho',
      },
    }[acao]

    const ok = await confirmAction({ ...textos, detail: rodada.title, tone: acao === 'encerrar' ? 'danger' : undefined })
    if (!ok) return

    setAgindo(true)
    try {
      const res = await apiFetch(`/api/nps/rodadas/${rodada.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(acao === 'reabrir' ? { acao, closes_at: fechamentoEmSeteDias() } : { acao }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Não foi possível atualizar a rodada.')
      notify.success('Rodada atualizada')
      await carregar()
    } catch (err) {
      notify.error('Não foi possível atualizar', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setAgindo(false)
    }
  }

  const acaoPrincipal =
    !rodada || !estado ? null : estado === 'rascunho' ? (
      <Button onClick={() => void executar('publicar')} disabled={agindo}>
        Publicar
      </Button>
    ) : estado === 'agendada' ? (
      <Button variant="outline" onClick={() => void executar('voltar_rascunho')} disabled={agindo}>
        Voltar para rascunho
      </Button>
    ) : estado === 'no_ar' ? (
      <Button variant="outline" onClick={() => void executar('encerrar')} disabled={agindo}>
        Encerrar agora
      </Button>
    ) : rodada.status === 'closed' ? (
      <Button variant="outline" onClick={() => void executar('reabrir')} disabled={agindo}>
        Reabrir por 7 dias
      </Button>
    ) : null

  const pendentes = dados?.relatorio.tratativasPendentes ?? 0

  return (
    <PageShell>
      <PageHeader
        eyebrow={
          <button type="button" onClick={onVoltar} className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeft className="h-3 w-3" aria-hidden="true" />
            NPS da Assessoria
          </button>
        }
        title={rodada?.title ?? 'Rodada'}
        description={
          rodada
            ? `${rotulo} · ${rodada.opens_at ? `abre ${formatarDataHora(rodada.opens_at)}` : 'sem abertura'}${rodada.closes_at ? ` · fecha ${formatarDataHora(rodada.closes_at)}` : ''}`
            : undefined
        }
        meta={
          estado ? (
            <span className="flex flex-wrap items-center gap-2">
              <StatusPill tone={ESTADOS[estado].tone}>{ESTADOS[estado].rotulo}</StatusPill>
              <span className="lg:hidden">{rotulo}</span>
            </span>
          ) : null
        }
        primaryAction={acaoPrincipal}
        actions={
          <>
            <Button variant="ghost" size="icon" onClick={onVoltar} aria-label="Voltar para as rodadas" className="lg:hidden">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            {rodada ? (
              <>
                <Button variant="ghost" size="icon" onClick={() => void copiarLink()} aria-label="Copiar link da rodada">
                  <Copy className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button variant="ghost" size="icon" asChild aria-label="Abrir a pesquisa em nova aba">
                  <a href={link} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setEditando(true)} aria-label="Editar rodada">
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
              </>
            ) : null}
            <Button variant="ghost" size="icon" onClick={() => void carregar()} disabled={carregando} aria-label="Atualizar">
              <RefreshCw className={cn('h-4 w-4', carregando && 'animate-spin')} aria-hidden="true" />
            </Button>
          </>
        }
      >
        <div className="-mx-1 overflow-x-auto px-1 pt-1">
          <SegmentedControl<AbaRodada>
            label="Seções da rodada"
            value={aba}
            onChange={onAba}
            options={[
              { value: 'resultados', label: 'Resultados' },
              { value: 'respostas', label: `Respostas${dados ? ` (${dados.respostas.length})` : ''}` , shortLabel: 'Respostas' },
              { value: 'tratativas', label: `Tratativas${pendentes ? ` (${pendentes})` : ''}`, shortLabel: 'Tratativas' },
              { value: 'divulgacao', label: 'Divulgação' },
              { value: 'questionario', label: 'Questionário' },
            ]}
          />
        </div>
      </PageHeader>

      {erro ? (
        <div className="mb-4">
          <ErrorBanner message={erro} onRetry={() => void carregar()} />
        </div>
      ) : null}

      {!dados && carregando ? (
        <div className="space-y-5">
          <StatGridSkeleton />
          <TableSkeleton />
        </div>
      ) : dados ? (
        <div className={cn('transition-opacity', carregando && 'opacity-60')}>
          {aba === 'resultados' ? (
            <NpsResultados dados={dados} onIrPara={onAba} />
          ) : aba === 'respostas' ? (
            <NpsRespostas
              rodada={dados.rodada}
              respostas={dados.respostas}
              onAbrir={abrirResposta}
              onEditar={editarResposta}
              onApagar={(r) => void apagarResposta(r.id, r.full_name)}
            />
          ) : aba === 'tratativas' ? (
            <NpsTratativas respostas={dados.respostas} onAbrir={abrirResposta} />
          ) : aba === 'divulgacao' ? (
            <NpsDivulgacao rodada={dados.rodada} />
          ) : (
            <NpsQuestionario versao={dados.rodada.survey_version} />
          )}
        </div>
      ) : null}

      <NpsRespostaModal
        resposta={respostaAberta}
        onClose={() => setRespostaAberta(null)}
        onAlterada={() => void carregar()}
        onApagar={apagarResposta}
      />

      {rodada ? (
        <NpsRodadaForm
          open={editando}
          onOpenChange={setEditando}
          rodada={rodada}
          onSalva={() => {
            setEditando(false)
            notify.success('Rodada atualizada')
            void carregar()
          }}
        />
      ) : null}
    </PageShell>
  )
}
