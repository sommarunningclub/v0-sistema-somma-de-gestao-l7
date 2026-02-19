'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  AlertCircle, CheckCircle2, Trash2, Edit2, RefreshCw, Plus, Search, 
  Mail, Phone, Building2, User, X, MessageCircle, ChevronDown, ChevronUp,
  Briefcase, Filter, LayoutGrid, LayoutList, Eye, Gift
} from 'lucide-react'
import { CNPJLookup } from '@/components/cnpj-lookup'
import { PartnerForm } from '@/components/partner-form'
import { PartnerCodesModal } from '@/components/partner-codes-modal'
import type { CNPJData, Partner } from '@/lib/services/partners'
import { WhatsAppMessageModal } from '@/components/whatsapp-message-modal'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type ViewMode = 'list' | 'form' | 'edit' | 'codes'
type FilterStatus = 'all' | 'active' | 'pending' | 'inactive' | 'negotiating'
type ListViewMode = 'cards' | 'table'

interface PartnerCode {
  id: string
  codigo: string
  nome_parceiro: string
  ativo: boolean
  created_at: string
  last_access?: string
}

export default function ParcerioSommaPage() {
  const [cnpjData, setCNPJData] = useState<CNPJData | undefined>()
  const [editingPartner, setEditingPartner] = useState<Partner | undefined>()
  const [partners, setPartners] = useState<Partner[]>([])
  const [partnerCodes, setPartnerCodes] = useState<PartnerCode[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFormLoading, setIsFormLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [listViewMode, setListViewMode] = useState<ListViewMode>('table')
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null)
  const [whatsappModal, setWhatsappModal] = useState<{ isOpen: boolean; phone: string; name: string }>({
    isOpen: false, phone: '', name: ''
  })

  const loadPartners = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch('/api/partners')
      if (!response.ok) throw new Error('Erro ao carregar parceiros')
      const data = await response.json()
      setPartners(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar parceiros')
    } finally {
      setIsLoading(false)
    }
  }

  const loadPartnerCodes = async () => {
    try {
      const response = await fetch('/api/partner-codes')
      if (!response.ok) throw new Error('Erro ao carregar códigos')
      const data = await response.json()
      setPartnerCodes(data.data || [])
    } catch (err) {
      console.error('Error loading codes:', err)
    }
  }

  useEffect(() => { 
    loadPartners()
    loadPartnerCodes()
  }, [])

  // Filter and search logic
  const filteredPartners = partners.filter(p => {
    const matchesSearch = !searchTerm || 
      p.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.cnpj?.includes(searchTerm) ||
      p.responsible_name?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const stats = {
    total: partners.length,
    active: partners.filter(p => p.status === 'active').length,
    pending: partners.filter(p => p.status === 'pending').length,
    inactive: partners.filter(p => p.status === 'inactive').length
  }

  const handleCNPJLoaded = (data: CNPJData) => {
    setCNPJData(data)
  }

  const handleFormSubmit = async (formData: Partial<Partner>) => {
    try {
      setIsFormLoading(true)
      setError(null)
      
      // Se está editando
      if (viewMode === 'edit' && editingPartner?.id) {
        console.log('[v0] Updating partner:', editingPartner.id)
        const response = await fetch(`/api/partners?id=${editingPartner.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        })
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Erro ao atualizar parceiro')
        }
        const updatedPartner = await response.json()
        setPartners(partners.map(p => p.id === updatedPartner.id ? updatedPartner : p))
        setSuccessMessage('Parceiro atualizado com sucesso!')
      } else {
        // Criando novo
        const response = await fetch('/api/partners', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        })
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Erro ao cadastrar parceiro')
        }
        const newPartner = await response.json()
        setPartners([newPartner, ...partners])
        setSuccessMessage('Parceiro cadastrado com sucesso!')
      }

      setCNPJData(undefined)
      setEditingPartner(undefined)
      setViewMode('list')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar parceiro')
      console.error('[v0] Error submitting form:', err)
    } finally {
      setIsFormLoading(false)
    }
  }

  const handleDeletePartner = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar este parceiro?')) return
    try {
      const response = await fetch(`/api/partners?id=${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Erro ao deletar parceiro')
      setPartners(partners.filter(p => p.id !== id))
      setSuccessMessage('Parceiro deletado com sucesso!')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao deletar parceiro')
    }
  }

  const toggleCardExpand = (id: string) => {
    const newExpanded = new Set(expandedCards)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedCards(newExpanded)
  }

  const formatCNPJ = (cnpj: string) => {
    const clean = cnpj.replace(/\D/g, '')
    if (clean.length !== 14) return cnpj
    return `${clean.slice(0,2)}.${clean.slice(2,5)}.${clean.slice(5,8)}/${clean.slice(8,12)}-${clean.slice(12)}`
  }

  return (
    <div className="h-full flex flex-col p-4 md:p-6 gap-4 overflow-hidden">
      {/* Header Section */}
      <header className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                {viewMode === 'edit' ? 'EDITAR PARCEIRO' : 'PARCEIRO SOMMA'}
              </h1>
              <p className="text-xs md:text-sm text-neutral-400">
                {viewMode === 'edit' 
                  ? 'Atualize os dados do parceiro' 
                  : viewMode === 'list' && filteredPartners.length > 0
                    ? `${filteredPartners.length} parceiro${filteredPartners.length !== 1 ? 's' : ''} ${filterStatus !== 'all' ? `(${filterStatus === 'active' ? 'ativos' : filterStatus === 'pending' ? 'pendentes' : filterStatus === 'negotiating' ? 'negociando' : 'inativos'})` : ''}`
                    : 'Gestao de parcerias comerciais'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={loadPartners}
              disabled={isLoading}
              size="sm"
              variant="outline"
              className="bg-transparent border-neutral-600 text-neutral-300 hover:bg-neutral-800"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            {viewMode === 'list' ? (
              <>
                <PartnerCodesModal 
                  codes={partnerCodes}
                  onCodesUpdate={loadPartnerCodes}
                  partnerName="Somma"
                />
                <Button
                  onClick={() => setViewMode('form')}
                  size="sm"
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  <span className="hidden sm:inline">Novo Parceiro</span>
                  <span className="sm:hidden">Novo</span>
                </Button>
              </>
            ) : (
              <Button
                onClick={() => { 
                  setViewMode('list')
                  setCNPJData(undefined)
                  setEditingPartner(undefined)
                }}
                size="sm"
                variant="outline"
                className="bg-transparent border-neutral-600 text-neutral-300 hover:bg-neutral-800"
              >
                <X className="w-4 h-4 mr-1.5" />
                Cancelar
              </Button>
            )}
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-300 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {successMessage && (
          <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
            <p className="text-sm text-green-300">{successMessage}</p>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col gap-4">
        {viewMode === 'form' || viewMode === 'edit' ? (
          /* FORM VIEW */
          <div className="flex-1 overflow-y-auto">
            <Card className="bg-neutral-900 border-neutral-700">
              <CardContent className="p-4 md:p-6">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-white mb-1">
                    {viewMode === 'edit' ? 'Editar Parceiro' : 'Cadastrar Novo Parceiro'}
                  </h2>
                  <p className="text-sm text-neutral-400">
                    {viewMode === 'edit' 
                      ? 'Atualize os dados do parceiro' 
                      : 'Busque pelo CNPJ ou preencha manualmente'}
                  </p>
                </div>
                
                {viewMode === 'form' && (
                  <div className="mb-6 p-4 bg-neutral-800/50 rounded-lg border border-neutral-700">
                    <CNPJLookup
                      onDataLoaded={handleCNPJLoaded}
                      onLoading={setIsFormLoading}
                      onError={setError}
                    />
                  </div>
                )}

                <PartnerForm
                  initialData={editingPartner}
                  cnpjData={cnpjData}
                  onSubmit={handleFormSubmit}
                  isLoading={isFormLoading}
                  isEditMode={viewMode === 'edit'}
                  onCancel={() => { 
                    setViewMode('list')
                    setCNPJData(undefined)
                    setEditingPartner(undefined)
                  }}
                />
              </CardContent>
            </Card>
          </div>
        ) : (
          /* LIST VIEW */
          <>
            {/* Search and Filter Bar - Always visible, compact */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <Input
                  placeholder="Buscar por nome, CNPJ ou responsavel..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-neutral-900 border-neutral-700 text-white placeholder-neutral-500 focus:border-orange-500"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              {/* Quick Filter Buttons + Controls */}
              <div className="flex items-center gap-2">
                {/* Status Filter Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`bg-transparent border-neutral-600 text-neutral-300 hover:bg-neutral-800 ${filterStatus !== 'all' ? 'border-orange-500/50 text-orange-400' : ''}`}
                    >
                      <Filter className="w-4 h-4 mr-1.5" />
                      {filterStatus === 'all' ? 'Todos' : 
                       filterStatus === 'active' ? 'Ativos' :
                       filterStatus === 'pending' ? 'Pendentes' :
                       filterStatus === 'negotiating' ? 'Negociando' : 'Inativos'}
                      <ChevronDown className="w-3 h-3 ml-1.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-neutral-900 border-neutral-700">
                    <DropdownMenuItem 
                      onClick={() => setFilterStatus('all')}
                      className={`text-neutral-300 focus:bg-neutral-800 ${filterStatus === 'all' ? 'bg-neutral-800' : ''}`}
                    >
                      <span className="w-2 h-2 rounded-full bg-orange-500 mr-2" />
                      Todos ({stats.total})
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setFilterStatus('active')}
                      className={`text-neutral-300 focus:bg-neutral-800 ${filterStatus === 'active' ? 'bg-neutral-800' : ''}`}
                    >
                      <span className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                      Ativos ({stats.active})
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setFilterStatus('pending')}
                      className={`text-neutral-300 focus:bg-neutral-800 ${filterStatus === 'pending' ? 'bg-neutral-800' : ''}`}
                    >
                      <span className="w-2 h-2 rounded-full bg-yellow-500 mr-2" />
                      Pendentes ({stats.pending})
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setFilterStatus('negotiating')}
                      className={`text-neutral-300 focus:bg-neutral-800 ${filterStatus === 'negotiating' ? 'bg-neutral-800' : ''}`}
                    >
                      <span className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
                      Em Negociacao ({partners.filter(p => p.status === 'negotiating').length})
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setFilterStatus('inactive')}
                      className={`text-neutral-300 focus:bg-neutral-800 ${filterStatus === 'inactive' ? 'bg-neutral-800' : ''}`}
                    >
                      <span className="w-2 h-2 rounded-full bg-red-500 mr-2" />
                      Inativos ({stats.inactive})
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* View Toggle */}
                <div className="flex items-center border border-neutral-700 rounded-md overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setListViewMode('table')}
                    className={`p-2 transition-colors ${listViewMode === 'table' ? 'bg-orange-500/20 text-orange-400' : 'text-neutral-400 hover:bg-neutral-800'}`}
                    title="Visualizacao em tabela"
                  >
                    <LayoutList className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setListViewMode('cards')}
                    className={`p-2 transition-colors ${listViewMode === 'cards' ? 'bg-orange-500/20 text-orange-400' : 'text-neutral-400 hover:bg-neutral-800'}`}
                    title="Visualizacao em cards"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                </div>

                {/* Stats Toggle */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`bg-transparent border-neutral-600 text-neutral-300 hover:bg-neutral-800 ${showFilters ? 'border-orange-500/50 text-orange-400' : ''}`}
                >
                  <Eye className="w-4 h-4 mr-1.5" />
                  <span className="hidden sm:inline">Resumo</span>
                </Button>
              </div>
            </div>

            {/* Collapsible Stats Row */}
            <Collapsible open={showFilters} onOpenChange={setShowFilters}>
              <CollapsibleContent className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  <button
                    type="button"
                    onClick={() => setFilterStatus('all')}
                    className={`p-3 rounded-lg border transition-all text-left ${
                      filterStatus === 'all' 
                        ? 'bg-orange-500/20 border-orange-500/50' 
                        : 'bg-neutral-900 border-neutral-700 hover:border-neutral-600'
                    }`}
                  >
                    <p className="text-[10px] text-neutral-400 font-medium uppercase tracking-wider">Total</p>
                    <p className={`text-xl font-bold mt-1 ${filterStatus === 'all' ? 'text-orange-400' : 'text-white'}`}>
                      {stats.total}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterStatus('active')}
                    className={`p-3 rounded-lg border transition-all text-left ${
                      filterStatus === 'active' 
                        ? 'bg-green-500/20 border-green-500/50' 
                        : 'bg-neutral-900 border-neutral-700 hover:border-neutral-600'
                    }`}
                  >
                    <p className="text-[10px] text-neutral-400 font-medium uppercase tracking-wider">Ativos</p>
                    <p className={`text-xl font-bold mt-1 ${filterStatus === 'active' ? 'text-green-400' : 'text-white'}`}>
                      {stats.active}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterStatus('pending')}
                    className={`p-3 rounded-lg border transition-all text-left ${
                      filterStatus === 'pending' 
                        ? 'bg-yellow-500/20 border-yellow-500/50' 
                        : 'bg-neutral-900 border-neutral-700 hover:border-neutral-600'
                    }`}
                  >
                    <p className="text-[10px] text-neutral-400 font-medium uppercase tracking-wider">Pendentes</p>
                    <p className={`text-xl font-bold mt-1 ${filterStatus === 'pending' ? 'text-yellow-400' : 'text-white'}`}>
                      {stats.pending}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterStatus('negotiating')}
                    className={`p-3 rounded-lg border transition-all text-left ${
                      filterStatus === 'negotiating' 
                        ? 'bg-blue-500/20 border-blue-500/50' 
                        : 'bg-neutral-900 border-neutral-700 hover:border-neutral-600'
                    }`}
                  >
                    <p className="text-[10px] text-neutral-400 font-medium uppercase tracking-wider">Negociando</p>
                    <p className={`text-xl font-bold mt-1 ${filterStatus === 'negotiating' ? 'text-blue-400' : 'text-white'}`}>
                      {partners.filter(p => p.status === 'negotiating').length}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterStatus('inactive')}
                    className={`p-3 rounded-lg border transition-all text-left ${
                      filterStatus === 'inactive' 
                        ? 'bg-red-500/20 border-red-500/50' 
                        : 'bg-neutral-900 border-neutral-700 hover:border-neutral-600'
                    }`}
                  >
                    <p className="text-[10px] text-neutral-400 font-medium uppercase tracking-wider">Inativos</p>
                    <p className={`text-xl font-bold mt-1 ${filterStatus === 'inactive' ? 'text-red-400' : 'text-white'}`}>
                      {stats.inactive}
                    </p>
                  </button>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Partners List/Table */}
            <div className="flex-1 overflow-hidden flex gap-4">
              {/* Main Content Area */}
              <div className={`flex-1 overflow-y-auto ${selectedPartner ? 'hidden md:block' : ''}`}>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-6 h-6 text-orange-500 animate-spin" />
                  </div>
                ) : filteredPartners.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Building2 className="w-12 h-12 text-neutral-700 mb-3" />
                    <p className="text-neutral-400 text-sm">
                      {partners.length === 0 ? 'Nenhum parceiro cadastrado' : 'Nenhum parceiro encontrado'}
                    </p>
                    {partners.length === 0 && (
                      <Button
                        onClick={() => setViewMode('form')}
                        size="sm"
                        className="mt-4 bg-orange-500 hover:bg-orange-600 text-white"
                      >
                        <Plus className="w-4 h-4 mr-1.5" />
                        Cadastrar Primeiro Parceiro
                      </Button>
                    )}
                  </div>
                ) : listViewMode === 'table' ? (
                  /* TABLE VIEW */
                  <Card className="bg-neutral-900 border-neutral-700 overflow-hidden">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-neutral-700 hover:bg-transparent">
                            <TableHead className="text-neutral-400 text-xs font-medium">Empresa</TableHead>
                            <TableHead className="text-neutral-400 text-xs font-medium hidden sm:table-cell">Responsavel</TableHead>
                            <TableHead className="text-neutral-400 text-xs font-medium hidden lg:table-cell">Contato</TableHead>
                            <TableHead className="text-neutral-400 text-xs font-medium">Status</TableHead>
                            <TableHead className="text-neutral-400 text-xs font-medium hidden md:table-cell">Beneficio</TableHead>
                            <TableHead className="text-neutral-400 text-xs font-medium text-right">Acoes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredPartners.map((partner) => (
                            <TableRow 
                              key={partner.id} 
                              className={`border-neutral-800 cursor-pointer transition-colors ${selectedPartner?.id === partner.id ? 'bg-orange-500/10' : 'hover:bg-neutral-800/50'}`}
                              onClick={() => setSelectedPartner(selectedPartner?.id === partner.id ? null : partner)}
                            >
                              <TableCell className="py-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center flex-shrink-0">
                                    <Building2 className="w-4 h-4 text-orange-500" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-white truncate max-w-[180px]">{partner.company_name}</p>
                                    <p className="text-[10px] text-neutral-500 font-mono">{formatCNPJ(partner.cnpj)}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="py-3 hidden sm:table-cell">
                                <div className="flex items-center gap-2">
                                  <User className="w-3 h-3 text-neutral-500 flex-shrink-0" />
                                  <span className="text-xs text-neutral-300 truncate max-w-[120px]">{partner.responsible_name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="py-3 hidden lg:table-cell">
                                <div className="flex items-center gap-2">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setWhatsappModal({
                                              isOpen: true,
                                              phone: partner.responsible_phone,
                                              name: partner.responsible_name
                                            })
                                          }}
                                          className="p-1.5 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                                        >
                                          <MessageCircle className="w-3 h-3" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="bg-neutral-800 border-neutral-700 text-xs">
                                        WhatsApp: {partner.responsible_phone}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <a
                                          href={`mailto:${partner.responsible_email}`}
                                          onClick={(e) => e.stopPropagation()}
                                          className="p-1.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                                        >
                                          <Mail className="w-3 h-3" />
                                        </a>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="bg-neutral-800 border-neutral-700 text-xs">
                                        {partner.responsible_email}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              </TableCell>
                              <TableCell className="py-3">
                                <Badge className={`text-[10px] ${
                                  partner.status === 'active' ? 'bg-green-500/20 text-green-400' :
                                  partner.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                  partner.status === 'negotiating' ? 'bg-blue-500/20 text-blue-400' :
                                  'bg-red-500/20 text-red-400'
                                }`}>
                                  {partner.status === 'active' ? 'Ativo' : 
                                   partner.status === 'pending' ? 'Pendente' : 
                                   partner.status === 'negotiating' ? 'Negociando' : 'Inativo'}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-3 hidden md:table-cell">
                                {partner.benefit ? (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="flex items-center gap-1.5">
                                          <Gift className="w-3 h-3 text-orange-400" />
                                          <span className="text-xs text-neutral-400 truncate max-w-[100px]">
                                            {partner.benefit_type === 'percentage' ? 'Desconto %' :
                                             partner.benefit_type === 'fixed' ? 'Valor Fixo' :
                                             partner.benefit_type === 'service' ? 'Servico' : 'Outro'}
                                          </span>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="bg-neutral-800 border-neutral-700 text-xs max-w-[200px]">
                                        {partner.benefit}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : (
                                  <span className="text-xs text-neutral-600">-</span>
                                )}
                              </TableCell>
                              <TableCell className="py-3">
                                <div className="flex items-center justify-end gap-1">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setEditingPartner(partner)
                                            setViewMode('edit')
                                          }}
                                          className="p-1.5 rounded text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="bg-neutral-800 border-neutral-700 text-xs">
                                        Editar
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            partner.id && handleDeletePartner(partner.id)
                                          }}
                                          className="p-1.5 rounded text-red-400 hover:bg-red-500/20 transition-colors"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="bg-neutral-800 border-neutral-700 text-xs">
                                        Excluir
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>
                ) : (
                  /* CARDS VIEW */
                  <div className="space-y-3">
                    {filteredPartners.map((partner) => {
                      const isExpanded = expandedCards.has(partner.id || '')
                      return (
                        <Card 
                          key={partner.id} 
                          className={`bg-neutral-900 border-neutral-700 transition-colors overflow-hidden ${selectedPartner?.id === partner.id ? 'border-orange-500/50' : 'hover:border-neutral-600'}`}
                        >
                          {/* Card Header - Always Visible */}
                          <div 
                            className="p-4 cursor-pointer"
                            onClick={() => {
                              toggleCardExpand(partner.id || '')
                              setSelectedPartner(partner)
                            }}
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center flex-shrink-0">
                                <Building2 className="w-5 h-5 text-orange-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-semibold text-white text-sm truncate">{partner.company_name}</h3>
                                  <Badge className={`text-[10px] ${
                                    partner.status === 'active' ? 'bg-green-500/20 text-green-400' :
                                    partner.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                    partner.status === 'negotiating' ? 'bg-blue-500/20 text-blue-400' :
                                    'bg-red-500/20 text-red-400'
                                  }`}>
                                    {partner.status === 'active' ? 'Ativo' : partner.status === 'pending' ? 'Pendente' : partner.status === 'negotiating' ? 'Negociando' : 'Inativo'}
                                  </Badge>
                                </div>
                                <p className="text-xs text-neutral-500 font-mono mt-0.5">{formatCNPJ(partner.cnpj)}</p>
                                <div className="flex items-center gap-4 mt-2">
                                  <div className="flex items-center gap-1">
                                    <User className="w-3 h-3 text-neutral-500" />
                                    <p className="text-xs text-neutral-400">{partner.responsible_name}</p>
                                  </div>
                                  {partner.benefit && (
                                    <div className="flex items-center gap-1">
                                      <Gift className="w-3 h-3 text-orange-400" />
                                      <p className="text-xs text-orange-400/80">Com beneficio</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                {/* Quick Actions */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setWhatsappModal({
                                      isOpen: true,
                                      phone: partner.responsible_phone,
                                      name: partner.responsible_name
                                    })
                                  }}
                                  className="p-1.5 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditingPartner(partner)
                                    setViewMode('edit')
                                  }}
                                  className="p-1.5 rounded text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  type="button"
                                  className="text-neutral-500 hover:text-neutral-300 p-1"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleCardExpand(partner.id || '')
                                  }}
                                >
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Card Expanded Content */}
                          {isExpanded && (
                            <div className="px-4 pb-4 pt-0 border-t border-neutral-800">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                                {/* Company Info */}
                                <div className="space-y-2">
                                  <h4 className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Empresa</h4>
                                  <div className="space-y-1.5 text-sm">
                                    {partner.company_legal_name && (
                                      <p className="text-neutral-300 text-xs">{partner.company_legal_name}</p>
                                    )}
                                    {partner.company_email && (
                                      <div className="flex items-center gap-2">
                                        <Mail className="w-3.5 h-3.5 text-neutral-500" />
                                        <a href={`mailto:${partner.company_email}`} className="text-xs text-neutral-400 hover:text-orange-400 transition-colors truncate">
                                          {partner.company_email}
                                        </a>
                                      </div>
                                    )}
                                    {partner.company_phone && (
                                      <div className="flex items-center gap-2">
                                        <Phone className="w-3.5 h-3.5 text-neutral-500" />
                                        <span className="text-xs text-neutral-400">{partner.company_phone}</span>
                                      </div>
                                    )}
                                    {partner.company_address && (
                                      <p className="text-xs text-neutral-500">
                                        {partner.company_address}{partner.company_city ? `, ${partner.company_city}` : ''}{partner.company_state ? ` - ${partner.company_state}` : ''}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Responsible Info */}
                                <div className="space-y-2">
                                  <h4 className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Responsavel</h4>
                                  <div className="space-y-1.5 text-sm">
                                    <p className="text-neutral-300 text-xs font-medium">{partner.responsible_name}</p>
                                    <div className="flex items-center gap-2">
                                      <Mail className="w-3.5 h-3.5 text-neutral-500" />
                                      <a href={`mailto:${partner.responsible_email}`} className="text-xs text-neutral-400 hover:text-orange-400 transition-colors truncate">
                                        {partner.responsible_email}
                                      </a>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Phone className="w-3.5 h-3.5 text-neutral-500" />
                                      <span className="text-xs text-neutral-400">{partner.responsible_phone}</span>
                                    </div>
                                    {partner.responsible_cpf && (
                                      <p className="text-xs text-neutral-500 font-mono">CPF: {partner.responsible_cpf}</p>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Benefit Info */}
                              {partner.benefit && (
                                <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                                  <h4 className="text-[10px] font-semibold text-orange-400 uppercase tracking-wider mb-2">Beneficio da Parceria</h4>
                                  <div className="flex items-start gap-2">
                                    <Badge className="text-[10px] bg-orange-500/20 text-orange-300 flex-shrink-0">
                                      {partner.benefit_type === 'percentage' ? 'Desconto %' :
                                       partner.benefit_type === 'fixed' ? 'Valor Fixo' :
                                       partner.benefit_type === 'service' ? 'Servico' : 'Outro'}
                                    </Badge>
                                    <p className="text-xs text-neutral-300">{partner.benefit}</p>
                                  </div>
                                </div>
                              )}

                              {/* Actions */}
                              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-neutral-800">
                                <Button
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setWhatsappModal({
                                      isOpen: true,
                                      phone: partner.responsible_phone,
                                      name: partner.responsible_name
                                    })
                                  }}
                                  className="bg-green-600 hover:bg-green-700 text-white text-xs"
                                >
                                  <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                                  WhatsApp
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    window.location.href = `mailto:${partner.responsible_email}`
                                  }}
                                  variant="outline"
                                  className="bg-transparent border-neutral-600 text-neutral-300 hover:bg-neutral-800 text-xs"
                                >
                                  <Mail className="w-3.5 h-3.5 mr-1.5" />
                                  Email
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditingPartner(partner)
                                    setViewMode('edit')
                                    setExpandedCards(new Set())
                                  }}
                                  variant="outline"
                                  className="bg-transparent border-neutral-600 text-neutral-300 hover:bg-neutral-800 text-xs"
                                >
                                  <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                                  Editar
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    partner.id && handleDeletePartner(partner.id)
                                  }}
                                  className="bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-xs"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </Card>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Detail Panel - Shows when a partner is selected */}
              {selectedPartner && (
                <div className={`${selectedPartner ? 'flex' : 'hidden'} md:flex w-full md:w-80 lg:w-96 flex-shrink-0 flex-col`}>
                  <Card className="bg-neutral-900 border-neutral-700 flex-1 overflow-hidden flex flex-col">
                    {/* Panel Header */}
                    <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">Detalhes do Parceiro</h3>
                      <button
                        type="button"
                        onClick={() => setSelectedPartner(null)}
                        className="p-1 rounded text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Panel Content */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {/* Company Header */}
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-6 h-6 text-orange-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-semibold text-white text-sm">{selectedPartner.company_name}</h4>
                          <p className="text-xs text-neutral-500 font-mono mt-0.5">{formatCNPJ(selectedPartner.cnpj)}</p>
                          <Badge className={`mt-2 text-[10px] ${
                            selectedPartner.status === 'active' ? 'bg-green-500/20 text-green-400' :
                            selectedPartner.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                            selectedPartner.status === 'negotiating' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {selectedPartner.status === 'active' ? 'Ativo' : 
                             selectedPartner.status === 'pending' ? 'Pendente' : 
                             selectedPartner.status === 'negotiating' ? 'Negociando' : 'Inativo'}
                          </Badge>
                        </div>
                      </div>

                      {/* Company Info */}
                      <div className="space-y-2">
                        <h5 className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Dados da Empresa</h5>
                        <div className="space-y-2 bg-neutral-800/50 rounded-lg p-3">
                          {selectedPartner.company_legal_name && (
                            <div>
                              <p className="text-[10px] text-neutral-500">Razao Social</p>
                              <p className="text-xs text-neutral-300">{selectedPartner.company_legal_name}</p>
                            </div>
                          )}
                          {selectedPartner.company_email && (
                            <div>
                              <p className="text-[10px] text-neutral-500">Email</p>
                              <a href={`mailto:${selectedPartner.company_email}`} className="text-xs text-orange-400 hover:underline">
                                {selectedPartner.company_email}
                              </a>
                            </div>
                          )}
                          {selectedPartner.company_phone && (
                            <div>
                              <p className="text-[10px] text-neutral-500">Telefone</p>
                              <p className="text-xs text-neutral-300">{selectedPartner.company_phone}</p>
                            </div>
                          )}
                          {selectedPartner.company_address && (
                            <div>
                              <p className="text-[10px] text-neutral-500">Endereco</p>
                              <p className="text-xs text-neutral-300">
                                {selectedPartner.company_address}
                                {selectedPartner.company_city && `, ${selectedPartner.company_city}`}
                                {selectedPartner.company_state && ` - ${selectedPartner.company_state}`}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Responsible Info */}
                      <div className="space-y-2">
                        <h5 className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Responsavel</h5>
                        <div className="space-y-2 bg-neutral-800/50 rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-neutral-500" />
                            <p className="text-xs text-neutral-300 font-medium">{selectedPartner.responsible_name}</p>
                          </div>
                          {selectedPartner.responsible_cpf && (
                            <div>
                              <p className="text-[10px] text-neutral-500">CPF</p>
                              <p className="text-xs text-neutral-300 font-mono">{selectedPartner.responsible_cpf}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-[10px] text-neutral-500">Email</p>
                            <a href={`mailto:${selectedPartner.responsible_email}`} className="text-xs text-orange-400 hover:underline">
                              {selectedPartner.responsible_email}
                            </a>
                          </div>
                          <div>
                            <p className="text-[10px] text-neutral-500">Telefone</p>
                            <p className="text-xs text-neutral-300">{selectedPartner.responsible_phone}</p>
                          </div>
                        </div>
                      </div>

                      {/* Benefit Info */}
                      {selectedPartner.benefit && (
                        <div className="space-y-2">
                          <h5 className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Beneficio</h5>
                          <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                            <Badge className="text-[10px] bg-orange-500/20 text-orange-300 mb-2">
                              {selectedPartner.benefit_type === 'percentage' ? 'Desconto %' :
                               selectedPartner.benefit_type === 'fixed' ? 'Valor Fixo' :
                               selectedPartner.benefit_type === 'service' ? 'Servico' : 'Outro'}
                            </Badge>
                            <p className="text-xs text-neutral-300">{selectedPartner.benefit}</p>
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      {selectedPartner.notes && (
                        <div className="space-y-2">
                          <h5 className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Observacoes</h5>
                          <div className="bg-neutral-800/50 rounded-lg p-3">
                            <p className="text-xs text-neutral-400">{selectedPartner.notes}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Panel Actions */}
                    <div className="p-4 border-t border-neutral-800 space-y-2">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setWhatsappModal({
                              isOpen: true,
                              phone: selectedPartner.responsible_phone,
                              name: selectedPartner.responsible_name
                            })
                          }}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs"
                        >
                          <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                          WhatsApp
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            window.location.href = `mailto:${selectedPartner.responsible_email}`
                          }}
                          variant="outline"
                          className="flex-1 bg-transparent border-neutral-600 text-neutral-300 hover:bg-neutral-800 text-xs"
                        >
                          <Mail className="w-3.5 h-3.5 mr-1.5" />
                          Email
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setEditingPartner(selectedPartner)
                            setViewMode('edit')
                            setSelectedPartner(null)
                          }}
                          variant="outline"
                          className="flex-1 bg-transparent border-neutral-600 text-neutral-300 hover:bg-neutral-800 text-xs"
                        >
                          <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            selectedPartner.id && handleDeletePartner(selectedPartner.id)
                            setSelectedPartner(null)
                          }}
                          className="bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-xs"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* WhatsApp Modal */}
      <WhatsAppMessageModal
        isOpen={whatsappModal.isOpen}
        phoneNumber={whatsappModal.phone}
        memberName={whatsappModal.name}
        onClose={() => setWhatsappModal({ isOpen: false, phone: '', name: '' })}
      />
    </div>
  )
}
