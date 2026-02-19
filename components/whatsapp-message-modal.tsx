"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MessageCircle, Send } from "lucide-react"

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

  if (!isOpen) return null

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "")
    return cleaned.startsWith("55") ? cleaned : `55${cleaned}`
  }

  const handleSendMessage = () => {
    if (!message.trim()) {
      alert("Por favor, escreva uma mensagem")
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="bg-neutral-900 border-neutral-700 w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-500" />
            <CardTitle className="text-lg font-bold text-white tracking-wider">
              Enviar Mensagem WhatsApp
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-0"
          >
            ✕
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Recipient Info */}
          <div className="p-3 bg-neutral-800 border border-neutral-700 rounded-lg">
            <p className="text-xs text-neutral-400 mb-1">ENVIANDO PARA</p>
            <p className="text-sm font-bold text-white">{memberName}</p>
            <p className="text-xs text-neutral-400 font-mono">{phoneNumber}</p>
          </div>

          {/* Message Input */}
          <div>
            <label className="text-xs text-neutral-400 tracking-wider block mb-2">
              MENSAGEM
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Digite sua mensagem aqui..."
              className="bg-neutral-800 border-neutral-700 text-white placeholder-neutral-400 text-sm resize-none"
              rows={5}
            />
            <p className="text-xs text-neutral-500 mt-1">
              {message.length} caracteres
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={handleSendMessage}
              disabled={loading || !message.trim()}
              className="bg-green-500 hover:bg-green-600 text-white font-medium flex-1 flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              Enviar via WhatsApp
            </Button>
            <Button
              onClick={onClose}
              className="border-neutral-700 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-300 bg-transparent border flex-1"
            >
              Cancelar
            </Button>
          </div>

          {/* Info */}
          <p className="text-xs text-neutral-500">
            Você será redirecionado para o WhatsApp Web. Se não tiver a conversa aberta, o WhatsApp será aberto automaticamente.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
