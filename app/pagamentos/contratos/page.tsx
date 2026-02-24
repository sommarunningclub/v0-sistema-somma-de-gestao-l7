"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  FileText, Plus, Search, Send, Eye, Trash2, RefreshCw,
  AlertCircle, CheckCircle, Clock, XCircle, User, Copy,
  ExternalLink, Loader2, FileSignature, X, Save, Edit3,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  List, ChevronDown, ChevronUp, Printer, Download, Columns,
  PanelLeft, Tag, RotateCcw, CheckSquare
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// ------- TIPOS -------
interface AsaasCustomer {
  id: string
  name: string
  cpfCnpj: string
  email: string
  mobilePhone?: string
  phone?: string
  address?: string
  addressNumber?: string
  complement?: string
  province?: string
  postalCode?: string
  city?: string
  state?: string
}

interface Contrato {
  id: string
  clienteId: string
  clienteNome: string
  clienteEmail: string
  clienteCpf: string
  conteudo: string
  status: "rascunho" | "enviado" | "assinado" | "cancelado" | "aguardando"
  clicksignKey?: string
  clicksignUrl?: string
  criadoEm: string
  atualizadoEm: string
}

// ------- TEMPLATE PADRÃO -------
const TEMPLATE_PADRAO = `CONTRATO E TERMO DE ADESÃO – ASSESSORIA SOMMA CLUB

Pelo presente instrumento particular, as partes abaixo identificadas celebram o presente Contrato de Prestação de Serviços de Assessoria Esportiva:

CONTRATADA:
Razão Social: SOMMA EMPREENDIMENTOS ESPORTIVOS LTDA
Nome Fantasia: SOMMA EMPREENDIMENTOS ESPORTIVOS
CNPJ: 61.315.987/0001-28
Endereço: ST de Rádio e TV Sul, Quadra 701, Conj. L, Bloco 02, Sala 417 – Parte K 52, Asa Sul, Brasília/DF – CEP 70.340-906
Telefone: (61) 9917-8033
E-mail: sommarunningclub@gmail.com

CONTRATANTE:
Nome: {{nome}}
CPF: {{cpf}}
E-mail: {{email}}
Telefone: {{telefone}}
Endereço: {{endereco}}

CLÁUSULA 1 – OBJETO
O presente contrato tem como objeto a prestação de serviços de assessoria esportiva em corrida de rua, incluindo planejamento de treinos, acompanhamento via aplicativo, benefícios exclusivos e participação em experiências promovidas pela SOMMA, conforme plano escolhido pelo CONTRATANTE.

CLÁUSULA 2 – PLANOS E VALORES
Plano Mensal: valor de R$220 por mês, cobrado de forma recorrente no cartão de crédito.
Plano Semestral: valor total de R$1.200, equivalente a seis meses de assessoria.
Plano Anual: valor total de R$2.160, equivalente a doze meses de assessoria.

O CONTRATANTE declara estar ciente de que os planos semestral e anual possuem condição promocional vinculada ao período mínimo contratado.

CLÁUSULA 3 – FORMA DE PAGAMENTO
Nos planos semestral e anual, a SOMMA poderá oferecer pagamento recorrente mensal como mera forma de cobrança, sem descaracterizar o compromisso mínimo do período contratado. O valor recorrente poderá ser de R$180 mensais no plano anual, conforme condição comercial vigente. O CONTRATANTE reconhece que a recorrência mensal não representa plano mensal livre, mas sim parcelamento do plano contratado.

CLÁUSULA 4 – BENEFÍCIOS INCLUSOS
- Presença VIP nas provas Somma com acesso privilegiado.
- Estrutura Somma em eventos e competições.
- Descontos em parceiros como Track&Field, Tex Barbearia, Dopahmina, Academia Evolve, Bugu Delícias e marcas de suplementos.
- Participação em sorteios mensais exclusivos.
- Encontros mensais com corridas temáticas, palestras e experiências.
- Treinamento personalizado via aplicativo com integração Strava e relógios GPS e acompanhamento de métricas.
- Camiseta oficial de membro nos planos semestral e anual.
- Desconto de 50% em camisetas adicionais para membros ativos.

Os benefícios poderão sofrer ajustes estratégicos sem descaracterizar a natureza do serviço.

CLÁUSULA 5 – FIDELIDADE E CANCELAMENTO
Nos planos semestral e anual existe permanência mínima correspondente ao período contratado.
O cancelamento deverá ser solicitado com antecedência mínima de 30 dias.
Caso o CONTRATANTE solicite cancelamento antes do prazo mínimo, poderá ocorrer ajuste financeiro correspondente à diferença entre o valor promocional do plano escolhido e o valor do plano mensal vigente, proporcional ao período utilizado.
Caso não haja aviso prévio de 30 dias, será devido o valor correspondente ao aviso prévio contratual.

CLÁUSULA 6 – INADIMPLÊNCIA
O não pagamento das parcelas recorrentes poderá resultar em suspensão imediata dos benefícios e acesso aos serviços.
Poderão ser aplicadas multas e encargos conforme legislação vigente, além da possibilidade de cobrança administrativa ou judicial dos valores pendentes.

CLÁUSULA 7 – ANÁLISE DE CRÉDITO E DADOS
O CONTRATANTE autoriza expressamente a SOMMA a realizar análise cadastral e consulta de crédito para fins de validação da contratação, quando aplicável. Autoriza ainda o tratamento de seus dados pessoais exclusivamente para execução do presente contrato, conforme legislação de proteção de dados.

CLÁUSULA 8 – CONDIÇÕES GERAIS
A assessoria esportiva não substitui acompanhamento médico. O CONTRATANTE declara estar apto à prática esportiva.
Os benefícios são pessoais e intransferíveis. A participação em eventos poderá depender de disponibilidade e regras específicas.

CLÁUSULA 9 – ACEITE DIGITAL
A adesão poderá ocorrer de forma eletrônica, sendo o aceite digital considerado válido e equivalente à assinatura física.

Data: {{data_atual}}

_______________________________
CONTRATANTE: {{nome}}
CPF: {{cpf}}

_______________________________
SOMMA EMPREENDIMENTOS ESPORTIVOS LTDA
CNPJ: 61.315.987/0001-28`

// ------- CAMPOS VARIÁVEIS -------
const CAMPOS_VARIAVEIS = [
  { key: "{{nome}}", label: "Nome do cliente", desc: "Nome completo" },
  { key: "{{cpf}}", label: "CPF", desc: "CPF formatado" },
  { key: "{{email}}", label: "E-mail", desc: "E-mail do cliente" },
  { key: "{{telefone}}", label: "Telefone", desc: "Celular ou telefone" },
  { key: "{{endereco}}", label: "Endereço", desc: "Endereço completo" },
  { key: "{{data_atual}}", label: "Data atual", desc: "Data de hoje" },
]

// ------- STATUS BADGE -------
function StatusBadge({ status }: { status: Contrato["status"] }) {
  const config = {
    rascunho: { label: "Rascunho", className: "bg-neutral-700 text-neutral-300", icon: Edit3 },
    enviado: { label: "Enviado", className: "bg-blue-500/20 text-blue-400 border border-blue-500/30", icon: Send },
    aguardando: { label: "Aguardando", className: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30", icon: Clock },
    assinado: { label: "Assinado", className: "bg-green-500/20 text-green-400 border border-green-500/30", icon: CheckCircle },
    cancelado: { label: "Cancelado", className: "bg-red-500/20 text-red-400 border border-red-500/30", icon: XCircle },
  }
  const c = config[status]
  const Icon = c.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.className}`}>
      <Icon className="w-3 h-3" />
      {c.label}
    </span>
  )
}

// ------- EDITOR SOFISTICADO -------
function EditorContrato({
  conteudo,
  onChange,
  clienteNome,
  onSalvar,
  onFechar,
  salvando,
}: {
  conteudo: string
  onChange: (v: string) => void
  clienteNome: string
  onSalvar: () => void
  onFechar: () => void
  salvando: boolean
}) {
  const [modo, setModo] = useState<"editar" | "preview" | "split">("split")
  const [showCampos, setShowCampos] = useState(true)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const inserirCampo = useCallback((campo: string) => {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const novo = conteudo.substring(0, start) + campo + conteudo.substring(end)
    onChange(novo)
    setTimeout(() => {
      el.selectionStart = el.selectionEnd = start + campo.length
      el.focus()
    }, 0)
  }, [conteudo, onChange])

  const wrapTexto = useCallback((antes: string, depois: string) => {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selecionado = conteudo.substring(start, end)
    const novo = conteudo.substring(0, start) + antes + selecionado + depois + conteudo.substring(end)
    onChange(novo)
    setTimeout(() => {
      el.selectionStart = start + antes.length
      el.selectionEnd = end + antes.length
      el.focus()
    }, 0)
  }, [conteudo, onChange])

  const totalPalavras = conteudo.trim().split(/\s+/).filter(Boolean).length
  const totalCaracteres = conteudo.length
  const camposNaoPreenchidos = CAMPOS_VARIAVEIS.filter(c => conteudo.includes(c.key))

  // Renderizar preview
  const renderPreview = (texto: string) => {
    return texto
      .split("\n")
      .map((line, i) => {
        const isTitle = line.match(/^[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÜÇ\s–\-]+$/) && line.trim().length > 3 && line.trim().length < 80
        const isClausula = line.match(/^CLÁUSULA\s+\d+/)
        const isSeparator = line.match(/^_{10,}/)
        const isEmpty = line.trim() === ""

        if (isEmpty) return <div key={i} className="h-3" />
        if (isSeparator) return <hr key={i} className="border-neutral-600 my-4" />
        if (isClausula) return (
          <p key={i} className="font-bold text-orange-400 mt-4 mb-1 text-sm">{line}</p>
        )
        if (isTitle && i < 5) return (
          <h2 key={i} className="text-base font-bold text-white text-center mb-2">{line}</h2>
        )
        if (isTitle) return (
          <p key={i} className="font-semibold text-white mt-3 mb-1 text-sm uppercase tracking-wide">{line}</p>
        )
        return <p key={i} className="text-neutral-300 text-sm leading-relaxed">{line}</p>
      })
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      {/* Barra superior */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-900 border-b border-neutral-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-orange-500" />
            <div>
              <p className="text-white text-sm font-semibold leading-none">Editor de Contrato</p>
              <p className="text-neutral-500 text-xs mt-0.5">{clienteNome}</p>
            </div>
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-neutral-700 mx-1" />

          {/* Toolbar de formatação */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => wrapTexto("**", "**")}
              className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title="Negrito"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => wrapTexto("_", "_")}
              className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title="Itálico"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                const el = textareaRef.current
                if (!el) return
                const start = el.selectionStart
                const lineStart = conteudo.lastIndexOf("\n", start - 1) + 1
                const novo = conteudo.substring(0, lineStart) + "- " + conteudo.substring(lineStart)
                onChange(novo)
              }}
              className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title="Lista"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-5 bg-neutral-700 mx-1" />
            <button
              onClick={() => {
                if (window.confirm("Restaurar o template original? Isso apagará as edições atuais.")) {
                  onChange(TEMPLATE_PADRAO)
                }
              }}
              className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title="Restaurar template"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Controles de modo e ações */}
        <div className="flex items-center gap-2">
          {/* Seletor de modo */}
          <div className="flex items-center bg-neutral-800 rounded-lg p-0.5 border border-neutral-700">
            {[
              { id: "editar", icon: Edit3, label: "Editar" },
              { id: "split", icon: Columns, label: "Split" },
              { id: "preview", icon: Eye, label: "Preview" },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setModo(id as typeof modo)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-all ${
                  modo === id
                    ? "bg-orange-500 text-white"
                    : "text-neutral-400 hover:text-white"
                }`}
                title={label}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowCampos(!showCampos)}
            className={`p-1.5 rounded border transition-colors ${
              showCampos
                ? "bg-orange-500/20 border-orange-500/50 text-orange-400"
                : "border-neutral-700 text-neutral-400 hover:text-white"
            }`}
            title="Campos variáveis"
          >
            <Tag className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-6 bg-neutral-700" />

          <Button
            onClick={onSalvar}
            disabled={salvando}
            className="bg-orange-500 hover:bg-orange-600 text-white h-8 px-3 text-xs gap-1.5"
          >
            {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Salvar
          </Button>
          <button onClick={onFechar} className="text-neutral-400 hover:text-white p-1.5">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1 bg-neutral-950 border-b border-neutral-800 flex-shrink-0 text-xs text-neutral-500">
        <div className="flex items-center gap-4">
          <span>{totalPalavras} palavras</span>
          <span>{totalCaracteres} caracteres</span>
          {camposNaoPreenchidos.length > 0 && (
            <span className="text-yellow-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {camposNaoPreenchidos.length} campo(s) variável(is) no texto
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {camposNaoPreenchidos.length === 0 && (
            <span className="text-green-500 flex items-center gap-1">
              <CheckSquare className="w-3 h-3" />
              Todos os campos preenchidos
            </span>
          )}
        </div>
      </div>

      {/* Área principal */}
      <div className="flex flex-1 overflow-hidden">
        {/* Painel de campos variáveis */}
        {showCampos && (
          <div className="w-56 bg-neutral-950 border-r border-neutral-800 flex flex-col flex-shrink-0 overflow-y-auto">
            <div className="p-3 border-b border-neutral-800">
              <p className="text-white text-xs font-semibold">Campos Variáveis</p>
              <p className="text-neutral-500 text-xs mt-0.5">Clique para inserir</p>
            </div>
            <div className="p-2 space-y-1">
              {CAMPOS_VARIAVEIS.map((campo) => {
                const noTexto = conteudo.includes(campo.key)
                return (
                  <button
                    key={campo.key}
                    onClick={() => inserirCampo(campo.key)}
                    className={`w-full text-left p-2.5 rounded-lg border transition-all hover:border-orange-500/50 hover:bg-orange-500/5 ${
                      noTexto
                        ? "border-orange-500/30 bg-orange-500/5"
                        : "border-neutral-800 bg-neutral-900"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-mono ${noTexto ? "text-orange-400" : "text-neutral-400"}`}>
                        {campo.key}
                      </span>
                      {noTexto && <CheckCircle className="w-3 h-3 text-orange-500 flex-shrink-0" />}
                    </div>
                    <p className="text-neutral-300 text-xs mt-0.5">{campo.label}</p>
                    <p className="text-neutral-600 text-xs">{campo.desc}</p>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Editor */}
        {(modo === "editar" || modo === "split") && (
          <div className={`flex flex-col ${modo === "split" ? "flex-1" : "flex-1"} border-r border-neutral-800`}>
            <div className="px-3 py-1.5 bg-neutral-950 border-b border-neutral-800 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-neutral-500 text-xs ml-2">contrato.txt</span>
            </div>
            <textarea
              ref={textareaRef}
              value={conteudo}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1 bg-neutral-950 text-neutral-200 text-sm font-mono p-6 resize-none focus:outline-none leading-relaxed"
              spellCheck={false}
              style={{ tabSize: 2 }}
            />
          </div>
        )}

        {/* Preview */}
        {(modo === "preview" || modo === "split") && (
          <div className={`${modo === "split" ? "flex-1" : "flex-1"} flex flex-col overflow-hidden`}>
            <div className="px-3 py-1.5 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-neutral-500" />
                <span className="text-neutral-500 text-xs">Pré-visualização</span>
              </div>
            </div>
            {/* Folha de papel */}
            <div className="flex-1 overflow-y-auto bg-neutral-800 p-6">
              <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-2xl overflow-hidden">
                {/* Cabeçalho do documento */}
                <div className="bg-neutral-900 px-8 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-orange-500 font-bold text-sm tracking-widest">SOMMA</p>
                    <p className="text-neutral-400 text-xs">Assessoria Esportiva</p>
                  </div>
                  <div className="text-right">
                    <p className="text-neutral-400 text-xs">CNPJ: 61.315.987/0001-28</p>
                    <p className="text-neutral-500 text-xs">sommarunningclub@gmail.com</p>
                  </div>
                </div>
                {/* Conteúdo */}
                <div className="px-8 py-6 bg-white min-h-96 text-neutral-900">
                  {conteudo.split("\n").map((line, i) => {
                    const isMainTitle = i === 0 && line.trim().length > 0
                    const isClausula = line.match(/^CLÁUSULA\s+\d+/)
                    const isSection = line.match(/^(CONTRATADA|CONTRATANTE):?$/)
                    const isSeparator = line.match(/^_{10,}/)
                    const isEmpty = line.trim() === ""
                    const isBullet = line.trim().startsWith("- ")

                    if (isEmpty) return <div key={i} className="h-3" />
                    if (isSeparator) return <hr key={i} className="border-neutral-300 my-4" />
                    if (isMainTitle) return (
                      <h1 key={i} className="text-center text-base font-bold text-neutral-900 mb-4 uppercase tracking-wide border-b-2 border-orange-500 pb-3">{line}</h1>
                    )
                    if (isClausula) return (
                      <p key={i} className="font-bold text-orange-600 mt-5 mb-1.5 text-sm uppercase tracking-wide">{line}</p>
                    )
                    if (isSection) return (
                      <p key={i} className="font-bold text-neutral-900 mt-4 mb-1 text-sm uppercase border-b border-neutral-200 pb-1">{line}</p>
                    )
                    if (isBullet) return (
                      <p key={i} className="text-neutral-700 text-sm leading-relaxed pl-4 flex gap-2">
                        <span className="text-orange-500 font-bold flex-shrink-0">•</span>
                        <span>{line.replace(/^- /, "")}</span>
                      </p>
                    )
                    return <p key={i} className="text-neutral-700 text-sm leading-relaxed">{line}</p>
                  })}
                </div>
                {/* Rodapé */}
                <div className="bg-neutral-50 px-8 py-3 border-t border-neutral-200 text-center">
                  <p className="text-neutral-400 text-xs">Documento gerado pelo Sistema Somma de Gestão · v2.1.11</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ------- COMPONENTE PRINCIPAL -------
export default function ContratosPage() {
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [clientes, setClientes] = useState<AsaasCustomer[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loadingClientes, setLoadingClientes] = useState(false)
  const [loadingAcao, setLoadingAcao] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showNovoModal, setShowNovoModal] = useState(false)
  const [showEditorModal, setShowEditorModal] = useState(false)
  const [showVisualizarModal, setShowVisualizarModal] = useState(false)
  const [showEnviarModal, setShowEnviarModal] = useState(false)
  const [contratoSelecionado, setContratoSelecionado] = useState<Contrato | null>(null)
  const [clienteSelecionado, setClienteSelecionado] = useState<AsaasCustomer | null>(null)
  const [searchCliente, setSearchCliente] = useState("")
  const [conteudoEditor, setConteudoEditor] = useState("")
  const [emailEnvio, setEmailEnvio] = useState("")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem("somma_contratos")
    if (saved) {
      try { setContratos(JSON.parse(saved)) } catch {}
    }
  }, [])

  const salvarContratos = (lista: Contrato[]) => {
    setContratos(lista)
    localStorage.setItem("somma_contratos", JSON.stringify(lista))
  }

  const buscarClientes = async (query = "") => {
    setLoadingClientes(true)
    setError(null)
    try {
      const endpoint = query
        ? `/api/asaas?endpoint=/customers&name=${encodeURIComponent(query)}&limit=50`
        : `/api/asaas?endpoint=/customers&limit=100`
      const res = await fetch(endpoint)
      if (!res.ok) throw new Error("Erro ao buscar clientes do Asaas")
      const data = await res.json()
      setClientes(data.data || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao buscar clientes")
    } finally {
      setLoadingClientes(false)
    }
  }

  const preencherTemplate = (cliente: AsaasCustomer): string => {
    const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    const endereco = [cliente.address, cliente.addressNumber, cliente.complement, cliente.province, cliente.city, cliente.state].filter(Boolean).join(", ")
    return TEMPLATE_PADRAO
      .replace(/\{\{nome\}\}/g, cliente.name || "")
      .replace(/\{\{cpf\}\}/g, cliente.cpfCnpj || "")
      .replace(/\{\{email\}\}/g, cliente.email || "")
      .replace(/\{\{telefone\}\}/g, cliente.mobilePhone || cliente.phone || "")
      .replace(/\{\{endereco\}\}/g, endereco || "Não informado")
      .replace(/\{\{data_atual\}\}/g, hoje)
  }

  const abrirNovoContrato = () => {
    setClienteSelecionado(null)
    setSearchCliente("")
    buscarClientes()
    setShowNovoModal(true)
  }

  const selecionarCliente = (cliente: AsaasCustomer) => {
    setClienteSelecionado(cliente)
    setConteudoEditor(preencherTemplate(cliente))
    setEmailEnvio(cliente.email || "")
    setShowNovoModal(false)
    setContratoSelecionado(null)
    setShowEditorModal(true)
  }

  const salvarRascunho = () => {
    if (!clienteSelecionado) return
    setSalvando(true)
    const agora = new Date().toISOString()
    const novoContrato: Contrato = {
      id: contratoSelecionado?.id || `contrato_${Date.now()}`,
      clienteId: clienteSelecionado.id,
      clienteNome: clienteSelecionado.name,
      clienteEmail: clienteSelecionado.email,
      clienteCpf: clienteSelecionado.cpfCnpj,
      conteudo: conteudoEditor,
      status: "rascunho",
      criadoEm: contratoSelecionado?.criadoEm || agora,
      atualizadoEm: agora,
    }
    const lista = contratoSelecionado
      ? contratos.map(c => c.id === contratoSelecionado.id ? novoContrato : c)
      : [...contratos, novoContrato]
    salvarContratos(lista)
    setTimeout(() => {
      setSalvando(false)
      setShowEditorModal(false)
      setContratoSelecionado(novoContrato)
    }, 600)
  }

  const editarContrato = (contrato: Contrato) => {
    const cliente: AsaasCustomer = {
      id: contrato.clienteId,
      name: contrato.clienteNome,
      email: contrato.clienteEmail,
      cpfCnpj: contrato.clienteCpf,
    }
    setClienteSelecionado(cliente)
    setContratoSelecionado(contrato)
    setConteudoEditor(contrato.conteudo)
    setEmailEnvio(contrato.clienteEmail)
    setShowEditorModal(true)
  }

  const abrirEnviarModal = (contrato: Contrato) => {
    setContratoSelecionado(contrato)
    setEmailEnvio(contrato.clienteEmail)
    setShowEnviarModal(true)
  }

  const enviarClicksign = async () => {
    if (!contratoSelecionado) return
    setLoadingAcao("enviando")
    try {
      const conteudoBase64 = btoa(unescape(encodeURIComponent(contratoSelecionado.conteudo)))
      const criarDocRes = await fetch("/api/clicksign?endpoint=/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document: {
            path: `/contratos/${contratoSelecionado.clienteNome.replace(/\s+/g, "_")}_${Date.now()}.txt`,
            content_base64: `data:text/plain;base64,${conteudoBase64}`,
            deadline_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            auto_close: true,
            locale: "pt-BR",
            sequence_enabled: false,
          },
        }),
      })
      if (!criarDocRes.ok) {
        const err = await criarDocRes.json()
        throw new Error(err.error || "Erro ao criar documento no Clicksign")
      }
      const docData = await criarDocRes.json()
      const docKey = docData.document?.key
      if (!docKey) throw new Error("Documento criado sem chave válida")

      const addSignRes = await fetch("/api/clicksign?endpoint=/documents/" + docKey + "/signers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signer: {
            email: emailEnvio,
            name: contratoSelecionado.clienteNome,
            documentation: contratoSelecionado.clienteCpf,
            has_documentation: true,
            sign_as: "sign",
          },
        }),
      })
      if (!addSignRes.ok) {
        const err = await addSignRes.json()
        throw new Error(err.error || "Erro ao adicionar signatário")
      }
      const signerData = await addSignRes.json()
      const signerKey = signerData.signer?.key
      if (signerKey) {
        await fetch("/api/clicksign?endpoint=/documents/" + docKey + "/signers/" + signerKey, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "Por favor, assine o contrato de assessoria esportiva da Somma Running Club." }),
        })
      }
      await fetch("/api/clicksign?endpoint=/documents/" + docKey + "/finish", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const agora = new Date().toISOString()
      const contratoAtualizado: Contrato = {
        ...contratoSelecionado,
        status: "enviado",
        clicksignKey: docKey,
        clicksignUrl: `https://app.clicksign.com/sign/${docKey}`,
        atualizadoEm: agora,
      }
      const lista = contratos.map(c => c.id === contratoSelecionado.id ? contratoAtualizado : c)
      salvarContratos(lista)
      setContratoSelecionado(contratoAtualizado)
      setShowEnviarModal(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao enviar contrato")
    } finally {
      setLoadingAcao(null)
    }
  }

  const verificarStatus = async (contrato: Contrato) => {
    if (!contrato.clicksignKey) return
    setLoadingAcao(contrato.id)
    try {
      const res = await fetch(`/api/clicksign?endpoint=/documents/${contrato.clicksignKey}`)
      if (!res.ok) throw new Error("Erro ao buscar status")
      const data = await res.json()
      const statusClicksign = data.document?.status
      let novoStatus: Contrato["status"] = contrato.status
      if (statusClicksign === "closed") novoStatus = "assinado"
      else if (statusClicksign === "running") novoStatus = "aguardando"
      else if (statusClicksign === "canceled") novoStatus = "cancelado"
      const atualizado = { ...contrato, status: novoStatus, atualizadoEm: new Date().toISOString() }
      const lista = contratos.map(c => c.id === contrato.id ? atualizado : c)
      salvarContratos(lista)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao verificar status")
    } finally {
      setLoadingAcao(null)
    }
  }

  const excluirContrato = (id: string) => {
    salvarContratos(contratos.filter(c => c.id !== id))
  }

  const contratosFiltrados = contratos.filter(c =>
    c.clienteNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.clienteEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.clienteCpf.includes(searchTerm)
  )

  const clientesFiltrados = clientes.filter(c =>
    c.name.toLowerCase().includes(searchCliente.toLowerCase()) ||
    (c.cpfCnpj || "").includes(searchCliente) ||
    (c.email || "").toLowerCase().includes(searchCliente.toLowerCase())
  )

  const stats = {
    total: contratos.length,
    rascunhos: contratos.filter(c => c.status === "rascunho").length,
    enviados: contratos.filter(c => c.status === "enviado" || c.status === "aguardando").length,
    assinados: contratos.filter(c => c.status === "assinado").length,
  }

  return (
    <>
      <div className="flex-1 flex flex-col h-full bg-black p-3 md:p-6 overflow-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
              <FileSignature className="w-7 h-7 text-orange-500" />
              Contratos
            </h1>
            <p className="text-neutral-400 text-xs md:text-sm mt-1">
              Gestão de contratos integrado com Asaas e Clicksign
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => { setIsRefreshing(true); setTimeout(() => setIsRefreshing(false), 800) }}
              variant="outline"
              className="border-neutral-700 text-neutral-400 hover:bg-neutral-800 bg-transparent"
              size="sm"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
            <Button
              onClick={abrirNovoContrato}
              className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
            >
              <Plus className="w-4 h-4" />
              Novo Contrato
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { label: "Total", value: stats.total, color: "text-white", bg: "bg-neutral-800" },
            { label: "Rascunhos", value: stats.rascunhos, color: "text-neutral-400", bg: "bg-neutral-800" },
            { label: "Enviados", value: stats.enviados, color: "text-blue-400", bg: "bg-blue-500/10" },
            { label: "Assinados", value: stats.assinados, color: "text-green-400", bg: "bg-green-500/10" },
          ].map((s) => (
            <Card key={s.label} className="bg-neutral-900 border-neutral-800">
              <CardContent className="p-4">
                <p className="text-neutral-500 text-xs">{s.label}</p>
                <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Busca */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
          <Input
            placeholder="Buscar por cliente, email ou CPF..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-neutral-900 border-neutral-800 text-white text-sm"
          />
        </div>

        {/* Erro */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-4 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Lista */}
        {contratosFiltrados.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-neutral-900 flex items-center justify-center mb-4 border border-neutral-800">
              <FileText className="w-10 h-10 text-neutral-700" />
            </div>
            <p className="text-neutral-400 text-lg font-medium">Nenhum contrato ainda</p>
            <p className="text-neutral-600 text-sm mt-1 mb-6 max-w-xs">Crie seu primeiro contrato vinculando um cliente do Asaas</p>
            <Button onClick={abrirNovoContrato} className="bg-orange-500 hover:bg-orange-600 text-white gap-2">
              <Plus className="w-4 h-4" />
              Criar Primeiro Contrato
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {contratosFiltrados.map((contrato) => (
              <Card key={contrato.id} className="bg-neutral-900 border-neutral-800 hover:border-orange-500/40 transition-colors">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0 border border-orange-500/30">
                        <span className="text-orange-500 text-sm font-bold">{contrato.clienteNome.charAt(0)}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white font-semibold text-sm truncate">{contrato.clienteNome}</p>
                          <StatusBadge status={contrato.status} />
                        </div>
                        <p className="text-neutral-400 text-xs mt-0.5">{contrato.clienteEmail}</p>
                        <p className="text-neutral-500 text-xs">CPF: {contrato.clienteCpf}</p>
                        <p className="text-neutral-600 text-xs mt-1">
                          Criado em {new Date(contrato.criadoEm).toLocaleDateString("pt-BR")} · Atualizado {new Date(contrato.atualizadoEm).toLocaleDateString("pt-BR")}
                          {contrato.clicksignKey && (
                            <span className="ml-2 text-blue-400">· Clicksign ativo</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Button
                        onClick={() => { setContratoSelecionado(contrato); setShowVisualizarModal(true) }}
                        variant="outline"
                        size="sm"
                        className="border-neutral-700 text-neutral-400 hover:bg-neutral-800 bg-transparent h-8 px-2 text-xs"
                        title="Visualizar"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      {contrato.status === "rascunho" && (
                        <Button
                          onClick={() => editarContrato(contrato)}
                          variant="outline"
                          size="sm"
                          className="border-neutral-700 text-neutral-400 hover:bg-neutral-800 bg-transparent h-8 px-2 text-xs gap-1"
                          title="Editar"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span className="hidden md:inline">Editar</span>
                        </Button>
                      )}
                      {contrato.status === "rascunho" && (
                        <Button
                          onClick={() => abrirEnviarModal(contrato)}
                          size="sm"
                          className="bg-blue-500 hover:bg-blue-600 text-white h-8 px-2 text-xs gap-1"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span className="hidden md:inline">Enviar</span>
                        </Button>
                      )}
                      {(contrato.status === "enviado" || contrato.status === "aguardando") && (
                        <Button
                          onClick={() => verificarStatus(contrato)}
                          disabled={loadingAcao === contrato.id}
                          size="sm"
                          className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/30 h-8 px-2 text-xs gap-1"
                        >
                          {loadingAcao === contrato.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                          <span className="hidden md:inline">Status</span>
                        </Button>
                      )}
                      {contrato.clicksignUrl && (
                        <>
                          <Button
                            onClick={() => navigator.clipboard.writeText(contrato.clicksignUrl!)}
                            variant="outline"
                            size="sm"
                            className="border-neutral-700 text-neutral-400 hover:bg-neutral-800 bg-transparent h-8 px-2"
                            title="Copiar link"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                          <a href={contrato.clicksignUrl} target="_blank" rel="noopener noreferrer">
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-neutral-700 text-neutral-400 hover:bg-neutral-800 bg-transparent h-8 px-2"
                              title="Abrir no Clicksign"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          </a>
                        </>
                      )}
                      {(contrato.status === "rascunho" || contrato.status === "cancelado") && (
                        <Button
                          onClick={() => excluirContrato(contrato.id)}
                          variant="outline"
                          size="sm"
                          className="border-red-500/30 text-red-400 hover:bg-red-500/10 bg-transparent h-8 px-2"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* MODAL: SELECIONAR CLIENTE */}
      {showNovoModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-3 z-50 overflow-y-auto">
          <Card className="bg-neutral-900 border-neutral-800 w-full max-w-lg my-4">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <User className="w-5 h-5 text-orange-500" />
                Selecionar Cliente
              </CardTitle>
              <button onClick={() => setShowNovoModal(false)} className="text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
                <Input
                  placeholder="Buscar por nome, CPF ou email..."
                  value={searchCliente}
                  onChange={(e) => {
                    setSearchCliente(e.target.value)
                    if (e.target.value.length > 2) buscarClientes(e.target.value)
                  }}
                  className="pl-10 bg-neutral-800 border-neutral-700 text-white text-sm"
                  autoFocus
                />
              </div>
              {loadingClientes ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
                  <span className="ml-2 text-neutral-400 text-sm">Carregando clientes do Asaas...</span>
                </div>
              ) : clientesFiltrados.length === 0 ? (
                <div className="text-center py-10">
                  <AlertCircle className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                  <p className="text-neutral-400 text-sm">
                    {error ? "Erro ao carregar clientes." : "Nenhum cliente encontrado."}
                  </p>
                  {error && <p className="text-neutral-500 text-xs mt-1">Verifique se a ASAAS_API_KEY está configurada.</p>}
                </div>
              ) : (
                <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                  {clientesFiltrados.map((cliente) => (
                    <button
                      key={cliente.id}
                      onClick={() => selecionarCliente(cliente)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-orange-500/50 transition-all text-left group"
                    >
                      <div className="w-9 h-9 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0 border border-orange-500/30 group-hover:border-orange-500/60 transition-colors">
                        <span className="text-orange-500 text-sm font-bold">{cliente.name.charAt(0)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-sm font-medium truncate">{cliente.name}</p>
                        <p className="text-neutral-400 text-xs">{cliente.email}</p>
                        <p className="text-neutral-500 text-xs">CPF: {cliente.cpfCnpj}</p>
                      </div>
                      <ChevronDown className="w-4 h-4 text-neutral-600 group-hover:text-orange-500 rotate-[-90deg] flex-shrink-0 transition-colors" />
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* EDITOR SOFISTICADO (fullscreen) */}
      {showEditorModal && clienteSelecionado && (
        <EditorContrato
          conteudo={conteudoEditor}
          onChange={setConteudoEditor}
          clienteNome={clienteSelecionado.name}
          onSalvar={salvarRascunho}
          onFechar={() => setShowEditorModal(false)}
          salvando={salvando}
        />
      )}

      {/* MODAL: VISUALIZAR */}
      {showVisualizarModal && contratoSelecionado && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-3 z-50 overflow-y-auto">
          <Card className="bg-neutral-900 border-neutral-800 w-full max-w-3xl my-4">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-neutral-800">
              <div>
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <Eye className="w-5 h-5 text-orange-500" />
                  Visualizar Contrato
                </CardTitle>
                <p className="text-neutral-400 text-xs mt-0.5">{contratoSelecionado.clienteNome} · <StatusBadge status={contratoSelecionado.status} /></p>
              </div>
              <button onClick={() => setShowVisualizarModal(false)} className="text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="bg-neutral-800 p-4 max-h-[70vh] overflow-y-auto">
                <div className="bg-white rounded-lg overflow-hidden">
                  <div className="bg-neutral-900 px-6 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-orange-500 font-bold text-sm tracking-widest">SOMMA</p>
                      <p className="text-neutral-400 text-xs">Assessoria Esportiva</p>
                    </div>
                    <div className="text-right">
                      <p className="text-neutral-400 text-xs">CNPJ: 61.315.987/0001-28</p>
                    </div>
                  </div>
                  <div className="px-8 py-6">
                    {contratoSelecionado.conteudo.split("\n").map((line, i) => {
                      const isMainTitle = i === 0
                      const isClausula = line.match(/^CLÁUSULA\s+\d+/)
                      const isSection = line.match(/^(CONTRATADA|CONTRATANTE):?$/)
                      const isSeparator = line.match(/^_{10,}/)
                      const isEmpty = line.trim() === ""
                      const isBullet = line.trim().startsWith("- ")
                      if (isEmpty) return <div key={i} className="h-3" />
                      if (isSeparator) return <hr key={i} className="border-neutral-300 my-4" />
                      if (isMainTitle) return <h1 key={i} className="text-center text-base font-bold text-neutral-900 mb-4 uppercase tracking-wide border-b-2 border-orange-500 pb-3">{line}</h1>
                      if (isClausula) return <p key={i} className="font-bold text-orange-600 mt-5 mb-1.5 text-sm uppercase tracking-wide">{line}</p>
                      if (isSection) return <p key={i} className="font-bold text-neutral-900 mt-4 mb-1 text-sm uppercase border-b border-neutral-200 pb-1">{line}</p>
                      if (isBullet) return (
                        <p key={i} className="text-neutral-700 text-sm leading-relaxed pl-4 flex gap-2">
                          <span className="text-orange-500 font-bold flex-shrink-0">•</span>
                          <span>{line.replace(/^- /, "")}</span>
                        </p>
                      )
                      return <p key={i} className="text-neutral-700 text-sm leading-relaxed">{line}</p>
                    })}
                  </div>
                </div>
              </div>
              <div className="p-4 flex justify-end gap-2 border-t border-neutral-800">
                {contratoSelecionado.status === "rascunho" && (
                  <Button
                    onClick={() => { setShowVisualizarModal(false); editarContrato(contratoSelecionado) }}
                    variant="outline"
                    className="border-neutral-700 text-neutral-400 hover:bg-neutral-800 bg-transparent gap-2"
                  >
                    <Edit3 className="w-4 h-4" />
                    Editar
                  </Button>
                )}
                {contratoSelecionado.status === "rascunho" && (
                  <Button
                    onClick={() => { setShowVisualizarModal(false); abrirEnviarModal(contratoSelecionado) }}
                    className="bg-blue-500 hover:bg-blue-600 text-white gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Enviar para Assinatura
                  </Button>
                )}
                <Button
                  onClick={() => setShowVisualizarModal(false)}
                  variant="outline"
                  className="border-neutral-700 text-neutral-400 hover:bg-neutral-800 bg-transparent"
                >
                  Fechar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* MODAL: ENVIAR */}
      {showEnviarModal && contratoSelecionado && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-3 z-50 overflow-y-auto">
          <Card className="bg-neutral-900 border-neutral-800 w-full max-w-md my-4">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <Send className="w-5 h-5 text-blue-400" />
                Enviar para Assinatura
              </CardTitle>
              <button onClick={() => setShowEnviarModal(false)} className="text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-blue-400 text-sm font-medium">Integração Clicksign</p>
                <p className="text-blue-300/70 text-xs mt-1">O contrato será enviado para o cliente assinar digitalmente via Clicksign.</p>
              </div>
              <div>
                <label className="text-neutral-400 text-xs block mb-1.5">Cliente</label>
                <div className="p-3 bg-neutral-800 rounded-lg border border-neutral-700">
                  <p className="text-white text-sm font-medium">{contratoSelecionado.clienteNome}</p>
                  <p className="text-neutral-400 text-xs">CPF: {contratoSelecionado.clienteCpf}</p>
                </div>
              </div>
              <div>
                <label className="text-neutral-400 text-xs block mb-1.5">E-mail para envio</label>
                <Input
                  type="email"
                  value={emailEnvio}
                  onChange={(e) => setEmailEnvio(e.target.value)}
                  className="bg-neutral-800 border-neutral-700 text-white text-sm"
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => setShowEnviarModal(false)}
                  variant="outline"
                  className="flex-1 border-neutral-700 text-neutral-400 bg-transparent"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={enviarClicksign}
                  disabled={!emailEnvio || !!loadingAcao}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white gap-2"
                >
                  {loadingAcao === "enviando" ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                  ) : (
                    <><Send className="w-4 h-4" /> Enviar pelo Clicksign</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
