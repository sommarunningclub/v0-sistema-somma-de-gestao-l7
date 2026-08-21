'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, CalendarPlus, Copy, KeyRound, Plus, RefreshCw, RotateCcw, Trash2, Zap } from 'lucide-react'

import { apiFetch } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ErrorBanner } from '@/components/ui/error-banner'
import {
  EmptyState,
  PageHeader,
  PageShell,
  Panel,
  PanelHeader,
  StatusPill,
  confirmAction,
  notify,
  type StatusTone,
} from '@/components/somma'
import type { PixAutomaticoToken } from '@/lib/pix-automatico/tokens'

// Códigos que liberam o Pix Automático no checkout do site.
//
// O Pix Automático aparece no sommaclub.com.br/checkout/mensal mas fica
// bloqueado: a meta comercial é levar o máximo de clientes para o cartão e
// liberar o débito automático caso a caso. Quem procura o atendimento recebe
// um código daqui, que vale para UM checkout e expira em 24 horas.

type EstadoToken = 'disponivel' | 'usado' | 'expirado'
type Situacao = { estado: EstadoToken; rotulo: string; tone: StatusTone }

// O estado é uma chave própria: comparar pelo rótulo traduzido faria a
// contagem e o botão Copiar quebrarem em silêncio numa troca de copy.
function situacaoDoToken(token: PixAutomaticoToken): Situacao {
  if (token.usado_em) return { estado: 'usado', rotulo: 'Usado', tone: 'neutral' }
  if (new Date(token.expira_em) <= new Date()) {
    return { estado: 'expirado', rotulo: 'Expirado', tone: 'neutral' }
  }
  return { estado: 'disponivel', rotulo: 'Disponível', tone: 'success' }
}

function formatarQuando(valor?: string | null): string {
  if (!valor) return '-'
  return new Date(valor).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function PixAutomaticoModule() {
  const [tokens, setTokens] = useState<PixAutomaticoToken[]>([])
  const [carregando, setCarregando] = useState(true)
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [observacao, setObservacao] = useState('')
  const [copiado, setCopiado] = useState<string | null>(null)
  // Códigos com prorrogação ou exclusão em andamento: desativa os botões só
  // dessas linhas, sem travar o resto da lista. É um Set porque ações em
  // linhas diferentes podem voar ao mesmo tempo; uma string única faria a
  // primeira que terminasse reabilitar os botões da outra no meio do voo.
  const [agindo, setAgindo] = useState<ReadonlySet<string>>(new Set())
  const marcarAgindo = (codigo: string, ativo: boolean) => {
    setAgindo((atual) => {
      const proximo = new Set(atual)
      if (ativo) proximo.add(codigo)
      else proximo.delete(codigo)
      return proximo
    })
  }

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const res = await apiFetch('/api/pix-automatico/tokens')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar os códigos')
      setTokens(data.tokens ?? [])
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar os códigos')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const gerar = async () => {
    setGerando(true)
    setErro(null)
    try {
      const res = await apiFetch('/api/pix-automatico/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observacao: observacao.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar o código')

      setObservacao('')

      // Copia ANTES de recarregar: depois de outro await o navegador pode
      // considerar que a permissão de área de transferência expirou.
      const codigo: string | undefined = data.token?.codigo
      if (codigo) {
        try {
          await navigator.clipboard.writeText(codigo)
          notify.success(`Código ${codigo} gerado e copiado`)
        } catch {
          notify.success(`Código ${codigo} gerado`)
        }
      }

      await carregar()
    } catch (err) {
      // Só o toast: o banner do topo pertence à listagem e o botão dele
      // recarrega a lista, o que não ajudaria num erro de geração.
      notify.error(err instanceof Error ? err.message : 'Erro ao gerar o código')
    } finally {
      setGerando(false)
    }
  }

  const copiar = async (codigo: string) => {
    try {
      await navigator.clipboard.writeText(codigo)
      setCopiado(codigo)
      setTimeout(() => setCopiado(null), 2500)
    } catch {
      notify.error('Não foi possível copiar')
    }
  }

  // Prorrogar e reativar são a MESMA chamada: a validade volta a contar 24h a
  // partir de agora. Só o rótulo muda conforme o estado do código.
  const prorrogar = async (token: PixAutomaticoToken) => {
    marcarAgindo(token.codigo, true)
    try {
      const res = await apiFetch(`/api/pix-automatico/tokens/${token.codigo}`, { method: 'PATCH' })
      const data = await res.json()
      if (!res.ok) {
        notify.error(data.error || 'Erro ao prorrogar o código')
        // 409: o código foi usado depois que a tela carregou. 404: alguém o
        // excluiu em outra aba. Nos dois casos a linha está defasada;
        // recarrega para refletir o estado real. Erro de rede/500 não: a
        // lista local continua válida e o skeleton só atrapalharia.
        if (res.status === 409 || res.status === 404) await carregar()
        return
      }

      const atualizado: PixAutomaticoToken = data.token
      setTokens((atuais) => atuais.map((t) => (t.codigo === atualizado.codigo ? atualizado : t)))
      notify.success(`Código ${atualizado.codigo} válido até ${formatarQuando(atualizado.expira_em)}`)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Erro ao prorrogar o código')
    } finally {
      marcarAgindo(token.codigo, false)
    }
  }

  const excluir = async (token: PixAutomaticoToken) => {
    const situacao = situacaoDoToken(token)
    const ok = await confirmAction({
      title: 'Excluir este código?',
      description:
        situacao.estado === 'usado'
          ? 'O registro de quem usou este código será perdido. Esta ação não pode ser desfeita.'
          : situacao.estado === 'disponivel'
            ? 'O código deixa de funcionar no checkout imediatamente. Esta ação não pode ser desfeita.'
            : 'Esta ação não pode ser desfeita.',
      detail: (
        <>
          <span className="block font-mono font-medium tracking-wider text-ink-strong">
            {token.codigo}
          </span>
          {token.observacao ? <span className="block text-ink-muted">{token.observacao}</span> : null}
        </>
      ),
      tone: 'danger',
    })
    if (!ok) return

    marcarAgindo(token.codigo, true)
    try {
      const res = await apiFetch(`/api/pix-automatico/tokens/${token.codigo}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.status === 404) {
        // Outra aba (ou outro admin) excluiu antes. O resultado que o usuário
        // queria já vale; manter a linha aqui seria um fantasma na lista.
        setTokens((atuais) => atuais.filter((t) => t.codigo !== token.codigo))
        notify.success(`Código ${token.codigo} já havia sido excluído`)
        return
      }
      if (!res.ok) throw new Error(data.error || 'Erro ao excluir o código')

      setTokens((atuais) => atuais.filter((t) => t.codigo !== token.codigo))
      notify.success(`Código ${token.codigo} excluído`)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Erro ao excluir o código')
    } finally {
      marcarAgindo(token.codigo, false)
    }
  }

  const disponiveis = tokens.filter((t) => situacaoDoToken(t).estado === 'disponivel').length

  return (
    <PageShell>
      <PageHeader
        eyebrow="Pagamentos"
        title="Pix Automático"
        description="Gere o código que libera o débito automático no checkout do site. Cada código vale para um checkout e expira em 24 horas."
        meta={
          carregando ? null : (
            <span>
              {disponiveis} {disponiveis === 1 ? 'código disponível' : 'códigos disponíveis'}
            </span>
          )
        }
        primaryAction={
          <Button onClick={gerar} disabled={gerando}>
            {gerando ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Gerar código
          </Button>
        }
        actions={
          <Button variant="outline" onClick={() => void carregar()} disabled={carregando}>
            <RefreshCw className={`mr-2 h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        }
      />

      {erro ? <ErrorBanner message={erro} onRetry={() => void carregar()} /> : null}

      <Panel className="mb-4">
        <PanelHeader
          icon={Zap}
          title="Novo código"
          description="Opcional: anote para quem é, para saber depois quem usou cada código."
        />
        <div className="flex flex-col gap-2 p-4 sm:flex-row">
          <Input
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void gerar()
              }
            }}
            placeholder="Nome ou telefone do cliente"
            className="flex-1"
          />
          <Button onClick={gerar} disabled={gerando} className="sm:w-auto">
            {gerando ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Gerar
          </Button>
        </div>
      </Panel>

      <Panel>
        <PanelHeader icon={KeyRound} title="Últimos códigos" />

        {carregando ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded border border-line bg-surface-sunken" />
            ))}
          </div>
        ) : tokens.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title="Nenhum código gerado ainda"
            description="Gere um código quando um cliente pedir para pagar com débito automático."
            action={
              <Button onClick={gerar} disabled={gerando}>
                <Plus className="mr-2 h-4 w-4" />
                Gerar o primeiro
              </Button>
            }
          />
        ) : (
          <div className="space-y-2 p-4">
            {tokens.map((token) => {
              const situacao = situacaoDoToken(token)
              const disponivel = situacao.estado === 'disponivel'
              const emAcao = agindo.has(token.codigo)
              return (
                <div
                  key={token.codigo}
                  className="flex flex-col gap-3 rounded border border-line p-3 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-lg tracking-wider">{token.codigo}</span>
                      <StatusPill tone={situacao.tone}>{situacao.rotulo}</StatusPill>
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">
                      {disponivel
                        ? `Expira em ${formatarQuando(token.expira_em)}`
                        : token.usado_em
                          ? `Usado em ${formatarQuando(token.usado_em)}${token.usado_por_nome ? ` por ${token.usado_por_nome}` : ''}`
                          : `Expirou em ${formatarQuando(token.expira_em)}`}
                      {token.observacao ? ` · ${token.observacao}` : ''}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {disponivel ? (
                      <Button variant="outline" size="sm" onClick={() => void copiar(token.codigo)}>
                        {copiado === token.codigo ? (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            Copiado
                          </>
                        ) : (
                          <>
                            <Copy className="mr-2 h-4 w-4" />
                            Copiar
                          </>
                        )}
                      </Button>
                    ) : null}
                    {situacao.estado !== 'usado' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void prorrogar(token)}
                        disabled={emAcao}
                        title="Vale por mais 24 horas a partir de agora"
                      >
                        {emAcao ? (
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        ) : disponivel ? (
                          <CalendarPlus className="mr-2 h-4 w-4" />
                        ) : (
                          <RotateCcw className="mr-2 h-4 w-4" />
                        )}
                        {disponivel ? 'Prorrogar' : 'Reativar'}
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => void excluir(token)}
                      disabled={emAcao}
                      title="Excluir código"
                      aria-label={`Excluir o código ${token.codigo}`}
                      className="text-ink-muted hover:text-danger"
                    >
                      {emAcao ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Panel>
    </PageShell>
  )
}
