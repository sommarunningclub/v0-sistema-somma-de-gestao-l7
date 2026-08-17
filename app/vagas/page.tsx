'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardList, Download, Loader2, MessageCircle, RefreshCw } from 'lucide-react'
import {
  EmptyState,
  FilterButton,
  FilterChip,
  MobileRecordCard,
  NoResultsState,
  Panel,
  PanelHeader,
  PageHeader,
  PageShell,
  ResponsiveModal,
  SearchInput,
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

/**
 * Este painel não tem uma tabela de vagas — o status "aberta/encerrada" mora
 * só no site (NOVO-SITE-SOMMA-V3/app/trabalhe-conosco-vagas/_vagas.ts, campo
 * `ativa`). Espelha aqui manualmente: ao fechar ou reabrir uma vaga no site,
 * atualize este set também.
 */
const VAGAS_ENCERRADAS = new Set<string>(['estagio-educacao-fisica'])

function vagaEncerrada(slug: string): boolean {
  return VAGAS_ENCERRADAS.has(slug)
}

function formatarData(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatarNascimento(iso: string | null): string {
  if (!iso) return '—'
  // Coluna `date`: chega como AAAA-MM-DD. Montar via `new Date` puxaria o fuso
  // e podia exibir o dia anterior.
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

function indicacaoTexto(c: CandidatoVaga): string {
  if (!c.indicado) return 'Não'
  return c.indicado_por?.trim() ? `Sim, por ${c.indicado_por.trim()}` : 'Sim'
}

export default function VagasPage() {
  const [candidatos, setCandidatos] = useState<CandidatoVaga[]>([])
  const [carregando, setCarregando] = useState(true)
  const [atualizando, setAtualizando] = useState(false)
  const [busca, setBusca] = useState('')
  const [etapa, setEtapa] = useState<FiltroEtapa>('todas')
  const [vagaSlug, setVagaSlug] = useState('todas')
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)
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
          matchesTextSearch(busca, [
            c.nome,
            c.email,
            c.instituicao,
            c.telefone,
            c.vaga_titulo,
            c.indicado_por ?? '',
          ]),
        ),
    [candidatos, etapa, vagaSlug, busca],
  )

  const novos = useMemo(
    () => candidatos.filter((c) => (c.status || 'novo') === 'novo').length,
    [candidatos],
  )

  /** Agrupa os candidatos filtrados em um cluster por vaga — abertas primeiro. */
  const grupos = useMemo(() => {
    const mapa = new Map<string, { slug: string; titulo: string; candidatos: CandidatoVaga[] }>()
    for (const c of filtrados) {
      const grupo = mapa.get(c.vaga_slug)
      if (grupo) grupo.candidatos.push(c)
      else mapa.set(c.vaga_slug, { slug: c.vaga_slug, titulo: c.vaga_titulo, candidatos: [c] })
    }
    return Array.from(mapa.values()).sort((a, b) => {
      const encerradaA = vagaEncerrada(a.slug)
      const encerradaB = vagaEncerrada(b.slug)
      if (encerradaA !== encerradaB) return encerradaA ? 1 : -1
      return a.titulo.localeCompare(b.titulo, 'pt-BR')
    })
  }, [filtrados])

  const filtrosAtivos = (etapa !== 'todas' ? 1 : 0) + (vagaSlug !== 'todas' ? 1 : 0)

  function limparFiltros() {
    setEtapa('todas')
    setVagaSlug('todas')
    setBusca('')
  }

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

  function botaoWhatsapp(c: CandidatoVaga, variante: 'icone' | 'texto') {
    const zap = whatsappHref(c.telefone, mensagemWhatsapp(c.nome, c.vaga_titulo))
    if (!zap) return null
    return (
      <Button asChild variant={variante === 'icone' ? 'ghost' : 'outline'} size="sm">
        <a
          href={zap}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
        >
          <MessageCircle aria-hidden="true" />
          {variante === 'texto' ? (
            'WhatsApp'
          ) : (
            <span className="sr-only">Chamar {c.nome} no WhatsApp</span>
          )}
        </a>
      </Button>
    )
  }

  const semCandidatos = !carregando && candidatos.length === 0

  return (
    <PageShell>
      <PageHeader
        eyebrow="Operação"
        title="Vagas"
        description="Candidatos recebidos pelo formulário de Trabalhe Conosco do site."
        meta={
          candidatos.length > 0 ? (
            <>
              <span>
                <span className="font-mono tabular-nums text-ink">{candidatos.length}</span> no
                total
              </span>
              <span>
                <span className="font-mono tabular-nums text-ink">{novos}</span> novos
              </span>
            </>
          ) : undefined
        }
        actions={
          <Button
            variant="secondary"
            size="icon"
            onClick={() => void carregar(true)}
            loading={atualizando}
            aria-label="Atualizar lista de candidatos"
          >
            <RefreshCw aria-hidden="true" />
          </Button>
        }
      >
        {!semCandidatos ? (
          <div className="space-y-2">
            <Toolbar>
              <SearchInput
                value={busca}
                onValueChange={setBusca}
                label="Buscar candidato"
                placeholder="Buscar por nome, e-mail, telefone ou instituição..."
                placeholderShort="Buscar candidato"
              />
              <FilterButton count={filtrosAtivos} onClick={() => setFiltrosAbertos(true)} />
            </Toolbar>

            {filtrosAtivos > 0 ? (
              <div className="flex flex-wrap gap-2">
                {etapa !== 'todas' ? (
                  <FilterChip
                    label="Etapa"
                    value={etapaLabel(etapa)}
                    onRemove={() => setEtapa('todas')}
                  />
                ) : null}
                {vagaSlug !== 'todas' ? (
                  <FilterChip
                    label="Vaga"
                    value={vagas.find((v) => v.slug === vagaSlug)?.titulo ?? vagaSlug}
                    onRemove={() => setVagaSlug('todas')}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </PageHeader>

      <div aria-busy={carregando || atualizando}>
        {carregando ? (
          <TableSkeleton rows={6} columns={6} />
        ) : semCandidatos ? (
          <EmptyState
            icon={ClipboardList}
            title="Nenhuma candidatura recebida"
            description="As candidaturas enviadas em sommaclub.com.br/trabalhe-conosco-vagas aparecem aqui automaticamente, com o currículo anexado."
          />
        ) : filtrados.length === 0 ? (
          <NoResultsState query={busca || 'os filtros aplicados'} onClear={limparFiltros} />
        ) : (
          <div className="space-y-4">
            {grupos.map((grupo) => {
              const encerrada = vagaEncerrada(grupo.slug)
              return (
                <Panel key={grupo.slug}>
                  <PanelHeader
                    title={grupo.titulo}
                    description={`${grupo.candidatos.length} candidatura${grupo.candidatos.length === 1 ? '' : 's'}`}
                    actions={
                      <StatusPill tone={encerrada ? 'neutral' : 'success'}>
                        {encerrada ? 'Encerrada' : 'Aberta'}
                      </StatusPill>
                    }
                  />

                  <div className="hidden lg:block">
                    <TableFrame busy={atualizando}>
                      <Table caption={`Candidatos de ${grupo.titulo}`}>
                        <THead>
                          <TR>
                            <TH>Candidato</TH>
                            <TH>Formação</TH>
                            <TH>Recebido</TH>
                            <TH>Etapa</TH>
                            <TH align="right">Ações</TH>
                          </TR>
                        </THead>
                        <TBody>
                          {grupo.candidatos.map((c) => (
                            <TR key={c.id} onClick={() => abrir(c)}>
                              <TD>
                                <span className="block font-medium text-ink-strong">{c.nome}</span>
                                <span className="block text-meta text-ink-muted">{c.email}</span>
                              </TD>
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
                                  {botaoWhatsapp(c, 'icone')}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={!c.curriculo_path || baixando}
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      void baixarCurriculo(c)
                                    }}
                                  >
                                    <Download aria-hidden="true" />
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

                  <div className="space-y-3 p-3 lg:hidden">
                    {grupo.candidatos.map((c) => (
                      <MobileRecordCard
                        key={c.id}
                        title={c.nome}
                        subtitle={c.email}
                        status={
                          <StatusPill tone={etapaTone(c.status)}>{etapaLabel(c.status)}</StatusPill>
                        }
                        fields={[
                          { label: 'Instituição', value: c.instituicao },
                          { label: 'Semestre', value: c.semestre },
                          { label: 'Recebido', value: formatarData(c.criado_em) },
                        ]}
                        actions={botaoWhatsapp(c, 'texto') ?? undefined}
                        onClick={() => abrir(c)}
                      />
                    ))}
                  </div>
                </Panel>
              )
            })}
          </div>
        )}
      </div>

      {/* Filtros — sheet no celular, diálogo no desktop. */}
      <ResponsiveModal
        open={filtrosAbertos}
        onOpenChange={setFiltrosAbertos}
        title="Filtrar candidatos"
        description="Os filtros valem junto com a busca."
        size="sm"
        footer={
          <div className="flex w-full gap-2">
            <Button variant="outline" block onClick={limparFiltros} disabled={filtrosAtivos === 0}>
              Limpar
            </Button>
            <Button block onClick={() => setFiltrosAbertos(false)}>
              Ver resultados
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <div>
            <span className="ds-eyebrow text-ink-muted">Etapa</span>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                variant={etapa === 'todas' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setEtapa('todas')}
                aria-pressed={etapa === 'todas'}
              >
                Todas
              </Button>
              {ETAPAS.map((e) => {
                const total = candidatos.filter((c) => (c.status || 'novo') === e.value).length
                return (
                  <Button
                    key={e.value}
                    variant={etapa === e.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setEtapa(e.value)}
                    aria-pressed={etapa === e.value}
                  >
                    {e.label}
                    <span className="ml-1.5 font-mono tabular-nums text-ink-muted">{total}</span>
                  </Button>
                )
              })}
            </div>
          </div>

          {vagas.length > 1 ? (
            <div>
              <span className="ds-eyebrow text-ink-muted">Vaga</span>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variant={vagaSlug === 'todas' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setVagaSlug('todas')}
                  aria-pressed={vagaSlug === 'todas'}
                >
                  Todas
                </Button>
                {vagas.map((v) => (
                  <Button
                    key={v.slug}
                    variant={vagaSlug === v.slug ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setVagaSlug(v.slug)}
                    aria-pressed={vagaSlug === v.slug}
                  >
                    {v.titulo}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </ResponsiveModal>

      {/* Ficha do candidato */}
      <ResponsiveModal
        open={selecionado !== null}
        onOpenChange={(open) => {
          if (!open) setSelecionado(null)
        }}
        title={selecionado?.nome ?? ''}
        description={selecionado?.vaga_titulo}
        size="lg"
      >
        {selecionado ? (
          <div className="space-y-6">
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {[
                { label: 'E-mail', value: selecionado.email },
                { label: 'Telefone', value: selecionado.telefone },
                { label: 'Nascimento', value: formatarNascimento(selecionado.data_nascimento) },
                { label: 'Instituição', value: selecionado.instituicao },
                { label: 'Semestre', value: selecionado.semestre },
                { label: 'Indicado', value: indicacaoTexto(selecionado) },
                { label: 'CEP', value: selecionado.cep || '—' },
                { label: 'Recebido em', value: formatarData(selecionado.criado_em) },
                { label: 'Endereço', value: enderecoCompleto(selecionado) },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="ds-eyebrow text-ink-muted">{item.label}</dt>
                  <dd className="mt-1 break-words text-ink-strong">{item.value}</dd>
                </div>
              ))}
            </dl>

            <div>
              <span className="ds-eyebrow text-ink-muted">Ações</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {whatsappHref(selecionado.telefone) ? (
                  <Button asChild variant="outline">
                    <a
                      href={
                        whatsappHref(
                          selecionado.telefone,
                          mensagemWhatsapp(selecionado.nome, selecionado.vaga_titulo),
                        ) ?? '#'
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle aria-hidden="true" />
                      Chamar no WhatsApp
                    </a>
                  </Button>
                ) : (
                  <Button variant="outline" disabled>
                    <MessageCircle aria-hidden="true" />
                    Telefone inválido
                  </Button>
                )}

                {selecionado.curriculo_path ? (
                  <Button
                    variant="outline"
                    loading={baixando}
                    onClick={() => void baixarCurriculo(selecionado)}
                  >
                    <Download aria-hidden="true" />
                    {selecionado.curriculo_nome ?? 'Baixar currículo'}
                  </Button>
                ) : (
                  <Button variant="outline" disabled>
                    <Download aria-hidden="true" />
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
                      onClick={() => void salvar({ status: e.value })}
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
                  loading={salvando}
                  disabled={observacoes === (selecionado.observacoes ?? '')}
                  onClick={() => void salvar({ observacoes })}
                >
                  Salvar observações
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </ResponsiveModal>
    </PageShell>
  )
}
