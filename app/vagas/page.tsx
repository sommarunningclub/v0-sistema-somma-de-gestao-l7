'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardList, Download, Loader2, MessageCircle, RefreshCw } from 'lucide-react'
import {
  EmptyState,
  MobileRecordCard,
  NoResultsState,
  PageHeader,
  PageShell,
  ResponsiveModal,
  SearchInput,
  SegmentedControl,
  StatGrid,
  StatGridSkeleton,
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
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { apiFetch } from '@/lib/api-client'
import { matchesTextSearch } from '@/lib/search-utils'
import {
  ETAPAS,
  type CandidatoVaga,
  type EtapaValue,
  etapaLabel,
  etapaTone,
  mensagemWhatsapp,
  whatsappHref,
} from '@/lib/vagas-constants'

type FiltroEtapa = EtapaValue | 'todas'

function formatarData(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatarNascimento(iso: string | null): string {
  if (!iso) return '—'
  // Coluna `date`: chega como AAAA-MM-DD. Montar via `new Date` puxaria o
  // fuso e podia exibir o dia anterior.
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return '—'
  const idade = calcularIdade(Number(m[1]), Number(m[2]), Number(m[3]))
  return `${m[3]}/${m[2]}/${m[1]}${idade === null ? '' : ` · ${idade} anos`}`
}

function calcularIdade(ano: number, mes: number, dia: number): number | null {
  const hoje = new Date()
  let idade = hoje.getFullYear() - ano
  const aniversarioPassou =
    hoje.getMonth() + 1 > mes || (hoje.getMonth() + 1 === mes && hoje.getDate() >= dia)
  if (!aniversarioPassou) idade -= 1
  return idade >= 0 && idade < 130 ? idade : null
}

function enderecoCompleto(c: CandidatoVaga): string {
  const partes = [
    c.logradouro,
    c.complemento,
    c.bairro,
    [c.cidade, c.estado].filter(Boolean).join(' - '),
  ].filter(Boolean)
  return partes.length > 0 ? partes.join(', ') : '—'
}

export default function VagasPage() {
  const [candidatos, setCandidatos] = useState<CandidatoVaga[]>([])
  const [carregando, setCarregando] = useState(true)
  const [atualizando, setAtualizando] = useState(false)
  const [busca, setBusca] = useState('')
  const [etapa, setEtapa] = useState<FiltroEtapa>('todas')
  const [vagaSlug, setVagaSlug] = useState<string>('todas')
  const [selecionado, setSelecionado] = useState<CandidatoVaga | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [baixando, setBaixando] = useState(false)
  const [observacoes, setObservacoes] = useState('')

  const carregar = useCallback(async (silencioso = false) => {
    if (silencioso) setAtualizando(true)
    else setCarregando(true)
    try {
      const res = await apiFetch('/api/vagas')
      if (!res.ok) throw new Error('Erro ao carregar')
      setCandidatos(await res.json())
    } catch {
      notify.error('Não foi possível carregar os candidatos', {
        description: 'Verifique a conexão e tente novamente.',
      })
    } finally {
      setCarregando(false)
      setAtualizando(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  /** Vagas presentes nos dados — não há tabela de vagas, elas vivem no site. */
  const vagas = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const c of candidatos) mapa.set(c.vaga_slug, c.vaga_titulo)
    return Array.from(mapa, ([slug, titulo]) => ({ slug, titulo }))
  }, [candidatos])

  const filtrados = useMemo(
    () =>
      candidatos
        .filter((c) => etapa === 'todas' || (c.status || 'novo') === etapa)
        .filter((c) => vagaSlug === 'todas' || c.vaga_slug === vagaSlug)
        .filter((c) =>
          matchesTextSearch(busca, [c.nome, c.email, c.instituicao, c.telefone, c.vaga_titulo]),
        ),
    [candidatos, etapa, vagaSlug, busca],
  )

  const contagem = useMemo(() => {
    const base: Record<string, number> = {}
    for (const e of ETAPAS) base[e.value] = 0
    for (const c of candidatos) {
      const s = c.status || 'novo'
      if (s in base) base[s] += 1
    }
    return base
  }, [candidatos])

  function abrir(candidato: CandidatoVaga) {
    setSelecionado(candidato)
    setObservacoes(candidato.observacoes ?? '')
  }

  async function salvar(patch: { status?: EtapaValue; observacoes?: string | null }) {
    if (!selecionado) return
    setSalvando(true)
    try {
      const res = await apiFetch(`/api/vagas/${selecionado.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao salvar')

      setCandidatos((prev) => prev.map((c) => (c.id === data.id ? data : c)))
      setSelecionado(data)
      notify.success('Candidatura atualizada')
    } catch (err) {
      notify.error('Não foi possível salvar', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSalvando(false)
    }
  }

  async function baixarCurriculo(candidato: CandidatoVaga) {
    setBaixando(true)
    try {
      const res = await apiFetch(`/api/vagas/${candidato.id}/curriculo`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao abrir o currículo')
      window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      notify.error('Não foi possível abrir o currículo', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBaixando(false)
    }
  }

  const semCandidatos = !carregando && candidatos.length === 0
  const buscaAtiva = busca.trim().length > 0 || etapa !== 'todas' || vagaSlug !== 'todas'

  return (
    <PageShell>
      <PageHeader
        eyebrow="Gestão"
        title="Vagas"
        description="Candidatos recebidos pelo formulário de Trabalhe Conosco do site."
        meta={
          <span>
            {candidatos.length} {candidatos.length === 1 ? 'candidato' : 'candidatos'}
          </span>
        }
        primaryAction={
          <Button variant="outline" onClick={() => carregar(true)} disabled={atualizando}>
            <RefreshCw className={`mr-2 h-4 w-4 ${atualizando ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        }
      >
        {!semCandidatos && (
          <Toolbar>
            <SearchInput
              value={busca}
              onValueChange={setBusca}
              label="Buscar candidato"
              placeholder="Buscar por nome, e-mail, telefone ou instituição"
              placeholderShort="Buscar candidato"
            />
            <SegmentedControl<FiltroEtapa>
              label="Filtrar por etapa"
              value={etapa}
              onChange={setEtapa}
              options={[
                { value: 'todas', label: 'Todas' },
                ...ETAPAS.map((e) => ({ value: e.value as FiltroEtapa, label: e.label })),
              ]}
            />
            {vagas.length > 1 && (
              <SegmentedControl<string>
                label="Filtrar por vaga"
                value={vagaSlug}
                onChange={setVagaSlug}
                options={[
                  { value: 'todas', label: 'Todas as vagas' },
                  ...vagas.map((v) => ({ value: v.slug, label: v.titulo })),
                ]}
              />
            )}
          </Toolbar>
        )}
      </PageHeader>

      {carregando ? (
        <div className="space-y-4">
          <StatGridSkeleton count={5} />
          <TableSkeleton rows={6} columns={6} />
        </div>
      ) : semCandidatos ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhuma candidatura recebida"
          description="As candidaturas enviadas em sommaclub.com.br/trabalhe-conosco-vagas aparecem aqui automaticamente, com o currículo anexado."
        />
      ) : (
        <div className="space-y-4">
          <StatGrid>
            {ETAPAS.map((e) => (
              <StatTile
                key={e.value}
                label={e.label}
                value={contagem[e.value] ?? 0}
                tone={e.value === 'novo' ? 'brand' : 'default'}
                onClick={() => setEtapa(etapa === e.value ? 'todas' : e.value)}
              />
            ))}
          </StatGrid>

          {filtrados.length === 0 ? (
            <NoResultsState
              query={busca || 'os filtros aplicados'}
              onClear={() => {
                setBusca('')
                setEtapa('todas')
                setVagaSlug('todas')
              }}
            />
          ) : (
            <>
              <div className="hidden lg:block">
                <TableFrame busy={atualizando}>
                  <Table caption="Candidatos das vagas abertas">
                    <THead>
                      <TR>
                        <TH>Candidato</TH>
                        <TH>Vaga</TH>
                        <TH>Formação</TH>
                        <TH>Recebido</TH>
                        <TH>Etapa</TH>
                        <TH align="right">Ações</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {filtrados.map((c) => (
                        <TR key={c.id} onClick={() => abrir(c)}>
                          <TD>
                            <span className="block font-medium text-ink-strong">{c.nome}</span>
                            <span className="block text-meta text-ink-muted">{c.email}</span>
                          </TD>
                          <TD>{c.vaga_titulo}</TD>
                          <TD>
                            <span className="block">{c.instituicao}</span>
                            <span className="block text-meta text-ink-muted">{c.semestre}</span>
                          </TD>
                          <TD>
                            <span className="font-mono tabular-nums">
                              {formatarData(c.criado_em)}
                            </span>
                          </TD>
                          <TD>
                            <StatusPill tone={etapaTone(c.status)}>
                              {etapaLabel(c.status)}
                            </StatusPill>
                          </TD>
                          <TD align="right">
                            <div className="flex items-center justify-end gap-1">
                              {(() => {
                                const zap = whatsappHref(
                                  c.telefone,
                                  mensagemWhatsapp(c.nome, c.vaga_titulo),
                                )
                                if (!zap) return null
                                return (
                                  <Button asChild variant="ghost" size="sm">
                                    <a
                                      href={zap}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      <MessageCircle className="h-4 w-4" />
                                      <span className="sr-only">
                                        Chamar {c.nome} no WhatsApp
                                      </span>
                                    </a>
                                  </Button>
                                )
                              })()}
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={!c.curriculo_path || baixando}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  baixarCurriculo(c)
                                }}
                              >
                                <Download className="h-4 w-4" />
                                <span className="sr-only">Baixar currículo de {c.nome}</span>
                              </Button>
                            </div>
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableFrame>
              </div>

              <div className="space-y-3 lg:hidden">
                {filtrados.map((c) => (
                  <MobileRecordCard
                    key={c.id}
                    title={c.nome}
                    subtitle={c.vaga_titulo}
                    status={
                      <StatusPill tone={etapaTone(c.status)}>{etapaLabel(c.status)}</StatusPill>
                    }
                    fields={[
                      { label: 'Instituição', value: c.instituicao },
                      { label: 'Semestre', value: c.semestre },
                      { label: 'Recebido', value: formatarData(c.criado_em) },
                    ]}
                    actions={(() => {
                      const zap = whatsappHref(
                        c.telefone,
                        mensagemWhatsapp(c.nome, c.vaga_titulo),
                      )
                      if (!zap) return undefined
                      return (
                        <Button asChild variant="outline" size="sm">
                          <a
                            href={zap}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <MessageCircle className="mr-2 h-4 w-4" />
                            WhatsApp
                          </a>
                        </Button>
                      )
                    })()}
                    onClick={() => abrir(c)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <ResponsiveModal
        open={selecionado !== null}
        onOpenChange={(open) => {
          if (!open) setSelecionado(null)
        }}
        title={selecionado?.nome ?? ''}
        description={selecionado?.vaga_titulo}
        size="lg"
      >
        {selecionado && (
          <div className="space-y-6">
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {[
                { label: 'E-mail', value: selecionado.email },
                { label: 'Telefone', value: selecionado.telefone },
                { label: 'Nascimento', value: formatarNascimento(selecionado.data_nascimento) },
                { label: 'Instituição', value: selecionado.instituicao },
                { label: 'Semestre', value: selecionado.semestre },
                { label: 'CEP', value: selecionado.cep || '—' },
                { label: 'Endereço', value: enderecoCompleto(selecionado) },
                { label: 'Recebido em', value: formatarData(selecionado.criado_em) },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="ds-eyebrow text-ink-muted">{item.label}</dt>
                  <dd className="mt-1 text-ink-strong">{item.value}</dd>
                </div>
              ))}
            </dl>

            <div>
              <span className="ds-eyebrow text-ink-muted">Ações</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {(() => {
                  const zap = whatsappHref(
                    selecionado.telefone,
                    mensagemWhatsapp(selecionado.nome, selecionado.vaga_titulo),
                  )
                  return zap ? (
                    <Button asChild variant="outline">
                      <a href={zap} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Chamar no WhatsApp
                      </a>
                    </Button>
                  ) : (
                    <Button variant="outline" disabled title="Telefone inválido para WhatsApp">
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Telefone inválido
                    </Button>
                  )
                })()}

                {selecionado.curriculo_path ? (
                  <Button
                    variant="outline"
                    disabled={baixando}
                    onClick={() => baixarCurriculo(selecionado)}
                  >
                    {baixando ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    {selecionado.curriculo_nome ?? 'Baixar currículo'}
                  </Button>
                ) : (
                  <Button variant="outline" disabled>
                    <Download className="mr-2 h-4 w-4" />
                    Sem currículo
                  </Button>
                )}
              </div>
            </div>

            <div>
              <span className="ds-eyebrow text-ink-muted">Etapa da triagem</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {ETAPAS.map((e) => {
                  const ativo = (selecionado.status || 'novo') === e.value
                  return (
                    <Button
                      key={e.value}
                      variant={ativo ? 'default' : 'outline'}
                      size="sm"
                      disabled={salvando}
                      onClick={() => salvar({ status: e.value })}
                      aria-pressed={ativo}
                    >
                      {e.label}
                    </Button>
                  )
                })}
              </div>
            </div>

            <div>
              <label htmlFor="observacoes" className="ds-eyebrow text-ink-muted">
                Observações
              </label>
              <Textarea
                id="observacoes"
                value={observacoes}
                onChange={(event) => setObservacoes(event.target.value)}
                placeholder="Anotações da triagem, retorno da entrevista, combinados."
                rows={4}
                className="mt-2"
              />
              <div className="mt-2 flex justify-end">
                <Button
                  size="sm"
                  disabled={salvando || observacoes === (selecionado.observacoes ?? '')}
                  onClick={() => salvar({ observacoes })}
                >
                  {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar observações
                </Button>
              </div>
            </div>
          </div>
        )}
      </ResponsiveModal>
    </PageShell>
  )
}
