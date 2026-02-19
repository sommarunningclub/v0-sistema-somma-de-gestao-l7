# Integração Asaas - Guia Completo

## Visão Geral

Este projeto integra com a API do Asaas para gerenciamento de pagamentos, cobranças e assinaturas.

Documentação oficial: https://docs.asaas.com/docs/visao-geral

## Pré-requisitos

1. Conta Asaas (Produção ou Sandbox)
   - Produção: https://www.asaas.com/
   - Sandbox: https://sandbox.asaas.com/

2. API Key gerada no painel Asaas
   - Acesse: Configurações > Integrações > API Key

## Configuração de Variáveis de Ambiente

Você precisa configurar as seguintes variáveis de ambiente:

### 1. NEXT_PUBLIC_ASAAS_API_URL

Define qual ambiente você está usando:

**Produção:**
```
NEXT_PUBLIC_ASAAS_API_URL=https://api.asaas.com/v3
```

**Sandbox (Testes):**
```
NEXT_PUBLIC_ASAAS_API_URL=https://sandbox.asaas.com/api/v3
```

### 2. ASAAS_API_KEY

Sua chave de API gerada no painel Asaas:

```
ASAAS_API_KEY=sua_chave_api_aqui
```

**Como obter:**
1. Acesse o painel Asaas
2. Vá em Configurações > Integrações
3. Clique em "Gerar API Key"
4. Copie a chave gerada

### 3. ASAAS_WALLET_ID (Opcional)

ID da carteira, caso utilize sub-contas:

```
ASAAS_WALLET_ID=sua_wallet_id_aqui
```

## Funcionalidades Implementadas

### Clientes
- Listar clientes
- Criar novo cliente
- Buscar cliente por ID

### Cobranças
- Listar cobranças
- Criar nova cobrança (Boleto, PIX, Cartão)
- Buscar cobrança por ID
- Verificar visualização de cobrança

### Assinaturas
- Listar assinaturas
- Criar nova assinatura recorrente
- Buscar assinatura por ID
- Listar pagamentos de uma assinatura

### Dashboard
- Métricas mensais (recebido, aguardando, vencido)
- MRR (Monthly Recurring Revenue)
- Taxa de churn
- Assinaturas ativas

### Webhooks
- Recebimento automático de eventos do Asaas
- Processamento de mudanças de status de pagamentos
- Idempotência (evita processamento duplicado)

## Estrutura de Arquivos

```
lib/
  services/
    asaas-api.ts          # Cliente da API Asaas
  types/
    asaas.ts              # Tipos TypeScript

app/
  api/
    asaas/
      route.ts            # Proxy API para frontend
    webhooks/
      asaas/
        route.ts          # Recebimento de webhooks
```

## Como Testar a Integração

### 1. Verificar Conexão

```bash
curl -X GET "https://seu-app.vercel.app/api/asaas?endpoint=/customers&limit=1"
```

### 2. Criar Cliente de Teste

```bash
curl -X POST "https://seu-app.vercel.app/api/asaas?endpoint=/customers" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Cliente Teste",
    "cpfCnpj": "12345678909",
    "email": "teste@exemplo.com"
  }'
```

### 3. Configurar Webhook

No painel Asaas:
1. Vá em Configurações > Webhooks
2. Adicione a URL: `https://seu-app.vercel.app/api/webhooks/asaas`
3. Selecione os eventos que deseja receber

## Eventos de Webhook Suportados

- `PAYMENT_CREATED` - Pagamento criado
- `PAYMENT_UPDATED` - Pagamento atualizado
- `PAYMENT_CONFIRMED` - Pagamento confirmado
- `PAYMENT_RECEIVED` - Pagamento recebido
- `PAYMENT_OVERDUE` - Pagamento vencido
- `PAYMENT_DELETED` - Pagamento deletado
- `SUBSCRIPTION_CREATED` - Assinatura criada
- `SUBSCRIPTION_UPDATED` - Assinatura atualizada
- `SUBSCRIPTION_DELETED` - Assinatura deletada

## Segurança

1. **Nunca** exponha sua API Key no frontend
2. Use sempre rotas de API (`/api/asaas`) como proxy
3. Valide webhooks para garantir autenticidade
4. Use HTTPS em produção
5. Implemente rate limiting

## Ambiente Sandbox vs Produção

### Sandbox (Desenvolvimento)
- Use para testes e desenvolvimento
- Não processa pagamentos reais
- API Key diferente da produção
- URL: `https://sandbox.asaas.com/api/v3`

### Produção
- Use apenas quando pronto para lançar
- Processa pagamentos reais
- Requer documentação aprovada
- URL: `https://api.asaas.com/v3`

## Solução de Problemas

### Erro: "ASAAS_API_KEY not configured"
- Verifique se a variável está configurada no painel Vercel
- Confira se não há espaços extras ou caracteres especiais

### Erro: "Unauthorized" (401)
- API Key inválida ou expirada
- Gere uma nova API Key no painel Asaas

### Erro: "Not Found" (404)
- Verifique se a URL da API está correta
- Confirme se está usando o ambiente correto (sandbox vs produção)

### Webhooks não funcionando
- Verifique se a URL está acessível publicamente
- Teste a rota manualmente com curl/Postman
- Confira os logs do webhook no painel Asaas

## Recursos Adicionais

- [Documentação Oficial](https://docs.asaas.com)
- [Referência da API](https://docs.asaas.com/reference)
- [Discord da Comunidade](https://discord.gg/asaas)
- [Status da API](https://status.asaas.com)

## Próximos Passos

1. Configure as variáveis de ambiente
2. Teste a conexão com a API
3. Configure os webhooks
4. Implemente as funcionalidades necessárias
5. Teste em sandbox antes de produção
6. Faça deploy em produção

---

**Última atualização:** 2026-02-19
**Versão da API Asaas:** v3
