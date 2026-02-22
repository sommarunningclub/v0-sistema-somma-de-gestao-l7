"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { Upload, CheckCircle, XCircle, AlertTriangle, Database } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

// Dados faltantes da planilha (linhas 155-186)
const DADOS_FALTANTES = [
  { nome: "Kamila Louzeiro dos Santos", email: "kamilalouzeiro149@gmail.com", whatsapp: "(61) 99423-5263", sexo: "feminino", cidade: "Gama", data_hora: "2026-02-11T16:04:17.476Z" },
  { nome: "Eithielen Bernardes", email: "eithi.elen@gmail.com", whatsapp: "(61) 98203-3715", sexo: "feminino", cidade: "Plano Piloto", data_hora: "2026-02-11T16:06:59.279Z" },
  { nome: "Camila Gonçalves", email: "camilagoncalves2007@hotmail.com", whatsapp: "(61) 98204-4535", sexo: "feminino", cidade: "Lago Norte", data_hora: "2026-02-11T16:07:02.901Z" },
  { nome: "Kevin torres", email: "kevi.verdao3@gmail.com", whatsapp: "(61) 98169-3723", sexo: "masculino", cidade: "Águas Lindas de Goiás - GO", data_hora: "2026-02-11T16:08:41.738Z" },
  { nome: "Íris Ramos santos de Lima", email: "irisramossantos@gmail.com", whatsapp: "(61) 99210-4884", sexo: "feminino", cidade: "Ceilândia", data_hora: "2026-02-11T16:12:31.559Z" },
  { nome: "João Victor Dreissig de Melo", email: "jvdreissig31@gmail.com", whatsapp: "(61) 98016-0954", sexo: "masculino", cidade: "São Sebastião", data_hora: "2026-02-11T16:18:02.284Z" },
  { nome: "Camila de Vasconcelos Silva", email: "camilavasc2@gmail.com", whatsapp: "(61) 98455-6613", sexo: "feminino", cidade: "Guará", data_hora: "2026-02-11T16:25:58.098Z" },
  { nome: "Joao pedro de oliveira sampaio", email: "jpdliveirass@gmail.com", whatsapp: "(61) 99416-5780", sexo: "masculino", cidade: "Águas Claras", data_hora: "2026-02-11T16:29:48.760Z" },
  { nome: "Erik Cesar Pinto", email: "erikcesarpinto27@gmail.com", whatsapp: "(61) 99681-2181", sexo: "masculino", cidade: "Taguatinga", data_hora: "2026-02-11T16:32:07.369Z" },
  { nome: "Ana Cecilia Rocha", email: "anaceciliarochacuz@gmail.com", whatsapp: "(61) 98605-6503", sexo: "feminino", cidade: "Águas Claras", data_hora: "2026-02-11T16:37:34.035Z" },
  { nome: "Ana Luiza Araujo de Souza", email: "analuuh1427@gmail.com", whatsapp: "(61) 99170-7460", sexo: "feminino", cidade: "Santa Maria", data_hora: "2026-02-11T17:01:27.392Z" },
  { nome: "Eliton Franco de Oliveira", email: "elitonsaude@gmail.com", whatsapp: "(61) 98487-7825", sexo: "masculino", cidade: "Riacho Fundo", data_hora: "2026-02-11T17:22:10.415Z" },
  { nome: "Cristiane Barbosa", email: "bcrisgabi@gmail.com", whatsapp: "(61) 98477-5063", sexo: "feminino", cidade: "Ceilândia", data_hora: "2026-02-11T17:22:47.532Z" },
  { nome: "Gabriel Oliveira", email: "gabrieloliveira.ceilandia@gmail.com", whatsapp: "(61) 98477-5064", sexo: "masculino", cidade: "Ceilândia", data_hora: "2026-02-11T17:24:00.303Z" },
  { nome: "Gabriel Vinicius R da Costa", email: "gvrdacosta@gmail.com", whatsapp: "(61) 99248-7162", sexo: "masculino", cidade: "Sobradinho", data_hora: "2026-02-11T17:25:03.104Z" },
  { nome: "Mariana Eduarda Brod", email: "marianaeduardabrod@gmail.com", whatsapp: "(61) 99866-8644", sexo: "feminino", cidade: "Plano Piloto", data_hora: "2026-02-11T17:30:35.182Z" },
  { nome: "Yasmin de Carvalho Ferreira", email: "yasmin.uff@gmail.com", whatsapp: "(61) 98754-4286", sexo: "feminino", cidade: "Águas Claras", data_hora: "2026-02-11T17:33:17.188Z" },
  { nome: "Blenda Cabral Gomes De Lima", email: "blendagomes@icloud.com", whatsapp: "(61) 99152-5005", sexo: "feminino", cidade: "Taguatinga", data_hora: "2026-02-11T17:35:37.662Z" },
  { nome: "David Gonçalves de Sousa", email: "davidgsousa006@gmail.com", whatsapp: "(61) 99663-8630", sexo: "masculino", cidade: "SCIA/Estrutural", data_hora: "2026-02-11T17:42:26.451Z" },
  { nome: "Lucas Lino", email: "lucaslino.treinador@gmail.com", whatsapp: "(61) 99252-2676", sexo: "masculino", cidade: "Santo Antônio do Descoberto", data_hora: "2026-02-11T18:06:35.324Z" },
  { nome: "Pâmela Lorena Ribeiro Avila", email: "panloly@hotmail.com", whatsapp: "(63) 99836-3025", sexo: "feminino", cidade: "Sudoeste/Octogonal", data_hora: "2026-02-11T18:17:05.419Z" },
  { nome: "Maria Clara da Silveira", email: "mclara-silv@outlook.com", whatsapp: "(66) 99975-7711", sexo: "feminino", cidade: "Plano Piloto", data_hora: "2026-02-11T18:57:49.611Z" },
  { nome: "Pedro Lucas Santos Brisio da Silva", email: "pedrobrisio28@gmail.com", whatsapp: "(61) 98637-9086", sexo: "masculino", cidade: "Samambaia", data_hora: "2026-02-11T19:01:41.510Z" },
  { nome: "Jessica Cristina Araújo Quintanilha", email: "jessicaquintanilha123@gmail.com", whatsapp: "(61) 99452-1620", sexo: "feminino", cidade: "Planaltina", data_hora: "2026-02-11T19:05:08.752Z" },
  { nome: "Ingrid Samara Rodrigues Pinheiro", email: "ingrid.rrodrigues2017@gmail.com", whatsapp: "(61) 98189-9277", sexo: "feminino", cidade: "Taguatinga", data_hora: "2026-02-11T19:14:04.968Z" },
  { nome: "Thiago da Silva dias", email: "thiago.l.dsd@gmail.com", whatsapp: "(61) 99387-2413", sexo: "masculino", cidade: "Guará", data_hora: "2026-02-11T20:58:15.249Z" },
  { nome: "Carla Magda dos Santos Barcelos", email: "magdacarla@gmail.com", whatsapp: "(61) 99322-5895", sexo: "feminino", cidade: "Taguatinga", data_hora: "2026-02-12T23:31:42.199Z" },
  { nome: "Lidiane Aguiar", email: "lidianedssaa@gmail.com", whatsapp: "(61) 99819-2099", sexo: "feminino", cidade: "Valparaíso de Goiás - GO", data_hora: "2026-02-22T01:03:56.140Z" },
  { nome: "Raiane Ionara", email: "raianezanella@hotmail.com", whatsapp: "(48) 99943-2877", sexo: "feminino", cidade: "Taguatinga", data_hora: "2026-02-22T12:47:44.705Z" },
  { nome: "Andressa Maria de Souza", email: "andressamariadesouza004@gmail.com", whatsapp: "(61) 99305-4397", sexo: "feminino", cidade: "São Sebastião", data_hora: "2026-02-22T13:22:57.765Z" },
]

export default function ImportListaVIPPage() {
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<{
    importados: number
    duplicados: number
    erros: number
    mensagens: string[]
  } | null>(null)
  const [totalAtual, setTotalAtual] = useState<number | null>(null)
  const [totalNovo, setTotalNovo] = useState<number | null>(null)

  const verificarTotais = async () => {
    const supabase = createClient()
    const { count } = await supabase
      .from("lista_vip_assessoria")
      .select("*", { count: "exact", head: true })
    
    setTotalAtual(count || 0)
  }

  const importarDados = async () => {
    setImporting(true)
    setProgress(0)
    setResults(null)

    const supabase = createClient()
    let importados = 0
    let duplicados = 0
    let erros = 0
    const mensagens: string[] = []

    for (let i = 0; i < DADOS_FALTANTES.length; i++) {
      const pessoa = DADOS_FALTANTES[i]
      
      try {
        // Verificar se o email já existe
        const { data: existente } = await supabase
          .from("lista_vip_assessoria")
          .select("id, email")
          .eq("email", pessoa.email)
          .maybeSingle()

        if (existente) {
          mensagens.push(`⚠️ Duplicado: ${pessoa.email}`)
          duplicados++
        } else {
          // Inserir novo registro
          const { error } = await supabase
            .from("lista_vip_assessoria")
            .insert({
              nome: pessoa.nome,
              email: pessoa.email,
              whatsapp: pessoa.whatsapp,
              sexo: pessoa.sexo,
              cidade: pessoa.cidade,
              data_hora: pessoa.data_hora,
              professor_id: null,
            })

          if (error) {
            mensagens.push(`❌ Erro: ${pessoa.nome} - ${error.message}`)
            erros++
          } else {
            mensagens.push(`✅ Importado: ${pessoa.nome}`)
            importados++
          }
        }
      } catch (error) {
        mensagens.push(`❌ Erro: ${pessoa.nome}`)
        erros++
      }

      setProgress(Math.round(((i + 1) / DADOS_FALTANTES.length) * 100))
    }

    // Verificar total após importação
    const { count } = await supabase
      .from("lista_vip_assessoria")
      .select("*", { count: "exact", head: true })

    setTotalNovo(count || 0)
    setResults({ importados, duplicados, erros, mensagens })
    setImporting(false)
  }

  return (
    <div className="min-h-screen bg-black p-3 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <Card className="bg-neutral-900 border-neutral-700">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-500/20 rounded-full flex items-center justify-center">
                <Database className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" />
              </div>
              <div>
                <CardTitle className="text-lg sm:text-xl text-white">Importação Lista VIP</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Sincronizar dados da planilha com o banco de dados
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Diagnóstico */}
        <Card className="bg-neutral-900 border-neutral-700">
          <CardHeader>
            <CardTitle className="text-sm sm:text-base text-neutral-300">Diagnóstico do Problema</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="p-3 sm:p-4 bg-neutral-800 rounded-lg">
                <p className="text-[10px] sm:text-xs text-neutral-400">Planilha</p>
                <p className="text-xl sm:text-2xl font-bold text-white font-mono">185</p>
              </div>
              <div className="p-3 sm:p-4 bg-neutral-800 rounded-lg">
                <p className="text-[10px] sm:text-xs text-neutral-400">Banco Atual</p>
                <p className="text-xl sm:text-2xl font-bold text-white font-mono">
                  {totalAtual !== null ? totalAtual : "..."}
                </p>
              </div>
              <div className="p-3 sm:p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-[10px] sm:text-xs text-red-400">Faltando</p>
                <p className="text-xl sm:text-2xl font-bold text-red-500 font-mono">
                  {totalAtual !== null ? 185 - totalAtual : "..."}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={verificarTotais}
                variant="outline"
                className="flex-1 bg-neutral-800 border-neutral-600 text-white hover:bg-neutral-700"
              >
                <Database className="w-4 h-4 mr-2" />
                Verificar Total Atual
              </Button>
            </div>

            <div className="p-3 sm:p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-start gap-2 sm:gap-3">
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs sm:text-sm text-blue-400 font-medium mb-1">
                    Solução
                  </p>
                  <p className="text-[10px] sm:text-xs text-neutral-300">
                    Esta ferramenta irá importar os {DADOS_FALTANTES.length} registros faltantes da planilha 
                    para o banco de dados, sincronizando os totais.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ação de Importação */}
        <Card className="bg-neutral-900 border-neutral-700">
          <CardHeader>
            <CardTitle className="text-sm sm:text-base text-neutral-300">Importar Dados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={importarDados}
              disabled={importing}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white text-sm sm:text-base active:scale-95"
            >
              <Upload className="w-4 h-4 mr-2" />
              {importing ? "Importando..." : `Importar ${DADOS_FALTANTES.length} Registros`}
            </Button>

            {importing && (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-xs sm:text-sm text-center text-neutral-400">
                  {progress}% concluído
                </p>
              </div>
            )}

            {results && (
              <div className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="p-2 sm:p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <div className="flex items-center gap-1 sm:gap-2 mb-1">
                      <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
                      <p className="text-[10px] sm:text-xs text-green-400">Importados</p>
                    </div>
                    <p className="text-lg sm:text-xl font-bold text-green-500 font-mono">
                      {results.importados}
                    </p>
                  </div>
                  <div className="p-2 sm:p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <div className="flex items-center gap-1 sm:gap-2 mb-1">
                      <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500" />
                      <p className="text-[10px] sm:text-xs text-yellow-400">Duplicados</p>
                    </div>
                    <p className="text-lg sm:text-xl font-bold text-yellow-500 font-mono">
                      {results.duplicados}
                    </p>
                  </div>
                  <div className="p-2 sm:p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <div className="flex items-center gap-1 sm:gap-2 mb-1">
                      <XCircle className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" />
                      <p className="text-[10px] sm:text-xs text-red-400">Erros</p>
                    </div>
                    <p className="text-lg sm:text-xl font-bold text-red-500 font-mono">
                      {results.erros}
                    </p>
                  </div>
                </div>

                {totalNovo !== null && (
                  <div className="p-3 sm:p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm text-green-400">Total no Banco Agora:</span>
                      <Badge className="bg-green-500 text-white text-sm sm:text-base px-3 py-1">
                        {totalNovo} registros
                      </Badge>
                    </div>
                  </div>
                )}

                <div className="max-h-60 overflow-y-auto bg-neutral-800 rounded-lg p-3 sm:p-4 space-y-1">
                  <p className="text-xs sm:text-sm font-medium text-neutral-300 mb-2">
                    Log de Importação:
                  </p>
                  {results.mensagens.map((msg, idx) => (
                    <p key={idx} className="text-[10px] sm:text-xs text-neutral-400 font-mono">
                      {msg}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
