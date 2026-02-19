# Checklist de Integração Asaas

Use este checklist para garantir que a integração com Asaas está corretamente configurada.

## Pré-requisitos

- [ ] Conta Asaas criada (Sandbox ou Produção)
- [ ] Acesso ao painel administrativo do Asaas
- [ ] Acesso ao painel Vercel do projeto

## Passo 1: Obter Credenciais Asaas

### No Painel Asaas:

- [ ] Acesse https://www.asaas.com (ou https://sandbox.asaas.com para testes)
- [ ] Faça login na sua conta
- [ ] Navegue até: **Configurações** > **Integrações**
- [ ] Clique em **"Gerar API Key"** ou **"Criar nova chave"**
- [ ] Copie a API Key gerada (você não poderá vê-la novamente!)
- [ ] (Opcional) Se usar sub-contas, copie também o Wallet ID

## Passo 2: Configurar Variáveis de Ambiente

### No Painel Vercel:

- [ ] Acesse seu projeto no Vercel
- [ ] Vá em **Settings** > **Environment Variables**
- [ ] Adicione as seguintes variáveis:

#### 1. NEXT_PUBLIC_ASAAS_API_URL
```
Nome: NEXT_PUBLIC_ASAAS_API_URL
Valor (Sandbox): https://sandbox.asaas.com/api/v3
Valor (Produção): https://api.asaas.com/v3
Environments: Production, Preview, Development
```

#### 2. ASAAS_API_KEY
```
Nome: ASAAS_API_KEY
Valor: [Cole sua API Key aqui]
Environments: Production, Preview, Development
Tipo: Secret (marque como sensível)
```

#### 3. ASAAS_WALLET_ID (Opcional)
```
Nome: ASAAS_WALLET_ID
Valor: [Cole seu Wallet ID aqui]
Environments: Production, Preview, Development
```

- [ ] Clique em **Save** para cada variável
- [ ] Faça **redeploy** do projeto após adicionar as variáveis

## Passo 3: Testar a Conexão

### Teste via Browser (desenvolvimento local):

- [ ] Execute o projeto: `npm run dev`
- [ ] Abra: http://localhost:3000
- [ ] Navegue até: **Pagamentos** > **Dashboard**
- [ ] Verifique se os dados carregam sem erros
- [ ] Verifique o console do navegador (F12) para mensagens de erro

### Teste via API:

- [ ] Execute o seguinte comando (substitua a URL):
```bash
curl -X GET "https://seu-app.vercel.app/api/asaas?endpoint=/customers&limit=1"
```

- [ ] Você deve receber uma resposta JSON com dados de clientes
- [ ] Se receber erro 401: API Key inválida
- [ ] Se receber erro 404: URL da API incorreta

## Passo 4: Configurar Webhooks

### No Painel Asaas:

- [ ] Vá em **Configurações** > **Webhooks**
- [ ] Clique em **"Adicionar Webhook"** ou **"Novo Webhook"**
- [ ] Configure:
  - **URL**: `https://seu-app.vercel.app/api/webhooks/asaas`
  - **Eventos a Receber**: Selecione todos ou os desejados
  - **Status**: Ativo

#### Eventos Recomendados:
- [ ] PAYMENT_CREATED
- [ ] PAYMENT_UPDATED
- [ ] PAYMENT_CONFIRMED
- [ ] PAYMENT_RECEIVED
- [ ] PAYMENT_OVERDUE
- [ ] SUBSCRIPTION_CREATED
- [ ] SUBSCRIPTION_UPDATED

- [ ] Salve o webhook
- [ ] Teste o webhook clicando em **"Testar"** no painel Asaas

### Verificar Recebimento:

- [ ] Após o teste, verifique os logs da aplicação
- [ ] No Vercel, vá em **Deployments** > [última implantação] > **Functions**
- [ ] Procure por logs da função `/api/webhooks/asaas`
- [ ] Deve aparecer: `[v0] Webhook received: [tipo_evento]`

## Passo 5: Testar Funcionalidades

### Criar Cliente:
- [ ] Acesse: **Pagamentos** > **Clientes**
- [ ] Clique em **"Novo Cliente"**
- [ ] Preencha os dados e salve
- [ ] Verifique se o cliente aparece na lista
- [ ] Confirme no painel Asaas que o cliente foi criado

### Criar Cobrança:
- [ ] Acesse: **Pagamentos** > **Cobranças**
- [ ] Clique em **"Nova Cobrança"**
- [ ] Selecione um cliente
- [ ] Escolha o tipo: PIX, Boleto ou Cartão
- [ ] Defina valor e vencimento
- [ ] Salve e verifique se foi criada

### Criar Assinatura:
- [ ] Acesse: **Pagamentos** > **Assinaturas**
- [ ] Clique em **"Nova Assinatura"**
- [ ] Selecione um cliente
- [ ] Configure a recorrência (Mensal, Anual, etc.)
- [ ] Salve e verifique se foi criada

### Dashboard:
- [ ] Acesse: **Pagamentos** > **Dashboard**
- [ ] Verifique se as métricas estão carregando:
  - [ ] Total Recebido
  - [ ] Aguardando Pagamento
  - [ ] Vencidas
  - [ ] MRR (Monthly Recurring Revenue)
  - [ ] Assinaturas Ativas
  - [ ] Taxa de Churn

## Passo 6: Monitoramento

### Logs e Debugging:

- [ ] Configure alertas no Vercel para erros de função
- [ ] Monitore a página de status: https://status.asaas.com
- [ ] Verifique periodicamente os logs de webhook no painel Asaas
- [ ] Configure notificações por email no painel Asaas

### Health Check:

- [ ] Crie um teste automatizado para verificar a conexão
- [ ] Configure um cron job ou monitor para testar a API periodicamente
- [ ] Documente contatos de suporte do Asaas caso precise de ajuda

## Solução de Problemas Comuns

### Erro: "ASAAS_API_KEY not configured"
- [ ] Verifique se a variável foi adicionada no Vercel
- [ ] Confirme se fez redeploy após adicionar
- [ ] Verifique se não há espaços extras na chave

### Erro: "Unauthorized" (401)
- [ ] Verifique se a API Key está correta
- [ ] Confirme se está usando o ambiente certo (sandbox vs produção)
- [ ] Gere uma nova API Key se necessário

### Erro: "Not Found" (404)
- [ ] Verifique se NEXT_PUBLIC_ASAAS_API_URL está correta
- [ ] Confirme o ambiente: sandbox ou produção
- [ ] Verifique se o endpoint existe na documentação

### Webhooks não funcionam
- [ ] Teste a URL do webhook manualmente (curl/Postman)
- [ ] Verifique se a URL está acessível publicamente
- [ ] Confira os logs do webhook no painel Asaas
- [ ] Verifique se a função está habilitada no Vercel

## Próximos Passos

- [ ] Documente o processo interno da sua equipe
- [ ] Crie backups regulares dos dados
- [ ] Implemente testes automatizados
- [ ] Configure ambiente de staging
- [ ] Planeje migração de sandbox para produção

## Recursos Úteis

- Documentação Asaas: https://docs.asaas.com
- Status da API: https://status.asaas.com
- Discord Asaas: https://discord.gg/asaas
- Suporte: https://ajuda.asaas.com

---

**Última atualização:** 2026-02-19
**Versão:** 1.0

Salve este checklist e consulte sempre que precisar configurar ou resolver problemas!
