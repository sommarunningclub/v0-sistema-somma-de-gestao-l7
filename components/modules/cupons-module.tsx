'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Percent, Plus, RefreshCw, Search, Ticket, Trash2, Users } from 'lucide-react'

import { apiFetch } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ErrorBanner } from '@/components/ui/error-banner'
import {
  EmptyState,
  NoResultsState,
  PageHeader,
  PageShell,
  Panel,
  PanelHeader,
  ResponsiveModal,
  StatusPill,
  confirmAction,
  notify,
  type StatusTone,
} from '@/components/somma'
import {
  PLANOS,
  PROFESSORES,
  descreverDesconto,
  descreverRegras,
  normalizarCodigo,
  situacaoDoCupom,
  type Cupom,
  type TipoCupom,
  type TipoPlano,
} from '@/lib/cupons/tipos'
import { ehLegado } from '@/lib/cupons/legados'
import {
  descreverAbatimento,
  descreverCobranca,
  situacaoDoUso,
  type UsoCupom,
} from '@/lib/cupons/usos'
import { formatarDataHora } from '@/lib/nps/periodo'

// Cupons do checkout da Assessoria.
//
// O sommaclub.com.br consulta esta tabela a cada tentativa de compra, antes da
// lista hardcoded dele. Salvar aqui publica na hora — por isso a tela repete
// isso no cabeçalho: não é um rascunho que alguém revisa depois, é o preço que
// o próximo cliente vai pagar.

const TONE: Record<ReturnType<typeof situacaoDoCupom>['estado'], StatusTone> = {
  ativo: 'success',
  desativado: 'neutral',
  expirado: 'neutral',
  esgotado: 'warning',
}

const SEM_RESTRICAO = 'todos'

interface Formulario {
  code: string
  type: TipoCupom
  value: string
  description: string
  expiration_date: string
  usage_limit: string
  professor: string
  plan_type: string
  first_month_only: boolean
  ativo: boolean
}

const FORM_VAZIO: Formulario = {
  code: '',
  type: 'PERCENTAGE',
  value: '',
  description: '',
  expiration_date: '',
  usage_limit: '',
  professor: SEM_RESTRICAO,
  plan_type: SEM_RESTRICAO,
  first_month_only: false,
  ativo: true,
}

function formDoCupom(cupom: Cupom): Formulario {
  return {
    code: cupom.code,
    type: cupom.type,
    value: String(cupom.value),
    description: cupom.description ?? '',
    expiration_date: cupom.expiration_date ?? '',
    usage_limit: cupom.usage_limit === null ? '' : String(cupom.usage_limit),
    professor: cupom.professor ?? SEM_RESTRICAO,
    plan_type: cupom.plan_type ?? SEM_RESTRICAO,
    first_month_only: cupom.first_month_only,
    ativo: cupom.status !== 'DISABLED',
  }
}

export function CuponsModule() {
  const [cupons, setCupons] = useState<Cupom[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')

  const [editando, setEditando] = useState<Cupom | null>(null)
  const [formAberto, setFormAberto] = useState(false)
  const [form, setForm] = useState<Formulario>(FORM_VAZIO)
  const [erroForm, setErroForm] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  // Linhas com ação em andamento: trava só os botões daquela linha, em vez de
  // congelar a lista inteira enquanto um cupom é desativado.
  const [agindo, setAgindo] = useState<ReadonlySet<string>>(new Set())

  // Quem usou: lista carregada sob demanda, um cupom por vez.
  const [usosDe, setUsosDe] = useState<Cupom | null>(null)
  const [usos, setUsos] = useState<UsoCupom[]>([])
  const [carregandoUsos, setCarregandoUsos] = useState(false)
  const [erroUsos, setErroUsos] = useState<string | null>(null)

  const marcarAgindo = (id: string, ativo: boolean) => {
    setAgindo((atual) => {
      const proximo = new Set(atual)
      if (ativo) proximo.add(id)
      else proximo.delete(id)
      return proximo
    })
  }

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const res = await apiFetch('/api/coupons')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar os cupons')
      setCupons(data.cupons ?? [])
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar os cupons')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return cupons
    return cupons.filter(
      (c) =>
        c.code.toLowerCase().includes(termo) ||
        (c.description ?? '').toLowerCase().includes(termo) ||
        (c.professor ?? '').toLowerCase().includes(termo)
    )
  }, [busca, cupons])

  const ativos = useMemo(
    () => cupons.filter((c) => situacaoDoCupom(c).estado === 'ativo').length,
    [cupons]
  )

  const abrirNovo = () => {
    setEditando(null)
    setForm(FORM_VAZIO)
    setErroForm(null)
    setFormAberto(true)
  }

  const abrirEdicao = (cupom: Cupom) => {
    setEditando(cupom)
    setForm(formDoCupom(cupom))
    setErroForm(null)
    setFormAberto(true)
  }

  const salvar = async () => {
    setSalvando(true)
    setErroForm(null)

    const payload = {
      code: normalizarCodigo(form.code),
      type: form.type,
      value: Number(String(form.value).replace(',', '.')),
      description: form.description,
      expiration_date: form.expiration_date || null,
      usage_limit: form.usage_limit === '' ? null : Number(form.usage_limit),
      professor: form.professor === SEM_RESTRICAO ? null : form.professor,
      plan_type: form.plan_type === SEM_RESTRICAO ? null : (form.plan_type as TipoPlano),
      first_month_only: form.first_month_only,
      status: form.ativo ? 'ACTIVE' : 'DISABLED',
    }

    try {
      const res = await apiFetch(editando ? `/api/coupons/${editando.id}` : '/api/coupons', {
        method: editando ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar o cupom')

      setFormAberto(false)
      notify.success(
        editando ? `Cupom ${payload.code} atualizado` : `Cupom ${payload.code} criado`,
        { description: payload.status === 'ACTIVE' ? 'Já vale no checkout do site.' : undefined }
      )
      await carregar()
    } catch (err) {
      // No banner do formulário, não em toast: o erro pertence ao campo que a
      // pessoa ainda tem na frente para corrigir.
      setErroForm(err instanceof Error ? err.message : 'Erro ao salvar o cupom')
    } finally {
      setSalvando(false)
    }
  }

  const alternarStatus = async (cupom: Cupom) => {
    const ativando = cupom.status === 'DISABLED'
    marcarAgindo(cupom.id, true)
    try {
      const res = await apiFetch(`/api/coupons/${cupom.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: cupom.code,
          type: cupom.type,
          value: cupom.value,
          description: cupom.description,
          expiration_date: cupom.expiration_date,
          usage_limit: cupom.usage_limit,
          professor: cupom.professor,
          plan_type: cupom.plan_type,
          first_month_only: cupom.first_month_only,
          status: ativando ? 'ACTIVE' : 'DISABLED',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao alterar o cupom')

      setCupons((atuais) => atuais.map((c) => (c.id === cupom.id ? data.cupom : c)))
      notify.success(
        ativando ? `${cupom.code} ativado` : `${cupom.code} desativado`,
        {
          description: ativando
            ? 'Já vale no checkout do site.'
            : 'O checkout recusa esse código a partir de agora.',
        }
      )
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Erro ao alterar o cupom')
    } finally {
      marcarAgindo(cupom.id, false)
    }
  }

  const excluir = async (cupom: Cupom) => {
    const legado = ehLegado(cupom.code)
    const ok = await confirmAction({
      title: legado ? 'Excluir não tira este cupom do ar' : 'Excluir este cupom?',
      description: legado
        ? 'Este código também está escrito no código do site. Excluindo aqui, o checkout volta a usar a regra antiga e o cupom continua funcionando. Para tirar de circulação, use Desativar.'
        : 'O código deixa de funcionar no checkout imediatamente. Esta ação não pode ser desfeita.',
      detail: (
        <>
          <span className="block font-mono font-medium tracking-wider text-ink-strong">
            {cupom.code}
          </span>
          <span className="block text-ink-muted">{descreverDesconto(cupom)}</span>
        </>
      ),
      tone: 'danger',
      confirmLabel: legado ? 'Excluir mesmo assim' : 'Excluir cupom',
    })
    if (!ok) return

    marcarAgindo(cupom.id, true)
    try {
      const res = await apiFetch(`/api/coupons/${cupom.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erro ao excluir o cupom')

      setCupons((atuais) => atuais.filter((c) => c.id !== cupom.id))
      notify.success(`Cupom ${cupom.code} excluído`)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Erro ao excluir o cupom')
    } finally {
      marcarAgindo(cupom.id, false)
    }
  }

  const abrirUsos = async (cupom: Cupom) => {
    setUsosDe(cupom)
    setUsos([])
    setErroUsos(null)
    setCarregandoUsos(true)
    try {
      const res = await apiFetch(`/api/coupons/${cupom.id}/usos`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar os usos')
      setUsos(data.usos ?? [])
    } catch (err) {
      setErroUsos(err instanceof Error ? err.message : 'Erro ao carregar os usos')
    } finally {
      setCarregandoUsos(false)
    }
  }

  // Parcelado não tem "primeira mensalidade": o site ignora a combinação, e a
  // API recusa. Melhor a tela não deixar chegar lá.
  const primeiroMesIndisponivel = form.plan_type === 'installment'

  return (
    <PageShell>
      <PageHeader
        eyebrow="Pagamentos"
        title="Cupons"
        description="Descontos do checkout da Assessoria. O site consulta esta lista a cada compra: salvar aqui vale no próximo checkout, sem publicação."
        meta={
          carregando ? null : (
            <span>
              {ativos} {ativos === 1 ? 'cupom ativo' : 'cupons ativos'} de {cupons.length}
            </span>
          )
        }
        primaryAction={
          <Button onClick={abrirNovo}>
            <Plus className="mr-2 h-4 w-4" />
            Novo cupom
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

      <Panel>
        <PanelHeader icon={Ticket} title="Cupons cadastrados" />

        <div className="border-b border-line p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por código, descrição ou professor"
              className="pl-9"
              aria-label="Buscar cupons"
            />
          </div>
        </div>

        {carregando ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded border border-line bg-surface-sunken" />
            ))}
          </div>
        ) : cupons.length === 0 ? (
          <EmptyState
            icon={Ticket}
            title="Nenhum cupom cadastrado"
            description="Crie um cupom para liberar desconto no checkout da Assessoria."
            action={
              <Button onClick={abrirNovo}>
                <Plus className="mr-2 h-4 w-4" />
                Criar o primeiro
              </Button>
            }
          />
        ) : filtrados.length === 0 ? (
          <NoResultsState query={busca} onClear={() => setBusca('')} />
        ) : (
          <div className="space-y-2 p-4">
            {filtrados.map((cupom) => {
              const situacao = situacaoDoCupom(cupom)
              const regras = descreverRegras(cupom)
              const emAcao = agindo.has(cupom.id)
              return (
                <div
                  key={cupom.id}
                  className="flex flex-col gap-3 rounded border border-line p-3 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-lg tracking-wider">{cupom.code}</span>
                      <StatusPill tone={TONE[situacao.estado]}>{situacao.rotulo}</StatusPill>
                      <span className="text-sm text-ink-muted">{descreverDesconto(cupom)}</span>
                    </div>
                    {cupom.description ? (
                      <p className="mt-1 truncate text-xs text-ink-muted">{cupom.description}</p>
                    ) : null}
                    {regras.length > 0 ? (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {regras.map((regra) => (
                          <span
                            key={regra}
                            className="rounded border border-line px-1.5 py-0.5 text-[11px] text-ink-muted"
                          >
                            {regra}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Switch
                      checked={cupom.status !== 'DISABLED'}
                      onCheckedChange={() => void alternarStatus(cupom)}
                      disabled={emAcao}
                      aria-label={`${cupom.status === 'DISABLED' ? 'Ativar' : 'Desativar'} o cupom ${cupom.code}`}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void abrirUsos(cupom)}
                      disabled={emAcao}
                      title="Quem usou este cupom"
                      aria-label={`Ver os ${cupom.usage_count} usos do cupom ${cupom.code}`}
                    >
                      <Users className="mr-2 h-4 w-4" />
                      {cupom.usage_count} {cupom.usage_count === 1 ? 'uso' : 'usos'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => abrirEdicao(cupom)}
                      disabled={emAcao}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => void excluir(cupom)}
                      disabled={emAcao}
                      title="Excluir cupom"
                      aria-label={`Excluir o cupom ${cupom.code}`}
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
          title={editando ? 'Editar cupom' : 'Novo cupom'}
          description={
            editando
              ? `${editando.code} · usado ${editando.usage_count} ${editando.usage_count === 1 ? 'vez' : 'vezes'}`
              : 'Vale no checkout assim que for salvo como ativo.'
          }
          size="lg"
          dismissible={false}
          footer={
            <>
              <Button variant="outline" onClick={() => setFormAberto(false)} disabled={salvando}>
                Cancelar
              </Button>
              <Button onClick={() => void salvar()} disabled={salvando}>
                {salvando ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editando ? 'Salvar' : 'Criar cupom'}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {erroForm ? <ErrorBanner message={erroForm} /> : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cupom-codigo">Código</Label>
                <Input
                  id="cupom-codigo"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: normalizarCodigo(e.target.value) }))}
                  placeholder="BLACKFRIDAY"
                  className="font-mono tracking-wider"
                  autoFocus={!editando}
                />
                <p className="text-xs text-ink-muted">É o que o cliente digita no checkout.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cupom-valor">Desconto</Label>
                <div className="flex gap-2">
                  <Select
                    value={form.type}
                    onValueChange={(v) => setForm((f) => ({ ...f, type: v as TipoCupom }))}
                  >
                    <SelectTrigger className="w-[7.5rem]" aria-label="Tipo de desconto">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENTAGE">Percentual</SelectItem>
                      <SelectItem value="FIXED">Em reais</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    id="cupom-valor"
                    value={form.value}
                    onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                    inputMode="decimal"
                    placeholder={form.type === 'PERCENTAGE' ? '10' : '50,00'}
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-ink-muted">
                  {form.type === 'PERCENTAGE'
                    ? 'Percentual sobre a mensalidade ou a parcela.'
                    : 'Valor abatido de cada mensalidade ou parcela.'}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cupom-descricao">Descrição</Label>
              <Textarea
                id="cupom-descricao"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Campanha de aniversário — divulgação no Instagram"
                rows={2}
              />
              <p className="text-xs text-ink-muted">
                Aparece para o cliente no resumo do checkout.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cupom-validade">Validade</Label>
                <Input
                  id="cupom-validade"
                  type="date"
                  value={form.expiration_date}
                  onChange={(e) => setForm((f) => ({ ...f, expiration_date: e.target.value }))}
                />
                <p className="text-xs text-ink-muted">Em branco, não expira.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cupom-limite">Limite de usos</Label>
                <Input
                  id="cupom-limite"
                  value={form.usage_limit}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, usage_limit: e.target.value.replace(/\D/g, '') }))
                  }
                  inputMode="numeric"
                  placeholder="Sem limite"
                />
                <p className="text-xs text-ink-muted">
                  Conta cada checkout concluído com o cupom.
                </p>
              </div>
            </div>

            <div className="rounded border border-line p-3">
              <p className="text-sm font-medium text-ink-strong">Restrições</p>
              <p className="mb-3 text-xs text-ink-muted">
                Em branco, o cupom vale para qualquer professor e qualquer plano.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="cupom-professor">Professor</Label>
                  <Select
                    value={form.professor}
                    onValueChange={(v) => setForm((f) => ({ ...f, professor: v }))}
                  >
                    <SelectTrigger id="cupom-professor">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SEM_RESTRICAO}>Todos os professores</SelectItem>
                      {PROFESSORES.map((professor) => (
                        <SelectItem key={professor} value={professor}>
                          {professor}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cupom-plano">Plano</Label>
                  <Select
                    value={form.plan_type}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        plan_type: v,
                        first_month_only: v === 'installment' ? false : f.first_month_only,
                      }))
                    }
                  >
                    <SelectTrigger id="cupom-plano">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SEM_RESTRICAO}>Todos os planos</SelectItem>
                      {PLANOS.map((plano) => (
                        <SelectItem key={plano.valor} value={plano.valor}>
                          {plano.rotulo} — {plano.detalhe}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-4 flex items-start gap-3">
                <Switch
                  id="cupom-primeiro-mes"
                  checked={form.first_month_only}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, first_month_only: v }))}
                  disabled={primeiroMesIndisponivel}
                />
                <div>
                  <Label htmlFor="cupom-primeiro-mes" className="cursor-pointer">
                    Desconto só na 1ª mensalidade
                  </Label>
                  <p className="text-xs text-ink-muted">
                    {primeiroMesIndisponivel
                      ? 'Indisponível: plano parcelado não tem mensalidade recorrente.'
                      : 'A partir do 2º ciclo, a assinatura volta ao valor cheio.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Switch
                id="cupom-ativo"
                checked={form.ativo}
                onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))}
              />
              <div>
                <Label htmlFor="cupom-ativo" className="cursor-pointer">
                  Cupom ativo
                </Label>
                <p className="text-xs text-ink-muted">
                  {form.ativo
                    ? 'O checkout aceita este código assim que você salvar.'
                    : 'O checkout recusa este código.'}
                </p>
              </div>
            </div>

            {editando && ehLegado(editando.code) ? (
              <p className="flex gap-2 rounded border border-line bg-surface-sunken p-3 text-xs text-ink-muted">
                <Percent className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Este código também está escrito no código do site. O que estiver salvo aqui tem
                  precedência — mas, se o cupom for excluído, o checkout volta a usar a regra antiga.
                </span>
              </p>
            ) : null}
          </div>
        </ResponsiveModal>
      ) : null}
      {usosDe ? (
        <ResponsiveModal
          open
          onOpenChange={(aberto) => {
            if (!aberto) setUsosDe(null)
          }}
          title={`Quem usou ${usosDe.code}`}
          description={
            usosDe.usage_count === 0
              ? 'Ninguém usou este cupom ainda.'
              : `${usosDe.usage_count} ${usosDe.usage_count === 1 ? 'uso' : 'usos'} · ${descreverDesconto(usosDe)}`
          }
          size="lg"
          footer={
            <Button variant="outline" onClick={() => setUsosDe(null)}>
              Fechar
            </Button>
          }
        >
          {erroUsos ? (
            <ErrorBanner message={erroUsos} onRetry={() => void abrirUsos(usosDe)} />
          ) : carregandoUsos ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded border border-line bg-surface-sunken" />
              ))}
            </div>
          ) : usos.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum uso registrado"
              description="Cada compra concluída no checkout com este cupom aparece aqui, com quem usou e quanto abateu."
            />
          ) : (
            <div className="space-y-2">
              {usos.map((uso) => {
                const situacao = situacaoDoUso(uso)
                const abatimento = descreverAbatimento(uso)
                return (
                  <div key={uso.id} className="rounded border border-line p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink-strong">
                          {uso.customer_name ?? 'Cliente sem nome'}
                        </p>
                        {uso.customer_email ? (
                          <p className="truncate text-xs text-ink-muted">{uso.customer_email}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2 text-xs text-ink-muted">
                        {situacao ? <StatusPill tone={situacao.tone}>{situacao.rotulo}</StatusPill> : null}
                        <span>{formatarDataHora(uso.redeemed_at)}</span>
                      </div>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-muted">
                      <span>{descreverCobranca(uso)}</span>
                      {uso.professor ? <span>Prof. {uso.professor}</span> : null}
                      {abatimento ? <span>{abatimento}</span> : null}
                      {uso.source === 'asaas' ? (
                        <span title="Importado da descrição da cobrança no Asaas, antes de o site registrar usos">
                          Histórico do Asaas
                        </span>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ResponsiveModal>
      ) : null}
    </PageShell>
  )
}
