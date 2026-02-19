# Integração Asaas - Documentação Completa

## 🔑 Variáveis de Ambiente

As seguintes variáveis de ambiente devem estar configuradas no projeto Vercel:

- `ASAAS_API_KEY`: Chave de API do Asaas (obrigatória)
- `ASAAS_BASE_URL`: URL base da API (padrão: `https://api.asaas.com/v3`)
- `ASAAS_WALLET_ID`: ID da carteira Asaas (opcional)

## 📁 Estrutura de Arquivos

### Rotas da API

- **`/app/api/asaas/route.ts`**: Proxy principal para a API do Asaas
  - Métodos: GET, POST, PUT, DELETE
  - Uso: `/api/asaas?endpoint=/customers`

- **`/app/api/asaas/test/route.ts`**: Rota de teste para validar a configuração
  - Método: GET
  - Uso: `/api/asaas/test`

### Serviços

- **`/lib/services/asaas-api.ts`**: Serviço principal de comunicação com Asaas
  - Funções para clientes, cobranças, assinaturas e métricas do dashboard

- **`/lib/services/charges.ts`**: Serviço de gerenciamento de cobranças
  - Integração entre banco de dados local e Asaas

- **`/lib/services/payments.ts`**: Serviço de pagamentos e métricas
  - Calcula MRR, churn rate e outras métricas

### Páginas

- **`/app/diagnostico-asaas/page.tsx`**: Página de diagnóstico e testes
  - Interface visual para validar todas as rotas da API

## 🛠️ Rotas Disponíveis

### Clientes

#### Listar Clientes
```
GET /api/asaas?endpoint=/customers&limit=100&offset=0
```

#### Buscar Cliente
```
GET /api/asaas?endpoint=/customers/{customerId}
```

#### Criar Cliente
```
POST /api/asaas?endpoint=/customers
Body: {
  "name": "João Silva",
  "cpfCnpj": "12345678901",
  "email": "joao@example.com",
  "mobilePhone": "11999999999"
}
```

#### Atualizar Cliente
```
PUT /api/asaas?endpoint=/customers/{customerId}
Body: { campos para atualizar }
```

#### Deletar Cliente
```
DELETE /api/asaas?endpoint=/customers/{customerId}
```

### Assinaturas

#### Listar Assinaturas
```
GET /api/asaas?endpoint=/subscriptions&limit=100&status=ACTIVE
```

Filtros disponíveis:
- `status`: ACTIVE, INACTIVE
- `customer`: ID do cliente
- `limit`: Limite de resultados
- `offset`: Paginação

#### Buscar Assinatura
```
GET /api/asaas?endpoint=/subscriptions/{subscriptionId}
```

#### Criar Assinatura
```
POST /api/asaas?endpoint=/subscriptions
Body: {
  "customer": "cus_000000000000",
  "billingType": "CREDIT_CARD",
  "value": 99.90,
  "nextDueDate": "2024-02-01",
  "cycle": "MONTHLY",
  "description": "Plano Premium"
}
```

Ciclos disponíveis:
- `MONTHLY`: Mensal
- `QUARTERLY`: Trimestral
- `SEMIANNUALLY`: Semestral
- `YEARLY`: Anual

#### Atualizar Assinatura
```
PUT /api/asaas?endpoint=/subscriptions/{subscriptionId}
Body: { campos para atualizar }
```

#### Deletar Assinatura
```
DELETE /api/asaas?endpoint=/subscriptions/{subscriptionId}
```

### Pagamentos

#### Listar Pagamentos
```
GET /api/asaas?endpoint=/payments&limit=100&status=PENDING
```

Filtros disponíveis:
- `status`: PENDING, RECEIVED, CONFIRMED, OVERDUE, REFUNDED, CANCELLED
- `customer`: ID do cliente
- `subscription`: ID da assinatura
- `dateCreated[ge]`: Data de criação maior ou igual (formato: YYYY-MM-DD)
- `dateCreated[le]`: Data de criação menor ou igual (formato: YYYY-MM-DD)

#### Buscar Pagamento
```
GET /api/asaas?endpoint=/payments/{paymentId}
```

#### Criar Pagamento
```
POST /api/asaas?endpoint=/payments
Body: {
  "customer": "cus_000000000000",
  "billingType": "BOLETO",
  "value": 150.00,
  "dueDate": "2024-02-15",
  "description": "Pagamento de mensalidade",
  "externalReference": "REF123"
}
```

Tipos de cobrança:
- `BOLETO`: Boleto bancário
- `CREDIT_CARD`: Cartão de crédito
- `PIX`: PIX
- `UNDEFINED`: Indefinido (permite múltiplas formas)

#### Buscar Informações de Visualização
```
GET /api/asaas?endpoint=/payments/{paymentId}/viewingInfo
```

Retorna:
- `hasBeenViewed`: Se foi visualizado
- `viewedDate`: Data da visualização
- `viewCount`: Número de visualizações

## 🧪 Como Testar

### 1. Teste Rápido via Navegador

Acesse: `https://seu-dominio.vercel.app/api/asaas/test`

Resposta esperada:
```json
{
  "success": true,
  "message": "Asaas API connection successful",
  "totalCustomers": 123,
  "envVars": {
    "ASAAS_API_KEY": "present (length: 64)",
    "ASAAS_BASE_URL": "https://api.asaas.com/v3",
    "ASAAS_WALLET_ID": "present"
  }
}
```

### 2. Teste Completo via Interface

Acesse: `https://seu-dominio.vercel.app/diagnostico-asaas`

Esta página executa os seguintes testes:
1. ✅ Configuração da API Key
2. ✅ GET /customers
3. ✅ GET /subscriptions
4. ✅ GET /payments
5. ✅ GET /subscriptions?status=ACTIVE

### 3. Teste via cURL

```bash
# Testar configuração
curl https://seu-dominio.vercel.app/api/asaas/test

# Listar clientes
curl https://seu-dominio.vercel.app/api/asaas?endpoint=/customers&limit=5

# Listar assinaturas ativas
curl https://seu-dominio.vercel.app/api/asaas?endpoint=/subscriptions&status=ACTIVE&limit=5
```

## 🔍 Diagnóstico de Problemas

### Erro: "ASAAS_API_KEY not configured"

**Causa**: A variável de ambiente não está configurada ou não está sendo lida.

**Solução**:
1. Verificar se a variável está configurada no Vercel (Settings > Environment Variables)
2. Verificar se o deploy foi feito após adicionar a variável
3. Forçar um novo deploy se necessário

### Erro: "Asaas API returned error"

**Causa**: A API do Asaas retornou um erro (autenticação, limite de rate, etc.)

**Solução**:
1. Verificar os logs do servidor para ver o erro exato
2. Confirmar que a chave de API é válida
3. Verificar se não está usando a chave do sandbox em produção

### Erro: "Failed to fetch"

**Causa**: Problema de rede ou timeout

**Solução**:
1. Verificar conectividade com a API do Asaas
2. Verificar se há bloqueio de firewall
3. Aumentar timeout se necessário

## 📊 Métricas do Dashboard

O sistema calcula automaticamente as seguintes métricas:

- **MRR (Monthly Recurring Revenue)**: Receita recorrente mensal
- **Received**: Total recebido no período
- **Awaiting**: Total aguardando pagamento
- **Overdue**: Total vencido
- **Active Subscriptions**: Número de assinaturas ativas
- **Churn Rate**: Taxa de cancelamento

Fonte: Busca DIRETA da API Asaas em tempo real.

## 🔐 Segurança

- ✅ API Key nunca exposta ao cliente
- ✅ Todas as chamadas passam pelo proxy Next.js
- ✅ Headers de autenticação adicionados no servidor
- ✅ Logs detalhados para debugging
- ✅ Validação de endpoints

## 📝 Convenções

- Use sempre o formato de data `YYYY-MM-DD`
- Valores monetários em número decimal (ex: 99.90)
- CPF/CNPJ sem pontuação
- Telefone com DDD sem espaços (ex: 11999999999)

## 🚀 Status da Integração

- ✅ Rota principal (`/api/asaas/route.ts`)
- ✅ Rota de teste (`/api/asaas/test/route.ts`)
- ✅ Serviço de API (`lib/services/asaas-api.ts`)
- ✅ Serviço de cobranças (`lib/services/charges.ts`)
- ✅ Serviço de pagamentos (`lib/services/payments.ts`)
- ✅ Página de diagnóstico (`/diagnostico-asaas`)
- ✅ Integração com clientes Asaas
- ✅ Integração com assinaturas
- ✅ Integração com pagamentos
- ✅ Cálculo de métricas

## 📅 Última Atualização

Data: 19/02/2026
Status: ✅ Todas as rotas funcionais e validadas
