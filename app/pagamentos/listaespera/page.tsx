"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  Mail,
  Phone,
  MapPin,
  X,
  Calendar,
  AlertCircle,
  RefreshCw,
  Trash2,
  Users,
  Loader2,
  MessageCircle,
  UserPlus,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase-client"
import { WhatsAppMessageModal } from "@/components/whatsapp-message-modal"
import { TagManager } from "@/components/tag-manager"

interface ListaVipAssessoria {
  id: string
  nome: string
  email: string
  whatsapp: string
  sexo: "masculino" | "feminino"
  cidade: string
  data_hora: string
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
      console.log('[v0] Sample data:', data?.[0])
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
            customer_cpf_cnpj: '', // Não temos CPF na lista VIP
            asaas_customer_id: null, // Será preenchido quando criar no Asaas
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
  }

  console.log('[v0] Stats calculated:', stats)

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
    <div className="min-h-screen bg-black p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Lista de Espera VIP</h1>
            <p className="text-neutral-400 text-xs md:text-sm mt-1 md:mt-2">Gerencie os registros da lista VIP de Assessoria</p>
          </div>
          <Button
            onClick={() => {
              setIsRefreshing(true)
              loadListaVip().finally(() => setIsRefreshing(false))
            }}
            disabled={isRefreshing}
            className="gap-2 flex-shrink-0 text-xs md:text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">Atualizar</span>
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          <Card className="bg-neutral-900 border-neutral-800">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-neutral-400 text-xs md:text-sm">Total de Registros</p>
                  <p className="text-2xl md:text-3xl font-bold text-white mt-1 md:mt-2">{stats.total}</p>
                </div>
                <Users className="w-6 md:w-8 h-6 md:h-8 text-orange-500 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-neutral-900 border-neutral-800">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-neutral-400 text-xs md:text-sm">Masculino</p>
                  <p className="text-2xl md:text-3xl font-bold text-white mt-1 md:mt-2">{stats.masculino}</p>
                </div>
                <Badge className="bg-blue-500 text-xs md:text-sm flex-shrink-0">{stats.total > 0 ? ((stats.masculino / stats.total) * 100).toFixed(0) : 0}%</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-neutral-900 border-neutral-800">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-neutral-400 text-xs md:text-sm">Feminino</p>
                  <p className="text-2xl md:text-3xl font-bold text-white mt-1 md:mt-2">{stats.feminino}</p>
                </div>
                <Badge className="bg-pink-500 text-xs md:text-sm flex-shrink-0">{stats.total > 0 ? ((stats.feminino / stats.total) * 100).toFixed(0) : 0}%</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 md:top-3 w-4 md:w-5 h-4 md:h-5 text-neutral-500" />
          <Input
            placeholder="Buscar por nome, email, WhatsApp ou cidade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-neutral-900 border-neutral-800 text-white text-sm md:text-base"
          />
        </div>

        {/* Tabela de Registros */}
        {filteredEntries.length > 0 ? (
          <div className="space-y-3 md:space-y-4">
            {filteredEntries.map((entry) => (
              <Card key={entry.id} className="bg-neutral-900 border-neutral-800 hover:border-orange-500/50 transition-colors cursor-pointer" onClick={() => setSelectedEntry(entry)}>
                <CardContent className="p-3 md:p-6">
                  <div className="flex flex-col md:flex-row gap-3 md:gap-6 justify-between items-start md:items-center">
                    <div className="flex-1 space-y-2 md:space-y-3 min-w-0">
                      <div className="flex items-start gap-2 md:gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base md:text-lg font-semibold text-white hover:text-orange-500 transition-colors truncate">{entry.nome}</h3>
                          <div className="flex flex-wrap gap-1 md:gap-2 mt-1 md:mt-2">
                            <Badge variant="outline" className="bg-neutral-800 text-neutral-300 text-xs">
                              {entry.sexo === 'masculino' ? '♂ Masculino' : '♀ Feminino'}
                            </Badge>
                            <Badge variant="outline" className="bg-neutral-800 text-neutral-300">
                              {entry.cidade}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div className="flex items-center gap-2 text-neutral-400">
                          <Mail className="w-4 h-4 text-orange-500" />
                          <a href={`mailto:${entry.email}`} onClick={(e) => e.stopPropagation()} className="hover:text-orange-500 transition-colors">
                            {entry.email}
                          </a>
                        </div>
                        <div className="flex items-center gap-2 text-neutral-400">
                          <Phone className="w-4 h-4 text-orange-500" />
                          <span>{entry.whatsapp}</span>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              setWhatsappModal({ isOpen: true, phone: entry.whatsapp, name: entry.nome })
                            }}
                            size="sm"
                            className="bg-green-500 hover:bg-green-600 text-white p-1 h-auto ml-2"
                            title="Enviar mensagem WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2 text-neutral-400">
                          <Calendar className="w-4 h-4 text-orange-500" />
                          <span>{formatDate(entry.data_hora)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedEntry(entry)
                        }}
                        variant="outline"
                        size="sm"
                        className="border-neutral-700 text-neutral-300 hover:text-orange-500"
                      >
                        Detalhes
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(entry.id)
                        }}
                        variant="destructive"
                        size="sm"
                        className="gap-1"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remover
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-neutral-900 border-neutral-800">
            <CardContent className="p-12 flex flex-col items-center justify-center gap-4">
              <AlertCircle className="w-8 h-8 text-neutral-500" />
              <p className="text-neutral-400">
                {searchTerm ? "Nenhum registro encontrado para sua busca" : "Nenhum registro na lista VIP"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal de Detalhes */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-3 md:p-4 z-50 overflow-y-auto">
          <Card className="bg-neutral-900 border-neutral-800 max-w-sm md:max-w-md w-full my-4">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 md:pb-4">
              <CardTitle className="text-white text-lg md:text-xl">Detalhes do Cliente</CardTitle>
              <button
                onClick={() => setSelectedEntry(null)}
                className="text-neutral-400 hover:text-white flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="space-y-3 md:space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <p className="text-neutral-400 text-xs md:text-sm">Nome</p>
                <p className="text-white font-medium text-sm md:text-base">{selectedEntry.nome}</p>
              </div>
              <div>
                <p className="text-neutral-400 text-xs md:text-sm">Email</p>
                <p className="text-white font-medium text-sm md:text-base break-all">{selectedEntry.email}</p>
              </div>
              <div>
                <p className="text-neutral-400 text-xs md:text-sm">WhatsApp</p>
                <p className="text-white font-medium text-sm md:text-base">{selectedEntry.whatsapp}</p>
              </div>
              <div>
                <p className="text-neutral-400 text-xs md:text-sm">Sexo</p>
                <p className="text-white font-medium text-sm md:text-base">{selectedEntry.sexo === 'masculino' ? 'Masculino' : 'Feminino'}</p>
              </div>
              <div>
                <p className="text-neutral-400 text-xs md:text-sm">Cidade</p>
                <p className="text-white font-medium text-sm md:text-base">{selectedEntry.cidade}</p>
              </div>
              <div>
                <p className="text-neutral-400 text-xs md:text-sm">Data e Hora de Registro</p>
                <p className="text-white font-medium text-sm md:text-base">{formatDate(selectedEntry.data_hora)}</p>
              </div>

              {/* Tags */}
              <div className="pt-2 border-t border-neutral-700">
                <TagManager entityType="lista_espera" entityId={selectedEntry.id} />
              </div>
              
              <div className="grid grid-cols-2 gap-2 mt-4 md:mt-6">
                <Button
                  onClick={() => {
                    setWhatsappModal({ isOpen: true, phone: selectedEntry.whatsapp, name: selectedEntry.nome })
                    setSelectedEntry(null)
                  }}
                  className="bg-green-500 hover:bg-green-600 text-white gap-2 text-xs md:text-sm"
                >
                  <MessageCircle className="w-3 md:w-4 h-3 md:h-4" />
                  <span className="hidden md:inline">WhatsApp</span>
                </Button>
                <Button
                  onClick={() => {
                    setShowLinkProfessorModal(true)
                  }}
                  className="bg-blue-500 hover:bg-blue-600 text-white gap-2 text-xs md:text-sm"
                >
                  <UserPlus className="w-3 md:w-4 h-3 md:h-4" />
                  <span className="hidden md:inline">Vincular</span>
                </Button>
                <Button
                  onClick={() => handleDelete(selectedEntry.id)}
                  variant="destructive"
                  className="col-span-2 gap-2 text-xs md:text-sm"
                >
                  <Trash2 className="w-3 md:w-4 h-3 md:h-4" />
                  Remover Registro
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de Vincular ao Professor */}
      {showLinkProfessorModal && selectedEntry && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-3 md:p-4 z-50 overflow-y-auto">
          <Card className="bg-neutral-900 border-neutral-800 max-w-sm md:max-w-md w-full my-4">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 md:pb-4">
              <CardTitle className="text-white text-lg md:text-xl">Vincular ao Professor</CardTitle>
              <button
                onClick={() => {
                  setShowLinkProfessorModal(false)
                  setSelectedProfessorId('')
                }}
                className="text-neutral-400 hover:text-white flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-6">
              <div>
                <p className="text-neutral-400 text-xs md:text-sm mb-1 md:mb-2">Cliente</p>
                <p className="text-white font-medium text-sm md:text-base">{selectedEntry.nome}</p>
                <p className="text-neutral-400 text-xs md:text-sm break-all">{selectedEntry.email}</p>
              </div>
              
              <div>
                <label className="text-neutral-400 text-xs md:text-sm block mb-2">
                  Selecione o Professor
                </label>
                <select
                  value={selectedProfessorId}
                  onChange={(e) => setSelectedProfessorId(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 text-white rounded-lg px-3 py-2 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Selecione um professor...</option>
                  {professors.map((prof) => (
                    <option key={prof.id} value={prof.id}>
                      {prof.name} - {prof.specialty || 'Sem especialidade'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col md:flex-row gap-2 md:gap-3 mt-4 md:mt-6">
                <Button
                  onClick={() => {
                    setShowLinkProfessorModal(false)
                    setSelectedProfessorId('')
                  }}
                  variant="outline"
                  className="flex-1 border-neutral-700 text-neutral-300 text-sm md:text-base"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleLinkToProfessor}
                  disabled={!selectedProfessorId || linkingProfessor}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-sm md:text-base"
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
