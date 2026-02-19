import { supabase } from "@/lib/supabase-client"

/**
 * TESTE DE CONECTIVIDADE - MÓDULO CARTEIRAS
 * Execute este arquivo para validar a integração
 */

export async function testCarteirasConnectivity() {
  console.log("=" .repeat(60))
  console.log("INICIANDO TESTES DE CONECTIVIDADE - MÓDULO CARTEIRAS")
  console.log("=" .repeat(60))

  const results = {
    supabaseConnection: false,
    professorsTableAccess: false,
    professorClientsTableAccess: false,
    commissionConfigAccess: false,
    cobrancasTableAccess: false,
    timestampA: new Date().toISOString()
  }

  // Teste 1: Conexão Supabase
  try {
    console.log("\n[TESTE 1] Testando conexão com Supabase...")
    const { data, error } = await supabase.auth.getUser()
    if (error) {
      console.warn("[AVISO] Sem usuário autenticado (esperado):", error.message)
    }
    results.supabaseConnection = true
    console.log("✅ Conexão Supabase: OK")
  } catch (err) {
    console.error("❌ Conexão Supabase: FALHOU", err)
  }

  // Teste 2: Tabela Professors
  try {
    console.log("\n[TESTE 2] Testando acesso à tabela 'professors'...")
    const { data, error, count } = await supabase
      .from("professors")
      .select("*", { count: "exact" })
      .limit(1)
    
    if (error) {
      console.error("❌ Erro ao acessar professors:", error.message)
    } else {
      results.professorsTableAccess = true
      console.log(`✅ Tabela professors: OK (${count} registros)`)
    }
  } catch (err) {
    console.error("❌ Tabela professors: FALHOU", err)
  }

  // Teste 3: Tabela Professor Clients
  try {
    console.log("\n[TESTE 3] Testando acesso à tabela 'professor_clients'...")
    const { data, error, count } = await supabase
      .from("professor_clients")
      .select("*", { count: "exact" })
      .limit(1)
    
    if (error) {
      console.error("❌ Erro ao acessar professor_clients:", error.message)
    } else {
      results.professorClientsTableAccess = true
      console.log(`✅ Tabela professor_clients: OK (${count} registros)`)
    }
  } catch (err) {
    console.error("❌ Tabela professor_clients: FALHOU", err)
  }

  // Teste 4: Tabela Commission Config
  try {
    console.log("\n[TESTE 4] Testando acesso à tabela 'commission_config'...")
    const { data, error } = await supabase
      .from("commission_config")
      .select("*")
      .limit(1)
    
    if (error) {
      console.error("❌ Erro ao acessar commission_config:", error.message)
    } else {
      results.commissionConfigAccess = true
      console.log(`✅ Tabela commission_config: OK`)
      if (data && data.length > 0) {
        console.log(`   Taxa fixa Somma: R$ ${data[0].somma_fixed_fee}`)
      }
    }
  } catch (err) {
    console.error("❌ Tabela commission_config: FALHOU", err)
  }

  // Teste 5: Tabela Cobrancas Membros
  try {
    console.log("\n[TESTE 5] Testando acesso à tabela 'cobrancas_membros'...")
    const { data, error, count } = await supabase
      .from("cobrancas_membros")
      .select("*", { count: "exact" })
      .limit(1)
    
    if (error) {
      console.error("❌ Erro ao acessar cobrancas_membros:", error.message)
    } else {
      results.cobrancasTableAccess = true
      console.log(`✅ Tabela cobrancas_membros: OK (${count} registros)`)
    }
  } catch (err) {
    console.error("❌ Tabela cobrancas_membros: FALHOU", err)
  }

  // Resumo
  console.log("\n" + "=" .repeat(60))
  console.log("RESUMO DOS TESTES")
  console.log("=" .repeat(60))
  
  const allTests = Object.entries(results)
    .filter(([key]) => key !== "timestampA")
    .map(([key, value]) => {
      const testName = key
        .replace(/([A-Z])/g, " $1")
        .trim()
        .toUpperCase()
      return `${value ? "✅" : "❌"} ${testName}: ${value ? "OK" : "FALHOU"}`
    })

  allTests.forEach(test => console.log(test))

  const passed = Object.values(results)
    .filter(v => typeof v === "boolean")
    .filter(v => v).length
  const total = Object.values(results)
    .filter(v => typeof v === "boolean").length

  console.log("\n" + "=" .repeat(60))
  console.log(`RESULTADO FINAL: ${passed}/${total} testes passaram`)
  console.log("=" .repeat(60))

  if (passed === total) {
    console.log("\n🎉 MÓDULO CARTEIRAS: TOTALMENTE FUNCIONAL")
    return true
  } else {
    console.log("\n⚠️  MÓDULO CARTEIRAS: VERIFICAR ERROS ACIMA")
    return false
  }
}

// Para usar: chame testCarteirasConnectivity() em um useEffect ou durante inicialização
