'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  AlertCircle,
  Plus,
  Edit2,
  Trash2,
  Search,
  X,
  Loader2,
  CheckCircle,
  Clock,
  AlertTriangle,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Cliente {
  id: string
  nome: string
  cpf: string
  email: string
  telefone: string
  data_nascimento: string | null
  sexo: string | null
  rua: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  cep: string | null
  tipo_plano: string | null
  valor: number | null
  forma_pagamento: string | null
  dia_vencimento: number | null
  data_entrada: string | null
  professor: string | null
  veste: string | null
  contrato_assinado: boolean
  status: string
  created_at: string
}

interface FormData {
  nome: string
  cpf: string
  email: string
  telefone: string
  data_nascimento: string
  sexo: string
  rua: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
  cep: string
  tipo_plano: string
  valor: string
  forma_pagamento: string
  dia_vencimento: string
  data_entrada: string
  professor: string
  veste: string
  contrato_assinado: boolean
  status: string
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

const formatCPF = (cpf: string) => {
  const cleaned = cpf.replace(/\D/g, '')
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

const formatPhone = (phone: string) => {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }
  return phone
}

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    ativo: 'bg-green-500/10 text-green-400 border-green-500/30',
    inativo: 'bg-red-500/10 text-red-400 border-red-500/30',
    pendente: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    cancelado: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  }
  return colors[status.toLowerCase()] || 'bg-neutral-500/10 text-neutral-400 border-neutral-500/30'
}

export default function GestorClientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [filtroStatus, setFiltroStatus] = useState<string>('')
  const [filtroProfessor, setFiltroProfessor] = useState<string>('')
  const [pesquisa, setPesquisa] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [clienteParaDeletar, setClienteParaDeletar] = useState<Cliente | null>(null)
  const [clienteEmEdicao, setClienteEmEdicao] = useState<Cliente | null>(null)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    nome: '',
    cpf: '',
    email: '',
    telefone: '',
    data_nascimento: '',
    sexo: '',
    rua: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
    tipo_plano: '',
    valor: '',
    forma_pagamento: '',
    dia_vencimento: '',
    data_entrada: '',
    professor: '',
    veste: '',
    contrato_assinado: false,
    status: 'ativo',
  })

  const carregarClientes = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: err } = await supabase
        .from('gestao-clientes-assessoria')
        .select('*')
        .order('created_at', { ascending: false })

      if (err) throw err

      setClientes(data || [])
    } catch (err: unknown) {
      const mensagem = err instanceof Error ? err.message : 'Erro ao carregar clientes'
      setError(mensagem)
      console.error('[v0]', mensagem)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregarClientes()
  }, [carregarClientes])

  const clientesFiltrados = clientes.filter(cliente => {
    const matchStatus = !filtroStatus || cliente.status.toLowerCase() === filtroStatus.toLowerCase()
    const matchProfessor = !filtroProfessor || cliente.professor === filtroProfessor
    const matchPesquisa =
      !pesquisa ||
      cliente.nome.toLowerCase().includes(pesquisa.toLowerCase()) ||
      cliente.cpf.includes(pesquisa) ||
      cliente.email.toLowerCase().includes(pesquisa.toLowerCase())

    return matchStatus && matchProfessor && matchPesquisa
  })

  const stats = {
    total: clientes.length,
    ativos: clientes.filter(c => c.status.toLowerCase() === 'ativo').length,
    inativos: clientes.filter(c => c.status.toLowerCase() === 'inativo').length,
    pendentes: clientes.filter(c => c.status.toLowerCase() === 'pendente').length,
  }

  const professorList = [...new Set(clientes.map(c => c.professor).filter(Boolean))] as string[]

  const handleNovoCliente = () => {
    setClienteEmEdicao(null)
    setFormData({
      nome: '',
      cpf: '',
      email: '',
      telefone: '',
      data_nascimento: '',
      sexo: '',
      rua: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      estado: '',
      cep: '',
      tipo_plano: '',
      valor: '',
      forma_pagamento: '',
      dia_vencimento: '',
      data_entrada: '',
      professor: '',
      veste: '',
      contrato_assinado: false,
      status: 'ativo',
    })
    setShowForm(true)
  }

  const handleEditar = (cliente: Cliente) => {
    setClienteEmEdicao(cliente)
    setFormData({
      nome: cliente.nome,
      cpf: cliente.cpf,
      email: cliente.email,
      telefone: cliente.telefone,
      data_nascimento: cliente.data_nascimento || '',
      sexo: cliente.sexo || '',
      rua: cliente.rua || '',
      numero: cliente.numero || '',
      complemento: cliente.complemento || '',
      bairro: cliente.bairro || '',
      cidade: cliente.cidade || '',
      estado: cliente.estado || '',
      cep: cliente.cep || '',
      tipo_plano: cliente.tipo_plano || '',
      valor: cliente.valor?.toString() || '',
      forma_pagamento: cliente.forma_pagamento || '',
      dia_vencimento: cliente.dia_vencimento?.toString() || '',
      data_entrada: cliente.data_entrada || '',
      professor: cliente.professor || '',
      veste: cliente.veste || '',
      contrato_assinado: cliente.contrato_assinado,
      status: cliente.status,
    })
    setShowForm(true)
  }

  const handleSalvar = async () => {
    if (!formData.nome || !formData.cpf || !formData.email) {
      setError('Nome, CPF e Email são obrigatórios')
      return
    }

    setSubmitLoading(true)
    try {
      const dataToSave = {
        nome: formData.nome,
        cpf: formData.cpf,
        email: formData.email,
        telefone: formData.telefone,
        data_nascimento: formData.data_nascimento || null,
        sexo: formData.sexo || null,
        rua: formData.rua || null,
        numero: formData.numero || null,
        complemento: formData.complemento || null,
        bairro: formData.bairro || null,
        cidade: formData.cidade || null,
        estado: formData.estado || null,
        cep: formData.cep || null,
        tipo_plano: formData.tipo_plano || null,
        valor: formData.valor ? parseFloat(formData.valor) : null,
        forma_pagamento: formData.forma_pagamento || null,
        dia_vencimento: formData.dia_vencimento ? parseInt(formData.dia_vencimento) : null,
        data_entrada: formData.data_entrada || null,
        professor: formData.professor || null,
        veste: formData.veste || null,
        contrato_assinado: formData.contrato_assinado,
        status: formData.status,
      }

      if (clienteEmEdicao) {
        const { error: err } = await supabase
          .from('gestao-clientes-assessoria')
          .update(dataToSave)
          .eq('id', clienteEmEdicao.id)

        if (err) throw err
      } else {
        const { error: err } = await supabase
          .from('gestao-clientes-assessoria')
          .insert([dataToSave])

        if (err) throw err
      }

      await carregarClientes()
      setShowForm(false)
    } catch (err: unknown) {
      const mensagem = err instanceof Error ? err.message : 'Erro ao salvar cliente'
      setError(mensagem)
      console.error('[v0]', mensagem)
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleDeletar = async () => {
    if (!clienteParaDeletar) return

    setSubmitLoading(true)
    try {
      const { error: err } = await supabase
        .from('gestao-clientes-assessoria')
        .delete()
        .eq('id', clienteParaDeletar.id)

      if (err) throw err

      await carregarClientes()
      setShowDeleteConfirm(false)
      setClienteParaDeletar(null)
    } catch (err: unknown) {
      const mensagem = err instanceof Error ? err.message : 'Erro ao deletar cliente'
      setError(mensagem)
      console.error('[v0]', mensagem)
    } finally {
      setSubmitLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="w-8 h-8 text-orange-500" />
            Gestor de Clientes
          </h1>
          <p className="text-neutral-400 text-sm mt-1">Gerenciamento de clientes da assessoria de corrida</p>
        </div>
        <Button onClick={handleNovoCliente} className="bg-orange-500 hover:bg-orange-600 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Novo Cliente
        </Button>
      </div>

      {/* Erro */}
      {error && (
        <div className="flex items-start gap-3 p-3 bg-red-900/30 border border-red-500/40 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">{error}</div>
          <button onClick={() => setError(null)} className="ml-auto flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-neutral-900 border-neutral-800 p-4">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-400" />
            <div>
              <p className="text-neutral-400 text-xs">Total de Clientes</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </div>
        </Card>
        <Card className="bg-neutral-900 border-neutral-800 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-400" />
            <div>
              <p className="text-neutral-400 text-xs">Ativos</p>
              <p className="text-2xl font-bold">{stats.ativos}</p>
            </div>
          </div>
        </Card>
        <Card className="bg-neutral-900 border-neutral-800 p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-400" />
            <div>
              <p className="text-neutral-400 text-xs">Inativos</p>
              <p className="text-2xl font-bold">{stats.inativos}</p>
            </div>
          </div>
        </Card>
        <Card className="bg-neutral-900 border-neutral-800 p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-yellow-400" />
            <div>
              <p className="text-neutral-400 text-xs">Pendentes</p>
              <p className="text-2xl font-bold">{stats.pendentes}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filtros e Busca */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-60 relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-neutral-500" />
          <Input
            placeholder="Buscar por nome, CPF ou email..."
            value={pesquisa}
            onChange={e => setPesquisa(e.target.value)}
            className="bg-neutral-900 border-neutral-800 text-white pl-10"
          />
        </div>

        <select
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value)}
          className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-md text-white text-sm focus:outline-none focus:border-orange-500"
        >
          <option value="">Todos os Status</option>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
          <option value="pendente">Pendente</option>
          <option value="cancelado">Cancelado</option>
        </select>

        <select
          value={filtroProfessor}
          onChange={e => setFiltroProfessor(e.target.value)}
          className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-md text-white text-sm focus:outline-none focus:border-orange-500"
        >
          <option value="">Todos os Professores</option>
          {professorList.map(prof => (
            <option key={prof} value={prof}>
              {prof}
            </option>
          ))}
        </select>
      </div>

      {/* Tabela de Clientes */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-12 flex items-center justify-center gap-2 text-neutral-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            Carregando clientes...
          </div>
        ) : clientesFiltrados.length === 0 ? (
          <div className="p-12 text-center text-neutral-400">
            Nenhum cliente encontrado
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-800 border-b border-neutral-700">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-neutral-300">Nome</th>
                  <th className="px-4 py-3 text-left font-semibold text-neutral-300">CPF</th>
                  <th className="px-4 py-3 text-left font-semibold text-neutral-300">Email</th>
                  <th className="px-4 py-3 text-left font-semibold text-neutral-300">Telefone</th>
                  <th className="px-4 py-3 text-left font-semibold text-neutral-300">Plano</th>
                  <th className="px-4 py-3 text-left font-semibold text-neutral-300">Professor</th>
                  <th className="px-4 py-3 text-left font-semibold text-neutral-300">Status</th>
                  <th className="px-4 py-3 text-center font-semibold text-neutral-300">Ações</th>
                </tr>
              </thead>
              <tbody>
                {clientesFiltrados.map((cliente, idx) => (
                  <tr key={cliente.id} className={`border-b border-neutral-800 ${idx % 2 === 0 ? 'bg-neutral-950' : 'bg-neutral-900'}`}>
                    <td className="px-4 py-3 font-medium">{cliente.nome}</td>
                    <td className="px-4 py-3 text-neutral-400">{formatCPF(cliente.cpf)}</td>
                    <td className="px-4 py-3 text-neutral-400 text-xs">{cliente.email}</td>
                    <td className="px-4 py-3 text-neutral-400">{formatPhone(cliente.telefone)}</td>
                    <td className="px-4 py-3 text-neutral-400">{cliente.tipo_plano || '-'}</td>
                    <td className="px-4 py-3 text-neutral-400">{cliente.professor || '-'}</td>
                    <td className="px-4 py-3">
                      <Badge className={`${getStatusColor(cliente.status)} border`}>{cliente.status}</Badge>
                    </td>
                    <td className="px-4 py-3 flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditar(cliente)}
                        className="hover:bg-neutral-800"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setClienteParaDeletar(cliente)
                          setShowDeleteConfirm(true)
                        }}
                        className="hover:bg-red-900/30"
                        title="Deletar"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Formulário */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-neutral-900 border-neutral-800">
          <DialogHeader>
            <DialogTitle>{clienteEmEdicao ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-neutral-400 block mb-2">Nome *</label>
              <Input
                placeholder="Nome completo"
                value={formData.nome}
                onChange={e => setFormData({ ...formData, nome: e.target.value })}
                className="bg-neutral-800 border-neutral-700 text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-400 block mb-2">CPF *</label>
              <Input
                placeholder="000.000.000-00"
                value={formData.cpf}
                onChange={e => setFormData({ ...formData, cpf: e.target.value })}
                className="bg-neutral-800 border-neutral-700 text-white"
              />
            </div>

            <div className="col-span-2">
              <label className="text-xs font-semibold text-neutral-400 block mb-2">Email *</label>
              <Input
                type="email"
                placeholder="email@example.com"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="bg-neutral-800 border-neutral-700 text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-400 block mb-2">Telefone</label>
              <Input
                placeholder="(11) 99999-9999"
                value={formData.telefone}
                onChange={e => setFormData({ ...formData, telefone: e.target.value })}
                className="bg-neutral-800 border-neutral-700 text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-400 block mb-2">Data de Nascimento</label>
              <Input
                type="date"
                value={formData.data_nascimento}
                onChange={e => setFormData({ ...formData, data_nascimento: e.target.value })}
                className="bg-neutral-800 border-neutral-700 text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-400 block mb-2">Sexo</label>
              <select
                value={formData.sexo}
                onChange={e => setFormData({ ...formData, sexo: e.target.value })}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-white text-sm"
              >
                <option value="">Selecione...</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
                <option value="O">Outro</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-400 block mb-2">CEP</label>
              <Input
                placeholder="00000-000"
                value={formData.cep}
                onChange={e => setFormData({ ...formData, cep: e.target.value })}
                className="bg-neutral-800 border-neutral-700 text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-400 block mb-2">Rua</label>
              <Input
                placeholder="Rua/Avenida"
                value={formData.rua}
                onChange={e => setFormData({ ...formData, rua: e.target.value })}
                className="bg-neutral-800 border-neutral-700 text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-400 block mb-2">Número</label>
              <Input
                placeholder="Número"
                value={formData.numero}
                onChange={e => setFormData({ ...formData, numero: e.target.value })}
                className="bg-neutral-800 border-neutral-700 text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-400 block mb-2">Complemento</label>
              <Input
                placeholder="Apto, sala..."
                value={formData.complemento}
                onChange={e => setFormData({ ...formData, complemento: e.target.value })}
                className="bg-neutral-800 border-neutral-700 text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-400 block mb-2">Bairro</label>
              <Input
                placeholder="Bairro"
                value={formData.bairro}
                onChange={e => setFormData({ ...formData, bairro: e.target.value })}
                className="bg-neutral-800 border-neutral-700 text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-400 block mb-2">Cidade</label>
              <Input
                placeholder="Cidade"
                value={formData.cidade}
                onChange={e => setFormData({ ...formData, cidade: e.target.value })}
                className="bg-neutral-800 border-neutral-700 text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-400 block mb-2">Estado</label>
              <Input
                placeholder="SP"
                maxLength={2}
                value={formData.estado}
                onChange={e => setFormData({ ...formData, estado: e.target.value.toUpperCase() })}
                className="bg-neutral-800 border-neutral-700 text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-400 block mb-2">Tipo de Plano</label>
              <select
                value={formData.tipo_plano}
                onChange={e => setFormData({ ...formData, tipo_plano: e.target.value })}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-white text-sm"
              >
                <option value="">Selecione...</option>
                <option value="Basic">Basic</option>
                <option value="Premium">Premium</option>
                <option value="Elite">Elite</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-400 block mb-2">Valor (R$)</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.valor}
                onChange={e => setFormData({ ...formData, valor: e.target.value })}
                className="bg-neutral-800 border-neutral-700 text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-400 block mb-2">Forma de Pagamento</label>
              <select
                value={formData.forma_pagamento}
                onChange={e => setFormData({ ...formData, forma_pagamento: e.target.value })}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-white text-sm"
              >
                <option value="">Selecione...</option>
                <option value="Cartão">Cartão</option>
                <option value="Boleto">Boleto</option>
                <option value="Pix">Pix</option>
                <option value="Transferência">Transferência</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-400 block mb-2">Dia de Vencimento</label>
              <Input
                type="number"
                min="1"
                max="31"
                placeholder="1"
                value={formData.dia_vencimento}
                onChange={e => setFormData({ ...formData, dia_vencimento: e.target.value })}
                className="bg-neutral-800 border-neutral-700 text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-400 block mb-2">Data de Entrada</label>
              <Input
                type="date"
                value={formData.data_entrada}
                onChange={e => setFormData({ ...formData, data_entrada: e.target.value })}
                className="bg-neutral-800 border-neutral-700 text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-400 block mb-2">Professor</label>
              <Input
                placeholder="Nome do professor"
                value={formData.professor}
                onChange={e => setFormData({ ...formData, professor: e.target.value })}
                className="bg-neutral-800 border-neutral-700 text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-400 block mb-2">Veste</label>
              <Input
                placeholder="Tamanho da veste"
                value={formData.veste}
                onChange={e => setFormData({ ...formData, veste: e.target.value })}
                className="bg-neutral-800 border-neutral-700 text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-400 block mb-2">Status</label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-white text-sm"
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
                <option value="pendente">Pendente</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.contrato_assinado}
                onChange={e => setFormData({ ...formData, contrato_assinado: e.target.checked })}
                className="w-4 h-4 cursor-pointer"
              />
              <label className="text-xs font-semibold text-neutral-400 cursor-pointer">Contrato Assinado</label>
            </div>
          </div>

          <div className="flex gap-3 justify-end mt-6">
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSalvar}
              disabled={submitLoading}
              className="bg-orange-500 hover:bg-orange-600 flex items-center gap-2"
            >
              {submitLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {clienteEmEdicao ? 'Salvar Alterações' : 'Criar Cliente'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Delete */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="bg-neutral-900 border-neutral-800">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>

          <div>
            <p className="text-neutral-300 mb-4">
              Tem certeza que deseja deletar o cliente <strong>{clienteParaDeletar?.nome}</strong>? Esta ação não pode ser desfeita.
            </p>

            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleDeletar}
                disabled={submitLoading}
                className="bg-red-600 hover:bg-red-700 flex items-center gap-2"
              >
                {submitLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Deletar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
