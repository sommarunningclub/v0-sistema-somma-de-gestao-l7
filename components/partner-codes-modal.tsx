'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { KeyRound, RefreshCw, Trash2 } from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import {
  CardListSkeleton,
  EmptyState,
  ResponsiveModal,
  SectionTitle,
  StatusPill,
  Well,
  confirmAction,
  notify,
} from '@/components/somma'

interface PartnerCode {
  id: string
  codigo: string
  nome_parceiro: string
  ativo: boolean
  created_at: string
  last_access?: string
}

interface PartnerCodesModalProps {
  codes: PartnerCode[]
  onCodesUpdate: () => void
  partnerName?: string
}

export function PartnerCodesModal({ codes: initialCodes, onCodesUpdate, partnerName }: PartnerCodesModalProps) {
  const [open, setOpen] = useState(false)
  const [codes, setCodes] = useState<PartnerCode[]>(initialCodes)
  const [newCode, setNewCode] = useState('')
  const [newPartnerName, setNewPartnerName] = useState(partnerName || '')
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Atualizar códigos quando props mudam
  useEffect(() => {
    setCodes(initialCodes)
  }, [initialCodes])

  const loadCodesFromSupabase = useCallback(async () => {
    try {
      setIsRefreshing(true)
      const response = await apiFetch('/api/partner-codes')
      if (!response.ok) throw new Error('Erro ao carregar códigos')
      const data = await response.json()
      setCodes(data.data || [])
    } catch (err) {
      console.error('[v0] Error loading codes from Supabase:', err)
      notify.error('Erro ao carregar códigos')
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  // Recarregar códigos do Supabase quando modal abre
  useEffect(() => {
    if (open) {
      loadCodesFromSupabase()
    }
  }, [open, loadCodesFromSupabase])

  const handleCreateCode = async () => {
    if (!newCode.trim()) {
      setError('Código não pode estar vazio')
      return
    }

    if (!newPartnerName.trim()) {
      setError('Nome do parceiro não pode estar vazio')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await apiFetch('/api/partner-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: newCode.trim(),
          nome_parceiro: newPartnerName.trim()
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erro ao criar código')
      }

      notify.success('Código criado com sucesso')
      setNewCode('')

      // Recarregar lista de códigos
      await loadCodesFromSupabase()
      onCodesUpdate()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar código'
      setError(message)
      notify.error(message)
      console.error('[v0] Error creating code:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteCode = async (code: PartnerCode) => {
    const confirmed = await confirmAction({
      title: 'Excluir código de parceiro?',
      description: 'O código deixa de funcionar imediatamente para quem tentar acessar com ele.',
      detail: `${code.codigo} — ${code.nome_parceiro}`,
      tone: 'danger',
    })
    if (!confirmed) return

    try {
      const response = await apiFetch(`/api/partner-codes/${code.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Erro ao deletar código')
      }

      // Recarregar lista de códigos
      await loadCodesFromSupabase()
      onCodesUpdate()
      notify.success('Código excluído')
    } catch (err) {
      console.error('[v0] Error deleting code:', err)
      notify.error('Erro ao deletar código')
    }
  }

  const canCreate = !!newCode.trim() && !!newPartnerName.trim()

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <KeyRound aria-hidden="true" />
        <span className="hidden sm:inline">Gerenciar códigos</span>
        <span className="sm:hidden">Códigos</span>
      </Button>

      <ResponsiveModal
        open={open}
        onOpenChange={setOpen}
        size="lg"
        title="Códigos de parceiro"
        description="Códigos usados pelos parceiros para acessar a área exclusiva."
        footer={
          <Button variant="secondary" onClick={() => setOpen(false)} block className="sm:w-auto">
            Fechar
          </Button>
        }
      >
        <div className="space-y-6">
          <section aria-label="Criar novo código">
            <SectionTitle as="h3" title="Criar novo código" />
            <Well className="space-y-3 p-4">
              <div>
                <label htmlFor="partner-name" className="mb-1.5 block text-meta font-medium text-ink-muted">
                  Nome do parceiro
                </label>
                <Input
                  id="partner-name"
                  type="text"
                  autoComplete="organization"
                  placeholder="Ex.: Red Bull, Adidas..."
                  value={newPartnerName}
                  onChange={(e) => {
                    setNewPartnerName(e.target.value)
                    setError(null)
                  }}
                  disabled={isLoading}
                  aria-invalid={!!error || undefined}
                  aria-describedby={error ? 'partner-code-error' : undefined}
                />
              </div>
              <div>
                <label htmlFor="partner-code" className="mb-1.5 block text-meta font-medium text-ink-muted">
                  Código
                </label>
                <Input
                  id="partner-code"
                  type="text"
                  autoComplete="off"
                  autoCapitalize="characters"
                  placeholder="Ex.: REDBULL@2026"
                  value={newCode}
                  onChange={(e) => {
                    setNewCode(e.target.value)
                    setError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (canCreate && !isLoading) handleCreateCode()
                    }
                  }}
                  disabled={isLoading}
                  aria-invalid={!!error || undefined}
                  aria-describedby={error ? 'partner-code-error' : undefined}
                  className="font-mono"
                />
              </div>
              {error ? (
                <p id="partner-code-error" role="alert" className="text-meta text-danger">
                  {error}
                </p>
              ) : null}
              <Button
                onClick={handleCreateCode}
                disabled={!canCreate}
                loading={isLoading}
                block
              >
                Criar código
              </Button>
            </Well>
          </section>

          <section aria-label="Códigos existentes">
            <SectionTitle
              as="h3"
              title="Códigos existentes"
              meta={
                <span className="flex items-center gap-2">
                  <span className="font-mono tabular-nums">{codes.length}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={loadCodesFromSupabase}
                    disabled={isRefreshing}
                    aria-label="Recarregar códigos"
                  >
                    <RefreshCw aria-hidden="true" className={isRefreshing ? 'animate-spin' : undefined} />
                  </Button>
                </span>
              }
            />
            <div className="scroll-touch max-h-96 overflow-y-auto" aria-busy={isRefreshing || undefined}>
              {isRefreshing && codes.length === 0 ? (
                <CardListSkeleton count={3} />
              ) : codes.length === 0 ? (
                <EmptyState
                  compact
                  icon={KeyRound}
                  title="Nenhum código criado ainda"
                  description="Crie um código acima para liberar o acesso de um parceiro."
                />
              ) : (
                <ul className="space-y-2">
                  {codes.map((code) => (
                    <li
                      key={code.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-raised p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-mono text-sm font-semibold text-brand-strong">{code.codigo}</p>
                          <StatusPill tone={code.ativo ? 'success' : 'danger'}>
                            {code.ativo ? 'Ativo' : 'Inativo'}
                          </StatusPill>
                        </div>
                        <p className="mt-1 truncate text-meta text-ink-muted">{code.nome_parceiro}</p>
                        <p className="mt-0.5 text-micro text-ink-subtle">
                          Criado em {new Date(code.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <Button
                        onClick={() => handleDeleteCode(code)}
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Excluir código ${code.codigo}`}
                        className="shrink-0 text-danger hover:text-danger"
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </ResponsiveModal>
    </>
  )
}
