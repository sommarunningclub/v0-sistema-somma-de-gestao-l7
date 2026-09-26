'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Copy, KeyRound, Plus, RefreshCw, Trash2, Users } from 'lucide-react'

import { apiFetch } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ErrorBanner } from '@/components/ui/error-banner'
import {
  EmptyState,
  Panel,
  PanelHeader,
  ResponsiveModal,
  StatusPill,
  confirmAction,
  notify,
} from '@/components/somma'
import { isValidCpf, maskCpf, onlyDigits } from '@/lib/insider/validation'
import {
  formatarCodigoAcesso,
  formatarCpfOperador,
  instrucoesDeAcesso,
  instrucoesDeAcessoInsider,
  type Operador,
} from '@/lib/pdv/operadores'
import { formatPdvWhen, pdvLoginUrl } from '@/lib/pdv/types'

/*
 * Operadores da frente de caixa.
 *
 * O painel cadastra o CPF e gera um código; a pessoa entra no PDV com os dois.
 * O código aparece UMA vez, na hora em que é gerado — não existe "ver código"
 * depois, só "gerar outro". A tela é desenhada em torno disso: o momento da
 * emissão é um modal próprio, com cópia do código e das instruções prontas
 * para mandar no WhatsApp.
 *
 * Quem é SOMMA Insider (com senha) não recebe código: entra no PDV com a senha
 * do Insider Connect. O formulário avisa antes de salvar, e o modal final traz
 * as instruções sem código. "Novo código" segue disponível para todo mundo.
 */

type CodigoEmitido = {
  operador: Operador
  /** null quando o operador é Insider e entra com a própria senha. */
  codigo: string | null
  motivo: 'novo' | 'renovado'
}

type Consulta = {
  cpf: string
  nome: string | null
  jaCadastrado: boolean
  insider: boolean
  /** Quando o registro Insider foi criado; mostrado para quem libera conferir. */
  insiderDesde: string | null
}

type RespostaErro = { error?: string; code?: string }

async function lerJson<T>(res: Response): Promise<T & RespostaErro> {
  return (await res.json().catch(() => ({}))) as T & RespostaErro
}

async function copiar(texto: string, rotulo: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(texto)
    notify.success(`${rotulo} copiado`)
  } catch {
    notify.error('Não foi possível copiar', { description: 'Selecione o texto e copie manualmente.' })
  }
}

export function PdvOperadoresPanel() {
  const [operadores, setOperadores] = useState<Operador[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [agindo, setAgindo] = useState<Set<string>>(new Set())

  const [formAberto, setFormAberto] = useState(false)
  const [form, setForm] = useState({ cpf: '', nome: '', senhaInsider: true })
  // Nome que veio da consulta de CPF: se o CPF mudar, ele não vale mais.
  const nomeSugerido = useRef<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erroForm, setErroForm] = useState<string | null>(null)
  const [consulta, setConsulta] = useState<Consulta | null>(null)

  const [emitido, setEmitido] = useState<CodigoEmitido | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const res = await apiFetch('/api/pdv/operadores')
      const body = await lerJson<{ operadores: Operador[] }>(res)
      if (!res.ok) {
        setErro(body.error || 'Não foi possível carregar os operadores.')
        return
      }
      setOperadores(body.operadores ?? [])
      setErro(null)
    } catch {
      setErro('Falha de conexão ao carregar os operadores.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  // Assim que o CPF fica completo e válido, a base do clube sugere o nome e
  // avisa se aquele CPF já tem acesso — antes de a pessoa clicar em salvar.
  const cpfDigitos = onlyDigits(form.cpf)
  useEffect(() => {
    // CPF mudou: o nome sugerido pela consulta anterior era de outra pessoa.
    const anterior = nomeSugerido.current
    nomeSugerido.current = null
    if (anterior) setForm((f) => (f.nome === anterior ? { ...f, nome: '' } : f))

    if (!formAberto || cpfDigitos.length !== 11 || !isValidCpf(cpfDigitos)) {
      setConsulta(null)
      return
    }
    setConsulta(null)
    let cancelado = false
    ;(async () => {
      const res = await apiFetch(`/api/pdv/operadores/lookup?cpf=${cpfDigitos}`)
      const body = await lerJson<{
        nome: string | null
        ja_cadastrado: boolean
        insider: boolean
        insider_desde: string | null
      }>(res)
      if (cancelado || !res.ok) return
      const nome = body.nome ?? null
      setConsulta({
        cpf: cpfDigitos,
        nome,
        jaCadastrado: Boolean(body.ja_cadastrado),
        insider: Boolean(body.insider),
        insiderDesde: body.insider_desde ?? null,
      })
      if (nome) {
        setForm((f) => (f.nome.trim() ? f : { ...f, nome }))
        nomeSugerido.current = nome
      }
    })().catch(() => {
      /* sugestão é conveniência; o cadastro segue sem ela */
    })
    return () => {
      cancelado = true
    }
  }, [formAberto, cpfDigitos])

  function abrirNovo() {
    setForm({ cpf: '', nome: '', senhaInsider: true })
    nomeSugerido.current = null
    setErroForm(null)
    setConsulta(null)
    setFormAberto(true)
  }

  async function comAcao<T>(id: string, fn: () => Promise<T>): Promise<T> {
    setAgindo((s) => new Set(s).add(id))
    try {
      return await fn()
    } finally {
      setAgindo((s) => {
        const proximo = new Set(s)
        proximo.delete(id)
        return proximo
      })
    }
  }

  async function salvar() {
    if (salvando) return
    setErroForm(null)

    if (!isValidCpf(cpfDigitos)) {
      setErroForm('Confira o CPF: os dígitos verificadores não conferem.')
      return
    }
    if (consulta?.jaCadastrado) {
      setErroForm('Este CPF já tem acesso ao PDV. Para trocar o código, use "Novo código" na lista.')
      return
    }

    setSalvando(true)
    try {
      const res = await apiFetch('/api/pdv/operadores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cpf: cpfDigitos,
          nome: form.nome.trim(),
          senha_insider: form.senhaInsider,
        }),
      })
      const body = await lerJson<{ operador: Operador; codigo: string | null }>(res)
      if (!res.ok) {
        setErroForm(body.error || 'Não foi possível cadastrar o operador.')
        return
      }
      setFormAberto(false)
      setEmitido({ operador: body.operador, codigo: body.codigo ?? null, motivo: 'novo' })
      notify.success(body.codigo ? 'Operador cadastrado' : 'Acesso liberado para o Insider')
      await carregar()
    } catch {
      setErroForm('Falha de conexão ao cadastrar o operador.')
    } finally {
      setSalvando(false)
    }
  }

  async function novoCodigo(operador: Operador) {
    const confirmado = await confirmAction({
      title: `Gerar um novo código para ${operador.nome}?`,
      description:
        'O código atual deixa de valer na hora. Quem estiver com o PDV aberto continua até sair; para entrar de novo, precisa do código novo.',
      confirmLabel: 'Gerar novo código',
    })
    if (!confirmado) return

    await comAcao(operador.id, async () => {
      try {
        const res = await apiFetch(`/api/pdv/operadores/${operador.id}/codigo`, { method: 'POST' })
        const body = await lerJson<{ operador: Operador; codigo: string }>(res)
        if (!res.ok) {
          notify.error('Não foi possível gerar o código', { description: body.error })
          return
        }
        setEmitido({ operador: body.operador, codigo: body.codigo, motivo: 'renovado' })
        setOperadores((lista) => lista.map((o) => (o.id === operador.id ? body.operador : o)))
      } catch {
        notify.error('Falha de conexão ao gerar o código')
      }
    })
  }

  async function alternarAtivo(operador: Operador) {
    const ativo = !operador.ativo
    if (!ativo) {
      const confirmado = await confirmAction({
        title: `Desativar o acesso de ${operador.nome}?`,
        description:
          'A pessoa não consegue mais entrar nem cobrar no PDV. O cadastro e o histórico de vendas ficam; dá para reativar depois.',
        confirmLabel: 'Desativar',
      })
      if (!confirmado) return
    }

    await comAcao(operador.id, async () => {
      try {
        const res = await apiFetch(`/api/pdv/operadores/${operador.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ativo }),
        })
        const body = await lerJson<{ operador: Operador }>(res)
        if (!res.ok) {
          notify.error('Não foi possível alterar o operador', { description: body.error })
          return
        }
        setOperadores((lista) => lista.map((o) => (o.id === operador.id ? body.operador : o)))
        notify.success(ativo ? 'Acesso reativado' : 'Acesso desativado')
      } catch {
        notify.error('Falha de conexão ao alterar o operador')
      }
    })
  }

  async function remover(operador: Operador) {
    const confirmado = await confirmAction({
      title: `Remover ${operador.nome} do PDV?`,
      description:
        'Apaga o acesso de vez. As vendas já feitas continuam registradas, mas deixam de apontar para este operador. Se for só um afastamento, prefira desativar.',
      confirmLabel: 'Remover',
      tone: 'danger',
    })
    if (!confirmado) return

    await comAcao(operador.id, async () => {
      try {
        const res = await apiFetch(`/api/pdv/operadores/${operador.id}`, { method: 'DELETE' })
        const body = await lerJson<{ ok: boolean }>(res)
        if (!res.ok) {
          notify.error('Não foi possível remover o operador', { description: body.error })
          return
        }
        setOperadores((lista) => lista.filter((o) => o.id !== operador.id))
        notify.success('Operador removido')
      } catch {
        notify.error('Falha de conexão ao remover o operador')
      }
    })
  }

  const ativos = operadores.filter((o) => o.ativo).length
  const entraPorSenhaInsider = Boolean(consulta?.insider && form.senhaInsider)

  return (
    <>
      <Panel>
        <PanelHeader
          icon={Users}
          title="Operadores da frente de caixa"
          description="Quem cobra no PDV entra com o CPF e um código gerado aqui. Insider entra com a senha do Insider Connect."
          actions={
            <Button size="sm" onClick={abrirNovo}>
              <Plus aria-hidden="true" />
              Novo operador
            </Button>
          }
        />

        {erro ? (
          <div className="p-4">
            <ErrorBanner message={erro} onRetry={() => void carregar()} />
          </div>
        ) : null}

        {carregando ? (
          <div className="space-y-2 p-4">
            {[0, 1].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded border border-line bg-surface-sunken" />
            ))}
          </div>
        ) : operadores.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title="Nenhum operador cadastrado"
            description="Cadastre o CPF de quem vai operar o caixa. O código gerado é a senha dessa pessoa no PDV."
            action={
              <Button onClick={abrirNovo}>
                <Plus aria-hidden="true" />
                Cadastrar o primeiro
              </Button>
            }
          />
        ) : (
          <div className="space-y-2 p-4">
            <p className="text-meta text-ink-muted">
              {ativos} {ativos === 1 ? 'ativo' : 'ativos'} de {operadores.length}
            </p>
            {operadores.map((operador) => {
              const emAcao = agindo.has(operador.id)
              return (
                <div
                  key={operador.id}
                  className="flex flex-col gap-3 rounded border border-line p-3 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink-strong">{operador.nome}</span>
                      <StatusPill tone={operador.ativo ? 'success' : 'neutral'}>
                        {operador.ativo ? 'Ativo' : 'Desativado'}
                      </StatusPill>
                      {operador.insider ? <StatusPill tone="brand">Insider</StatusPill> : null}
                      <code className="text-xs text-ink-muted">{formatarCpfOperador(operador.cpf)}</code>
                    </div>
                    <p className="mt-1 text-meta text-ink-muted">
                      {operador.insider
                        ? 'Entra com a senha do Insider Connect'
                        : `Código gerado em ${formatPdvWhen(operador.codigo_gerado_em)}`}{' '}
                      ·{' '}
                      {operador.ultimo_acesso_em
                        ? `último acesso ${formatPdvWhen(operador.ultimo_acesso_em)}`
                        : 'nunca entrou'}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Switch
                      checked={operador.ativo}
                      onCheckedChange={() => void alternarAtivo(operador)}
                      disabled={emAcao}
                      aria-label={`${operador.ativo ? 'Desativar' : 'Reativar'} o acesso de ${operador.nome}`}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void novoCodigo(operador)}
                      disabled={emAcao || !operador.ativo}
                      title="Gera outro código e invalida o atual"
                    >
                      <KeyRound aria-hidden="true" />
                      Novo código
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => void remover(operador)}
                      disabled={emAcao}
                      title="Remover operador"
                      aria-label={`Remover ${operador.nome} do PDV`}
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

      {formAberto ? (
        <ResponsiveModal
          open
          onOpenChange={(aberto) => {
            if (!aberto && !salvando) setFormAberto(false)
          }}
          title="Novo operador"
          description={
            entraPorSenhaInsider
              ? 'Insider entra com a própria senha do Insider Connect; nenhum código é gerado.'
              : 'O código de acesso aparece assim que o cadastro for salvo.'
          }
          dismissible={false}
          footer={
            <>
              <Button variant="outline" onClick={() => setFormAberto(false)} disabled={salvando}>
                Cancelar
              </Button>
              <Button onClick={() => void salvar()} disabled={salvando}>
                {salvando ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
                {entraPorSenhaInsider ? 'Liberar acesso' : 'Cadastrar e gerar código'}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {erroForm ? <ErrorBanner message={erroForm} /> : null}

            <div className="space-y-1.5">
              <Label htmlFor="operador-cpf">CPF</Label>
              <Input
                id="operador-cpf"
                value={form.cpf}
                onChange={(e) => setForm((f) => ({ ...f, cpf: maskCpf(e.target.value) }))}
                inputMode="numeric"
                autoComplete="off"
                placeholder="000.000.000-00"
                className="font-mono tracking-wider"
                autoFocus
              />
              <p className="text-xs text-ink-muted">
                {consulta?.jaCadastrado
                  ? 'Este CPF já tem acesso ao PDV.'
                  : consulta?.insider
                    ? 'Encontrado no SOMMA Insider, com senha criada.'
                    : consulta && consulta.nome
                      ? 'Encontrado na base do clube — confira o nome abaixo.'
                      : consulta
                        ? 'Não está na base do clube. Informe o nome.'
                        : 'É com ele que a pessoa entra no PDV.'}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="operador-nome">Nome</Label>
              <Input
                id="operador-nome"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                autoComplete="off"
                placeholder="Como aparece na lista de operadores"
                maxLength={120}
              />
            </div>

            {consulta?.insider && !consulta.jaCadastrado ? (
              <div className="flex items-start gap-3 rounded border border-line p-3">
                <Switch
                  id="operador-senha-insider"
                  checked={form.senhaInsider}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, senhaInsider: v }))}
                />
                <div className="space-y-1">
                  <Label htmlFor="operador-senha-insider" className="cursor-pointer">
                    Entrar com a senha do Insider Connect
                  </Label>
                  <p className="text-xs text-ink-muted">
                    Registro Insider criado em {formatPdvWhen(consulta.insiderDesde)}. O cadastro
                    Insider é aberto ao público: confira se o nome acima é mesmo de quem vai operar
                    o caixa. Desligado, o painel gera um código.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </ResponsiveModal>
      ) : null}

      {emitido ? (
        <ResponsiveModal
          open
          onOpenChange={(aberto) => {
            if (!aberto) setEmitido(null)
          }}
          title={
            emitido.codigo === null
              ? 'Acesso liberado'
              : emitido.motivo === 'novo'
                ? 'Código de acesso gerado'
                : 'Novo código de acesso'
          }
          description={
            emitido.codigo === null
              ? 'Insider: entra no PDV com o CPF e a senha do Insider Connect. Nenhum código foi gerado.'
              : 'Este código só aparece agora. Se a pessoa perder, gere outro.'
          }
          footer={
            <>
              <Button
                variant="outline"
                onClick={() =>
                  void copiar(
                    emitido.codigo === null
                      ? instrucoesDeAcessoInsider({
                          nome: emitido.operador.nome,
                          cpf: emitido.operador.cpf,
                          loginUrl: pdvLoginUrl(),
                        })
                      : instrucoesDeAcesso({
                          nome: emitido.operador.nome,
                          cpf: emitido.operador.cpf,
                          codigo: emitido.codigo,
                          loginUrl: pdvLoginUrl(),
                        }),
                    'Texto com as instruções'
                  )
                }
              >
                <Copy aria-hidden="true" />
                Copiar instruções
              </Button>
              <Button onClick={() => setEmitido(null)}>
                <Check aria-hidden="true" />
                Pronto
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <dl className="space-y-2 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="shrink-0 text-ink-muted">Operador</dt>
                <dd className="text-right font-medium text-ink">{emitido.operador.nome}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="shrink-0 text-ink-muted">CPF</dt>
                <dd className="text-right font-mono text-ink">
                  {formatarCpfOperador(emitido.operador.cpf)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="shrink-0 text-ink-muted">Entra em</dt>
                <dd className="break-all text-right text-ink">{pdvLoginUrl()}</dd>
              </div>
            </dl>

            {emitido.codigo === null ? (
              <div className="rounded border border-line bg-surface-sunken p-4 text-sm text-ink">
                Na tela de login, a pessoa toca em <strong>Senha do Insider</strong> e usa a
                mesma senha do Insider Connect. Se preferir um código, use{' '}
                <strong>Novo código</strong> na lista.
              </div>
            ) : (
              <div className="rounded border border-line bg-surface-sunken p-4 text-center">
                <p className="text-meta font-semibold uppercase tracking-wider text-ink-muted">
                  Código de acesso
                </p>
                <p className="mt-2 select-all font-mono text-3xl font-semibold tracking-[0.2em] text-ink-strong">
                  {formatarCodigoAcesso(emitido.codigo)}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() => void copiar(formatarCodigoAcesso(emitido.codigo ?? ''), 'Código')}
                >
                  <Copy aria-hidden="true" />
                  Copiar código
                </Button>
              </div>
            )}
          </div>
        </ResponsiveModal>
      ) : null}
    </>
  )
}
