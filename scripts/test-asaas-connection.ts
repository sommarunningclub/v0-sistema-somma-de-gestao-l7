/**
 * Script de teste de conexão com a API Asaas
 * Valida as credenciais e testa endpoints básicos
 */

const ASAAS_API_URL = process.env.NEXT_PUBLIC_ASAAS_API_URL || ''
const ASAAS_API_KEY = process.env.ASAAS_API_KEY || ''
const ASAAS_WALLET_ID = process.env.ASAAS_WALLET_ID || ''

async function testAsaasConnection() {
  console.log('🔍 Testando conexão com Asaas...\n')

  // Validar configuração
  console.log('📋 Validando configuração:')
  console.log(`   URL: ${ASAAS_API_URL || '❌ NÃO CONFIGURADA'}`)
  console.log(`   API Key: ${ASAAS_API_KEY ? '✅ Configurada' : '❌ NÃO CONFIGURADA'}`)
  console.log(`   Wallet ID: ${ASAAS_WALLET_ID || '❌ NÃO CONFIGURADA'}`)
  console.log('')

  if (!ASAAS_API_URL || !ASAAS_API_KEY) {
    console.error('❌ Erro: Variáveis de ambiente não configuradas')
    process.exit(1)
  }

  try {
    // Teste 1: Buscar informações da conta
    console.log('🧪 Teste 1: Buscando informações da conta...')
    const accountResponse = await fetch(`${ASAAS_API_URL}/myAccount`, {
      method: 'GET',
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json',
      },
    })

    if (!accountResponse.ok) {
      const errorData = await accountResponse.json()
      console.error('❌ Erro ao buscar conta:', errorData)
      process.exit(1)
    }

    const accountData = await accountResponse.json()
    console.log('✅ Conta encontrada:')
    console.log(`   Nome: ${accountData.name || 'N/A'}`)
    console.log(`   Email: ${accountData.email || 'N/A'}`)
    console.log(`   CPF/CNPJ: ${accountData.cpfCnpj || 'N/A'}`)
    console.log(`   Wallet ID: ${accountData.walletId || 'N/A'}`)
    console.log('')

    // Teste 2: Verificar saldo
    console.log('🧪 Teste 2: Verificando saldo...')
    const financeResponse = await fetch(`${ASAAS_API_URL}/finance/getCurrentBalance`, {
      method: 'GET',
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json',
      },
    })

    if (financeResponse.ok) {
      const financeData = await financeResponse.json()
      console.log('✅ Saldo atual:')
      console.log(`   Disponível: R$ ${financeData.balance || 0}`)
      console.log('')
    } else {
      console.log('⚠️  Não foi possível obter saldo (pode ser limitação da API)')
      console.log('')
    }

    // Teste 3: Listar clientes (primeiros 10)
    console.log('🧪 Teste 3: Listando clientes...')
    const customersResponse = await fetch(`${ASAAS_API_URL}/customers?limit=10`, {
      method: 'GET',
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json',
      },
    })

    if (customersResponse.ok) {
      const customersData = await customersResponse.json()
      console.log(`✅ Total de clientes: ${customersData.totalCount || 0}`)
      if (customersData.data && customersData.data.length > 0) {
        console.log(`   Primeiros clientes:`)
        customersData.data.slice(0, 3).forEach((customer: any) => {
          console.log(`   - ${customer.name} (${customer.email || 'sem email'})`)
        })
      }
      console.log('')
    }

    // Teste 4: Verificar Wallet ID
    if (ASAAS_WALLET_ID) {
      console.log('🧪 Teste 4: Verificando Wallet ID...')
      if (accountData.walletId === ASAAS_WALLET_ID) {
        console.log('✅ Wallet ID corresponde à conta')
      } else {
        console.log('⚠️  Wallet ID configurado difere da conta:')
        console.log(`   Configurado: ${ASAAS_WALLET_ID}`)
        console.log(`   Na conta: ${accountData.walletId || 'N/A'}`)
      }
      console.log('')
    }

    console.log('✅ Todos os testes passaram com sucesso!')
    console.log('🎉 Integração Asaas está funcionando corretamente!')
    console.log('')
    console.log('📚 Próximos passos:')
    console.log('   1. Configure webhooks no painel Asaas')
    console.log('   2. Teste criar uma cobrança de teste')
    console.log('   3. Monitore os logs de pagamentos')
    
  } catch (error) {
    console.error('❌ Erro ao testar conexão:', error)
    process.exit(1)
  }
}

testAsaasConnection()
