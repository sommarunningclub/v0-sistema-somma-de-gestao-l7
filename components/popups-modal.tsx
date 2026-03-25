'use client'

import { useState, useRef, useCallback } from 'react'
import { X, Upload, Loader2, ImageIcon } from 'lucide-react'
import type { Popup, PopupWithStats, CreatePopupInput, PopupFrequency } from '@/lib/services/popups'

const SITE_PAGES = [
  { value: '/', label: 'Página inicial' },
  { value: '/evolve', label: 'Evolve' },
  { value: '/check-in', label: 'Check-in' },
  { value: '/insider-conect', label: 'Insider Connect' },
  { value: '/seja-parceiro', label: 'Seja Parceiro' },
  { value: '/parceiro-somma-club', label: 'Parceiro Somma Club' },
]

interface PopupsModalProps {
  popup?: PopupWithStats | null
  onClose: () => void
  onSave: (data: CreatePopupInput) => Promise<void>
}

export default function PopupsModal({ popup, onClose, onSave }: PopupsModalProps) {
  const isEditing = !!popup

  const [title, setTitle] = useState(popup?.title || '')
  const [imageUrl, setImageUrl] = useState(popup?.image_url || '')
  const [imagePath, setImagePath] = useState<string | null>(null) // track uploaded path for orphan cleanup
  const [redirectLink, setRedirectLink] = useState(popup?.redirect_link || '')
  const [startDate, setStartDate] = useState(
    popup?.start_date ? popup.start_date.slice(0, 10) : new Date().toISOString().slice(0, 10)
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

  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadFile = async (file: File) => {
    setUploading(true)
    setUploadError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/popups/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) {
        setUploadError(json.error || 'Erro ao fazer upload')
        return
      }
      setImageUrl(json.url)
      setImagePath(json.path)
    } catch {
      setUploadError('Erro ao fazer upload da imagem')
    } finally {
      setUploading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }, [])

  const togglePage = (value: string) => {
    setPages((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]
    )
  }

  const addCustomPage = () => {
    const v = customPage.trim()
    if (v && !pages.includes(v)) {
      setPages((prev) => [...prev, v.startsWith('/') ? v : `/${v}`])
      setCustomPage('')
    }
  }

  const handleClose = async () => {
    // Clean up orphaned image (uploaded in this session but popup not saved/updated)
    // Applies to both create AND edit flows — imagePath is only set when a new file was uploaded
    if (imagePath) {
      await fetch(`/api/popups/upload?path=${encodeURIComponent(imagePath)}`, { method: 'DELETE' })
    }
    onClose()
  }

  const handleSave = async () => {
    setSaving(true)
    await onSave({
      title,
      image_url: imageUrl,
      redirect_link: redirectLink,
      is_active: isActive,
      start_date: new Date(startDate).toISOString(),
      end_date: noEndDate || !endDate ? null : new Date(endDate).toISOString(),
      pages,
      frequency,
    })
    setSaving(false)
  }

  const canSave = title.trim() && redirectLink.trim() && startDate && !uploading && !saving

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-800 sticky top-0 bg-neutral-950 z-10">
          <h2 className="font-semibold text-white">
            {isEditing ? 'Editar Pop-up' : 'Novo Pop-up'}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 text-neutral-500 hover:text-white transition-colors rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs text-neutral-400 mb-1.5 font-medium">
              Título <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nome da campanha"
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-xs text-neutral-400 mb-1.5 font-medium">Imagem</label>
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl transition-colors cursor-pointer ${
                isDragging ? 'border-orange-500 bg-orange-500/5' : 'border-neutral-700 hover:border-neutral-600'
              }`}
            >
              {imageUrl ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="Preview" className="w-full rounded-xl object-cover max-h-40" />
                  <div className="absolute inset-0 bg-black/50 rounded-xl opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-sm">Trocar imagem</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  {uploading ? (
                    <Loader2 className="w-8 h-8 text-neutral-500 animate-spin" />
                  ) : (
                    <>
                      <ImageIcon className="w-8 h-8 text-neutral-600" />
                      <p className="text-sm text-neutral-500">Arraste ou clique para fazer upload</p>
                      <p className="text-xs text-neutral-600">JPG, PNG, WebP, GIF — máx. 5MB</p>
                    </>
                  )}
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFileChange}
              className="hidden"
            />
            {uploadError && <p className="text-xs text-red-400 mt-1">{uploadError}</p>}
          </div>

          {/* Redirect Link */}
          <div>
            <label className="block text-xs text-neutral-400 mb-1.5 font-medium">
              Link de redirecionamento <span className="text-red-400">*</span>
            </label>
            <input
              type="url"
              value={redirectLink}
              onChange={(e) => setRedirectLink(e.target.value)}
              placeholder="https://sommaclub.com.br/evento"
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-400 mb-1.5 font-medium">
                Data início <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1.5 font-medium">Data fim</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={noEndDate}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors disabled:opacity-40"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={noEndDate}
              onChange={(e) => { setNoEndDate(e.target.checked); if (e.target.checked) setEndDate('') }}
              className="accent-orange-500"
            />
            <span className="text-xs text-neutral-400">Sem data de fim</span>
          </label>

          {/* Frequency */}
          <div>
            <label className="block text-xs text-neutral-400 mb-1.5 font-medium">Frequência</label>
            <div className="flex rounded-lg overflow-hidden border border-neutral-700">
              {([
                { value: 'uma_vez', label: 'Uma vez' },
                { value: 'sessao', label: 'Por sessão' },
                { value: 'sempre', label: 'Sempre' },
              ] as { value: PopupFrequency; label: string }[]).map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setFrequency(value)}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${
                    frequency === value
                      ? 'bg-orange-500 text-black'
                      : 'bg-neutral-900 text-neutral-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Pages */}
          <div>
            <label className="block text-xs text-neutral-400 mb-2 font-medium">
              Páginas onde exibir
            </label>
            <div className="space-y-1.5">
              {SITE_PAGES.map(({ value, label }) => (
                <label key={value} className="flex items-center gap-2.5 cursor-pointer group/check">
                  <input
                    type="checkbox"
                    checked={pages.includes(value)}
                    onChange={() => togglePage(value)}
                    className="accent-orange-500"
                  />
                  <span className="text-sm text-neutral-300 group-hover/check:text-white transition-colors">
                    {label}
                  </span>
                  <span className="text-xs text-neutral-600 ml-auto">{value}</span>
                </label>
              ))}
            </div>
            {/* Custom page */}
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={customPage}
                onChange={(e) => setCustomPage(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomPage() } }}
                placeholder="/outra-pagina"
                className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-orange-500 transition-colors"
              />
              <button
                onClick={addCustomPage}
                className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-sm transition-colors"
              >
                +
              </button>
            </div>
            {pages.filter(p => !SITE_PAGES.map(s => s.value).includes(p)).map(p => (
              <div key={p} className="flex items-center justify-between mt-1 px-2 py-1 bg-neutral-800 rounded text-xs">
                <span className="text-neutral-300">{p}</span>
                <button onClick={() => togglePage(p)} className="text-neutral-500 hover:text-red-400">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Active toggle */}
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-neutral-300">Ativar imediatamente</span>
            <button
              onClick={() => setIsActive(!isActive)}
              className={`relative w-10 h-5 rounded-full transition-colors ${isActive ? 'bg-orange-500' : 'bg-neutral-700'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </label>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-neutral-800 flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 py-2.5 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 transition-colors text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 py-2.5 rounded-lg bg-orange-500 text-black font-semibold text-sm hover:bg-orange-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditing ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  )
}
