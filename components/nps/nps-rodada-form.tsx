'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ResponsiveModal, notify } from '@/components/somma'
import { apiFetch } from '@/lib/api-client'
import { linkDaRodada } from '@/lib/nps/links'
import {
  bimestresParaEscolha,
  deCampoDataHora,
  formatarDataHora,
  janelaSugerida,
  lerReferencia,
  paraCampoDataHora,
  referenciaDoBimestre,
  rotuloDoBimestre,
  slugDoBimestre,
  tituloPadrao,
} from '@/lib/nps/periodo'
import { SLUG_RE } from '@/lib/nps/validacao'
import type { Rodada } from '@/lib/nps/tipos'

interface NpsRodadaFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Editando: a rodada. Criando: omitido. */
  rodada?: Rodada | null
  /** Bimestres que já têm rodada, para sugerir o próximo livre. */
  periodosExistentes?: string[]
  onSalva: (rodada: Rodada) => void
}

type Erros = Partial<Record<'referencia' | 'titulo' | 'slug' | 'abre' | 'fecha', string>>

export const CAMPO_SELECT =
  'h-11 w-full rounded-md border border-line bg-surface-sunken px-3 text-base text-ink focus-visible:border-brand focus-visible:outline-none sm:text-sm'

/**
 * Criar e editar rodada. Escolher o bimestre preenche título, código do link e
 * uma janela de 15 dias; o que a pessoa editar à mão deixa de ser sobrescrito.
 */
export function NpsRodadaForm({ open, onOpenChange, rodada, periodosExistentes = [], onSalva }: NpsRodadaFormProps) {
  const editando = Boolean(rodada)
  const podeMudarLink = !rodada || rodada.status === 'draft'
  const opcoes = useMemo(() => bimestresParaEscolha(new Date()), [])

  const [referencia, setReferencia] = useState('')
  const [titulo, setTitulo] = useState('')
  const [slug, setSlug] = useState('')
  const [abre, setAbre] = useState('')
  const [fecha, setFecha] = useState('')
  const [publicar, setPublicar] = useState(false)
  const [editados, setEditados] = useState({ titulo: false, slug: false, janela: false })
  const [erros, setErros] = useState<Erros>({})
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!open) return
    setErros({})
    setPublicar(false)
    if (rodada) {
      setReferencia(rodada.reference_period)
      setTitulo(rodada.title)
      setSlug(rodada.slug)
      setAbre(paraCampoDataHora(rodada.opens_at))
      setFecha(paraCampoDataHora(rodada.closes_at))
      setEditados({ titulo: true, slug: true, janela: true })
      return
    }
    // Sugere o primeiro bimestre, do atual em diante, que ainda não tem rodada.
    const livres = opcoes.slice(1).filter((b) => !periodosExistentes.includes(referenciaDoBimestre(b)))
    const b = livres[0] ?? opcoes[1]
    setEditados({ titulo: false, slug: false, janela: false })
    aplicarBimestre(referenciaDoBimestre(b), { titulo: false, slug: false, janela: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rodada])

  function aplicarBimestre(ref: string, marcados = editados) {
    setReferencia(ref)
    const b = lerReferencia(ref)
    if (!b) return
    if (!marcados.titulo) setTitulo(tituloPadrao(b))
    if (!marcados.slug && podeMudarLink) setSlug(slugDoBimestre(b))
    if (!marcados.janela) {
      const j = janelaSugerida(b, new Date())
      setAbre(paraCampoDataHora(j.abre.toISOString()))
      setFecha(paraCampoDataHora(j.fecha.toISOString()))
    }
  }

  function validar(): Erros {
    const e: Erros = {}
    if (!lerReferencia(referencia)) e.referencia = 'Escolha o bimestre.'
    if (titulo.trim().length < 3) e.titulo = 'Dê um título para a rodada.'
    const codigo = slug.trim().toLowerCase()
    if (!SLUG_RE.test(codigo) || codigo.length < 3) e.slug = 'Use letras minúsculas, números e hífens (mínimo 3).'
    else if (codigo === 'convite') e.slug = 'Este código é reservado.'
    const abreIso = deCampoDataHora(abre)
    const fechaIso = deCampoDataHora(fecha)
    if (!abreIso) e.abre = 'Informe quando a rodada abre.'
    if (!fechaIso) e.fecha = 'Informe quando a rodada fecha.'
    if (abreIso && fechaIso && new Date(fechaIso) <= new Date(abreIso)) e.fecha = 'O fechamento precisa ser depois da abertura.'
    return e
  }

  async function salvar() {
    const e = validar()
    setErros(e)
    if (Object.keys(e).length > 0) return

    setSalvando(true)
    try {
      const corpo: Record<string, unknown> = {
        title: titulo.trim(),
        reference_period: referencia,
        opens_at: deCampoDataHora(abre),
        closes_at: deCampoDataHora(fecha),
      }
      if (podeMudarLink) corpo.slug = slug.trim().toLowerCase()
      if (!editando) corpo.publicar = publicar

      const res = await apiFetch(editando ? `/api/nps/rodadas/${rodada?.id}` : '/api/nps/rodadas', {
        method: editando ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Não foi possível salvar a rodada.')
      onSalva(data.rodada as Rodada)
    } catch (err) {
      notify.error('Não foi possível salvar', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setSalvando(false)
    }
  }

  const abreIso = deCampoDataHora(abre)
  const codigo = slug.trim().toLowerCase()

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={editando ? 'Editar rodada' : 'Nova rodada'}
      description="O questionário é o mesmo em todas as rodadas, para o NPS ser comparável ao longo do tempo."
      size="lg"
      dismissible={!salvando}
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar()} disabled={salvando}>
            {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : publicar ? 'Criar e publicar' : 'Criar rascunho'}
          </Button>
        </div>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          void salvar()
        }}
        noValidate
      >
        <div>
          <Label htmlFor="nps-bimestre">Bimestre</Label>
          <select
            id="nps-bimestre"
            className={`${CAMPO_SELECT} mt-1.5`}
            value={referencia}
            onChange={(e) => aplicarBimestre(e.target.value)}
            aria-invalid={Boolean(erros.referencia) || undefined}
          >
            {!opcoes.some((b) => referenciaDoBimestre(b) === referencia) && referencia ? (
              <option value={referencia}>{referencia}</option>
            ) : null}
            {opcoes.map((b) => {
              const ref = referenciaDoBimestre(b)
              const usado = periodosExistentes.includes(ref) && ref !== rodada?.reference_period
              return (
                <option key={ref} value={ref}>
                  {rotuloDoBimestre(b)}
                  {usado ? ' (já tem rodada)' : ''}
                </option>
              )
            })}
          </select>
          {erros.referencia ? <p className="mt-1.5 text-meta text-danger">{erros.referencia}</p> : null}
        </div>

        <div>
          <Label htmlFor="nps-titulo">Título</Label>
          <Input
            id="nps-titulo"
            className="mt-1.5"
            value={titulo}
            maxLength={120}
            onChange={(e) => {
              setTitulo(e.target.value)
              setEditados((x) => ({ ...x, titulo: true }))
            }}
            aria-invalid={Boolean(erros.titulo) || undefined}
          />
          {erros.titulo ? <p className="mt-1.5 text-meta text-danger">{erros.titulo}</p> : null}
        </div>

        <div>
          <Label htmlFor="nps-slug">Código do link</Label>
          <div className="mt-1.5 flex items-stretch overflow-hidden rounded-md border border-line bg-surface-sunken focus-within:border-brand">
            <span className="hidden items-center border-r border-line px-3 font-mono text-meta text-ink-subtle sm:flex">
              /assessoria/nps/
            </span>
            <input
              id="nps-slug"
              value={slug}
              disabled={!podeMudarLink}
              maxLength={60}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => {
                setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))
                setEditados((x) => ({ ...x, slug: true }))
              }}
              aria-invalid={Boolean(erros.slug) || undefined}
              aria-describedby="nps-slug-ajuda"
              className="h-11 min-w-0 flex-1 bg-transparent px-3 font-mono text-base text-ink focus:outline-none disabled:cursor-not-allowed disabled:text-ink-muted sm:text-sm"
            />
          </div>
          <p id="nps-slug-ajuda" className="mt-1.5 break-all text-meta text-ink-muted">
            {podeMudarLink
              ? SLUG_RE.test(codigo)
                ? linkDaRodada(codigo)
                : 'Letras minúsculas, números e hífens.'
              : 'Publicada, a rodada mantém o link: ele pode já estar num grupo.'}
          </p>
          {erros.slug ? <p className="mt-1 text-meta text-danger">{erros.slug}</p> : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="nps-abre">Abre em</Label>
            <Input
              id="nps-abre"
              type="datetime-local"
              className="mt-1.5"
              value={abre}
              onChange={(e) => {
                setAbre(e.target.value)
                setEditados((x) => ({ ...x, janela: true }))
              }}
              aria-invalid={Boolean(erros.abre) || undefined}
            />
            {erros.abre ? <p className="mt-1.5 text-meta text-danger">{erros.abre}</p> : null}
          </div>
          <div>
            <Label htmlFor="nps-fecha">Fecha em</Label>
            <Input
              id="nps-fecha"
              type="datetime-local"
              className="mt-1.5"
              value={fecha}
              onChange={(e) => {
                setFecha(e.target.value)
                setEditados((x) => ({ ...x, janela: true }))
              }}
              aria-invalid={Boolean(erros.fecha) || undefined}
            />
            {erros.fecha ? <p className="mt-1.5 text-meta text-danger">{erros.fecha}</p> : null}
          </div>
          <p className="text-meta text-ink-muted sm:col-span-2">Horário de Brasília.</p>
        </div>

        {!editando ? (
          <div className="flex items-start justify-between gap-4 rounded-md border border-line bg-surface-sunken p-3">
            <div>
              <Label htmlFor="nps-publicar">Publicar agora</Label>
              <p className="mt-1 text-meta text-ink-muted">
                {publicar
                  ? abreIso && new Date(abreIso) > new Date()
                    ? `O link fica agendado e passa a aceitar respostas em ${formatarDataHora(abreIso)}.`
                    : 'O link passa a aceitar respostas assim que a rodada for criada.'
                  : 'Em rascunho, o link não abre para ninguém. Publique depois, na tela da rodada.'}
              </p>
            </div>
            <Switch id="nps-publicar" checked={publicar} onCheckedChange={setPublicar} />
          </div>
        ) : null}
      </form>
    </ResponsiveModal>
  )
}
