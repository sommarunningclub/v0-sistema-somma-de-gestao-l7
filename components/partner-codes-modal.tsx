'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { CalendarDays, Check, Copy, KeyRound, Link2, RefreshCw, Trash2 } from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import {
  CardListSkeleton,
  EmptyState,
  ResponsiveModal,
  SectionTitle,
  StatusPill,
  Well,
  confirmAction,
  notify,
} from '@/components/somma'
import { normalizarCodigo, type CodigoParceiro } from '@/lib/parceiros/vinculos'

interface EventoAberto {
  id: string
  titulo: string
  data_evento: string
  slug: string | null
  lp_url: string | null
  tem_pagina: boolean
}

interface PartnerCodesModalProps {
  codes: CodigoParceiro[]
  onCodesUpdate: () => void
  partnerName?: string
}

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

export function PartnerCodesModal({ codes: initialCodes, onCodesUpdate, partnerName }: PartnerCodesModalProps) {
  const [open, setOpen] = useState(false)
  const [codes, setCodes] = useState<CodigoParceiro[]>(initialCodes)
  const [newCode, setNewCode] = useState('')
  const [newPartnerName, setNewPartnerName] = useState(partnerName || '')
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [eventos, setEventos] = useState<EventoAberto[]>([])
  const [novosEventoIds, setNovosEventoIds] = useState<string[]>([])
  // Código cujos vínculos estão sendo editados na lista, e a seleção em curso.
  const [editandoVinculos, setEditandoVinculos] = useState<string | null>(null)
  const [selecaoEdicao, setSelecaoEdicao] = useState<string[]>([])
  const [salvandoVinculos, setSalvandoVinculos] = useState(false)
  const [copiado, setCopiado] = useState<string | null>(null)

  useEffect(() => {
    setCodes(initialCodes)
  }, [initialCodes])

  const loadCodesFromSupabase = useCallback(async () => {
    try {
      setIsRefreshing(true)
      const response = await apiFetch('/api/partner-codes')
      if (!response.ok) throw new Error('Erro ao carregar códigos')
      const data = await response.json()
      setCodes(data.data || [])
    } catch (err) {
      console.error('[parceiro] Erro ao carregar códigos:', err)
      notify.error('Erro ao carregar códigos')
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  const loadEventos = useCallback(async () => {
    try {
      const response = await apiFetch('/api/partner-codes/eventos')
      if (!response.ok) throw new Error('Erro ao carregar eventos')
      const data = await response.json()
      setEventos(data.eventos || [])
    } catch (err) {
      // Silencioso: sem a lista, criar código continua funcionando — só não
      // dá para vincular evento nenhum, e a seção explica isso.
      console.error('[parceiro] Erro ao carregar eventos abertos:', err)
    }
  }, [])

  useEffect(() => {
    if (open) {
      loadCodesFromSupabase()
      loadEventos()
    }
  }, [open, loadCodesFromSupabase, loadEventos])

  const alternar = (lista: string[], id: string): string[] =>
    lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]

  const copiarLink = async (link: string, chave: string) => {
    try {
      await navigator.clipboard.writeText(link)
      setCopiado(chave)
      setTimeout(() => setCopiado(null), 2500)
    } catch {
      notify.error('Não foi possível copiar o link')
    }
  }

  const handleCreateCode = async () => {
    const codigo = normalizarCodigo(newCode)
    if (!codigo) {
      setError('Código não pode estar vazio')
      return
    }
    if (!newPartnerName.trim()) {
      setError('Nome do parceiro não pode estar vazio')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await apiFetch('/api/partner-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo,
          nome_parceiro: newPartnerName.trim(),
          evento_ids: novosEventoIds,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao criar código')

      // O código pode nascer sem os vínculos: a API cria uma coisa de cada vez
      // e avisa quando a segunda falha, em vez de perder o cadastro inteiro.
      if (data.aviso) notify.warning(data.aviso)
      else notify.success('Código criado com sucesso')

      setNewCode('')
      setNovosEventoIds([])

      await loadCodesFromSupabase()
      onCodesUpdate()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar código'
      setError(message)
      notify.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const abrirEdicaoVinculos = (code: CodigoParceiro) => {
    setEditandoVinculos(code.id)
    setSelecaoEdicao(code.eventos.map((e) => e.id))
  }

  const salvarVinculos = async (code: CodigoParceiro) => {
    setSalvandoVinculos(true)
    try {
      const response = await apiFetch(`/api/partner-codes/${code.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evento_ids: selecaoEdicao }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Erro ao salvar os eventos')

      setEditandoVinculos(null)
      await loadCodesFromSupabase()
      onCodesUpdate()
      notify.success(`Eventos de ${code.codigo} atualizados`)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Erro ao salvar os eventos')
    } finally {
      setSalvandoVinculos(false)
    }
  }

  const handleDeleteCode = async (code: CodigoParceiro) => {
    const totalInscricoes = code.eventos.reduce((soma, e) => soma + e.inscricoes, 0)
    const confirmed = await confirmAction({
      title: 'Excluir código de parceiro?',
      description:
        totalInscricoes > 0
          ? `O código deixa de funcionar e os links divulgados param de atribuir. As ${totalInscricoes} inscrições já feitas continuam no evento, mas deixam de aparecer aqui.`
          : 'O código deixa de funcionar imediatamente para quem tentar acessar com ele.',
      detail: `${code.codigo} — ${code.nome_parceiro}`,
      tone: 'danger',
    })
    if (!confirmed) return

    try {
      const response = await apiFetch(`/api/partner-codes/${code.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Erro ao deletar código')

      await loadCodesFromSupabase()
      onCodesUpdate()
      notify.success('Código excluído')
    } catch (err) {
      console.error('[parceiro] Erro ao excluir código:', err)
      notify.error('Erro ao deletar código')
    }
  }

  const canCreate = !!newCode.trim() && !!newPartnerName.trim()

  /** Caixas de evento, usadas na criação e na edição de um código existente. */
  const listaDeEventos = (selecionados: string[], onToggle: (id: string) => void, idPrefixo: string) => {
    if (eventos.length === 0) {
      return (
        <p className="text-meta text-ink-muted">
          Nenhum evento aberto no momento. O código funciona mesmo assim — dá para vincular
          eventos depois.
        </p>
      )
    }
    return (
      <ul className="space-y-2">
        {eventos.map((evento) => {
          const id = `${idPrefixo}-${evento.id}`
          return (
            <li key={evento.id} className="flex items-start gap-2.5">
              <Checkbox
                id={id}
                checked={selecionados.includes(evento.id)}
                onCheckedChange={() => onToggle(evento.id)}
                disabled={!evento.tem_pagina}
                className="mt-0.5"
              />
              <label htmlFor={id} className={evento.tem_pagina ? 'cursor-pointer' : 'cursor-default'}>
                <span className="block text-meta text-ink-strong">{evento.titulo}</span>
                <span className="block text-micro text-ink-subtle">
                  {formatarData(evento.data_evento)}
                  {evento.tem_pagina ? '' : ' · sem página de inscrição, não gera link'}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <KeyRound aria-hidden="true" />
        <span className="hidden sm:inline">Gerenciar códigos</span>
        <span className="sm:hidden">Códigos</span>
      </Button>

      <ResponsiveModal
        open={open}
        onOpenChange={setOpen}
        size="lg"
        title="Códigos de parceiro"
        description="Código de acesso do parceiro e link de divulgação dos eventos."
        footer={
          <Button variant="secondary" onClick={() => setOpen(false)} block className="sm:w-auto">
            Fechar
          </Button>
        }
      >
        <div className="space-y-6">
          <section aria-label="Criar novo código">
            <SectionTitle as="h3" title="Criar novo código" />
            <Well className="space-y-3 p-4">
              <div>
                <label htmlFor="partner-name" className="mb-1.5 block text-meta font-medium text-ink-muted">
                  Nome do parceiro
                </label>
                <Input
                  id="partner-name"
                  type="text"
                  autoComplete="organization"
                  placeholder="Ex.: Red Bull, Adidas..."
                  value={newPartnerName}
                  onChange={(e) => {
                    setNewPartnerName(e.target.value)
                    setError(null)
                  }}
                  disabled={isLoading}
                  aria-invalid={!!error || undefined}
                  aria-describedby={error ? 'partner-code-error' : undefined}
                />
              </div>
              <div>
                <label htmlFor="partner-code" className="mb-1.5 block text-meta font-medium text-ink-muted">
                  Código
                </label>
                <Input
                  id="partner-code"
                  type="text"
                  autoComplete="off"
                  autoCapitalize="characters"
                  placeholder="Ex.: REDBULL2026"
                  value={newCode}
                  onChange={(e) => {
                    setNewCode(normalizarCodigo(e.target.value))
                    setError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (canCreate && !isLoading) handleCreateCode()
                    }
                  }}
                  disabled={isLoading}
                  aria-invalid={!!error || undefined}
                  aria-describedby={error ? 'partner-code-error' : undefined}
                  className="font-mono"
                />
              </div>

              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-meta font-medium text-ink-muted">
                  <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />
                  Vincular aos eventos abertos
                </p>
                <p className="mb-2 text-micro text-ink-subtle">
                  Cada evento marcado gera um link com o código. As inscrições feitas por ele
                  ficam creditadas ao parceiro.
                </p>
                {listaDeEventos(
                  novosEventoIds,
                  (id) => setNovosEventoIds((atual) => alternar(atual, id)),
                  'novo'
                )}
              </div>

              {error ? (
                <p id="partner-code-error" role="alert" className="text-meta text-danger">
                  {error}
                </p>
              ) : null}
              <Button onClick={handleCreateCode} disabled={!canCreate} loading={isLoading} block>
                Criar código
              </Button>
            </Well>
          </section>

          <section aria-label="Códigos existentes">
            <SectionTitle
              as="h3"
              title="Códigos existentes"
              meta={
                <span className="flex items-center gap-2">
                  <span className="font-mono tabular-nums">{codes.length}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={loadCodesFromSupabase}
                    disabled={isRefreshing}
                    aria-label="Recarregar códigos"
                  >
                    <RefreshCw aria-hidden="true" className={isRefreshing ? 'animate-spin' : undefined} />
                  </Button>
                </span>
              }
            />
            <div className="scroll-touch max-h-96 overflow-y-auto" aria-busy={isRefreshing || undefined}>
              {isRefreshing && codes.length === 0 ? (
                <CardListSkeleton count={3} />
              ) : codes.length === 0 ? (
                <EmptyState
                  compact
                  icon={KeyRound}
                  title="Nenhum código criado ainda"
                  description="Crie um código acima para liberar o acesso de um parceiro."
                />
              ) : (
                <ul className="space-y-2">
                  {codes.map((code) => {
                    const editando = editandoVinculos === code.id
                    return (
                      <li
                        key={code.id}
                        className="rounded-lg border border-line bg-surface-raised p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-mono text-sm font-semibold text-brand-strong">
                                {code.codigo}
                              </p>
                              <StatusPill tone={code.ativo ? 'success' : 'danger'}>
                                {code.ativo ? 'Ativo' : 'Inativo'}
                              </StatusPill>
                            </div>
                            <p className="mt-1 truncate text-meta text-ink-muted">{code.nome_parceiro}</p>
                            <p className="mt-0.5 text-micro text-ink-subtle">
                              Criado em {new Date(code.created_at).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          <Button
                            onClick={() => handleDeleteCode(code)}
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Excluir código ${code.codigo}`}
                            className="shrink-0 text-danger hover:text-danger"
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </div>

                        {/* Eventos vinculados, com o link pronto para o parceiro */}
                        {!editando && code.eventos.length > 0 ? (
                          <ul className="mt-3 space-y-2 border-t border-line pt-3">
                            {code.eventos.map((evento) => (
                              <li key={evento.id} className="text-micro">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="min-w-0 truncate text-ink-muted">
                                    {evento.titulo}
                                  </span>
                                  <span className="shrink-0 font-mono tabular-nums text-ink-subtle">
                                    {evento.inscricoes}{' '}
                                    {evento.inscricoes === 1 ? 'inscrição' : 'inscrições'}
                                  </span>
                                </div>
                                {evento.link ? (
                                  <div className="mt-1 flex items-center gap-1.5">
                                    <code className="min-w-0 flex-1 truncate rounded bg-surface-sunken px-1.5 py-1 text-ink-subtle">
                                      {evento.link}
                                    </code>
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      onClick={() => void copiarLink(evento.link!, `${code.id}-${evento.id}`)}
                                      aria-label={`Copiar link de ${evento.titulo}`}
                                      className="shrink-0"
                                    >
                                      {copiado === `${code.id}-${evento.id}` ? (
                                        <Check aria-hidden="true" className="text-success" />
                                      ) : (
                                        <Copy aria-hidden="true" />
                                      )}
                                    </Button>
                                  </div>
                                ) : (
                                  <p className="mt-1 text-ink-subtle">
                                    Evento sem página de inscrição — não há link para divulgar.
                                  </p>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : null}

                        {editando ? (
                          <div className="mt-3 space-y-3 border-t border-line pt-3">
                            {listaDeEventos(
                              selecaoEdicao,
                              (id) => setSelecaoEdicao((atual) => alternar(atual, id)),
                              `edit-${code.id}`
                            )}
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => void salvarVinculos(code)}
                                loading={salvandoVinculos}
                              >
                                Salvar eventos
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditandoVinculos(null)}
                                disabled={salvandoVinculos}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => abrirEdicaoVinculos(code)}
                            className="mt-2 text-ink-muted"
                          >
                            <Link2 aria-hidden="true" />
                            {code.eventos.length > 0 ? 'Editar eventos' : 'Vincular eventos'}
                          </Button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>
      </ResponsiveModal>
    </>
  )
}
