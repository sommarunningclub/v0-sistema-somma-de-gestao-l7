'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Copy, ExternalLink, Link2, MessageCircle, Send, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorBanner } from '@/components/ui/error-banner'
import {
  EmptyState,
  MobileRecordCard,
  NoResultsState,
  Panel,
  PanelHeader,
  SearchInput,
  SegmentedControl,
  StatGrid,
  StatTile,
  StatusPill,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableFrame,
  TableSkeleton,
  Toolbar,
  notify,
} from '@/components/somma'
import { apiFetch } from '@/lib/api-client'
import { estadoDaRodada } from '@/lib/nps/estado'
import { CANAIS, comOrigem, linkDaRodada, linkPessoal, linkWhatsapp, mensagemConvite, slugDeOrigem } from '@/lib/nps/links'
import { formatarDataHora, rotuloDaReferencia } from '@/lib/nps/periodo'
import type { ConviteNps, Rodada } from '@/lib/nps/tipos'

type FiltroConvite = 'sem_resposta' | 'responderam' | 'todos'

function situacaoDoConvite(c: ConviteNps): { rotulo: string; tone: 'success' | 'info' | 'neutral' } {
  if (c.respondido) return { rotulo: 'Respondeu', tone: 'success' }
  if (c.opened_at) return { rotulo: 'Abriu, não respondeu', tone: 'info' }
  if (c.shared_at) return { rotulo: 'Enviado', tone: 'neutral' }
  return { rotulo: 'Não enviado', tone: 'neutral' }
}

async function copiar(texto: string, mensagem: string) {
  try {
    await navigator.clipboard.writeText(texto)
    notify.success(mensagem)
    return true
  } catch {
    notify.error('Não foi possível copiar', { description: texto })
    return false
  }
}

function normalizar(texto: string | null | undefined): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

function LinhaDeLink({ titulo, descricao, url }: { titulo: string; descricao?: string; url: string }) {
  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-strong">{titulo}</p>
        {descricao ? <p className="text-meta text-ink-muted">{descricao}</p> : null}
        <p className="mt-1 break-all font-mono text-[0.75rem] text-ink">{url}</p>
      </div>
      <Button variant="outline" size="sm" className="shrink-0" onClick={() => void copiar(url, `Link de ${titulo} copiado`)}>
        <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
        Copiar
      </Button>
    </li>
  )
}

/**
 * Onde a rodada chega aos alunos. Três camadas de link: o da rodada, um por
 * canal (para saber de onde vieram as respostas) e um pessoal por aluno (para
 * saber quem respondeu e cobrar quem não respondeu).
 */
export function NpsDivulgacao({ rodada }: { rodada: Rodada }) {
  const estado = estadoDaRodada(rodada)
  const rotulo = rotuloDaReferencia(rodada.reference_period)
  const link = linkDaRodada(rodada.slug)

  const [canalLivre, setCanalLivre] = useState('')
  const [convites, setConvites] = useState<ConviteNps[] | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [gerando, setGerando] = useState(false)
  const [filtro, setFiltro] = useState<FiltroConvite>('sem_resposta')
  const [busca, setBusca] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const res = await apiFetch(`/api/nps/rodadas/${rodada.id}/convites`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Não foi possível carregar os links pessoais.')
      setConvites(data.convites)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível carregar os links pessoais.')
    } finally {
      setCarregando(false)
    }
  }, [rodada.id])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function gerar() {
    setGerando(true)
    try {
      const res = await apiFetch(`/api/nps/rodadas/${rodada.id}/convites`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Não foi possível gerar os links.')
      notify.success(
        data.criados === 0 ? 'Todos os alunos ativos já têm link' : `${data.criados} ${data.criados === 1 ? 'link criado' : 'links criados'}`,
        { description: `${data.total} alunos com link pessoal nesta rodada.` },
      )
      await carregar()
    } catch (err) {
      notify.error('Não foi possível gerar os links', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setGerando(false)
    }
  }

  function marcarCompartilhado(c: ConviteNps) {
    if (c.shared_at) return
    const agora = new Date().toISOString()
    setConvites((lista) => lista?.map((x) => (x.id === c.id ? { ...x, shared_at: agora } : x)) ?? null)
    void apiFetch(`/api/nps/convites/${c.id}/compartilhado`, { method: 'POST' }).catch(() => undefined)
  }

  async function copiarConvite(c: ConviteNps) {
    if (await copiar(linkPessoal(c.token), `Link de ${c.first_name} copiado`)) marcarCompartilhado(c)
  }

  function enviarWhatsapp(c: ConviteNps) {
    const url = linkWhatsapp(c.telefone, mensagemConvite(c.first_name, linkPessoal(c.token), rotulo))
    if (!url) return
    // Abre antes de qualquer await: depois dele o navegador trata como pop-up.
    window.open(url, '_blank', 'noopener,noreferrer')
    marcarCompartilhado(c)
  }

  const resumo = useMemo(() => {
    const lista = convites ?? []
    return {
      total: lista.length,
      enviados: lista.filter((c) => c.shared_at || c.opened_at || c.respondido).length,
      abriram: lista.filter((c) => c.opened_at || c.respondido).length,
      responderam: lista.filter((c) => c.respondido).length,
      semCelular: lista.filter((c) => !c.telefone).length,
    }
  }, [convites])

  const porProfessor = useMemo(() => {
    const mapa = new Map<string, { total: number; responderam: number }>()
    for (const c of convites ?? []) {
      const chave = c.professor_name ?? 'Sem professor'
      const atual = mapa.get(chave) ?? { total: 0, responderam: 0 }
      mapa.set(chave, { total: atual.total + 1, responderam: atual.responderam + (c.respondido ? 1 : 0) })
    }
    return Array.from(mapa, ([professor, v]) => ({ professor, ...v })).sort((a, b) => b.total - a.total)
  }, [convites])

  const visiveis = useMemo(() => {
    const termo = normalizar(busca.trim())
    return (convites ?? [])
      .filter((c) => (filtro === 'todos' ? true : filtro === 'responderam' ? c.respondido : !c.respondido))
      .filter(
        (c) =>
          !termo ||
          normalizar(`${c.first_name} ${c.last_name}`).includes(termo) ||
          normalizar(c.professor_name).includes(termo),
      )
  }, [convites, filtro, busca])

  const aviso =
    estado === 'rascunho'
      ? 'A rodada está em rascunho: os links ainda não abrem a pesquisa. Publique quando estiver pronta.'
      : estado === 'agendada'
        ? `Até ${formatarDataHora(rodada.opens_at)} os links mostram que a pesquisa ainda não abriu.`
        : estado === 'encerrada'
          ? 'A rodada está encerrada: os links mostram que a pesquisa acabou.'
          : null

  const origemLivre = slugDeOrigem(canalLivre)

  return (
    <div className="space-y-5">
      {aviso ? (
        <p role="status" className="rounded-md border border-warning-border bg-warning-soft px-4 py-3 text-sm text-ink">
          {aviso}
        </p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel>
          <PanelHeader
            icon={Link2}
            title="Link da rodada"
            description="Para grupos e Instagram. Quem abre responde com o próprio nome."
          />
          <div className="space-y-3 p-4 sm:p-5">
            <p className="break-all rounded border border-line bg-surface-sunken px-3 py-2.5 font-mono text-sm text-ink-strong">{link}</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void copiar(link, 'Link da rodada copiado')}>
                <Copy className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Copiar link
              </Button>
              <Button variant="outline" asChild>
                <a href={link} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Abrir pesquisa
                </a>
              </Button>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            icon={Send}
            title="Links por canal"
            description="O mesmo link marcado com a origem. O relatório mostra por onde as respostas chegaram."
          />
          <div className="p-4 sm:p-5">
            <ul className="divide-y divide-line">
              {CANAIS.map((canal) => (
                <LinhaDeLink key={canal.id} titulo={canal.rotulo} descricao={canal.descricao} url={comOrigem(link, canal.id)} />
              ))}
            </ul>
            <div className="mt-4 border-t border-line pt-4">
              <Label htmlFor="nps-canal-livre">Outro canal</Label>
              <Input
                id="nps-canal-livre"
                className="mt-1.5"
                placeholder="Ex.: parceiro Evolve, cartaz na loja"
                value={canalLivre}
                maxLength={60}
                onChange={(e) => setCanalLivre(e.target.value)}
              />
              {origemLivre ? (
                <ul className="mt-3">
                  <LinhaDeLink titulo={canalLivre.trim()} url={comOrigem(link, origemLivre)} />
                </ul>
              ) : null}
            </div>
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          icon={UserCheck}
          title="Links pessoais"
          description="Um link por aluno ativo. Preenche o nome, vincula ao professor e mostra quem ainda não respondeu."
          actions={
            estado !== 'encerrada' ? (
              <Button size="sm" onClick={() => void gerar()} disabled={gerando}>
                {gerando ? 'Gerando…' : resumo.total > 0 ? 'Gerar os que faltam' : 'Gerar links'}
              </Button>
            ) : null
          }
        />
        <div className="space-y-4 p-4 sm:p-5">
          {erro ? <ErrorBanner message={erro} onRetry={() => void carregar()} /> : null}

          {carregando && !convites ? (
            <TableSkeleton />
          ) : !convites || convites.length === 0 ? (
            <EmptyState
              compact
              icon={UserCheck}
              title="Nenhum link pessoal nesta rodada"
              description="Gere um link para cada aluno ativo da gestão. Rodar de novo cria só os que faltam."
            />
          ) : (
            <>
              <StatGrid>
                <StatTile label="Links" value={resumo.total} hint={resumo.semCelular ? `${resumo.semCelular} sem celular cadastrado` : 'Todos com celular'} />
                <StatTile label="Enviados" value={resumo.enviados} hint={`${Math.round((100 * resumo.enviados) / resumo.total)}% dos links`} />
                <StatTile label="Abriram" value={resumo.abriram} />
                <StatTile
                  label="Responderam"
                  tone="brand"
                  value={resumo.responderam}
                  hint={`${Math.round((100 * resumo.responderam) / resumo.total)}% dos alunos com link`}
                />
              </StatGrid>

              <ul className="flex flex-wrap gap-2" aria-label="Respostas por professor">
                {porProfessor.map((p) => (
                  <li key={p.professor} className="rounded-sm border border-line bg-surface-sunken px-2 py-1 text-meta text-ink">
                    {p.professor}{' '}
                    <span className="font-mono tabular-nums text-ink-muted">
                      {p.responderam}/{p.total}
                    </span>
                  </li>
                ))}
              </ul>

              <Toolbar>
                <SearchInput value={busca} onValueChange={setBusca} placeholder="Buscar aluno ou professor" />
                <SegmentedControl<FiltroConvite>
                  label="Filtrar links pessoais"
                  value={filtro}
                  onChange={setFiltro}
                  options={[
                    { value: 'sem_resposta', label: `Sem resposta (${resumo.total - resumo.responderam})`, shortLabel: 'Pendentes' },
                    { value: 'responderam', label: `Responderam (${resumo.responderam})`, shortLabel: 'Responderam' },
                    { value: 'todos', label: `Todos (${resumo.total})`, shortLabel: 'Todos' },
                  ]}
                />
              </Toolbar>

              {visiveis.length === 0 ? (
                busca ? (
                  <NoResultsState query={busca} onClear={() => setBusca('')} />
                ) : (
                  <p className="text-meta text-ink-muted">Nenhum aluno neste filtro.</p>
                )
              ) : (
                <>
                  <div className="hidden lg:block">
                    <TableFrame>
                      <Table caption="Links pessoais da rodada">
                        <THead>
                          <TH>Aluno</TH>
                          <TH>Professor</TH>
                          <TH>Situação</TH>
                          <TH align="right">Enviar</TH>
                        </THead>
                        <TBody>
                          {visiveis.map((c) => {
                            const s = situacaoDoConvite(c)
                            return (
                              <TR key={c.id}>
                                <TD>
                                  <span className="font-medium text-ink-strong">
                                    {c.first_name} {c.last_name}
                                  </span>
                                </TD>
                                <TD>
                                  <span className="text-ink">{c.professor_name ?? '-'}</span>
                                </TD>
                                <TD>
                                  <StatusPill tone={s.tone}>{s.rotulo}</StatusPill>
                                </TD>
                                <TD align="right">
                                  <span className="inline-flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => void copiarConvite(c)}>
                                      <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                                      Copiar
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => enviarWhatsapp(c)}
                                      disabled={!c.telefone}
                                      title={c.telefone ? undefined : 'Sem celular cadastrado na gestão'}
                                    >
                                      <MessageCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                                      WhatsApp
                                    </Button>
                                  </span>
                                </TD>
                              </TR>
                            )
                          })}
                        </TBody>
                      </Table>
                    </TableFrame>
                  </div>

                  <div className="space-y-3 lg:hidden">
                    {visiveis.map((c) => {
                      const s = situacaoDoConvite(c)
                      return (
                        <MobileRecordCard
                          key={c.id}
                          title={`${c.first_name} ${c.last_name}`}
                          subtitle={c.professor_name ?? 'Sem professor'}
                          status={<StatusPill tone={s.tone}>{s.rotulo}</StatusPill>}
                          actions={
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" className="flex-1" onClick={() => void copiarConvite(c)}>
                                <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                                Copiar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => enviarWhatsapp(c)}
                                disabled={!c.telefone}
                              >
                                <MessageCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                                WhatsApp
                              </Button>
                            </div>
                          }
                        />
                      )
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </Panel>
    </div>
  )
}
