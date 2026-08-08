'use client'

import { useState, useEffect, useCallback, useRef, useId } from 'react'
import {
  Building2,
  Calendar,
  Clock,
  Download,
  FileIcon,
  FileText,
  Mail,
  MessageSquare,
  Paperclip,
  Phone,
  Save,
  Search,
  Send,
  Trash2,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  EmptyState,
  ResponsiveModal,
  SectionTitle,
  StatusPill,
  Well,
  confirmAction,
  notify,
} from '@/components/somma'
import { STAGE_TONE, stageLabel } from '@/components/crm-lead-card'
import { CRM_STAGES } from '@/lib/crm-constants'
import type { CRMLead, CRMLeadNote, CRMLeadAttachment, CRMStage, MeetingData } from '@/lib/services/crm'
import { getSession } from '@/components/protected-route'
import { useCNPJLookup } from '@/hooks/use-cnpj-lookup'
import { CRMMeetingTab } from '@/components/crm-meeting-tab'
import { apiFetch } from '@/lib/api-client'

interface CRMLeadModalProps {
  open: boolean
  lead: CRMLead | null
  isNew?: boolean
  onClose: () => void
  onSave: (lead: Partial<CRMLead>) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}

type TabKey = 'details' | 'notes' | 'attachments' | 'meeting'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function CRMLeadModal({ open, lead, isNew, onClose, onSave, onDelete }: CRMLeadModalProps) {
  const session = getSession()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { lookupCNPJ, loading: cnpjLoading, error: cnpjError } = useCNPJLookup()
  const fieldId = useId()

  // Form state
  const [name, setName] = useState(lead?.name || '')
  const [phone, setPhone] = useState(lead?.phone || '')
  const [email, setEmail] = useState(lead?.email || '')
  const [companyName, setCompanyName] = useState(lead?.company_name || '')
  const [cnpj, setCnpj] = useState(lead?.cnpj || '')
  const [description, setDescription] = useState(lead?.description || '')
  const [stage, setStage] = useState<CRMStage>(lead?.stage || 'novo_lead')
  const [touched, setTouched] = useState(false)

  // Notes & Attachments
  const [notes, setNotes] = useState<CRMLeadNote[]>([])
  const [attachments, setAttachments] = useState<CRMLeadAttachment[]>([])
  const [newNote, setNewNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('details')
  const [currentMeeting, setCurrentMeeting] = useState<MeetingData | null | undefined>(lead?.meeting)

  // UI state
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dirty, setDirty] = useState(false)

  const markDirty = () => setDirty(true)

  const nameError = touched && !name.trim() ? 'Informe o nome do contato.' : null
  const emailError = email.trim() && !EMAIL_RE.test(email.trim()) ? 'E-mail inválido.' : null

  // Load notes and attachments
  const loadNotesAndAttachments = useCallback(async () => {
    if (!lead?.id) return

    const [notesRes, attachRes] = await Promise.all([
      apiFetch(`/api/crm/${lead.id}/notes`),
      apiFetch(`/api/crm/${lead.id}/attachments`),
    ])

    if (notesRes.ok) setNotes(await notesRes.json())
    if (attachRes.ok) setAttachments(await attachRes.json())
  }, [lead?.id])

  useEffect(() => {
    loadNotesAndAttachments()
  }, [loadNotesAndAttachments])

  // CNPJ / CPF mask
  const formatDocumento = (value: string) => {
    const nums = value.replace(/\D/g, '').slice(0, 14)
    if (nums.length <= 11) {
      return nums
        .replace(/^(\d{3})(\d)/, '$1.$2')
        .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
    }
    return nums
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
  }

  // Phone mask
  const formatPhone = (value: string) => {
    const nums = value.replace(/\D/g, '').slice(0, 11)
    if (nums.length <= 10) {
      return nums.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim()
    }
    return nums.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim()
  }

  const handleSave = async () => {
    setTouched(true)
    if (!name.trim() || emailError) return
    setSaving(true)
    try {
      await onSave({
        ...(lead?.id ? { id: lead.id } : {}),
        name: name.trim(),
        phone,
        email: email.trim(),
        company_name: companyName.trim(),
        cnpj: cnpj.replace(/\D/g, ''),
        description: description.trim(),
        stage,
        created_by: session?.full_name || session?.email || 'unknown',
      })
      setDirty(false)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  // Fetch fresh company name from DB when opening existing lead
  useEffect(() => {
    if (!lead?.id || isNew) return
    apiFetch(`/api/crm/${lead.id}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.company_name) setCompanyName(data.company_name)
      })
      .catch(() => {})
  }, [lead?.id, isNew])

  const handleStageChange = async (newStage: CRMStage) => {
    setStage(newStage)
    if (newStage === 'agendamento' && !isNew) {
      setActiveTab('meeting')
    } else if (activeTab === 'meeting' && newStage !== 'agendamento') {
      setActiveTab('details')
    }
    if (!lead?.id || isNew) {
      markDirty()
      return
    }
    await apiFetch(`/api/crm/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStage }),
    })
  }

  const handleCNPJLookup = async () => {
    const data = await lookupCNPJ(cnpj)
    if (data) {
      setCompanyName(data.nome_fantasia || data.razao_social)
      if (data.ddd_telefone_1) setPhone(data.ddd_telefone_1)
      if (data.email) setEmail(data.email)
      markDirty()
    }
  }

  const handleDelete = async () => {
    if (!lead?.id || !onDelete) return
    const confirmed = await confirmAction({
      title: 'Excluir este lead?',
      description:
        'O lead sai do funil junto com suas observações e anexos. Esta ação não pode ser desfeita.',
      detail: lead.name,
      tone: 'danger',
    })
    if (!confirmed) return

    setDeleting(true)
    try {
      await onDelete(lead.id)
      setDirty(false)
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  const requestClose = async () => {
    if (dirty) {
      const confirmed = await confirmAction({
        title: 'Descartar alterações?',
        description: 'Há alterações não salvas neste lead. Se sair agora, elas serão perdidas.',
        confirmLabel: 'Descartar',
        cancelLabel: 'Continuar editando',
        tone: 'danger',
      })
      if (!confirmed) return
    }
    onClose()
  }

  const handleAddNote = async () => {
    if (!newNote.trim() || !lead?.id) return

    setSavingNote(true)
    try {
      const res = await apiFetch(`/api/crm/${lead.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newNote.trim(),
          created_by: session?.full_name || session?.email || 'unknown',
        }),
      })

      if (res.ok) {
        setNewNote('')
        loadNotesAndAttachments()
      } else {
        notify.error('Não foi possível salvar a observação')
      }
    } finally {
      setSavingNote(false)
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!lead?.id) return
    const confirmed = await confirmAction({
      title: 'Excluir observação?',
      description: 'A observação será removida do histórico do lead.',
      tone: 'danger',
    })
    if (!confirmed) return

    const res = await apiFetch(`/api/crm/${lead.id}/notes?noteId=${noteId}`, { method: 'DELETE' })
    if (res.ok) {
      notify.success('Observação excluída')
      loadNotesAndAttachments()
    } else {
      notify.error('Erro ao excluir a observação')
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !lead?.id) return

    setUploading(true)
    try {
      // Upload to Supabase Storage via client-side
      const { supabase } = await import('@/lib/supabase-client')
      const fileExt = file.name.split('.').pop()
      const fileName = `${lead.id}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('crm-attachments')
        .upload(fileName, file)

      if (uploadError) {
        console.error('[v0] Upload error:', uploadError)
        notify.error('Erro ao enviar o arquivo')
        return
      }

      const { data: urlData } = supabase.storage
        .from('crm-attachments')
        .getPublicUrl(fileName)

      // Save attachment record
      const res = await apiFetch(`/api/crm/${lead.id}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: session?.full_name || session?.email || 'unknown',
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        console.error('[v0] Error saving attachment record:', error)
        notify.error('Erro ao registrar o anexo')
        return
      }

      notify.success('Anexo enviado')
      loadNotesAndAttachments()
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteAttachment = async (attachmentId: string, fileName: string) => {
    if (!lead?.id) return
    const confirmed = await confirmAction({
      title: 'Excluir anexo?',
      description: 'O arquivo deixará de ficar disponível para a equipe.',
      detail: fileName,
      tone: 'danger',
    })
    if (!confirmed) return

    const res = await apiFetch(`/api/crm/${lead.id}/attachments?attachmentId=${attachmentId}`, { method: 'DELETE' })
    if (res.ok) {
      notify.success('Anexo excluído')
      loadNotesAndAttachments()
    } else {
      notify.error('Erro ao excluir o anexo')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  const tabs: { key: TabKey; label: string; icon: React.ElementType; count?: number }[] = [
    { key: 'details', label: 'Dados', icon: User },
    { key: 'notes', label: 'Histórico', icon: MessageSquare, count: notes.length },
    { key: 'attachments', label: 'Anexos', icon: Paperclip, count: attachments.length },
    ...(stage === 'agendamento'
      ? [{ key: 'meeting' as const, label: 'Reunião', icon: Calendar }]
      : []),
  ]

  const fieldClass = 'mt-1.5'
  const labelClass = 'flex items-center gap-1.5 text-meta font-medium text-ink-muted'

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(next) => {
        if (!next) void requestClose()
      }}
      size="lg"
      dismissible={!dirty}
      title={isNew ? 'Novo lead' : lead?.name || 'Detalhes do lead'}
      description={
        isNew
          ? 'Cadastre a oportunidade de parceria e escolha a fase inicial do funil.'
          : lead?.company_name || 'Sem empresa'
      }
      footer={
        <>
          {!isNew && onDelete ? (
            <Button
              variant="outline"
              onClick={handleDelete}
              loading={deleting}
              className="mr-auto text-danger hover:text-danger"
            >
              <Trash2 aria-hidden="true" />
              Excluir
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => void requestClose()}>
            Cancelar
          </Button>
          <Button onClick={handleSave} loading={saving}>
            <Save aria-hidden="true" />
            {isNew ? 'Criar lead' : 'Salvar'}
          </Button>
        </>
      }
    >
      {/* Abas (apenas para leads existentes) */}
      {!isNew ? (
        <div role="tablist" aria-label="Seções do lead" className="mb-4 flex flex-wrap gap-1 border-b border-line">
          {tabs.map((tab) => {
            const selected = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                id={`${fieldId}-tab-${tab.key}`}
                aria-selected={selected}
                aria-controls={`${fieldId}-panel-${tab.key}`}
                onClick={() => setActiveTab(tab.key)}
                className={`ds-tap -mb-px flex items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition-colors ${
                  selected
                    ? 'border-brand text-brand-strong'
                    : 'border-transparent text-ink-muted hover:text-ink-strong'
                }`}
              >
                <tab.icon aria-hidden="true" className="h-4 w-4" />
                {tab.label}
                {tab.count ? (
                  <span className="font-mono text-micro tabular-nums text-ink-subtle">
                    {tab.count}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      ) : null}

      {/* Dados */}
      {activeTab === 'details' || isNew ? (
        <div
          role={isNew ? undefined : 'tabpanel'}
          id={`${fieldId}-panel-details`}
          aria-labelledby={isNew ? undefined : `${fieldId}-tab-details`}
          className="space-y-6"
        >
          <section>
            <SectionTitle
              title="Fase do funil"
              meta={<StatusPill tone={STAGE_TONE[stage]}>{stageLabel(stage)}</StatusPill>}
            />
            <div role="radiogroup" aria-label="Fase do funil" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CRM_STAGES.map((s) => {
                const selected = stage === s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => void handleStageChange(s.id)}
                    className={`ds-tap flex items-center justify-center rounded-lg border px-3 text-[0.8125rem] font-medium transition-colors ${
                      selected
                        ? 'border-brand-border bg-brand-soft text-brand-strong'
                        : 'border-line bg-surface-sunken text-ink-muted hover:border-line-strong hover:text-ink'
                    }`}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>
          </section>

          <section>
            <SectionTitle title="Contato" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={`${fieldId}-name`} className={labelClass}>
                  <User aria-hidden="true" className="h-3.5 w-3.5" />
                  Nome <span className="text-danger">*</span>
                </label>
                <Input
                  id={`${fieldId}-name`}
                  className={fieldClass}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    markDirty()
                  }}
                  onBlur={() => setTouched(true)}
                  placeholder="Nome do contato"
                  type="text"
                  autoComplete="name"
                  required
                  aria-required="true"
                  aria-invalid={nameError ? true : undefined}
                  aria-describedby={nameError ? `${fieldId}-name-error` : undefined}
                />
                {nameError ? (
                  <p id={`${fieldId}-name-error`} className="mt-1.5 text-meta text-danger">
                    {nameError}
                  </p>
                ) : null}
              </div>

              <div>
                <label htmlFor={`${fieldId}-phone`} className={labelClass}>
                  <Phone aria-hidden="true" className="h-3.5 w-3.5" />
                  Telefone
                </label>
                <Input
                  id={`${fieldId}-phone`}
                  className={fieldClass}
                  value={phone}
                  onChange={(e) => {
                    setPhone(formatPhone(e.target.value))
                    markDirty()
                  }}
                  placeholder="(00) 00000-0000"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>

              <div>
                <label htmlFor={`${fieldId}-email`} className={labelClass}>
                  <Mail aria-hidden="true" className="h-3.5 w-3.5" />
                  E-mail
                </label>
                <Input
                  id={`${fieldId}-email`}
                  className={fieldClass}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    markDirty()
                  }}
                  placeholder="email@empresa.com"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  aria-invalid={emailError ? true : undefined}
                  aria-describedby={emailError ? `${fieldId}-email-error` : undefined}
                />
                {emailError ? (
                  <p id={`${fieldId}-email-error`} className="mt-1.5 text-meta text-danger">
                    {emailError}
                  </p>
                ) : null}
              </div>

              <div>
                <label htmlFor={`${fieldId}-company`} className={labelClass}>
                  <Building2 aria-hidden="true" className="h-3.5 w-3.5" />
                  Empresa
                </label>
                <Input
                  id={`${fieldId}-company`}
                  className={fieldClass}
                  value={companyName}
                  onChange={(e) => {
                    setCompanyName(e.target.value)
                    markDirty()
                  }}
                  placeholder="Nome da empresa"
                  type="text"
                  autoComplete="organization"
                />
              </div>
            </div>
          </section>

          <section>
            <SectionTitle title="Documento e oportunidade" />
            <div className="space-y-4">
              <div>
                <label htmlFor={`${fieldId}-cnpj`} className={labelClass}>
                  <FileText aria-hidden="true" className="h-3.5 w-3.5" />
                  CNPJ / CPF
                </label>
                <div className="mt-1.5 flex gap-2">
                  <Input
                    id={`${fieldId}-cnpj`}
                    value={cnpj}
                    onChange={(e) => {
                      setCnpj(formatDocumento(e.target.value))
                      markDirty()
                    }}
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    className="flex-1"
                    aria-invalid={cnpjError ? true : undefined}
                    aria-describedby={cnpjError ? `${fieldId}-cnpj-error` : undefined}
                  />
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={handleCNPJLookup}
                    loading={cnpjLoading}
                    disabled={cnpj.replace(/\D/g, '').length !== 14}
                    aria-label="Buscar dados da empresa pelo CNPJ"
                  >
                    <Search aria-hidden="true" />
                  </Button>
                </div>
                {cnpjError ? (
                  <p id={`${fieldId}-cnpj-error`} className="mt-1.5 text-meta text-danger">
                    {cnpjError}
                  </p>
                ) : null}
              </div>

              <div>
                <label htmlFor={`${fieldId}-description`} className={labelClass}>
                  Descrição
                </label>
                <textarea
                  id={`${fieldId}-description`}
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value)
                    markDirty()
                  }}
                  placeholder="Descreva a oportunidade de parceria..."
                  rows={4}
                  className="mt-1.5 w-full resize-none rounded-lg border border-line bg-surface-sunken px-3.5 py-2.5 text-base text-ink transition-colors placeholder:text-ink-subtle hover:border-line-strong focus-visible:border-brand focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand"
                />
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {/* Histórico */}
      {activeTab === 'notes' && !isNew ? (
        <div
          role="tabpanel"
          id={`${fieldId}-panel-notes`}
          aria-labelledby={`${fieldId}-tab-notes`}
          className="space-y-4"
        >
          <SectionTitle title="Nova observação" meta="Ctrl+Enter envia" />
          <div className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor={`${fieldId}-note`} className="sr-only">
              Nova observação
            </label>
            <textarea
              id={`${fieldId}-note`}
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Escreva uma observação sobre este lead..."
              rows={3}
              className="w-full flex-1 resize-none rounded-lg border border-line bg-surface-sunken px-3.5 py-2.5 text-base text-ink transition-colors placeholder:text-ink-subtle hover:border-line-strong focus-visible:border-brand focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleAddNote()
              }}
            />
            <Button
              onClick={handleAddNote}
              disabled={!newNote.trim()}
              loading={savingNote}
              className="sm:self-start"
            >
              <Send aria-hidden="true" />
              Enviar
            </Button>
          </div>

          {notes.length === 0 ? (
            <EmptyState
              compact
              icon={MessageSquare}
              title="Nenhuma observação ainda"
              description="Registre aqui o que foi conversado — o histórico fica visível para toda a equipe."
            />
          ) : (
            <ul className="space-y-3">
              {notes.map((note) => (
                <li key={note.id}>
                  <Well className="p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="flex-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                        {note.content}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDeleteNote(note.id)}
                        aria-label={`Excluir observação de ${note.created_by}`}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                    <p className="mt-3 flex items-center gap-2 text-meta text-ink-subtle">
                      <Clock aria-hidden="true" className="h-3 w-3" />
                      <time dateTime={note.created_at}>{formatDate(note.created_at)}</time>
                      <span aria-hidden="true">•</span>
                      <span>{note.created_by}</span>
                    </p>
                  </Well>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {/* Reunião */}
      {activeTab === 'meeting' && !isNew && lead?.id ? (
        <div
          role="tabpanel"
          id={`${fieldId}-panel-meeting`}
          aria-labelledby={`${fieldId}-tab-meeting`}
        >
          <CRMMeetingTab
            leadId={lead.id}
            leadEmail={email}
            initialMeeting={currentMeeting}
            onSaved={(saved) => setCurrentMeeting(saved)}
          />
        </div>
      ) : null}

      {/* Anexos */}
      {activeTab === 'attachments' && !isNew ? (
        <div
          role="tabpanel"
          id={`${fieldId}-panel-attachments`}
          aria-labelledby={`${fieldId}-tab-attachments`}
          className="space-y-4"
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.txt,.csv"
          />
          <Button
            variant="secondary"
            block
            onClick={() => fileInputRef.current?.click()}
            loading={uploading}
          >
            <Paperclip aria-hidden="true" />
            Anexar proposta / documento
          </Button>

          {attachments.length === 0 ? (
            <EmptyState
              compact
              icon={Paperclip}
              title="Nenhum anexo ainda"
              description="Envie propostas, contratos e apresentações para manter tudo no mesmo lugar."
            />
          ) : (
            <ul className="space-y-2.5">
              {attachments.map((att) => (
                <li key={att.id}>
                  <Well className="flex items-center gap-3 p-3.5">
                    <FileIcon aria-hidden="true" className="h-7 w-7 shrink-0 text-brand" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-strong">{att.file_name}</p>
                      <p className="mt-0.5 text-meta text-ink-subtle">
                        {formatFileSize(att.file_size)} • {formatDate(att.uploaded_at)} •{' '}
                        {att.uploaded_by}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button asChild variant="ghost" size="icon-sm">
                        <a
                          href={att.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Baixar ${att.file_name}`}
                        >
                          <Download aria-hidden="true" />
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDeleteAttachment(att.id, att.file_name)}
                        aria-label={`Excluir ${att.file_name}`}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                  </Well>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </ResponsiveModal>
  )
}
