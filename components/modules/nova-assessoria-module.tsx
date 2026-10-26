'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock, Download, Globe, Megaphone, MousePointerClick, RefreshCw, Shuffle, Smartphone, Users } from 'lucide-react'

import { apiFetch } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { ErrorBanner } from '@/components/ui/error-banner'
import {
  EmptyState,
  MobileRecordCard,
  NoResultsState,
  PageHeader,
  PageShell,
  Panel,
  PanelHeader,
  ResponsiveModal,
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
  TablePagination,
} from '@/components/somma'
import {
  contatosEmCsv,
  formatarDataHora,
  nomeDaPagina,
  nomeDoProfessor,
  origemDe,
  resumir,
  type EventoBora,
  type Linha,
  type Periodo,
  type Rodizio,
} from '@/lib/nova-assessoria/resumo'

// Contatos da BORA vindos do site.
//
// Em sommaclub.com.br/assessoria a pessoa deixa nome e WhatsApp e cai no
// WhatsApp do professor da vez (rodízio JôJô → Alexandre → Mateus → Brito).
// No link de um professor, cai sempre nele. O site grava cada visita e cada
// contato com a origem (UTM, click id, referrer), o aparelho e a cidade; aqui
// isso vira os números do período e a lista de quem pediu contato.

const OPCOES_PERIODO: Array<{ value: Periodo; label: string }> = [
  { value: 'hoje', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'tudo', label: 'Tudo' },
]

const POR_PAGINA = 25

function percentual(parte: number, todo: number): string {
  if (!todo) return '-'
  return `${Math.round((parte / todo) * 100)}%`
}

function linkWhatsapp(numero: string): string {
  return `https://wa.me/${numero.replace(/\D/g, '')}`
}

function formatarWhatsapp(numero: string | null): string {
  if (!numero) return '-'
  const d = numero.replace(/^55/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return numero
}

function comoChegou(e: EventoBora): { rotulo: string; tone: 'brand' | 'info' | 'neutral' } {
  if (e.repetido) return { rotulo: 'Repetido', tone: 'neutral' }
  if (e.pagina === 'assessoria') return { rotulo: `Rodízio #${e.rodizio_posicao ?? '?'}`, tone: 'brand' }
  return { rotulo: 'Link do professor', tone: 'info' }
}

/** Lista com barra proporcional. Série única: uma cor só, número sempre escrito. */
function Barras({
  linhas,
  medida,
  vazio,
  limite = 8,
}: {
  linhas: Array<{ chave: string; rotulo: string; valor: number; detalhe?: string }>
  medida: string
  vazio: string
  limite?: number
}) {
  const visiveis = linhas.filter((l) => l.valor > 0).slice(0, limite)
  if (!visiveis.length) return <p className="p-4 text-sm text-ink-muted">{vazio}</p>
  const maximo = Math.max(...visiveis.map((l) => l.valor))
  return (
    <ul className="space-y-3 p-4">
      {visiveis.map((l) => (
        <li key={l.chave} title={`${l.rotulo}: ${l.valor} ${medida}${l.detalhe ? ` · ${l.detalhe}` : ''}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink">{l.rotulo}</span>
            <span className="shrink-0 font-mono tabular-nums text-ink">
              {l.valor}
              {l.detalhe ? <span className="ml-2 text-xs text-ink-muted">{l.detalhe}</span> : null}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-surface-sunken">
            <div className="h-1.5 rounded-full bg-brand" style={{ width: `${Math.max(2, (l.valor / maximo) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function porContatos(linhas: Linha[]) {
  return linhas.map((l) => ({
    chave: l.chave,
    rotulo: l.rotulo,
    valor: l.contatos,
    detalhe: `${l.visitas} ${l.visitas === 1 ? 'visita' : 'visitas'}`,
  }))
}

function Detalhe({ evento }: { evento: EventoBora }) {
  const campos: Array<[string, React.ReactNode]> = [
    ['Data e hora', formatarDataHora(evento.criado_em)],
    ['Nome', evento.nome ?? '-'],
    [
      'WhatsApp',
      evento.whatsapp ? (
        <a href={linkWhatsapp(evento.whatsapp)} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
          {formatarWhatsapp(evento.whatsapp)}
        </a>
      ) : (
        '-'
      ),
    ],
    ['Professor', nomeDoProfessor(evento.professor)],
    ['Como chegou ao professor', comoChegou(evento).rotulo],
    ['Página', nomeDaPagina(evento.pagina)],
    ['Origem', origemDe(evento)],
    ['utm_source', evento.utm_source ?? '-'],
    ['utm_medium', evento.utm_medium ?? '-'],
    ['utm_campaign', evento.utm_campaign ?? '-'],
    ['utm_term', evento.utm_term ?? '-'],
    ['utm_content', evento.utm_content ?? '-'],
    ['Click ids', evento.click_ids ? JSON.stringify(evento.click_ids) : '-'],
    ['Referrer', evento.referrer ?? '-'],
    ['URL', evento.url ?? '-'],
    ['Primeiro toque', evento.primeiro_toque ? JSON.stringify(evento.primeiro_toque, null, 1) : '-'],
    ['Aparelho', [evento.dispositivo, evento.sistema, evento.navegador].filter(Boolean).join(' · ') || '-'],
    ['Tela', evento.tela ?? '-'],
    ['Idioma e fuso', [evento.idioma, evento.fuso].filter(Boolean).join(' · ') || '-'],
    ['Local', [evento.cidade, evento.regiao, evento.pais].filter(Boolean).join(', ') || '-'],
    ['IP', evento.ip ?? '-'],
    ['Visitante', evento.visitante_id ?? '-'],
    ['Sessão', evento.sessao_id ?? '-'],
    ['User agent', evento.user_agent ?? '-'],
  ]
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[180px_minmax(0,1fr)]">
      {campos.map(([rotulo, valor]) => (
        <div key={rotulo} className="contents">
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted sm:pt-0.5">{rotulo}</dt>
          <dd className="break-words text-sm text-ink [overflow-wrap:anywhere] whitespace-pre-wrap">{valor}</dd>
        </div>
      ))}
    </dl>
  )
}

export function NovaAssessoriaModule() {
  const [periodo, setPeriodo] = useState<Periodo>('30d')
  const [eventos, setEventos] = useState<EventoBora[]>([])
  const [rodizio, setRodizio] = useState<Rodizio | null>(null)
  const [truncado, setTruncado] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)
  const [aberto, setAberto] = useState<EventoBora | null>(null)

  const carregar = useCallback(async (p: Periodo) => {
    setCarregando(true)
    setErro(null)
    try {
      const res = await apiFetch(`/api/nova-assessoria?periodo=${p}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar os dados')
      setEventos(data.eventos ?? [])
      setRodizio(data.rodizio ?? null)
      setTruncado(Boolean(data.truncado))
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar os dados')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregar(periodo)
  }, [carregar, periodo])

  useEffect(() => setPagina(1), [busca, periodo])

  const resumo = useMemo(() => resumir(eventos), [eventos])

  const contatos = useMemo(() => {
    const todos = eventos.filter((e) => e.tipo === 'contato')
    const termo = busca.trim().toLowerCase()
    if (!termo) return todos
    const digitos = termo.replace(/\D/g, '')
    return todos.filter((e) =>
      [e.nome, nomeDoProfessor(e.professor), origemDe(e), e.utm_campaign, e.cidade]
        .some((v) => v?.toLowerCase().includes(termo)) || (digitos.length >= 3 && e.whatsapp?.includes(digitos)),
    )
  }, [eventos, busca])

  const paginaAtual = contatos.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)

  const exportar = () => {
    const csv = contatosEmCsv(contatos)
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nova-assessoria-contatos-${periodo}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const maxHora = Math.max(1, ...resumo.porHora)

  return (
    <PageShell>
      <PageHeader
        eyebrow="Relacionamento"
        title="Nova Assessoria"
        description="Contatos da BORA Assessoria vindos do site: quem pediu, quando, de onde veio e para qual professor foi."
        meta={
          carregando ? null : (
            <span>
              {resumo.contatos} {resumo.contatos === 1 ? 'contato' : 'contatos'} no período
            </span>
          )
        }
        primaryAction={
          <Button onClick={exportar} disabled={carregando || !contatos.length}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        }
        actions={
          <Button variant="outline" onClick={() => void carregar(periodo)} disabled={carregando}>
            <RefreshCw className={`mr-2 h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SegmentedControl label="Período" value={periodo} onChange={setPeriodo} options={OPCOES_PERIODO} />
        {truncado ? (
          <span className="text-xs text-warning">Período grande: mostrando os 20 mil eventos mais recentes.</span>
        ) : null}
      </div>

      {erro ? <ErrorBanner message={erro} onRetry={() => void carregar(periodo)} /> : null}

      <StatGrid className="mb-4">
        <StatTile
          label="Visitas"
          icon={Globe}
          value={resumo.visitas}
          hint={`${resumo.visitantes} ${resumo.visitantes === 1 ? 'pessoa' : 'pessoas'} diferentes`}
          loading={carregando}
        />
        <StatTile
          label="Contatos"
          icon={MousePointerClick}
          value={resumo.contatos}
          hint={`${resumo.pessoas} WhatsApp diferentes`}
          loading={carregando}
        />
        <StatTile
          label="Conversão"
          icon={Users}
          value={resumo.conversao === null ? '-' : `${(resumo.conversao * 100).toFixed(1)}%`}
          hint="Pessoas que pediram contato ÷ pessoas que visitaram"
          loading={carregando}
        />
        <StatTile
          label="Próximo do rodízio"
          icon={Shuffle}
          tone="brand"
          value={rodizio?.proximo ? nomeDoProfessor(rodizio.proximo) : '-'}
          hint={
            rodizio
              ? `${rodizio.posicao} ${rodizio.posicao === 1 ? 'pessoa distribuída' : 'pessoas distribuídas'} desde o início`
              : undefined
          }
          loading={carregando}
        />
      </StatGrid>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            icon={Shuffle}
            title="Por professor"
            description={
              rodizio?.ordem.length
                ? `Fila: ${rodizio.ordem.map((s) => nomeDoProfessor(s)).join(' → ')}`
                : 'Contatos que cada professor recebeu no período'
            }
          />
          <Barras
            medida="contatos"
            vazio="Nenhum contato no período."
            linhas={resumo.porProfessor.map((p) => ({
              chave: p.slug,
              rotulo: p.nome,
              valor: p.total,
              detalhe: `${p.rodizio} rodízio · ${p.link} link${p.repetidos ? ` · ${p.repetidos} repetidos` : ''}`,
            }))}
          />
        </Panel>

        <Panel>
          <PanelHeader icon={Globe} title="Origem" description="Contatos por origem, com as visitas da mesma origem ao lado" />
          <Barras medida="contatos" vazio="Nenhum evento no período." linhas={porContatos(resumo.porOrigem)} />
        </Panel>

        <Panel>
          <PanelHeader icon={Megaphone} title="Campanhas" description="Pelo utm_campaign do link" />
          <Barras medida="contatos" vazio="Nenhum evento no período." linhas={porContatos(resumo.porCampanha)} />
        </Panel>

        <Panel>
          <PanelHeader icon={Smartphone} title="Páginas e aparelhos" description="Onde o contato aconteceu e em qual aparelho" />
          <Barras medida="contatos" vazio="Nenhum evento no período." linhas={porContatos(resumo.porPagina)} limite={6} />
          <div className="border-t border-line-soft">
            <Barras medida="contatos" vazio="Nenhum evento no período." linhas={porContatos(resumo.porAparelho)} limite={6} />
          </div>
        </Panel>
      </div>

      <Panel className="mb-4">
        <PanelHeader icon={Clock} title="Horário dos contatos" description="Contatos por hora do dia, no horário de Brasília" />
        <div className="p-4">
          <div className="flex h-28 items-end gap-[2px]">
            {resumo.porHora.map((n, hora) => (
              <div
                key={hora}
                title={`${String(hora).padStart(2, '0')}h: ${n} ${n === 1 ? 'contato' : 'contatos'}`}
                className="group flex h-full flex-1 items-end"
              >
                <div
                  className="w-full rounded-t-[4px] bg-brand transition-opacity group-hover:opacity-80"
                  style={{ height: n ? `${Math.max(4, (n / maxHora) * 100)}%` : '2px', opacity: n ? 1 : 0.25 }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-[10px] text-ink-muted">
            <span>00h</span>
            <span>06h</span>
            <span>12h</span>
            <span>18h</span>
            <span>23h</span>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          icon={MousePointerClick}
          title="Quem pediu contato"
          description="Toque numa linha para ver tudo o que foi registrado"
          actions={
            <SearchInput
              value={busca}
              onValueChange={setBusca}
              label="Buscar contato"
              placeholder="Nome, WhatsApp, professor, origem…"
              placeholderShort="Buscar"
            />
          }
        />

        {carregando ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded border border-line bg-surface-sunken" />
            ))}
          </div>
        ) : resumo.contatos === 0 ? (
          <EmptyState
            icon={MousePointerClick}
            title="Nenhum contato no período"
            description="Os contatos aparecem aqui assim que alguém deixa nome e WhatsApp em sommaclub.com.br/assessoria ou no link de um professor."
          />
        ) : contatos.length === 0 ? (
          <NoResultsState query={busca} onClear={() => setBusca('')} />
        ) : (
          <div className="p-4 pt-0">
            <div className="hidden md:block">
              <TableFrame>
                <Table caption="Contatos da BORA no período">
                  <THead>
                    <TH>Data e hora</TH>
                    <TH>Nome</TH>
                    <TH>WhatsApp</TH>
                    <TH>Professor</TH>
                    <TH>Origem</TH>
                    <TH>Campanha</TH>
                    <TH>Aparelho</TH>
                    <TH>Cidade</TH>
                  </THead>
                  <TBody>
                    {paginaAtual.map((e) => {
                      const chegada = comoChegou(e)
                      return (
                        <TR key={e.id} onClick={() => setAberto(e)}>
                          <TD className="whitespace-nowrap font-mono text-xs tabular-nums">{formatarDataHora(e.criado_em)}</TD>
                          <TD className="font-medium">{e.nome ?? '-'}</TD>
                          <TD className="whitespace-nowrap">{formatarWhatsapp(e.whatsapp)}</TD>
                          <TD>
                            <div className="flex flex-col gap-1">
                              <span>{nomeDoProfessor(e.professor)}</span>
                              <StatusPill tone={chegada.tone} className="w-fit">
                                {chegada.rotulo}
                              </StatusPill>
                            </div>
                          </TD>
                          <TD>{origemDe(e)}</TD>
                          <TD>{e.utm_campaign ?? '-'}</TD>
                          <TD className="whitespace-nowrap">
                            {[e.dispositivo, e.navegador].filter(Boolean).join(' · ') || '-'}
                          </TD>
                          <TD>{e.cidade ?? '-'}</TD>
                        </TR>
                      )
                    })}
                  </TBody>
                </Table>
              </TableFrame>
            </div>

            <div className="space-y-2 md:hidden">
              {paginaAtual.map((e) => {
                const chegada = comoChegou(e)
                return (
                  <MobileRecordCard
                    key={e.id}
                    onClick={() => setAberto(e)}
                    title={e.nome ?? '-'}
                    subtitle={formatarDataHora(e.criado_em)}
                    status={<StatusPill tone={chegada.tone}>{chegada.rotulo}</StatusPill>}
                    fields={[
                      { label: 'Professor', value: nomeDoProfessor(e.professor) },
                      { label: 'WhatsApp', value: formatarWhatsapp(e.whatsapp) },
                      { label: 'Origem', value: origemDe(e) },
                      { label: 'Campanha', value: e.utm_campaign ?? '-' },
                    ]}
                  />
                )
              })}
            </div>

            <TablePagination page={pagina} pageSize={POR_PAGINA} total={contatos.length} onPageChange={setPagina} className="mt-3" />
          </div>
        )}
      </Panel>

      <ResponsiveModal
        open={aberto !== null}
        onOpenChange={(open) => {
          if (!open) setAberto(null)
        }}
        title={aberto?.nome ?? 'Contato'}
        description={aberto ? `${nomeDoProfessor(aberto.professor)} · ${formatarDataHora(aberto.criado_em)}` : undefined}
        size="lg"
      >
        {aberto ? <Detalhe evento={aberto} /> : null}
      </ResponsiveModal>
    </PageShell>
  )
}
