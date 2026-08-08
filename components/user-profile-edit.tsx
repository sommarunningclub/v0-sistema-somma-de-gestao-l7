'use client'

import * as React from 'react'
import { Camera, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Panel, Well, notify } from '@/components/somma'
import { supabase } from '@/lib/supabase-client'

/**
 * Edição do próprio perfil.
 *
 * Só o nome é editável: e-mail e papel são exibidos como leitura porque mudam
 * o acesso e pertencem à Administração. O feedback saiu das faixas coloridas
 * artesanais e passou pelo canal único de toasts.
 */

interface UserProfileEditProps {
  user: {
    id: string
    email: string
    full_name: string | null
    role: string | null
  }
  onClose: () => void
  onSave: () => void
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gerenciador',
  user: 'Usuário',
}

export function UserProfileEdit({ user, onClose, onSave }: UserProfileEditProps) {
  const [fullName, setFullName] = React.useState(user.full_name || '')
  const [avatar, setAvatar] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      setAvatar(typeof reader.result === 'string' ? reader.result : null)
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!fullName.trim()) {
      notify.warning('Informe seu nome', {
        description: 'O nome aparece no menu do painel e nos registros de atividade.',
      })
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({
          full_name: fullName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (updateError) {
        notify.error('Não foi possível atualizar o perfil', {
          description: updateError.message,
        })
        return
      }

      notify.success('Perfil atualizado')
      onSave()
      onClose()
    } catch {
      notify.error('Não foi possível salvar as alterações', {
        description: 'Falha de conexão com o servidor.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Panel className="w-full max-w-sm">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h3 className="text-sm font-semibold text-ink-strong">Editar perfil</h3>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Fechar edição de perfil"
        >
          <X aria-hidden="true" />
        </Button>
      </div>

      <div className="space-y-4 p-5">
        <div>
          <span className="mb-2 block ds-label">Foto de perfil</span>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand-border bg-brand-soft">
              {avatar ? (
                 
                <img
                  src={avatar}
                  alt="Pré-visualização da foto de perfil"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Camera aria-hidden="true" className="h-7 w-7 text-brand" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <label
                htmlFor="profile-avatar"
                className="mb-1.5 block text-sm font-medium text-ink-strong"
              >
                Escolher imagem
              </label>
              <input
                id="profile-avatar"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                aria-describedby="profile-avatar-hint"
                className="block w-full text-meta text-ink-muted file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-strong"
              />
              <p id="profile-avatar-hint" className="mt-1.5 text-meta text-ink-subtle">
                PNG ou JPG, até 5 MB.
              </p>
            </div>
          </div>
        </div>

        <div>
          <label
            htmlFor="profile-full-name"
            className="mb-1.5 block text-sm font-medium text-ink-strong"
          >
            Nome completo
          </label>
          <Input
            id="profile-full-name"
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Seu nome completo"
          />
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink-strong">E-mail</span>
          <Well className="px-3.5 py-2.5 text-sm text-ink-muted">{user.email}</Well>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink-strong">Função</span>
          <Well className="px-3.5 py-2.5 text-sm text-ink-muted">
            {ROLE_LABEL[user.role ?? ''] ?? 'Usuário'}
          </Well>
          <p className="mt-1.5 text-meta text-ink-subtle">
            Função e e-mail são alterados pela Administração.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loading}
            className="sm:flex-1"
            block
          >
            Cancelar
          </Button>
          <Button
            onClick={() => void handleSave()}
            loading={loading}
            className="sm:flex-1"
            block
          >
            Salvar
          </Button>
        </div>
      </div>
    </Panel>
  )
}
