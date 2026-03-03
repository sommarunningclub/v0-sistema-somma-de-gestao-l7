'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, RefreshCw, Download, Users, Calendar, List, MessageCircle } from 'lucide-react'
import type { CheckInData } from '@/lib/services/checkin'
import { formatCPF, formatPhone, formatDate, getTodayCheckIns } from '@/lib/services/checkin'
import { WhatsAppMessageModal } from '@/components/whatsapp-message-modal'

type FilterType = 'all' | 'validated' | 'not_validated' | 'today'

export default function CheckInPage() {
  const [checkInData, setCheckInData] = useState<CheckInData[]>([])
  const [todayCheckIns, setTodayCheckIns] = useState<CheckInData[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [updatingCpf, setUpdatingCpf] = useState<string | null>(null)
  const [whatsappModal, setWhatsappModal] = useState<{ isOpen: boolean; phone: string; name: string }>({
    isOpen: false,
    phone: '',
    name: ''
  })

  const fetchCheckInData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/checkin', {
        method: 'GET',
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error('Falha ao buscar dados do check-in')
      }

      const result = await response.json()
      
      if (result.error) {
        throw new Error(result.error)
      }

      setCheckInData(result.data)
      const today = getTodayCheckIns(result.data)
      setTodayCheckIns(today)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
      setError(errorMessage)
      console.error('[v0] Error fetching check-in data:', errorMessage)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCheckInData()
  }, [])

  // Aplicar filtros baseado no activeFilter
  const getFilteredData = () => {
    let data = checkInData

    // Aplicar filtro de validação
    if (activeFilter === 'validated') {
      data = data.filter(item => item.validated)
    } else if (activeFilter === 'not_validated') {
      data = data.filter(item => !item.validated)
    }

    return data
  }

  const filteredByType = getFilteredData()
  
  // Aplicar busca
  const currentFilteredData = filteredByType.filter(
    (item) =>
      item.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.telefone.includes(searchTerm) ||
      item.cpf.includes(searchTerm)
  )

  // Calcular estatísticas de validação
  const validatedCount = checkInData.filter(item => item.validated).length
  const validatedTodayCount = todayCheckIns.filter(item => item.validated).length

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchCheckInData()
    setIsRefreshing(false)
  }

  const handleExport = () => {
    const csv = [
      ['Nome', 'Telefone', 'CPF', 'Data'],
      ...currentFilteredData.map(item => [
        item.nome,
        formatPhone(item.telefone),
        formatCPF(item.cpf),
        formatDate(item.data)
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `check-in-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleOpenWhatsApp = (phone: string, name: string) => {
    setWhatsappModal({ isOpen: true, phone, name })
  }

  const handleCloseWhatsApp = () => {
    setWhatsappModal({ isOpen: false, phone: '', name: '' })
  }

  // Aplicar filtros baseado no activeFilter
  // const getFilteredData = () => {
  //   let data = checkInData

  //   // Aplicar filtro de período (hoje vs todos)
  //   if (activeFilter === 'today') {
  //     data = todayCheckIns
  //   }

  //   // Aplicar filtro de validação
  //   if (activeFilter === 'validated') {
  //     data = data.filter(item => item.validated)
  //   } else if (activeFilter === 'not_validated') {
  //     data = data.filter(item => !item.validated)
  //   }

  //   return data
  // }

  const handleToggleValidation = async (cpf: string, currentValidated: boolean) => {
    setUpdatingCpf(cpf)
    try {
      const response = await fetch('/api/checkin/validate', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cpf,
          validated: !currentValidated
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erro ao atualizar validação')
      }

      // Atualizar o estado local
      const updatedData = checkInData.map(item =>
        item.cpf === cpf
          ? { ...item, validated: !currentValidated, validated_at: new Date().toISOString() }
          : item
      )
      setCheckInData(updatedData)

      // Atualizar também o array de hoje se aplicável
      const updatedToday = todayCheckIns.map(item =>
        item.cpf === cpf
          ? { ...item, validated: !currentValidated, validated_at: new Date().toISOString() }
          : item
      )
      setTodayCheckIns(updatedToday)
    } catch (err) {
      console.error('[v0] Error toggling validation:', err)
      alert('Erro ao atualizar validação')
    } finally {
      setUpdatingCpf(null)
    }
  }

  return (
    <div className="w-full min-h-full flex flex-col p-3 sm:p-4 md:p-6 lg:p-8 gap-3 sm:gap-4 md:gap-6 lg:h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-white tracking-wider">CHECK-IN SOMMA</h1>
          <p className="text-xs sm:text-sm text-neutral-400">Acompanhe os check-ins do evento</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="bg-orange-500 hover:bg-orange-600 text-white flex-1 sm:flex-none active:scale-95 md:active:scale-100"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button
            onClick={handleExport}
            disabled={currentFilteredData.length === 0}
            className="bg-green-600 hover:bg-green-700 text-white flex-1 sm:flex-none active:scale-95 md:active:scale-100"
          >
            <Download className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Exportar</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards - Clickable Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
        <Card 
          className={`cursor-pointer transition-all hover:scale-[1.02] ${
            activeFilter === 'all' 
              ? 'bg-orange-500/20 border-orange-500' 
              : 'bg-neutral-900 border-neutral-700 hover:border-orange-500/50'
          }`}
          onClick={() => setActiveFilter('all')}
        >
          <CardContent className="p-2 sm:p-3 md:p-4">
            <div className="flex flex-col gap-1">
              <p className="text-xs text-neutral-400 tracking-wider">TOTAL CHECK-INS</p>
              <p className="text-base sm:text-lg md:text-2xl font-bold text-white font-mono">{checkInData.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:scale-[1.02] ${
            activeFilter === 'validated' 
              ? 'bg-green-500/20 border-green-500' 
              : 'bg-neutral-900 border-neutral-700 hover:border-green-500/50'
          }`}
          onClick={() => setActiveFilter('validated')}
        >
          <CardContent className="p-2 sm:p-3 md:p-4">
            <div className="flex flex-col gap-1">
              <p className="text-xs text-neutral-400 tracking-wider">VALIDADOS</p>
              <p className="text-base sm:text-lg md:text-2xl font-bold text-green-500 font-mono">{validatedCount}</p>
              <p className="text-[10px] text-neutral-500">{checkInData.length > 0 ? Math.round((validatedCount / checkInData.length) * 100) : 0}% do total</p>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:scale-[1.02] ${
            activeFilter === 'today' 
              ? 'bg-blue-500/20 border-blue-500' 
              : 'bg-neutral-900 border-neutral-700 hover:border-blue-500/50'
          }`}
          onClick={() => setActiveFilter('today')}
        >
          <CardContent className="p-2 sm:p-3 md:p-4">
            <div className="flex flex-col gap-1">
              <p className="text-xs text-neutral-400 tracking-wider">HOJE</p>
              <p className="text-base sm:text-lg md:text-2xl font-bold text-blue-500 font-mono">{todayCheckIns.length}</p>
              <p className="text-[10px] text-green-500">{validatedTodayCount} validados</p>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:scale-[1.02] ${
            activeFilter === 'not_validated' 
              ? 'bg-red-500/20 border-red-500' 
              : 'bg-neutral-900 border-neutral-700 hover:border-red-500/50'
          }`}
          onClick={() => setActiveFilter('not_validated')}
        >
          <CardContent className="p-2 sm:p-3 md:p-4">
            <div className="flex flex-col gap-1">
              <p className="text-xs text-neutral-400 tracking-wider">NÃO VALIDADOS</p>
              <p className="text-base sm:text-lg md:text-2xl font-bold text-red-500 font-mono">{checkInData.length - validatedCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
        <Input
          placeholder="Buscar por nome, telefone ou CPF..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 w-full bg-neutral-800 border-neutral-600 text-white placeholder-neutral-400 text-xs sm:text-sm rounded-lg"
        />
      </div>

      {/* Error State */}
      {error && (
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="p-3 sm:p-4">
            <p className="text-sm text-red-400">
              Erro ao carregar dados: {error}
            </p>
            <Button
              onClick={handleRefresh}
              className="mt-2 bg-red-600 hover:bg-red-700 text-white text-sm w-full"
            >
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <Card className="bg-neutral-900 border-neutral-700 flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-orange-500/20 mb-4">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-sm text-neutral-400">Carregando check-ins...</p>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && filteredByType.length === 0 && (
        <Card className="bg-neutral-900 border-neutral-700 flex-1 flex items-center justify-center">
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-neutral-500 mx-auto mb-3 opacity-50" />
            <p className="text-neutral-400 text-sm">
              Nenhum check-in encontrado para este filtro
            </p>
          </div>
        </Card>
      )}

      {!loading && !error && currentFilteredData.length === 0 && filteredByType.length > 0 && searchTerm && (
        <Card className="bg-neutral-900 border-neutral-700 flex-1 flex items-center justify-center">
          <div className="text-center py-8">
            <Search className="w-12 h-12 text-neutral-500 mx-auto mb-3 opacity-50" />
            <p className="text-neutral-400 text-sm">Nenhum resultado encontrado para "{searchTerm}"</p>
          </div>
        </Card>
      )}

      {/* Mobile Card View */}
      <div className="lg:hidden flex flex-col gap-2">
        {currentFilteredData.map((item, index) => (
          <Card
            key={index}
            className="bg-neutral-900 border-neutral-700 hover:border-orange-500/50 transition-colors"
          >
            <CardContent className="p-3">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{item.nome}</p>
                    <p className="text-xs text-neutral-400 truncate">{formatPhone(item.telefone)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.telefone && (
                      <Button
                        size="sm"
                        onClick={() => handleOpenWhatsApp(item.telefone, item.nome)}
                        className="bg-green-600 hover:bg-green-700 text-white p-1.5 h-auto"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => handleToggleValidation(item.cpf, item.validated)}
                      disabled={updatingCpf === item.cpf}
                      className={`p-1.5 h-auto text-xs ${
                        item.validated 
                          ? 'bg-green-500/20 hover:bg-green-500/30 text-green-400' 
                          : 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
                      }`}
                    >
                      {updatingCpf === item.cpf ? '...' : item.validated ? '✓' : '✗'}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-neutral-400 pt-2 border-t border-neutral-800">
                  <span className="font-mono">{formatCPF(item.cpf)}</span>
                  <span>{formatDate(item.data)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop Table View */}
      <Card className="hidden lg:flex bg-neutral-900 border-neutral-700 flex-1 flex-col overflow-hidden">
        <CardHeader className="border-b border-neutral-700">
          <CardTitle className="text-xs sm:text-sm font-medium text-neutral-300 tracking-wider">
            {activeFilter === 'all' && 'TODOS OS CHECK-INS'}
            {activeFilter === 'validated' && 'CHECK-INS VALIDADOS'}
            {activeFilter === 'not_validated' && 'CHECK-INS NÃO VALIDADOS'}
            {activeFilter === 'today' && 'CHECK-INS DE HOJE'}
            {' '}- {currentFilteredData.length} registros
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden flex flex-col p-0">
          {currentFilteredData.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-neutral-400">Nenhum check-in encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-neutral-800">
                  <tr className="border-b border-neutral-700">
                    <th className="text-left py-3 px-4 font-medium text-neutral-400 tracking-wider">NOME</th>
                    <th className="text-left py-3 px-4 font-medium text-neutral-400 tracking-wider">TELEFONE</th>
                    <th className="text-left py-3 px-4 font-medium text-neutral-400 tracking-wider">CPF</th>
                    <th className="text-left py-3 px-4 font-medium text-neutral-400 tracking-wider">DATA</th>
                    <th className="text-center py-3 px-4 font-medium text-neutral-400 tracking-wider">VALIDAÇÃO</th>
                    <th className="text-center py-3 px-4 font-medium text-neutral-400 tracking-wider">AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {currentFilteredData.map((item, index) => (
                    <tr
                      key={index}
                      className={`border-b border-neutral-800 hover:bg-neutral-800 transition-colors ${
                        index % 2 === 0 ? 'bg-neutral-900' : 'bg-neutral-850'
                      }`}
                    >
                      <td className="py-3 px-4 text-white font-medium">{item.nome}</td>
                      <td className="py-3 px-4 text-neutral-300">{formatPhone(item.telefone)}</td>
                      <td className="py-3 px-4 text-neutral-300 font-mono">{formatCPF(item.cpf)}</td>
                      <td className="py-3 px-4 text-neutral-300">{formatDate(item.data)}</td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Button
                            size="sm"
                            onClick={() => handleToggleValidation(item.cpf, item.validated)}
                            disabled={updatingCpf === item.cpf}
                            className={`px-3 py-1 text-xs ${
                              item.validated 
                                ? 'bg-green-500/20 hover:bg-green-500/30 text-green-400' 
                                : 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
                            }`}
                            title="Clique para alternar validação"
                          >
                            {updatingCpf === item.cpf ? 'Atualizando...' : item.validated ? '✓ Validado' : '✗ Não Validado'}
                          </Button>
                          {item.validated && item.validated_at && (
                            <span className="text-[10px] text-neutral-500">
                              {new Date(item.validated_at).toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {item.telefone && (
                          <Button
                            size="sm"
                            onClick={() => handleOpenWhatsApp(item.telefone, item.nome)}
                            className="bg-green-600 hover:bg-green-700 text-white p-1.5 h-auto"
                            title="Enviar mensagem via WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* WhatsApp Message Modal */}
      <WhatsAppMessageModal
        isOpen={whatsappModal.isOpen}
        phoneNumber={whatsappModal.phone}
        memberName={whatsappModal.name}
        onClose={handleCloseWhatsApp}
      />
    </div>
  )
}
