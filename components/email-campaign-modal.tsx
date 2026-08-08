'use client'

import { useCallback, useEffect, useState } from 'react'
import { X, Loader2, ChevronLeft, ChevronRight, Send, Mail } from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import EmailAudiencePicker from './email-audience-picker'
import EmailContentForm from './email-content-form'
import type { AudienceSelection, EmailCampaign } from '@/lib/email/types'
import type { TemplateFields, TemplateKey } from '@/lib/email/templates'

interface EmailCampaignModalProps {
  campaign?: EmailCampaign | null
  onClose: () => void
  onSaved: () => void
}

const STEPS = [
  { id: 1, label: 'Audiência' },
  { id: 2, label: 'Conteúdo' },
  { id: 3, label: 'Revisão' },
  { id: 4, label: 'Disparo' },
] as const

const AUDIENCE_LABELS: Record<string, string> = {
  membros: 'Membros do clube',
  checkins: 'Check-ins de eventos',
  lista_vip: 'Lista VIP SommaDay',
  lista_espera: 'Lista de espera assessoria',
}

const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  anuncio: 'Anúncio',
  simples: 'Simples',
  evento: 'Evento',
}

const labelClass = 'block text-xs text-neutral-400 mb-1.5 font-medium'

export default function EmailCampaignModal({ campaign, onClose, onSaved }: EmailCampaignModalProps) {
  const [step, setStep] = useState(1)
  const [campaignId, setCampaignId] = useState<string | null>(campaign?.id ?? null)
  const [campaignStatus, setCampaignStatus] = useState(campaign?.status ?? 'rascunho')

  const [nome, setNome] = useState(campaign?.nome ?? '')
  const [templateKey, setTemplateKey] = useState<TemplateKey>(campaign?.template_key ?? 'anuncio')
  const [subject, setSubject] = useState(campaign?.subject ?? '')
  const [preheader, setPreheader] = useState(campaign?.preheader ?? '')
  const [content, setContent] = useState<TemplateFields>(campaign?.content ?? { titulo: '', texto: '' })
  const [ctaLabel, setCtaLabel] = useState(campaign?.cta_label ?? '')
  const [ctaUrl, setCtaUrl] = useState(campaign?.cta_url ?? '')
  const [audience, setAudience] = useState<AudienceSelection>(campaign?.audience ?? { bases: [] })
  const [audienceTotal, setAudienceTotal] = useState(campaign?.total_recipients ?? 0)

  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [testEmail, setTestEmail] = useState('')
  const [sendingTest, setSendingTest] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  const [dispatchMode, setDispatchMode] = useState<'now' | 'schedule'>('now')
  const [scheduledLocal, setScheduledLocal] = useState('')
  const [dispatching, setDispatching] = useState(false)
  const [dispatchError, setDispatchError] = useState<string | null>(null)

  const handleTotalChange = useCallback((total: number) => setAudienceTotal(total), [])

  const buildPayload = () => ({
    nome,
    template_key: templateKey,
    subject,
    preheader: preheader || null,
    content,
    cta_label: ctaLabel || null,
    cta_url: ctaUrl || null,
    audience,
  })

  /** Cria (se ainda não existe) ou atualiza o rascunho. Devolve o id salvo, ou null se falhou. */
  const saveDraft = useCallback(async (): Promise<string | null> => {
    setSaving(true)
    setSaveError(null)
    try {
      const method = campaignId ? 'PATCH' : 'POST'
      const url = campaignId ? `/api/email-campaigns/${campaignId}` : '/api/email-campaigns'
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      })
      const data = await res.json()
      if (!res.ok) {
        setSaveError(data.error || 'Erro ao salvar rascunho')
        return null
      }
      setCampaignId(data.id)
      setCampaignStatus(data.status)
      return data.id as string
    } catch {
      setSaveError('Erro ao salvar rascunho')
      return null
    } finally {
      setSaving(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, nome, templateKey, subject, preheader, content, ctaLabel, ctaUrl, audience])

  const loadPreview = async (id: string) => {
    try {
      const res = await apiFetch(`/api/email-campaigns/${id}/preview`)
      if (!res.ok) return
      const data = await res.json()
      setPreviewHtml(data.html)
    } catch {
      // preview é best-effort — o wizard segue funcionando sem ele
    }
  }

  const handleSaveDraft = async () => {
    const id = await saveDraft()
    if (id) await loadPreview(id)
  }

  // Campanha existente (edição): já tem conteúdo salvo, então o preview pode
  // ser carregado de imediato, sem esperar um novo "salvar rascunho".
  useEffect(() => {
    if (campaign?.id) loadPreview(campaign.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const goToStep2 = () => {
    if (audience.bases.length === 0) return
    setStep(2)
  }

  const goToStep3 = async () => {
    const id = await saveDraft()
    if (!id) return
    await loadPreview(id)
    setTestResult(null)
    setStep(3)
  }

  const canGoStep2To3 = nome.trim().length >= 2 && subject.trim().length >= 2 && content.titulo.trim() && content.texto.trim()

  const handleSendTest = async () => {
    if (!campaignId || !testEmail.trim()) return
    setSendingTest(true)
    setTestResult(null)
    try {
      const res = await apiFetch(`/api/email-campaigns/${campaignId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setTestResult({ ok: false, message: data.error || 'Erro ao enviar teste' })
        return
      }
      setTestResult({ ok: true, message: `Teste enviado para ${testEmail.trim()}.` })
    } catch {
      setTestResult({ ok: false, message: 'Erro ao enviar teste' })
    } finally {
      setSendingTest(false)
    }
  }

  const handleDispatchNow = async () => {
    setDispatching(true)
    setDispatchError(null)
    try {
      const id = await saveDraft()
      if (!id) return

      if (
        !confirm(
          `Disparar esta campanha agora para ${audienceTotal} destinatários? Depois de enviado, não é possível desfazer para quem já recebeu.`,
        )
      ) {
        return
      }

      const res = await apiFetch(`/api/email-campaigns/${id}/dispatch`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setDispatchError(data.error || 'Erro ao disparar campanha')
        return
      }
      onSaved()
      onClose()
    } catch {
      setDispatchError('Erro ao disparar campanha')
    } finally {
      setDispatching(false)
    }
  }

  const handleSchedule = async () => {
    if (!scheduledLocal) {
      setDispatchError('Escolha data e hora do disparo')
      return
    }
    setDispatching(true)
    setDispatchError(null)
    try {
      // Fuso de Brasília (UTC-3) fixo — datetime-local não devolve fuso.
      const scheduledAt = new Date(`${scheduledLocal}:00-03:00`).toISOString()

      if (!confirm(`Agendar esta campanha para ${audienceTotal} destinatários?`)) return

      // A rota PATCH de edição bloqueia a troca de `status` (só os campos de
      // conteúdo são editáveis por ali). O único caminho da API que marca uma
      // campanha como "agendada" é a criação (POST), então uma campanha já
      // salva como rascunho precisa ser recriada para virar agendada. Se já
      // estiver agendada, um PATCH simples de `scheduled_at` basta.
      if (campaignStatus === 'agendada' && campaignId) {
        const res = await apiFetch(`/api/email-campaigns/${campaignId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scheduled_at: scheduledAt }),
        })
        const data = await res.json()
        if (!res.ok) {
          setDispatchError(data.error || 'Erro ao agendar campanha')
          return
        }
      } else {
        const oldId = campaignId
        const res = await apiFetch('/api/email-campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...buildPayload(), scheduled_at: scheduledAt }),
        })
        const data = await res.json()
        if (!res.ok) {
          setDispatchError(data.error || 'Erro ao agendar campanha')
          return
        }
        setCampaignId(data.id)
        setCampaignStatus(data.status)
        if (oldId) {
          await apiFetch(`/api/email-campaigns/${oldId}`, { method: 'DELETE' }).catch(() => {})
        }
      }

      onSaved()
      onClose()
    } catch {
      setDispatchError('Erro ao agendar campanha')
    } finally {
      setDispatching(false)
    }
  }

  const selectedBaseLabels = audience.bases.map((b) => AUDIENCE_LABELS[b.key] ?? b.key)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-800 sticky top-0 bg-neutral-950 z-10">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-orange-400" />
            <h2 className="font-semibold text-white">
              {campaign ? 'Editar campanha' : 'Nova campanha'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 text-neutral-500 hover:text-white transition-colors rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-5 pt-4">
          {STEPS.map((s, idx) => (
            <div key={s.id} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                    step === s.id
                      ? 'bg-orange-500 text-black'
                      : step > s.id
                      ? 'bg-orange-500/30 text-orange-400'
                      : 'bg-neutral-800 text-neutral-500'
                  }`}
                >
                  {s.id}
                </div>
                <span
                  className={`text-xs font-medium hidden sm:inline ${
                    step === s.id ? 'text-white' : 'text-neutral-500'
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && <div className="flex-1 h-px bg-neutral-800 mx-2" />}
            </div>
          ))}
        </div>

        <div className="p-5 space-y-5">
          {step === 1 && <EmailAudiencePicker value={audience} onChange={setAudience} onTotalChange={handleTotalChange} />}

          {step === 2 && (
            <EmailContentForm
              nome={nome}
              onNomeChange={setNome}
              templateKey={templateKey}
              onTemplateKeyChange={setTemplateKey}
              subject={subject}
              onSubjectChange={setSubject}
              preheader={preheader}
              onPreheaderChange={setPreheader}
              content={content}
              onContentChange={(patch) => setContent((prev) => ({ ...prev, ...patch }))}
              ctaLabel={ctaLabel}
              onCtaLabelChange={setCtaLabel}
              ctaUrl={ctaUrl}
              onCtaUrlChange={setCtaUrl}
              previewHtml={previewHtml}
              onSaveDraft={handleSaveDraft}
              saving={saving}
              saveError={saveError}
            />
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-white mb-2">Audiência</h3>
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-sm text-neutral-300">
                  <p>{selectedBaseLabels.join(', ') || 'Nenhuma base selecionada'}</p>
                  <p className="text-orange-400 font-semibold mt-1">{audienceTotal} destinatários únicos</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-white mb-2">Conteúdo</h3>
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-sm text-neutral-300 space-y-1">
                  <p>
                    <span className="text-neutral-500">Template:</span> {TEMPLATE_LABELS[templateKey]}
                  </p>
                  <p>
                    <span className="text-neutral-500">Assunto:</span> {subject || '—'}
                  </p>
                  <p>
                    <span className="text-neutral-500">CTA:</span>{' '}
                    {ctaLabel && ctaUrl ? `${ctaLabel} → ${ctaUrl}` : 'Sem botão'}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-white mb-2">Enviar teste</h3>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-orange-500 transition-colors"
                  />
                  <button
                    onClick={handleSendTest}
                    disabled={!testEmail.trim() || sendingTest || !campaignId}
                    className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  >
                    {sendingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Enviar teste
                  </button>
                </div>
                {testResult && (
                  <p className={`text-xs mt-2 ${testResult.ok ? 'text-green-400' : 'text-red-400'}`}>
                    {testResult.message}
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                <p className="text-sm text-neutral-300">
                  Esta campanha será enviada para{' '}
                  <span className="text-orange-400 font-semibold">{audienceTotal} destinatários</span>.
                </p>
              </div>

              <div className="flex rounded-lg overflow-hidden border border-neutral-700">
                <button
                  onClick={() => setDispatchMode('now')}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                    dispatchMode === 'now' ? 'bg-orange-500 text-black' : 'bg-neutral-900 text-neutral-400 hover:text-white'
                  }`}
                >
                  Disparar agora
                </button>
                <button
                  onClick={() => setDispatchMode('schedule')}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                    dispatchMode === 'schedule'
                      ? 'bg-orange-500 text-black'
                      : 'bg-neutral-900 text-neutral-400 hover:text-white'
                  }`}
                >
                  Agendar
                </button>
              </div>

              {dispatchMode === 'schedule' && (
                <div>
                  <label className={labelClass}>Data e hora (horário de Brasília)</label>
                  <input
                    type="datetime-local"
                    value={scheduledLocal}
                    onChange={(e) => setScheduledLocal(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>
              )}

              {dispatchError && <p className="text-xs text-red-400">{dispatchError}</p>}

              <button
                onClick={dispatchMode === 'now' ? handleDispatchNow : handleSchedule}
                disabled={dispatching || (dispatchMode === 'schedule' && !scheduledLocal)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-orange-500 text-black font-semibold text-sm hover:bg-orange-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {dispatching && <Loader2 className="w-4 h-4 animate-spin" />}
                {dispatchMode === 'now' ? 'Disparar agora' : 'Agendar campanha'}
              </button>
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="p-5 border-t border-neutral-800 flex gap-3">
          <button
            onClick={() => (step === 1 ? onClose() : setStep((s) => s - 1))}
            className="flex-1 py-2.5 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 transition-colors text-sm font-medium flex items-center justify-center gap-1.5"
          >
            {step > 1 && <ChevronLeft className="w-4 h-4" />}
            {step === 1 ? 'Cancelar' : 'Voltar'}
          </button>
          {step < 4 && (
            <button
              onClick={step === 1 ? goToStep2 : step === 2 ? goToStep3 : () => setStep(4)}
              disabled={
                (step === 1 && audience.bases.length === 0) ||
                (step === 2 && (!canGoStep2To3 || saving)) ||
                saving
              }
              className="flex-1 py-2.5 rounded-lg bg-orange-500 text-black font-semibold text-sm hover:bg-orange-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              {saving && step === 2 ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Próximo
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
