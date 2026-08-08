"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Send } from "lucide-react"
import { ResponsiveModal, Well, notify } from "@/components/somma"

interface WhatsAppMessageModalProps {
  isOpen: boolean
  phoneNumber: string
  memberName: string
  onClose: () => void
}

export function WhatsAppMessageModal({
  isOpen,
  phoneNumber,
  memberName,
  onClose,
}: WhatsAppMessageModalProps) {
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "")
    return cleaned.startsWith("55") ? cleaned : `55${cleaned}`
  }

  const handleSendMessage = () => {
    if (!message.trim()) {
      notify.warning("Escreva uma mensagem antes de enviar")
      return
    }

    setLoading(true)

    const formattedPhone = formatPhoneNumber(phoneNumber)
    const encodedMessage = encodeURIComponent(message)
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`

    window.open(whatsappUrl, "_blank")

    setLoading(false)
    setMessage("")
    onClose()
  }

  return (
    <ResponsiveModal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      size="md"
      title="Enviar mensagem no WhatsApp"
      description="Você será redirecionado para o WhatsApp com a mensagem já escrita."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} block className="sm:w-auto">
            Cancelar
          </Button>
          <Button
            onClick={handleSendMessage}
            loading={loading}
            disabled={!message.trim()}
            block
            className="sm:w-auto"
          >
            <Send aria-hidden="true" />
            Enviar via WhatsApp
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Well className="p-3">
          <p className="ds-eyebrow">Enviando para</p>
          <p className="mt-1 text-sm font-semibold text-ink-strong">{memberName}</p>
          <p className="font-mono text-meta text-ink-muted">{phoneNumber}</p>
        </Well>

        <div>
          <label
            htmlFor="whatsapp-message"
            className="mb-1.5 block text-meta font-medium text-ink-muted"
          >
            Mensagem
          </label>
          <textarea
            id="whatsapp-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Digite sua mensagem aqui..."
            rows={5}
            aria-describedby="whatsapp-message-count"
            className="w-full resize-none rounded-lg border border-line bg-surface-sunken px-3.5 py-2.5 text-base text-ink transition-colors placeholder:text-ink-subtle hover:border-line-strong focus-visible:border-brand focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand lg:text-sm"
          />
          <p id="whatsapp-message-count" className="mt-1 text-meta text-ink-subtle" aria-live="polite">
            <span className="font-mono tabular-nums">{message.length}</span> caracteres
          </p>
        </div>
      </div>
    </ResponsiveModal>
  )
}
