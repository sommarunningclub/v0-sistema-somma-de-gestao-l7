// components/popups-modal.tsx
'use client'

import { useCallback, useId, useRef, useState } from 'react'
import { ImageIcon, Loader2, Trash2, Upload, X } from 'lucide-react'
import {
  ResponsiveModal,
  SectionTitle,
  SegmentedControl,
  Well,
  confirmAction,
  notify,
} from '@/components/somma'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiFetch } from '@/lib/api-client'
import type { CreatePopupInput, PopupFrequency, PopupWithStats } from '@/lib/services/popups'

const SITE_PAGES = [
  { value: '/', label: 'Página inicial' },
  { value: '/evolve', label: 'Evolve' },
  { value: '/check-in', label: 'Check-in' },
  { value: '/insider-conect', label: 'Insider Connect' },
  { value: '/seja-parceiro', label: 'Seja Parceiro' },
  { value: '/parceiro-somma-club', label: 'Parceiro Somma Club' },
]

const FREQUENCY_OPTIONS: Array<{ value: PopupFrequency; label: string }> = [
  { value: 'uma_vez', label: 'Uma vez' },
  { value: 'sessao', label: 'Por sessão' },
  { value: 'sempre', label: 'Sempre' },
]

interface PopupsModalProps {
  open: boolean
  popup?: PopupWithStats | null
  onClose: () => void
  onSave: (data: CreatePopupInput) => Promise<void>
}

function FieldLabel({
  htmlFor,
  children,
  required = false,
}: {
  htmlFor: string
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block ds-label">
      {children}
      {required ? (
        <>
          {' '}
          <span aria-hidden="true" className="text-danger">
            *
          </span>
          <span className="sr-only">(obrigatório)</span>
        </>
      ) : null}
    </label>
  )
}

export default function PopupsModal({ open, popup, onClose, onSave }: PopupsModalProps) {
  const isEditing = !!popup
  const ids = useId()
  const titleId = `${ids}-title`
  const linkId = `${ids}-link`
  const startId = `${ids}-start`
  const endId = `${ids}-end`
  const customPageId = `${ids}-custom-page`

  const [title, setTitle] = useState(popup?.title || '')
  const [imageUrl, setImageUrl] = useState(popup?.image_url || '')
  // caminho do upload feito nesta sessão — usado para limpar órfãos ao cancelar
  const [imagePath, setImagePath] = useState<string | null>(null)
  const [redirectLink, setRedirectLink] = useState(popup?.redirect_link || '')
  const [startDate, setStartDate] = useState(
    popup?.start_date ? popup.start_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
  )
  const [endDate, setEndDate] = useState(popup?.end_date ? popup.end_date.slice(0, 10) : '')
  const [noEndDate, setNoEndDate] = useState(!popup?.end_date)
  const [frequency, setFrequency] = useState<PopupFrequency>(popup?.frequency || 'uma_vez')
  const [pages, setPages] = useState<string[]>(popup?.pages || [])
  const [customPage, setCustomPage] = useState('')
  const [isActive, setIsActive] = useState(popup?.is_active ?? false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [showErrors, setShowErrors] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const titleError = !title.trim() ? 'Informe um título para a campanha.' : null
  const linkError = !redirectLink.trim()
    ? 'Informe o link de redirecionamento.'
    : !/^https?:\/\//i.test(redirectLink.trim())
      ? 'O link deve começar com http:// ou https://.'
      : null
  const startError = !startDate ? 'Informe a data de início.' : null
  const endError =
    !noEndDate && endDate && startDate && endDate < startDate
      ? 'A data de fim deve ser posterior à data de início.'
      : null

  const hasErrors = Boolean(titleError || linkError || startError || endError)

  const uploadFile = useCallback(async (file: File) => {
    setUploading(true)
    setUploadError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await apiFetch('/api/popups/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) {
        setUploadError(typeof json?.error === 'string' ? json.error : 'Erro ao fazer upload')
        return
      }
      setImageUrl(json.url)
      setImagePath(json.path)
      setDirty(true)
    } catch {
      setUploadError('Erro ao fazer upload da imagem')
    } finally {
      setUploading(false)
    }
  }, [])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) void uploadFile(file)
    event.target.value = ''
  }

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      setIsDragging(false)
      const file = event.dataTransfer.files?.[0]
      if (file) void uploadFile(file)
    },
    [uploadFile],
  )

  const togglePage = (value: string) => {
    setDirty(true)
    setPages((prev) => (prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]))
  }

  const addCustomPage = () => {
    const value = customPage.trim()
    if (!value) return
    const normalized = value.startsWith('/') ? value : `/${value}`
    if (pages.includes(normalized)) {
      notify.info('Esta página já está na lista')
      setCustomPage('')
      return
    }
    setDirty(true)
    setPages((prev) => [...prev, normalized])
    setCustomPage('')
  }

  const cleanupOrphanImage = async () => {
    // Limpa a imagem enviada nesta sessão quando o pop-up não é salvo.
    if (imagePath) {
      await apiFetch(`/api/popups/upload?path=${encodeURIComponent(imagePath)}`, {
        method: 'DELETE',
      })
    }
  }

  const requestClose = async () => {
    if (saving || uploading) return
    if (dirty) {
      const confirmed = await confirmAction({
        title: 'Descartar alterações?',
        description: 'As alterações feitas neste pop-up não foram salvas e serão perdidas.',
        detail: title.trim() || 'Novo pop-up',
        confirmLabel: 'Descartar',
        cancelLabel: 'Continuar editando',
        tone: 'danger',
      })
      if (!confirmed) return
    }
    await cleanupOrphanImage()
    onClose()
  }

  const handleSave = async () => {
    if (hasErrors) {
      setShowErrors(true)
      notify.error('Revise os campos destacados antes de salvar')
      return
    }
    setSaving(true)
    try {
      await onSave({
        title: title.trim(),
        image_url: imageUrl,
        redirect_link: redirectLink.trim(),
        is_active: isActive,
        start_date: new Date(startDate).toISOString(),
        end_date: noEndDate || !endDate ? null : new Date(endDate).toISOString(),
        pages,
        frequency,
      })
    } finally {
      setSaving(false)
    }
  }

  const customPages = pages.filter((page) => !SITE_PAGES.some((site) => site.value === page))
  const showError = (message: string | null) => (showErrors ? message : null)

  return (
    <ResponsiveModalShell
      open={open}
      onRequestClose={requestClose}
      title={isEditing ? 'Editar pop-up' : 'Novo pop-up'}
      description={
        isEditing
          ? 'Altere conteúdo, agendamento e segmentação da campanha.'
          : 'Configure a campanha que será exibida no site.'
      }
      busy={saving || uploading}
      footer={
        <>
          <Button variant="secondary" onClick={() => void requestClose()} block className="sm:w-auto">
            Cancelar
          </Button>
          <Button
            onClick={() => void handleSave()}
            loading={saving}
            disabled={uploading}
            block
            className="sm:w-auto"
          >
            {isEditing ? 'Salvar alterações' : 'Criar pop-up'}
          </Button>
        </>
      }
    >
      <div className="space-y-7">
        {/* Conteúdo */}
        <section aria-labelledby={`${ids}-sec-conteudo`}>
          <SectionTitle as="h3" title={<span id={`${ids}-sec-conteudo`}>Conteúdo</span>} />
          <div className="space-y-4">
            <div>
              <FieldLabel htmlFor={titleId} required>
                Título
              </FieldLabel>
              <Input
                id={titleId}
                value={title}
                onChange={(event) => {
                  setDirty(true)
                  setTitle(event.target.value)
                }}
                placeholder="Nome da campanha"
                aria-invalid={showError(titleError) ? true : undefined}
                aria-describedby={showError(titleError) ? `${titleId}-error` : undefined}
              />
              {showError(titleError) ? (
                <p id={`${titleId}-error`} role="alert" className="mt-1.5 text-meta text-danger">
                  {titleError}
                </p>
              ) : null}
            </div>

            <div>
              <FieldLabel htmlFor={linkId} required>
                Link de redirecionamento
              </FieldLabel>
              <Input
                id={linkId}
                type="url"
                inputMode="url"
                value={redirectLink}
                onChange={(event) => {
                  setDirty(true)
                  setRedirectLink(event.target.value)
                }}
                placeholder="https://sommaclub.com.br/evento"
                aria-invalid={showError(linkError) ? true : undefined}
                aria-describedby={showError(linkError) ? `${linkId}-error` : undefined}
              />
              {showError(linkError) ? (
                <p id={`${linkId}-error`} role="alert" className="mt-1.5 text-meta text-danger">
                  {linkError}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {/* Imagem */}
        <section aria-labelledby={`${ids}-sec-imagem`}>
          <SectionTitle as="h3" title={<span id={`${ids}-sec-imagem`}>Imagem</span>} />
          <div
            onDragOver={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`rounded-xl border-2 border-dashed transition-colors ${
              isDragging ? 'border-brand bg-brand-soft' : 'border-line hover:border-line-strong'
            }`}
          >
            {imageUrl ? (
              <div className="p-3">
                { }
                <img
                  src={imageUrl}
                  alt="Pré-visualização da imagem do pop-up"
                  className="max-h-44 w-full rounded-lg object-cover"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    loading={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload aria-hidden="true" />
                    Trocar imagem
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={uploading}
                    onClick={() => {
                      setDirty(true)
                      setImageUrl('')
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                    Remover
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl py-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {uploading ? (
                  <>
                    <Loader2 aria-hidden="true" className="h-7 w-7 animate-spin text-brand" />
                    <span className="text-sm text-ink" aria-live="polite">
                      Enviando imagem...
                    </span>
                  </>
                ) : (
                  <>
                    <ImageIcon aria-hidden="true" className="h-7 w-7 text-ink-subtle" />
                    <span className="text-sm text-ink">
                      <span className="lg:hidden">Toque para escolher uma imagem</span>
                      <span className="hidden lg:inline">Arraste ou clique para enviar</span>
                    </span>
                    <span className="text-meta text-ink-subtle">
                      JPG, PNG, WebP ou GIF — máx. 5MB
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileChange}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />
          {uploadError ? (
            <p role="alert" className="mt-2 text-meta text-danger">
              {uploadError}
            </p>
          ) : null}
        </section>

        {/* Agendamento */}
        <section aria-labelledby={`${ids}-sec-agenda`}>
          <SectionTitle as="h3" title={<span id={`${ids}-sec-agenda`}>Agendamento</span>} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor={startId} required>
                Data de início
              </FieldLabel>
              <Input
                id={startId}
                type="date"
                value={startDate}
                onChange={(event) => {
                  setDirty(true)
                  setStartDate(event.target.value)
                }}
                aria-invalid={showError(startError) ? true : undefined}
                aria-describedby={showError(startError) ? `${startId}-error` : undefined}
              />
              {showError(startError) ? (
                <p id={`${startId}-error`} role="alert" className="mt-1.5 text-meta text-danger">
                  {startError}
                </p>
              ) : null}
            </div>
            <div>
              <FieldLabel htmlFor={endId}>Data de fim</FieldLabel>
              <Input
                id={endId}
                type="date"
                value={endDate}
                disabled={noEndDate}
                min={startDate || undefined}
                onChange={(event) => {
                  setDirty(true)
                  setEndDate(event.target.value)
                }}
                aria-invalid={showError(endError) ? true : undefined}
                aria-describedby={showError(endError) ? `${endId}-error` : undefined}
              />
              {showError(endError) ? (
                <p id={`${endId}-error`} role="alert" className="mt-1.5 text-meta text-danger">
                  {endError}
                </p>
              ) : null}
            </div>
          </div>

          <label className="ds-tap mt-2 flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={noEndDate}
              onChange={(event) => {
                setDirty(true)
                setNoEndDate(event.target.checked)
                if (event.target.checked) setEndDate('')
              }}
              className="h-4 w-4 accent-brand"
            />
            <span className="text-sm text-ink">Sem data de fim</span>
          </label>

          <div className="mt-4">
            <span className="mb-1.5 block ds-label">Frequência de exibição</span>
            <SegmentedControl
              label="Frequência de exibição"
              value={frequency}
              onChange={(value) => {
                setDirty(true)
                setFrequency(value)
              }}
              options={FREQUENCY_OPTIONS}
              className="w-full"
            />
          </div>

          <label className="ds-tap mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-line px-3">
            <span className="text-sm text-ink">
              Ativar imediatamente
              <span className="mt-0.5 block text-meta text-ink-muted">
                O pop-up só aparece no site dentro do período configurado.
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={isActive}
              onChange={(event) => {
                setDirty(true)
                setIsActive(event.target.checked)
              }}
              className="h-5 w-5 shrink-0 accent-brand"
            />
          </label>
        </section>

        {/* Segmentação */}
        <section aria-labelledby={`${ids}-sec-segmentacao`}>
          <SectionTitle
            as="h3"
            title={<span id={`${ids}-sec-segmentacao`}>Segmentação</span>}
            meta={pages.length > 0 ? `${pages.length} página(s)` : 'Todas as páginas'}
          />
          <fieldset>
            <legend className="sr-only">Páginas onde exibir o pop-up</legend>
            <div className="space-y-1">
              {SITE_PAGES.map(({ value, label }) => (
                <label
                  key={value}
                  className="ds-tap flex cursor-pointer items-center gap-2.5 rounded-lg px-2 hover:bg-surface-hover"
                >
                  <input
                    type="checkbox"
                    checked={pages.includes(value)}
                    onChange={() => togglePage(value)}
                    className="h-4 w-4 accent-brand"
                  />
                  <span className="text-sm text-ink">{label}</span>
                  <span className="ml-auto text-meta text-ink-subtle">{value}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-3">
            <FieldLabel htmlFor={customPageId}>Adicionar outra página</FieldLabel>
            <div className="flex gap-2">
              <Input
                id={customPageId}
                value={customPage}
                onChange={(event) => setCustomPage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addCustomPage()
                  }
                }}
                placeholder="/outra-pagina"
              />
              <Button type="button" variant="secondary" onClick={addCustomPage}>
                Adicionar
              </Button>
            </div>
          </div>

          {customPages.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {customPages.map((page) => (
                <li key={page}>
                  <Well className="flex items-center justify-between gap-2 py-1 pl-3 pr-1">
                    <span className="truncate text-meta text-ink">{page}</span>
                    <button
                      type="button"
                      onClick={() => togglePage(page)}
                      aria-label={`Remover página ${page}`}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-danger-soft hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      <X aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </Well>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </ResponsiveModalShell>
  )
}

/**
 * Envolve o `ResponsiveModal` para que qualquer tentativa de fechar (ESC,
 * overlay, botão X) passe pela confirmação de alterações não salvas.
 */
function ResponsiveModalShell({
  open,
  onRequestClose,
  title,
  description,
  footer,
  busy,
  children,
}: {
  open: boolean
  onRequestClose: () => Promise<void>
  title: React.ReactNode
  description?: React.ReactNode
  footer: React.ReactNode
  busy: boolean
  children: React.ReactNode
}) {
  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(next) => {
        if (!next) void onRequestClose()
      }}
      title={title}
      description={description}
      footer={footer}
      size="lg"
      dismissible={!busy}
    >
      {children}
    </ResponsiveModal>
  )
}
