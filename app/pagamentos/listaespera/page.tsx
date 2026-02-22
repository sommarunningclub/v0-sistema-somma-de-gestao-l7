"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Search,
  Mail,
  Phone,
  X,
  Calendar,
  AlertCircle,
  RefreshCw,
  Trash2,
  Users,
  Loader2,
  MessageCircle,
  UserPlus,
  CheckSquare,
  CreditCard,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase-client"
import { WhatsAppMessageModal } from "@/components/whatsapp-message-modal"

interface ListaVipAssessoria {
  id: string
  nome: string
  email: string
  whatsapp: string
  sexo: "masculino" | "feminino"
  cidade: string
  data_hora: string
  professor_id?: string
  has_subscribed?: boolean
  plan_type?: string
  subscription_date?: string
  notes?: string
}

export default function ListaEsperaPage() {
  const { toast } = useToast()
  const [entries, setEntries] = useState<ListaVipAssessoria[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<ListaVipAssessoria | null>(null)
  const [whatsappModal, setWhatsappModal] = useState<{ isOpen: boolean; phone: string; name: string }>({
    isOpen: false,
    phone: '',
    name: ''
  })
  const [showLinkProfessorModal, setShowLinkProfessorModal] = useState(false)
  const [professors, setProfessors] = useState<any[]>([])
  const [selectedProfessorId, setSelectedProfessorId] = useState<string>('')
  const [linkingProfessor, setLinkingProfessor] = useState(false)
  
  // Seleção múltipla
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showBulkSubscriptionModal, setShowBulkSubscriptionModal] = useState(false)
  const [bulkPlanType, setBulkPlanType] = useState<string>('')
  const [bulkNotes, setBulkNotes] = useState<string>('')
  const [updatingBulk, setUpdatingBulk] = useState(false)

  // Buscar dados da tabela lista_vip_assessoria
  const loadListaVip = async () => {
    try {
      console.log('[v0] Loading lista_vip_assessoria...')
      setLoading(true)
      const { data, error } = await supabase
        .from('lista_vip_assessoria')
        .select('*')
        .order('data_hora', { ascending: false })

      if (error) {
        console.error('[v0] Error loading lista_vip_assessoria:', error)
        toast({
          title: "Erro ao carregar dados",
          description: error.message,
          variant: "destructive",
        })
        return
      }

      console.log('[v0] Lista VIP loaded successfully:', data?.length, 'records')
      setEntries(data || [])
    } catch (error) {
      console.error('[v0] Error:', error)
      toast({
        title: "Erro",
        description: "Falha ao carregar lista VIP",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Remover entrada da lista
  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este registro?")) return

    try {
      const { error } = await supabase
        .from('lista_vip_assessoria')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast({
        title: "Sucesso",
        description: "Registro removido da lista",
      })

      loadListaVip()
    } catch (error) {
      console.error('[v0] Error deleting:', error)
      toast({
        title: "Erro",
        description: "Falha ao remover registro",
        variant: "destructive",
      })
    }
  }

  // Buscar professores
  const loadProfessors = async () => {
    try {
      const { data, error } = await supabase
        .from('professors')
        .select('*')
        .eq('status', 'active')
        .order('name')

      if (error) throw error
      setProfessors(data || [])
    } catch (error) {
      console.error('[v0] Error loading professors:', error)
    }
  }

  // Marcar como assinado em massa
  const handleBulkMarkAsSubscribed = async () => {
    if (selectedIds.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos um registro",
        variant: "destructive",
      })
      return
    }

    if (!bulkPlanType) {
      toast({
        title: "Erro",
        description: "Selecione o tipo de plano",
        variant: "destructive",
      })
      return
    }

    try {
      setUpdatingBulk(true)

      const { error } = await supabase
        .from('lista_vip_assessoria')
        .update({
          has_subscribed: true,
          plan_type: bulkPlanType,
          subscription_date: new Date().toISOString(),
          notes: bulkNotes || null
        })
        .in('id', selectedIds)

      if (error) throw error

      toast({
        title: "Sucesso",
        description: `${selectedIds.length} ${selectedIds.length === 1 ? 'registro marcado' : 'registros marcados'} como assinado`,
      })

      setShowBulkSubscriptionModal(false)
      setSelectedIds([])
      setBulkPlanType('')
      setBulkNotes('')
      loadListaVip()
    } catch (error) {
      console.error('[v0] Error updating bulk:', error)
      toast({
        title: "Erro",
        description: "Falha ao atualizar registros",
        variant: "destructive",
      })
    } finally {
      setUpdatingBulk(false)
    }
  }

  // Vincular cliente ao professor
  const handleLinkToProfessor = async () => {
    if (!selectedEntry || !selectedProfessorId) {
      toast({
        title: "Erro",
        description: "Selecione um professor",
        variant: "destructive",
      })
      return
    }

    try {
      setLinkingProfessor(true)

      console.log('[v0] Linking client to professor:', {
        clientId: selectedEntry.id,
        clientName: selectedEntry.nome,
        professorId: selectedProfessorId
      })

      // 1. Atualizar a lista VIP com o professor_id
      const { error: updateError } = await supabase
        .from('lista_vip_assessoria')
        .update({ professor_id: selectedProfessorId })
        .eq('id', selectedEntry.id)

      if (updateError) {
        console.error('[v0] Error updating lista_vip_assessoria:', updateError)
        throw updateError
      }

      // 2. Verificar se já existe vínculo na tabela professor_clients
      const { data: existingLink } = await supabase
        .from('professor_clients')
        .select('*')
        .eq('professor_id', selectedProfessorId)
        .eq('customer_email', selectedEntry.email)
        .single()

      if (!existingLink) {
        // 3. Criar registro na tabela professor_clients
        const { error: insertError } = await supabase
          .from('professor_clients')
          .insert([{
            professor_id: selectedProfessorId,
            customer_name: selectedEntry.nome,
            customer_email: selectedEntry.email,
            customer_cpf_cnpj: '',
            asaas_customer_id: null,
            status: 'active',
            linked_at: new Date().toISOString()
          }])

        if (insertError) {
          console.error('[v0] Error inserting into professor_clients:', insertError)
          throw insertError
        }

        console.log('[v0] Client successfully linked to professor in both tables')
      } else {
        console.log('[v0] Client already linked in professor_clients table')
      }

      toast({
        title: "Sucesso",
        description: "Cliente vinculado ao professor com sucesso",
      })

      setShowLinkProfessorModal(false)
      setSelectedProfessorId('')
      setSelectedEntry(null)
      loadListaVip()
    } catch (error) {
      console.error('[v0] Error linking to professor:', error)
      toast({
        title: "Erro",
        description: "Falha ao vincular cliente ao professor",
        variant: "destructive",
      })
    } finally {
      setLinkingProfessor(false)
    }
  }

  // Toggle seleção individual
  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  // Selecionar/desselecionar todos
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredEntries.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredEntries.map(e => e.id))
    }
  }

  // Carregar dados ao montar o componente
  useEffect(() => {
    loadListaVip()
    loadProfessors()
  }, [])

  // Filtrar dados por busca
  const filteredEntries = entries.filter(entry =>
    entry.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.whatsapp.includes(searchTerm) ||
    entry.cidade.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const stats = {
    total: entries.length,
    masculino: entries.filter(e => e.sexo === 'masculino').length,
    feminino: entries.filter(e => e.sexo === 'feminino').length,
    assinados: entries.filter(e => e.has_subscribed).length,
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateString
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          <p className="text-white">Carregando lista VIP...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black p-3 sm:p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Lista de Espera VIP</h1>
            <p className="text-neutral-400 mt-1 sm:mt-2 text-sm sm:text-base">Gerencie os registros da lista VIP de Assessoria</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            {selectedIds.length > 0 && (
              <Button
                onClick={() => setShowBulkSubscriptionModal(true)}
                className="gap-2 bg-green-500 hover:bg-green-600 text-white flex-1 sm:flex-none"
              >
                <CheckSquare className="w-4 h-4" />
                Marcar como Assinado ({selectedIds.length})
              </Button>
            )}
            <Button
              onClick={() => {
                setIsRefreshing(true)
                loadListaVip().finally(() => setIsRefreshing(false))
              }}
              disabled={isRefreshing}
              className="gap-2 flex-1 sm:flex-none"
              variant="outline"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card className="bg-neutral-900 border-neutral-800">
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-neutral-400 text-xs sm:text-sm truncate">Total</p>
                  <p className="text-xl sm:text-2xl md:text-3xl font-bold text-white mt-1">{stats.total}</p>
                </div>
                <Users className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-orange-500 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-neutral-900 border-neutral-800">
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="flex flex-col gap-2">
                <p className="text-neutral-400 text-xs sm:text-sm">Masculino</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xl sm:text-2xl md:text-3xl font-bold text-white">{stats.masculino}</p>
                  <Badge className="bg-blue-500 text-xs">{((stats.masculino / stats.total) * 100).toFixed(0)}%</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-neutral-900 border-neutral-800">
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="flex flex-col gap-2">
                <p className="text-neutral-400 text-xs sm:text-sm">Feminino</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xl sm:text-2xl md:text-3xl font-bold text-white">{stats.feminino}</p>
                  <Badge className="bg-pink-500 text-xs">{((stats.feminino / stats.total) * 100).toFixed(0)}%</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-neutral-900 border-green-500/50">
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="flex flex-col gap-2">
                <p className="text-neutral-400 text-xs sm:text-sm">Assinados</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xl sm:text-2xl md:text-3xl font-bold text-green-500">{stats.assinados}</p>
                  <Badge className="bg-green-500 text-xs">{stats.total > 0 ? ((stats.assinados / stats.total) * 100).toFixed(0) : 0}%</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Selection Controls */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-neutral-500" />
            <Input
              placeholder="Buscar por nome, email, WhatsApp ou cidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 sm:pl-10 bg-neutral-900 border-neutral-800 text-white text-sm sm:text-base"
            />
          </div>
          <Button
            onClick={toggleSelectAll}
            variant="outline"
            className="border-neutral-700 text-neutral-300 hover:text-orange-500 gap-2 w-full sm:w-auto"
          >
            <CheckSquare className="w-4 h-4" />
            {selectedIds.length === filteredEntries.length ? 'Desselecionar Todos' : 'Selecionar Todos'}
          </Button>
        </div>

        {/* Tabela de Registros */}
        {filteredEntries.length > 0 ? (
          <div className="space-y-3 sm:space-y-4">
            {filteredEntries.map((entry) => (
              <Card 
                key={entry.id} 
                className={`bg-neutral-900 border-neutral-800 hover:border-orange-500/50 transition-colors ${
                  selectedIds.includes(entry.id) ? 'ring-2 ring-orange-500' : ''
                } ${entry.has_subscribed ? 'border-green-500/30' : ''}`}
              >
                <CardContent className="p-3 sm:p-4 md:p-6">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedIds.includes(entry.id)}
                        onCheckedChange={() => toggleSelect(entry.id)}
                        className="mt-1 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="text-base sm:text-lg font-semibold text-white truncate">{entry.nome}</h3>
                            <div className="flex flex-wrap gap-2 mt-2">
                              <Badge variant="outline" className="bg-neutral-800 text-neutral-300 text-xs">
                                {entry.sexo === 'masculino' ? '♂ Masculino' : '♀ Feminino'}
                              </Badge>
                              <Badge variant="outline" className="bg-neutral-800 text-neutral-300 text-xs">
                                {entry.cidade}
                              </Badge>
                              {entry.has_subscribed && (
                                <>
                                  <Badge className="bg-green-500 text-white text-xs">
                                    ✓ Assinado
                                  </Badge>
                                  {entry.plan_type && (
                                    <Badge className="bg-blue-500 text-white text-xs">
                                      {entry.plan_type}
                                    </Badge>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                          <div className="flex items-center gap-2 text-neutral-400 text-xs sm:text-sm min-w-0">
                            <Mail className="w-3 h-3 sm:w-4 sm:h-4 text-orange-500 flex-shrink-0" />
                            <a 
                              href={`mailto:${entry.email}`} 
                              className="hover:text-orange-500 transition-colors truncate"
                              title={entry.email}
                            >
                              {entry.email}
                            </a>
                          </div>
                          <div className="flex items-center gap-2 text-neutral-400 text-xs sm:text-sm">
                            <Phone className="w-3 h-3 sm:w-4 sm:h-4 text-orange-500 flex-shrink-0" />
                            <span className="truncate">{entry.whatsapp}</span>
                            <Button
                              onClick={() => setWhatsappModal({ isOpen: true, phone: entry.whatsapp, name: entry.nome })}
                              size="sm"
                              className="bg-green-500 hover:bg-green-600 text-white p-1 h-auto flex-shrink-0"
                              title="Enviar mensagem WhatsApp"
                            >
                              <MessageCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2 text-neutral-400 text-xs sm:text-sm">
                            <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-orange-500 flex-shrink-0" />
                            <span className="truncate">{formatDate(entry.data_hora)}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-2">
                          <Button
                            onClick={() => setSelectedEntry(entry)}
                            variant="outline"
                            size="sm"
                            className="border-neutral-700 text-neutral-300 hover:text-orange-500 text-xs sm:text-sm"
                          >
                            Detalhes
                          </Button>
                          <Button
                            onClick={() => handleDelete(entry.id)}
                            variant="destructive"
                            size="sm"
                            className="gap-1 text-xs sm:text-sm"
                          >
                            <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                            Remover
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-neutral-900 border-neutral-800">
            <CardContent className="p-8 sm:p-12 flex flex-col items-center justify-center gap-4">
              <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 text-neutral-500" />
              <p className="text-neutral-400 text-sm sm:text-base text-center">
                {searchTerm ? "Nenhum registro encontrado para sua busca" : "Nenhum registro na lista VIP"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal de Marcar como Assinado em Massa */}
      {showBulkSubscriptionModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <Card className="bg-neutral-900 border-neutral-800 max-w-md w-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-white">Marcar como Assinado</CardTitle>
              <button
                onClick={() => {
                  setShowBulkSubscriptionModal(false)
                  setBulkPlanType('')
                  setBulkNotes('')
                }}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-neutral-800 p-4 rounded-lg">
                <p className="text-neutral-400 text-sm">Registros selecionados</p>
                <p className="text-2xl font-bold text-white">{selectedIds.length}</p>
              </div>

              <div>
                <label className="text-neutral-400 text-sm block mb-2">
                  Tipo de Plano *
                </label>
                <select
                  value={bulkPlanType}
                  onChange={(e) => setBulkPlanType(e.target.value)}
                  className="w-full bg-neutral-800 border-neutral-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Selecione o tipo de plano...</option>
                  <option value="Mensal">Mensal</option>
                  <option value="Semestral">Semestral</option>
                  <option value="Anual">Anual</option>
                </select>
              </div>

              <div>
                <label className="text-neutral-400 text-sm block mb-2">
                  Observações (opcional)
                </label>
                <textarea
                  value={bulkNotes}
                  onChange={(e) => setBulkNotes(e.target.value)}
                  placeholder="Adicione observações sobre a conversão..."
                  rows={3}
                  className="w-full bg-neutral-800 border-neutral-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </div>

              <div className="flex gap-2 mt-6">
                <Button
                  onClick={() => {
                    setShowBulkSubscriptionModal(false)
                    setBulkPlanType('')
                    setBulkNotes('')
                  }}
                  variant="outline"
                  className="flex-1 border-neutral-700 text-neutral-300"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleBulkMarkAsSubscribed}
                  disabled={!bulkPlanType || updatingBulk}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                >
                  {updatingBulk ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Atualizando...
                    </>
                  ) : (
                    <>
                      <CheckSquare className="w-4 h-4 mr-2" />
                      Confirmar
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de Detalhes */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <Card className="bg-neutral-900 border-neutral-800 max-w-md w-full my-8">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-white">Detalhes do Registro</CardTitle>
              <button
                onClick={() => setSelectedEntry(null)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-neutral-400 text-sm">Nome</p>
                <p className="text-white font-medium">{selectedEntry.nome}</p>
              </div>
              <div>
                <p className="text-neutral-400 text-sm">Email</p>
                <p className="text-white font-medium break-all">{selectedEntry.email}</p>
              </div>
              <div>
                <p className="text-neutral-400 text-sm">WhatsApp</p>
                <p className="text-white font-medium">{selectedEntry.whatsapp}</p>
              </div>
              <div>
                <p className="text-neutral-400 text-sm">Sexo</p>
                <p className="text-white font-medium capitalize">
                  {selectedEntry.sexo === 'masculino' ? 'Masculino' : 'Feminino'}
                </p>
              </div>
              <div>
                <p className="text-neutral-400 text-sm">Cidade</p>
                <p className="text-white font-medium">{selectedEntry.cidade}</p>
              </div>
              <div>
                <p className="text-neutral-400 text-sm">Data e Hora de Registro</p>
                <p className="text-white font-medium">{formatDate(selectedEntry.data_hora)}</p>
              </div>

              {selectedEntry.has_subscribed && (
                <>
                  <div className="border-t border-neutral-700 pt-4">
                    <Badge className="bg-green-500 text-white mb-4">Já Assinou</Badge>
                  </div>
                  {selectedEntry.plan_type && (
                    <div>
                      <p className="text-neutral-400 text-sm">Tipo de Plano</p>
                      <p className="text-white font-medium">{selectedEntry.plan_type}</p>
                    </div>
                  )}
                  {selectedEntry.subscription_date && (
                    <div>
                      <p className="text-neutral-400 text-sm">Data da Assinatura</p>
                      <p className="text-white font-medium">{formatDate(selectedEntry.subscription_date)}</p>
                    </div>
                  )}
                  {selectedEntry.notes && (
                    <div>
                      <p className="text-neutral-400 text-sm">Observações</p>
                      <p className="text-white font-medium">{selectedEntry.notes}</p>
                    </div>
                  )}
                </>
              )}
              
              <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-neutral-700">
                <Button
                  onClick={() => {
                    setWhatsappModal({ isOpen: true, phone: selectedEntry.whatsapp, name: selectedEntry.nome })
                    setSelectedEntry(null)
                  }}
                  className="bg-green-500 hover:bg-green-600 text-white gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </Button>
                <Button
                  onClick={() => {
                    setShowLinkProfessorModal(true)
                  }}
                  className="bg-blue-500 hover:bg-blue-600 text-white gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Vincular
                </Button>
                {!selectedEntry.has_subscribed && (
                  <Button
                    onClick={() => {
                      setSelectedIds([selectedEntry.id])
                      setSelectedEntry(null)
                      setShowBulkSubscriptionModal(true)
                    }}
                    className="col-span-2 bg-green-500 hover:bg-green-600 text-white gap-2"
                  >
                    <CheckSquare className="w-4 h-4" />
                    Marcar como Assinado
                  </Button>
                )}
                <Button
                  onClick={() => {
                    const id = selectedEntry.id
                    setSelectedEntry(null)
                    handleDelete(id)
                  }}
                  variant="destructive"
                  className="col-span-2 gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Remover Registro
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de Vincular ao Professor */}
      {showLinkProfessorModal && selectedEntry && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <Card className="bg-neutral-900 border-neutral-800 max-w-md w-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-white">Vincular ao Professor</CardTitle>
              <button
                onClick={() => {
                  setShowLinkProfessorModal(false)
                  setSelectedProfessorId('')
                }}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-neutral-400 text-sm mb-2">Cliente</p>
                <p className="text-white font-medium">{selectedEntry.nome}</p>
                <p className="text-neutral-400 text-sm">{selectedEntry.email}</p>
              </div>
              
              <div>
                <label className="text-neutral-400 text-sm block mb-2">
                  Selecione o Professor
                </label>
                <select
                  value={selectedProfessorId}
                  onChange={(e) => setSelectedProfessorId(e.target.value)}
                  className="w-full bg-neutral-800 border-neutral-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Selecione um professor...</option>
                  {professors.map((prof) => (
                    <option key={prof.id} value={prof.id}>
                      {prof.name} - {prof.specialty || 'Sem especialidade'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 mt-6">
                <Button
                  onClick={() => {
                    setShowLinkProfessorModal(false)
                    setSelectedProfessorId('')
                  }}
                  variant="outline"
                  className="flex-1 border-neutral-700 text-neutral-300"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleLinkToProfessor}
                  disabled={!selectedProfessorId || linkingProfessor}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {linkingProfessor ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Vinculando...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Vincular
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de WhatsApp */}
      <WhatsAppMessageModal
        isOpen={whatsappModal.isOpen}
        phoneNumber={whatsappModal.phone}
        memberName={whatsappModal.name}
        onClose={() => setWhatsappModal({ isOpen: false, phone: '', name: '' })}
      />
    </div>
  )
}
