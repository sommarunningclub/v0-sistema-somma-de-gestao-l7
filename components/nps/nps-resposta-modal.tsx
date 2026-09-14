'use client'

import { useEffect, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ResponsiveModal, SegmentedControl, Skeleton, StatusPill, notify } from '@/components/somma'
import { apiFetch } from '@/lib/api-client'
import { STATUS_TRATATIVA } from '@/lib/nps/estado'
import { rotuloDaOrigem } from '@/lib/nps/links'
import { nomeCasaCom } from '@/lib/nps/nome'
import { formatarDataHora } from '@/lib/nps/periodo'
import { questionarioDaVersao, type PerguntaQuestionario } from '@/lib/nps/questionario'
import {
  ROTULO_IDENTIFICACAO,
  motivosDaTratativa,
  precisaTratativa,
  professorDaResposta,
  professorDivergente,
  professorMarcado,
} from '@/lib/nps/relatorio'
import type { EventoTratativa, RespostaNps, Rodada, StatusTratativa, Tratativa } from '@/lib/nps/tipos'
import { CAMPO_SELECT } from './nps-rodada-form'
import { CATEGORIA } from './visual'

/** `editar` abre a ficha já com o formulário de correção aberto. */
export type ModoFicha = 'ver' | 'editar'

interface Detalhe {
  resposta: RespostaNps
  rodada: Rodada
  tratativa: Tratativa | null
  eventos: EventoTratativa[]
}

interface ProfessorAtivo {
  id: string
  nome: string
}

function valorDe(r: RespostaNps, campo: string): unknown {
  return (r as unknown as Record<string, unknown>)[campo]
}

function rotuloDaOpcao(opcoes: PerguntaQuestionario['opcoes'], valor: unknown): string {
  return opcoes?.find((o) => o.valor === valor)?.rotulo ?? String(valor)
}

/** A resposta como a pessoa viu a pergunta: rótulo, não o valor técnico. */
function formatarResposta(p: PerguntaQuestionario, r: RespostaNps): { texto: string; vazia: boolean } {
  const v = valorDe(r, p.id)
  if (v === null || v === undefined || (Array.isArray(v) && v.length === 0)) {
    return { texto: p.tipo === 'text' ? 'Sem resposta' : 'Pergunta não exibida', vazia: true }
  }
  switch (p.tipo) {
    case 'scale':
      return { texto: `${v}/10`, vazia: false }
    case 'rating':
      return { texto: `${v} · ${p.rotulos?.[Number(v) - 1] ?? ''}`, vazia: false }
    case 'single':
      return { texto: rotuloDaOpcao(p.opcoes, v), vazia: false }
    case 'multi':
      return { texto: (v as unknown[]).map((x) => rotuloDaOpcao(p.opcoes, x)).join(', '), vazia: false }
    default:
      return { texto: String(v), vazia: false }
  }
}

const OPCOES_STATUS: Array<{ value: StatusTratativa; label: string }> = [
  { value: 'pending', label: 'Pendente' },
  { value: 'in_progress', label: 'Em contato' },
  { value: 'resolved', label: 'Resolvida' },
  { value: 'no_action', label: 'Sem ação' },
]

export function NpsRespostaModal({
  resposta: aberta,
  onClose,
  onAlterada,
  onApagar,
}: {
  resposta: { id: string; modo: ModoFicha } | null
  onClose: () => void
  onAlterada: () => void
  /** Confirma, apaga e fecha a ficha. Fica com quem tem a lista, que precisa recarregar. */
  onApagar: (id: string, nome: string) => Promise<void>
}) {
  const respostaId = aberta?.id ?? null
  const modoInicial = aberta?.modo ?? 'ver'
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusTratativa>('pending')
  const [responsavel, setResponsavel] = useState('')
  const [nota, setNota] = useState('')
  const [salvando, setSalvando] = useState(false)

  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState('')
  const [sobrenome, setSobrenome] = useState('')
  const [professorId, setProfessorId] = useState('')
  const [professores, setProfessores] = useState<ProfessorAtivo[] | null>(null)
  const [erroEdicao, setErroEdicao] = useState<string | null>(null)
  const [salvandoDados, setSalvandoDados] = useState(false)
  const [apagando, setApagando] = useState(false)

  function comecarEdicao(r: RespostaNps) {
    setNome(r.first_name)
    setSobrenome(r.last_name)
    setProfessorId(r.professor_id ?? '')
    setErroEdicao(null)
    setEditando(true)
  }

  useEffect(() => {
    if (!respostaId) {
      setDetalhe(null)
      setEditando(false)
      return
    }
    let ativo = true
    setDetalhe(null)
    setErro(null)
    setEditando(false)
    apiFetch(`/api/nps/respostas/${respostaId}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Não foi possível abrir a resposta.')
        if (!ativo) return
        setDetalhe(data)
        setStatus(data.tratativa?.status ?? 'pending')
        setResponsavel(data.tratativa?.owner_name ?? '')
        setNota('')
        if (modoInicial === 'editar') comecarEdicao(data.resposta)
      })
      .catch((err) => ativo && setErro(err instanceof Error ? err.message : 'Não foi possível abrir a resposta.'))
    return () => {
      ativo = false
    }
  }, [respostaId, modoInicial])

  // A lista de professores só é buscada quando alguém vai corrigir uma resposta.
  useEffect(() => {
    if (!editando || professores) return
    let ativo = true
    apiFetch('/api/nps/professores')
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Não foi possível carregar os professores.')
        if (ativo) setProfessores(data.professores)
      })
      .catch((err) => {
        if (!ativo) return
        setProfessores([])
        setErroEdicao(err instanceof Error ? err.message : 'Não foi possível carregar os professores.')
      })
    return () => {
      ativo = false
    }
  }, [editando, professores])

  async function salvar() {
    if (!respostaId || !detalhe) return
    setSalvando(true)
    try {
      const res = await apiFetch(`/api/nps/respostas/${respostaId}/tratativa`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, owner_name: responsavel, ...(nota.trim() ? { note: nota } : {}) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Não foi possível salvar a tratativa.')
      setDetalhe({ ...detalhe, tratativa: data.tratativa, eventos: data.eventos })
      setNota('')
      notify.success('Tratativa salva')
      onAlterada()
    } catch (err) {
      notify.error('Não foi possível salvar', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setSalvando(false)
    }
  }

  /** Manda só o que mudou: quem corrige o nome não mexe no professor sem querer. */
  async function salvarDados() {
    if (!respostaId || !detalhe) return
    const r = detalhe.resposta
    const mudancas: { first_name?: string; last_name?: string; professor_id?: string | null } = {}
    if (nome.trim() !== r.first_name) mudancas.first_name = nome
    if (sobrenome.trim() !== r.last_name) mudancas.last_name = sobrenome
    if ((professorId || null) !== r.professor_id) mudancas.professor_id = professorId || null
    if (Object.keys(mudancas).length === 0) {
      setEditando(false)
      return
    }

    setSalvandoDados(true)
    setErroEdicao(null)
    try {
      const res = await apiFetch(`/api/nps/respostas/${respostaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mudancas),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Não foi possível salvar a correção.')
      setDetalhe({ ...detalhe, resposta: data.resposta })
      setEditando(false)
      notify.success('Resposta corrigida')
      onAlterada()
    } catch (err) {
      setErroEdicao(err instanceof Error ? err.message : 'Não foi possível salvar a correção.')
    } finally {
      setSalvandoDados(false)
    }
  }

  async function apagar() {
    if (!detalhe) return
    setApagando(true)
    try {
      await onApagar(detalhe.resposta.id, detalhe.resposta.full_name)
    } finally {
      setApagando(false)
    }
  }

  const r = detalhe?.resposta
  const questionario = r ? questionarioDaVersao(r.survey_version) : null
  const mostrarTratativa = Boolean(r && (precisaTratativa(r) || detalhe?.tratativa))
  const professor = r ? professorDaResposta(r) : null
  const marcado = r ? professorMarcado(r) : null
  const sugerido = marcado ? professores?.find((p) => nomeCasaCom(marcado, p.nome)) : undefined
  const professorAtualInativo = Boolean(r?.professor_id && professores && !professores.some((p) => p.id === r.professor_id))

  return (
    <ResponsiveModal
      open={Boolean(respostaId)}
      onOpenChange={(abertoAgora) => !abertoAgora && onClose()}
      title={r ? r.full_name : 'Resposta'}
      description={r ? `Enviada em ${formatarDataHora(r.submitted_at)}` : undefined}
      size="xl"
    >
      {erro ? (
        <p className="text-sm text-danger">{erro}</p>
      ) : !r || !detalhe ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <div className="space-y-6">
          <section aria-label="Quem respondeu" className="rounded-md border border-line p-4">
            {editando ? (
              <form
                className="space-y-4"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault()
                  void salvarDados()
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="nps-editar-nome">Nome</Label>
                    <Input id="nps-editar-nome" className="mt-1.5" value={nome} maxLength={60} onChange={(e) => setNome(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="nps-editar-sobrenome">Sobrenome</Label>
                    <Input
                      id="nps-editar-sobrenome"
                      className="mt-1.5"
                      value={sobrenome}
                      maxLength={80}
                      onChange={(e) => setSobrenome(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="nps-editar-professor">Professor</Label>
                  <select
                    id="nps-editar-professor"
                    className={`${CAMPO_SELECT} mt-1.5`}
                    value={professorId}
                    disabled={!professores}
                    onChange={(e) => setProfessorId(e.target.value)}
                  >
                    <option value="">{professores ? 'Sem professor' : 'Carregando professores…'}</option>
                    {professorAtualInativo && r.professor_id ? (
                      <option value={r.professor_id}>{r.professor_name ?? 'Professor atual'} (inativo)</option>
                    ) : null}
                    {professores?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                  {sugerido && sugerido.id !== professorId ? (
                    <button
                      type="button"
                      onClick={() => setProfessorId(sugerido.id)}
                      className="mt-1.5 text-meta font-semibold text-brand hover:underline"
                    >
                      Usar {sugerido.nome}, que o aluno marcou na pesquisa
                    </button>
                  ) : marcado ? (
                    <p className="mt-1.5 text-meta text-ink-muted">Na pesquisa, o aluno marcou {marcado}.</p>
                  ) : null}
                </div>
                {erroEdicao ? (
                  <p role="alert" className="text-meta text-danger">
                    {erroEdicao}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-meta text-ink-muted">Notas e textos são do aluno e não se editam.</p>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" onClick={() => setEditando(false)} disabled={salvandoDados}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={salvandoDados || !professores}>
                      {salvandoDados ? 'Salvando…' : 'Salvar correção'}
                    </Button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <dl className="grid min-w-0 flex-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                    <div>
                      <dt className="ds-eyebrow text-ink-muted">Professor</dt>
                      <dd className="mt-0.5 text-sm text-ink-strong">
                        {professor ? professor.nome : 'Não identificado'}
                        {professor?.origem === 'informado' ? (
                          <span className="ml-1.5 text-meta text-ink-muted">(marcado pelo aluno)</span>
                        ) : null}
                      </dd>
                    </div>
                    <div>
                      <dt className="ds-eyebrow text-ink-muted">Identificação</dt>
                      <dd className="mt-0.5 text-sm text-ink">
                        {ROTULO_IDENTIFICACAO[r.identification_method]} · {rotuloDaOrigem(r.source)}
                      </dd>
                    </div>
                  </dl>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="outline" size="sm" onClick={() => comecarEdicao(r)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-danger hover:text-danger"
                      onClick={() => void apagar()}
                      disabled={apagando}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      Apagar
                    </Button>
                  </div>
                </div>
                {professorDivergente(r) ? (
                  <p className="flex flex-wrap items-center gap-2 text-meta text-ink">
                    <StatusPill tone="warning">Professor diferente</StatusPill>
                    Na pesquisa o aluno marcou {marcado}; o cadastro aponta {r.professor_name}.
                  </p>
                ) : null}
                {r.updated_by ? (
                  <p className="text-meta text-ink-muted">
                    Corrigida por {r.updated_by} em {formatarDataHora(r.updated_at)}.
                  </p>
                ) : null}
              </div>
            )}
          </section>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-line bg-surface-sunken p-3">
              <p className="ds-eyebrow text-ink-muted">Recomendaria</p>
              <p className="mt-1 flex items-center gap-2">
                <span className="text-2xl font-semibold text-ink-strong">{r.nps_score}</span>
                <StatusPill tone={CATEGORIA[r.nps_category].tone}>{CATEGORIA[r.nps_category].rotulo}</StatusPill>
              </p>
            </div>
            <div className="rounded-md border border-line bg-surface-sunken p-3">
              <p className="ds-eyebrow text-ink-muted">Chance de renovar</p>
              <p className="mt-1 text-2xl font-semibold text-ink-strong">
                {r.renewal_probability}
                <span className="text-sm font-normal text-ink-muted">/10</span>
              </p>
            </div>
          </div>

          {mostrarTratativa ? (
            <section aria-labelledby="nps-tratativa-titulo" className="rounded-md border border-brand-border bg-brand-softer p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="nps-tratativa-titulo" className="text-sm font-semibold text-ink-strong">
                  Tratativa
                </h3>
                <span className="flex flex-wrap gap-1.5">
                  {motivosDaTratativa(r).map((m) => (
                    <span key={m} className="rounded-sm border border-line bg-surface-sunken px-1.5 py-0.5 font-mono text-[0.6875rem] text-ink">
                      {m}
                    </span>
                  ))}
                </span>
              </div>

              <div className="mt-4 space-y-4">
                <div className="overflow-x-auto">
                  <SegmentedControl<StatusTratativa> label="Status da tratativa" value={status} onChange={setStatus} options={OPCOES_STATUS} />
                </div>
                <div>
                  <Label htmlFor="nps-responsavel">Quem está cuidando</Label>
                  <Input
                    id="nps-responsavel"
                    className="mt-1.5"
                    value={responsavel}
                    maxLength={120}
                    placeholder="Ex.: professor Joseph, coordenação"
                    onChange={(e) => setResponsavel(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="nps-anotacao">Anotação</Label>
                  <Textarea
                    id="nps-anotacao"
                    className="mt-1.5"
                    rows={3}
                    maxLength={4000}
                    value={nota}
                    placeholder="O que foi conversado, o que ficou combinado"
                    onChange={(e) => setNota(e.target.value)}
                  />
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => void salvar()} disabled={salvando}>
                    {salvando ? 'Salvando…' : 'Salvar tratativa'}
                  </Button>
                </div>
              </div>

              {detalhe.eventos.length > 0 ? (
                <ol className="mt-4 space-y-2 border-t border-line pt-4">
                  {[...detalhe.eventos].reverse().map((e) => (
                    <li key={e.id} className="text-meta">
                      <p className="text-ink-muted">
                        {formatarDataHora(e.created_at)} · {e.author}
                        {e.status ? ` · ${STATUS_TRATATIVA[e.status].rotulo}` : ''}
                      </p>
                      {e.note ? <p className="mt-0.5 whitespace-pre-wrap text-ink">{e.note}</p> : null}
                    </li>
                  ))}
                </ol>
              ) : null}
            </section>
          ) : null}

          {questionario ? (
            questionario.secoes
              .filter((s) => s.id !== 'identificacao')
              .map((secao) => {
                const perguntas = questionario.perguntas.filter((p) => p.secao === secao.id)
                if (perguntas.length === 0) return null
                return (
                  <section key={secao.id} aria-labelledby={`nps-secao-${secao.id}`}>
                    <h3 id={`nps-secao-${secao.id}`} className="mb-2 ds-eyebrow text-brand">
                      {secao.titulo}
                    </h3>
                    <dl className="divide-y divide-line rounded-md border border-line">
                      {perguntas.map((p) => {
                        const resposta = formatarResposta(p, r)
                        const seguimento = p.seguimento
                        const valorSeguimento = seguimento ? valorDe(r, seguimento.campo) : null
                        return (
                          <div key={p.id} className="grid gap-1 p-3 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] sm:gap-4">
                            <dt className="text-meta text-ink-muted">{p.titulo}</dt>
                            <dd className={resposta.vazia ? 'text-meta italic text-ink-subtle' : 'whitespace-pre-wrap text-sm text-ink-strong'}>
                              {resposta.texto}
                              {seguimento && valorSeguimento && !(Array.isArray(valorSeguimento) && valorSeguimento.length === 0) ? (
                                <span className="mt-1 block text-meta not-italic text-ink">
                                  {seguimento.rotulo}{' '}
                                  {Array.isArray(valorSeguimento)
                                    ? valorSeguimento.map((x) => rotuloDaOpcao(seguimento.opcoes, x)).join(', ')
                                    : String(valorSeguimento)}
                                </span>
                              ) : null}
                            </dd>
                          </div>
                        )
                      })}
                    </dl>
                  </section>
                )
              })
          ) : (
            <p className="text-meta text-ink-muted">Versão de questionário desconhecida: {r.survey_version}.</p>
          )}
        </div>
      )}
    </ResponsiveModal>
  )
}
