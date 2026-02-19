'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Trash2, Plus, RefreshCw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

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
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Atualizar códigos quando props mudam
  useEffect(() => {
    setCodes(initialCodes)
  }, [initialCodes])

  // Recarregar códigos do Supabase quando modal abre
  useEffect(() => {
    if (open) {
      loadCodesFromSupabase()
    }
  }, [open])

  const loadCodesFromSupabase = async () => {
    try {
      setIsRefreshing(true)
      const response = await fetch('/api/partner-codes')
      if (!response.ok) throw new Error('Erro ao carregar códigos')
      const data = await response.json()
      setCodes(data.data || [])
    } catch (err) {
      console.error('[v0] Error loading codes from Supabase:', err)
    } finally {
      setIsRefreshing(false)
    }
  }

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
    setSuccessMessage(null)

    try {
      const response = await fetch('/api/partner-codes', {
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

      setSuccessMessage('Código criado com sucesso!')
      setNewCode('')
      
      // Recarregar lista de códigos
      await loadCodesFromSupabase()
      onCodesUpdate()
      
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar código')
      console.error('[v0] Error creating code:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteCode = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar este código?')) return

    try {
      const response = await fetch(`/api/partner-codes/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Erro ao deletar código')
      }

      // Recarregar lista de códigos
      await loadCodesFromSupabase()
      onCodesUpdate()
    } catch (err) {
      console.error('[v0] Error deleting code:', err)
      alert('Erro ao deletar código')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 bg-transparent">
          <Plus className="w-4 h-4" />
          Gerenciar Códigos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl bg-neutral-900 border-neutral-700">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="text-orange-500">Gerenciar Códigos de Parceiro</DialogTitle>
          <Button
            onClick={loadCodesFromSupabase}
            disabled={isRefreshing}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </DialogHeader>

        <div className="space-y-6">
          {/* Create New Code Section */}
          <div className="space-y-3 p-4 bg-neutral-800 rounded-lg border border-neutral-700">
            <Label className="text-sm font-medium">Criar Novo Código</Label>
            <div className="space-y-3">
              <div>
                <Label htmlFor="partner-name" className="text-xs text-neutral-300 mb-1.5 block">Nome do Parceiro</Label>
                <Input
                  id="partner-name"
                  placeholder="Ex: Red Bull, Adidas..."
                  value={newPartnerName}
                  onChange={(e) => setNewPartnerName(e.target.value)}
                  disabled={isLoading}
                  className="bg-neutral-700 border-neutral-600 text-white placeholder-neutral-400"
                />
              </div>
              <div>
                <Label htmlFor="partner-code" className="text-xs text-neutral-300 mb-1.5 block">Código</Label>
                <Input
                  id="partner-code"
                  placeholder="Ex: REDBULL@2026"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateCode()}
                  disabled={isLoading}
                  className="bg-neutral-700 border-neutral-600 text-white placeholder-neutral-400"
                />
              </div>
            </div>
            <Button
              onClick={handleCreateCode}
              disabled={isLoading || !newCode.trim() || !newPartnerName.trim()}
              className="w-full bg-orange-500 hover:bg-orange-600 text-black font-semibold"
            >
              {isLoading ? 'Criando...' : 'Criar Código'}
            </Button>
            {error && <p className="text-xs text-red-400">{error}</p>}
            {successMessage && <p className="text-xs text-green-400">{successMessage}</p>}
          </div>

          {/* Codes List */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Códigos Existentes ({codes.length})</Label>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {codes.length === 0 ? (
                <p className="text-sm text-neutral-400 py-4 text-center">Nenhum código criado ainda</p>
              ) : (
                codes.map((code) => (
                  <Card key={code.id} className="bg-neutral-800 border-neutral-700">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-mono font-semibold text-orange-400">{code.codigo}</p>
                            <Badge 
                              className={code.ativo ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}
                            >
                              {code.ativo ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </div>
                          <p className="text-xs text-neutral-400 mt-1">{code.nome_parceiro}</p>
                          <p className="text-xs text-neutral-500 mt-0.5">
                            Criado em: {new Date(code.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <Button
                          onClick={() => handleDeleteCode(code.id)}
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
