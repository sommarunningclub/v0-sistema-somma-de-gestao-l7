'use client'

import { useState } from 'react'
import { Camera, CheckCircle2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorBanner } from '@/components/ui/error-banner'
// Import direto (e não pelo barrel) porque `components/somma/index.ts` reexporta
// o `UserMenu`, que por sua vez importa este modal — o ciclo quebraria a
// avaliação do módulo no bundle de client.
import { ResponsiveModal } from '@/components/somma/responsive-modal'
import { apiFetch } from '@/lib/api-client'

interface ProfileModalProps {
  user: {
    id: string
    email: string
    full_name: string | null
    role: string | null
    created_at: string
  }
  onClose: () => void
  onSave: () => void
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gerenciador',
  user: 'Usuário',
}

export function ProfileModal({ user, onClose, onSave }: ProfileModalProps) {
  const [fullName, setFullName] = useState(user.full_name || '')
  const [avatar, setAvatar] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatar(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSave = async () => {
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await apiFetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body?.error || 'Erro ao atualizar perfil')
        console.error('[perfil] Update error:', body)
        return
      }

      setSuccess(true)
      setTimeout(() => {
        onSave()
        onClose()
      }, 1000)
    } catch (err) {
      setError('Erro ao salvar alterações')
      console.error('[v0] Save error:', err)
    } finally {
      setLoading(false)
    }
  }

  const displayName = user.full_name?.trim() || user.email?.split('@')[0] || 'Usuário'
  const roleLabel = ROLE_LABEL[user.role ?? 'user'] ?? 'Usuário'

  return (
    <ResponsiveModal
      open
      onOpenChange={(open) => {
        if (!open && !loading) onClose()
      }}
      size="md"
      title="Editar perfil"
      description="Gerencie suas informações pessoais"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading} block className="sm:w-auto">
            Cancelar
          </Button>
          <Button onClick={handleSave} loading={loading} block className="sm:w-auto">
            <Save aria-hidden="true" />
            {loading ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {error && <ErrorBanner message={error} />}

        {success && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-lg border border-success-border bg-success-soft p-3 text-sm text-success"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            Perfil atualizado com sucesso!
          </div>
        )}

        <div className="flex items-center gap-4 border-b border-line pb-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand-border bg-brand-soft">
            {avatar ? (
              <img src={avatar} alt="Pré-visualização do avatar" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xl font-semibold text-brand" aria-hidden="true">
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-ink-strong">{displayName}</h3>
            <p className="ds-eyebrow mt-0.5 text-brand">{roleLabel}</p>
            <p className="mt-1 text-meta text-ink-muted">
              Membro desde {new Date(user.created_at).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <span className="block text-[0.8125rem] font-medium text-ink">Foto de perfil</span>
          <div className="flex flex-wrap items-center gap-3">
            <label className="ds-tap inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface-raised px-4 text-[0.8125rem] text-ink transition-colors hover:border-line-strong hover:bg-surface-hover focus-within:ring-2 focus-within:ring-brand">
              <Camera className="h-4 w-4 text-brand" aria-hidden="true" />
              <span>Selecionar imagem</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="sr-only"
              />
            </label>
            <p className="text-meta text-ink-subtle">PNG ou JPG até 5MB</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile-full-name">Nome completo</Label>
          <Input
            id="profile-full-name"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Seu nome completo"
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <span className="block text-[0.8125rem] font-medium text-ink">E-mail</span>
          <p className="ds-well px-3 py-2.5 text-sm text-ink-muted">{user.email}</p>
          <p className="text-meta text-ink-subtle">O e-mail não pode ser alterado.</p>
        </div>

        <div className="space-y-2">
          <span className="block text-[0.8125rem] font-medium text-ink">Função</span>
          <p className="ds-well px-3 py-2.5 text-sm font-medium text-brand">{roleLabel}</p>
        </div>
      </div>
    </ResponsiveModal>
  )
}
