'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Save, Trash2, Send, Paperclip, FileText, Download, Clock, MessageSquare, Building2, User, Phone, Mail, FileIcon, AlertTriangle, Search, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CRM_STAGES } from '@/lib/crm-constants'
import type { CRMLead, CRMLeadNote, CRMLeadAttachment, CRMStage, MeetingData } from '@/lib/services/crm'
import { getSession } from '@/components/protected-route'
import { useCNPJLookup } from '@/hooks/use-cnpj-lookup'
import { CRMMeetingTab } from '@/components/crm-meeting-tab'

interface CRMLeadModalProps {
  lead: CRMLead | null
  isNew?: boolean
  onClose: () => void
  onSave: (lead: Partial<CRMLead>) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}

export function CRMLeadModal({ lead, isNew, onClose, onSave, onDelete }: CRMLeadModalProps) {
  const session = getSession()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { lookupCNPJ, loading: cnpjLoading, error: cnpjError } = useCNPJLookup()

  // Form state
  const [name, setName] = useState(lead?.name || '')
  const [phone, setPhone] = useState(lead?.phone || '')
  const [email, setEmail] = useState(lead?.email || '')
  const [companyName, setCompanyName] = useState(lead?.company_name || '')
  const [cnpj, setCnpj] = useState(lead?.cnpj || '')
  const [description, setDescription] = useState(lead?.description || '')
  const [stage, setStage] = useState<CRMStage>(lead?.stage || 'novo_lead')

  // Notes & Attachments
  const [notes, setNotes] = useState<CRMLeadNote[]>([])
  const [attachments, setAttachments] = useState<CRMLeadAttachment[]>([])
  const [newNote, setNewNote] = useState('')
  const [activeTab, setActiveTab] = useState<'details' | 'notes' | 'attachments' | 'meeting'>('details')
  const [currentMeeting, setCurrentMeeting] = useState<MeetingData | null | undefined>(lead?.meeting)

  // UI state
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Load notes and attachments
  const loadNotesAndAttachments = useCallback(async () => {
    if (!lead?.id) return

    const [notesRes, attachRes] = await Promise.all([
      fetch(`/api/crm/${lead.id}/notes`),
      fetch(`/api/crm/${lead.id}/attachments`),
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
    if (!name.trim()) return
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
      onClose()
    } finally {
      setSaving(false)
    }
  }

  // Fetch fresh company name from DB when opening existing lead
  useEffect(() => {
    if (!lead?.id || isNew) return
    fetch(`/api/crm/${lead.id}`)
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
    if (!lead?.id || isNew) return
    await fetch(`/api/crm/${lead.id}`, {
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
    }
  }

  const handleDelete = async () => {
    if (!lead?.id || !onDelete) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeleting(true)
    try {
      await onDelete(lead.id)
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  const handleAddNote = async () => {
    if (!newNote.trim() || !lead?.id) return

    const res = await fetch(`/api/crm/${lead.id}/notes`, {
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
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!lead?.id) return
    const res = await fetch(`/api/crm/${lead.id}/notes?noteId=${noteId}`, { method: 'DELETE' })
    if (res.ok) loadNotesAndAttachments()
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
        return
      }

      const { data: urlData } = supabase.storage
        .from('crm-attachments')
        .getPublicUrl(fileName)

      // Save attachment record
      const res = await fetch(`/api/crm/${lead.id}/attachments`, {
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
        return
      }

      loadNotesAndAttachments()
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!lead?.id) return
    const res = await fetch(`/api/crm/${lead.id}/attachments?attachmentId=${attachmentId}`, { method: 'DELETE' })
    if (res.ok) loadNotesAndAttachments()
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

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-4 sm:p-4" onClick={onClose}>
      <div
        className="bg-neutral-900 border border-neutral-700 rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Handle Bar */}
        <div className="sm:hidden flex justify-center pt-2">
          <div className="w-12 h-1 bg-neutral-700 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:p-4 border-b border-neutral-700 gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-white">
              {isNew ? 'Novo Lead' : 'Detalhes do Lead'}
            </h2>
            {!isNew && lead && (
              <p className="text-xs sm:text-sm text-neutral-400 mt-0.5 truncate">
                {lead.company_name || 'Sem empresa'}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-2.5 -m-2.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors flex-shrink-0 w-10 h-10 flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs (only for existing leads) */}
        {!isNew && (
          <div className="flex border-b border-neutral-700 bg-neutral-800/30">
            {[
              { key: 'details' as const, label: 'Dados', icon: User },
              { key: 'notes' as const, label: 'Histórico', icon: MessageSquare },
              { key: 'attachments' as const, label: 'Anexos', icon: Paperclip },
              ...(stage === 'agendamento' ? [{ key: 'meeting' as const, label: 'Reunião', icon: Calendar }] : []),
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 sm:px-3 py-3 sm:py-4 text-xs sm:text-sm font-medium transition-all min-h-[48px] ${
                  activeTab === tab.key
                    ? 'text-orange-500 border-b-2 border-orange-500 bg-neutral-800/50'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800/20'
                }`}
              >
                <tab.icon className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs sm:text-sm">{tab.label}</span>
                {tab.key === 'notes' && notes.length > 0 && (
                  <span className="ml-0.5 inline-flex items-center justify-center min-w-[20px] h-5 bg-orange-500/20 text-orange-400 text-xs rounded-full font-semibold flex-shrink-0">{notes.length}</span>
                )}
                {tab.key === 'attachments' && attachments.length > 0 && (
                  <span className="ml-0.5 inline-flex items-center justify-center min-w-[20px] h-5 bg-orange-500/20 text-orange-400 text-xs rounded-full font-semibold flex-shrink-0">{attachments.length}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Details Tab */}
          {(activeTab === 'details' || isNew) && (
            <div className="space-y-4">
              {/* Stage Selector */}
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-2">Etapa do Lead</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CRM_STAGES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleStageChange(s.id)}
                      className={`text-xs sm:text-sm py-2.5 px-3 rounded-lg border-2 transition-all min-h-[44px] flex items-center justify-center font-medium ${
                        stage === s.id
                          ? `${s.color} text-white border-transparent shadow-lg`
                          : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:border-neutral-500 active:bg-neutral-700'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-2">
                    <User className="w-3 h-3 inline mr-1" />
                    Nome *
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nome do contato"
                    className="bg-neutral-800 border-neutral-700 text-white text-sm h-11 sm:h-10 px-3.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-2">
                    <Phone className="w-3 h-3 inline mr-1" />
                    Telefone
                  </label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    className="bg-neutral-800 border-neutral-700 text-white text-sm h-11 sm:h-10 px-3.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-2">
                    <Mail className="w-3 h-3 inline mr-1" />
                    E-mail
                  </label>
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@empresa.com"
                    type="email"
                    className="bg-neutral-800 border-neutral-700 text-white text-sm h-11 sm:h-10 px-3.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-2">
                    <Building2 className="w-3 h-3 inline mr-1" />
                    Empresa
                  </label>
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Nome da empresa"
                    className="bg-neutral-800 border-neutral-700 text-white text-sm h-11 sm:h-10 px-3.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-2">
                  <FileText className="w-3 h-3 inline mr-1" />
                  CNPJ / CPF
                </label>
                <div className="flex gap-2">
                  <Input
                    value={cnpj}
                    onChange={(e) => setCnpj(formatDocumento(e.target.value))}
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    className="bg-neutral-800 border-neutral-700 text-white text-sm flex-1 h-11 sm:h-10 px-3.5"
                  />
                  <Button
                    onClick={handleCNPJLookup}
                    disabled={cnpjLoading || cnpj.replace(/\D/g, '').length !== 14}
                    className="bg-orange-600 hover:bg-orange-700 text-white px-4 min-h-[44px] sm:min-h-[40px] flex-shrink-0"
                    size="sm"
                    title="Buscar dados da empresa pelo CNPJ"
                  >
                    <Search className="w-4 h-4" />
                  </Button>
                </div>
                {cnpjError && <p className="text-xs text-red-400 mt-1.5">{cnpjError}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-2">Descrição</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva a oportunidade de parceria..."
                  rows={4}
                  className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3.5 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-colors"
                />
              </div>
            </div>
          )}

          {/* Notes Tab */}
          {activeTab === 'notes' && !isNew && (
            <div className="space-y-4">
              {/* Add note */}
              <div className="flex gap-2 flex-col sm:flex-row">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Escreva uma observação sobre este lead..."
                  rows={3}
                  className="flex-1 bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3.5 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-colors"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddNote()
                  }}
                />
                <Button
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                  className="bg-orange-500 hover:bg-orange-600 text-white w-full sm:w-auto min-h-[44px] sm:min-h-[40px] flex-shrink-0"
                  size="default"
                >
                  <Send className="w-4 h-4" />
                  <span className="ml-1">Enviar</span>
                </Button>
              </div>

              {/* Notes list */}
              {notes.length === 0 ? (
                <p className="text-center text-neutral-500 text-sm py-8">Nenhuma observação ainda.</p>
              ) : (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <div key={note.id} className="bg-neutral-800 border border-neutral-700 rounded-lg p-3.5 group hover:border-neutral-600 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm text-neutral-200 whitespace-pre-wrap flex-1 leading-relaxed">{note.content}</p>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="p-2.5 -m-1 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0 active:scale-90"
                          title="Deletar nota"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-3 text-xs text-neutral-500">
                        <Clock className="w-3 h-3" />
                        <time>{formatDate(note.created_at)}</time>
                        <span className="text-neutral-600">•</span>
                        <span>{note.created_by}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Meeting Tab */}
          {activeTab === 'meeting' && !isNew && lead?.id && (
            <CRMMeetingTab
              leadId={lead.id}
              leadEmail={email}
              initialMeeting={currentMeeting}
              onSaved={(saved) => setCurrentMeeting(saved)}
            />
          )}

          {/* Attachments Tab */}
          {activeTab === 'attachments' && !isNew && (
            <div className="space-y-4">
              {/* Upload */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.txt,.csv"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="bg-orange-600 hover:bg-orange-700 text-white border-0 w-full min-h-[44px] font-medium"
                  variant="outline"
                >
                  <Paperclip className="w-4 h-4 mr-2" />
                  {uploading ? 'Enviando...' : 'Anexar Proposta / Documento'}
                </Button>
              </div>

              {/* Attachments list */}
              {attachments.length === 0 ? (
                <p className="text-center text-neutral-500 text-sm py-12">Nenhum anexo ainda.</p>
              ) : (
                <div className="space-y-2.5">
                  {attachments.map((att) => (
                    <div key={att.id} className="flex items-center gap-3 bg-neutral-800 border border-neutral-700 rounded-lg p-3.5 hover:border-neutral-600 group transition-colors">
                      <FileIcon className="w-8 h-8 text-orange-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate font-medium">{att.file_name}</p>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          {formatFileSize(att.file_size)} • {formatDate(att.uploaded_at)} • {att.uploaded_by}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <a
                          href={att.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 -m-1 text-neutral-400 hover:text-orange-500 hover:bg-orange-500/10 rounded-lg transition-colors active:scale-90"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => handleDeleteAttachment(att.id)}
                          className="p-2.5 -m-1 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors active:scale-90"
                          title="Deletar anexo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`border-t border-neutral-700 p-4 sm:p-4 bg-neutral-900/50 ${
          confirmDelete
            ? 'flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between pb-[calc(1rem+env(safe-area-inset-bottom))]'
            : 'flex flex-col-reverse sm:flex-row sm:items-center gap-2 sm:justify-between pb-[calc(1rem+env(safe-area-inset-bottom))]'
        }`}>
          <div className="w-full sm:w-auto">
            {!isNew && onDelete && (
              <Button
                onClick={handleDelete}
                disabled={deleting}
                variant="outline"
                className={`w-full sm:w-auto min-h-[44px] sm:min-h-[40px] font-medium ${
                  confirmDelete
                    ? 'bg-red-500/20 border-red-500 text-red-400 hover:bg-red-500/30'
                    : 'border-neutral-700 text-neutral-400 hover:text-red-400 hover:border-red-500/50'
                }`}
              >
                {confirmDelete ? (
                  <>
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    {deleting ? 'Excluindo...' : 'Confirmar Exclusão'}
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir
                  </>
                )}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 sm:flex-none border-neutral-700 text-neutral-400 hover:text-white min-h-[44px] sm:min-h-[40px] font-medium"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="flex-1 sm:flex-none bg-orange-500 hover:bg-orange-600 text-white min-h-[44px] sm:min-h-[40px] font-medium"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Salvando...' : isNew ? 'Criar Lead' : 'Salvar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
