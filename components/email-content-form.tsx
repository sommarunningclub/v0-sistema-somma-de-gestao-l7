'use client'

import { Loader2 } from 'lucide-react'
import type { TemplateFields, TemplateKey } from '@/lib/email/templates'

interface EmailContentFormProps {
  nome: string
  onNomeChange: (v: string) => void
  templateKey: TemplateKey
  onTemplateKeyChange: (v: TemplateKey) => void
  subject: string
  onSubjectChange: (v: string) => void
  preheader: string
  onPreheaderChange: (v: string) => void
  content: TemplateFields
  onContentChange: (patch: Partial<TemplateFields>) => void
  ctaLabel: string
  onCtaLabelChange: (v: string) => void
  ctaUrl: string
  onCtaUrlChange: (v: string) => void
  previewHtml: string | null
  onSaveDraft: () => void
  saving: boolean
  saveError: string | null
}

const TEMPLATE_OPTIONS: Array<{ value: TemplateKey; label: string; description: string }> = [
  {
    value: 'anuncio',
    label: 'Anúncio',
    description: 'Imagem de destaque, título e texto — para novidades e promoções.',
  },
  {
    value: 'simples',
    label: 'Simples',
    description: 'Só título e texto, sem imagem — para comunicados rápidos.',
  },
  {
    value: 'evento',
    label: 'Evento',
    description: 'Como o anúncio, mas com data e local em destaque.',
  },
]

const fieldClass =
  'w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-orange-500 transition-colors'
const labelClass = 'block text-xs text-neutral-400 mb-1.5 font-medium'

export default function EmailContentForm({
  nome,
  onNomeChange,
  templateKey,
  onTemplateKeyChange,
  subject,
  onSubjectChange,
  preheader,
  onPreheaderChange,
  content,
  onContentChange,
  ctaLabel,
  onCtaLabelChange,
  ctaUrl,
  onCtaUrlChange,
  previewHtml,
  onSaveDraft,
  saving,
  saveError,
}: EmailContentFormProps) {
  const showImagem = templateKey === 'anuncio' || templateKey === 'evento'
  const showEventoFields = templateKey === 'evento'

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
    <div className="space-y-5">
      {/* Nome interno */}
      <div>
        <label className={labelClass}>
          Nome da campanha <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={nome}
          onChange={(e) => onNomeChange(e.target.value)}
          placeholder="Ex: Promoção de aniversário — agosto"
          className={fieldClass}
        />
        <p className="text-xs text-neutral-600 mt-1">Uso interno — não aparece para quem recebe.</p>
      </div>

      {/* Template */}
      <div>
        <label className={labelClass}>Template</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {TEMPLATE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onTemplateKeyChange(opt.value)}
              className={`text-left p-3 rounded-lg border transition-colors ${
                templateKey === opt.value
                  ? 'border-orange-500 bg-orange-500/10'
                  : 'border-neutral-700 bg-neutral-900 hover:border-neutral-600'
              }`}
            >
              <p
                className={`text-sm font-semibold ${
                  templateKey === opt.value ? 'text-orange-400' : 'text-white'
                }`}
              >
                {opt.label}
              </p>
              <p className="text-xs text-neutral-500 mt-1">{opt.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Assunto e preheader */}
      <div>
        <label className={labelClass}>
          Assunto <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder="O que aparece na caixa de entrada"
          className={fieldClass}
        />
      </div>
      <div>
        <label className={labelClass}>Preheader</label>
        <input
          type="text"
          value={preheader}
          onChange={(e) => onPreheaderChange(e.target.value)}
          placeholder="Texto de prévia, exibido ao lado do assunto"
          className={fieldClass}
        />
      </div>

      {/* Título e texto */}
      <div>
        <label className={labelClass}>
          Título <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={content.titulo}
          onChange={(e) => onContentChange({ titulo: e.target.value })}
          placeholder="Título em destaque no corpo do e-mail"
          className={fieldClass}
        />
      </div>
      <div>
        <label className={labelClass}>
          Texto <span className="text-red-400">*</span>
        </label>
        <textarea
          value={content.texto}
          onChange={(e) => onContentChange({ texto: e.target.value })}
          rows={5}
          placeholder="Corpo do e-mail"
          className={fieldClass}
        />
      </div>

      {/* Imagem (anúncio/evento) */}
      {showImagem && (
        <div>
          <label className={labelClass}>URL da imagem</label>
          <input
            type="url"
            value={content.imagem_url ?? ''}
            onChange={(e) => onContentChange({ imagem_url: e.target.value })}
            placeholder="https://..."
            className={fieldClass}
          />
        </div>
      )}

      {/* Data e local (evento) */}
      {showEventoFields && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Data</label>
            <input
              type="text"
              value={content.data ?? ''}
              onChange={(e) => onContentChange({ data: e.target.value })}
              placeholder="Ex: Sáb, 23 de agosto, 7h"
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>Local</label>
            <input
              type="text"
              value={content.local ?? ''}
              onChange={(e) => onContentChange({ local: e.target.value })}
              placeholder="Ex: Parque Ibirapuera"
              className={fieldClass}
            />
          </div>
        </div>
      )}

      {/* CTA */}
      <div>
        <label className={labelClass}>Botão de ação (CTA)</label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            type="text"
            value={ctaLabel}
            onChange={(e) => onCtaLabelChange(e.target.value)}
            placeholder="Rótulo — ex: Confirmar presença"
            className={fieldClass}
          />
          <input
            type="url"
            value={ctaUrl}
            onChange={(e) => onCtaUrlChange(e.target.value)}
            placeholder="URL de destino"
            className={fieldClass}
          />
        </div>
        <p className="text-xs text-neutral-600 mt-1">
          Os dois campos são necessários para o botão aparecer no e-mail.
        </p>
      </div>

      {/* Salvar rascunho */}
      <div className="pt-2 border-t border-neutral-800 space-y-3">
        {saveError && <p className="text-xs text-red-400">{saveError}</p>}
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={saving}
          className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Salvar rascunho e atualizar preview
        </button>
      </div>
    </div>

    {/* Preview */}
    <div className="lg:sticky lg:top-0">
      <label className={labelClass}>Preview</label>
      {previewHtml ? (
        <iframe
          srcDoc={previewHtml}
          title="Preview do e-mail"
          sandbox=""
          className="w-full h-[50vh] min-h-[16rem] lg:h-full lg:min-h-[24rem] bg-white rounded-lg border border-neutral-700"
        />
      ) : (
        <div className="w-full h-[50vh] min-h-[16rem] lg:h-full lg:min-h-[24rem] flex items-center justify-center bg-neutral-900 border border-dashed border-neutral-700 rounded-lg">
          <p className="text-xs text-neutral-600">
            Salve o rascunho para ver o preview aqui.
          </p>
        </div>
      )}
    </div>
    </div>
  )
}
