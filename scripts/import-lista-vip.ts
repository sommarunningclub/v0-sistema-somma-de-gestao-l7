import { createClient } from '@supabase/supabase-js'

// Este script importa dados da planilha para a tabela lista_vip_assessoria
// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// Dados da planilha (linha 155 em diante - os 84 registros faltantes)
const dadosPlanilha = [
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
  { nome: "Gabriel Oliveira", email: "bcrisgabi@gmail.com", whatsapp: "(61) 98477-5063", sexo: "masculino", cidade: "Ceilândia", data_hora: "2026-02-11T17:24:00.303Z" },
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
  { nome: "Camila de Vasconcelos Silva", email: "camilavasc2@gmail.com", whatsapp: "(61) 98455-6613", sexo: "feminino", cidade: "Guará", data_hora: "2026-02-22T14:00:51.350Z" },
]

async function importarDados() {
  console.log('🚀 Iniciando importação de dados da lista VIP...')
  console.log(`📊 Total de registros a importar: ${dadosPlanilha.length}`)

  let importados = 0
  let erros = 0
  let duplicados = 0

  for (const pessoa of dadosPlanilha) {
    try {
      // Verificar se o email já existe
      const { data: existente, error: errorCheck } = await supabase
        .from('lista_vip_assessoria')
        .select('id, email')
        .eq('email', pessoa.email)
        .single()

      if (existente) {
        console.log(`⚠️  Email duplicado ignorado: ${pessoa.email}`)
        duplicados++
        continue
      }

      // Inserir o novo registro
      const { error } = await supabase
        .from('lista_vip_assessoria')
        .insert({
          nome: pessoa.nome,
          email: pessoa.email,
          whatsapp: pessoa.whatsapp,
          sexo: pessoa.sexo,
          cidade: pessoa.cidade,
          data_hora: pessoa.data_hora,
          professor_id: null
        })

      if (error) {
        console.error(`❌ Erro ao importar ${pessoa.nome}:`, error.message)
        erros++
      } else {
        console.log(`✅ Importado: ${pessoa.nome}`)
        importados++
      }
    } catch (error) {
      console.error(`❌ Erro ao processar ${pessoa.nome}:`, error)
      erros++
    }
  }

  console.log('\n📈 Resultado da Importação:')
  console.log(`✅ Importados com sucesso: ${importados}`)
  console.log(`⚠️  Duplicados (ignorados): ${duplicados}`)
  console.log(`❌ Erros: ${erros}`)
  console.log(`📊 Total processado: ${dadosPlanilha.length}`)

  // Verificar total de registros após importação
  const { count } = await supabase
    .from('lista_vip_assessoria')
    .select('*', { count: 'exact', head: true })

  console.log(`\n🎯 Total de registros na tabela agora: ${count}`)
}

importarDados()
  .then(() => {
    console.log('\n✨ Importação concluída!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Erro fatal:', error)
    process.exit(1)
  })
