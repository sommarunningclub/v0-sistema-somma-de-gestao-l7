# Módulo "Clientes Assessoria" - Guia de Integração e Sincronização

## Visão Geral

O módulo "Clientes Assessoria" foi completamente redesenhado e aprimorado com as seguintes funcionalidades:

1. **Sincronização Bidirecional com Asaas**
2. **Filtros Avançados**
3. **Interface Melhorada com Estatísticas**

## 📊 Novas Funcionalidades

### 1. Sincronização com Asaas

O sistema agora sincroniza automaticamente os clientes cadastrados no Asaas com o banco de dados local (Supabase).

**Tabelas Criadas:**
- `asaas_customers_sync` - Armazena dados sincronizados dos clientes
- `asaas_sync_logs` - Registra histórico de sincronizações

**Campos Sincronizados:**
- ID do cliente (Asaas)
- Nome completo
- Email
- Telefone
- CPF/CNPJ
- Status (ativo/inativo)
- Endereço completo
- Emails adicionais
- Tipo de cobrança
- Data de vencimento
- Status de assinatura
- Data da última sincronização

### 2. Serviço de Sincronização

**Arquivo:** `lib/services/asaas-sync.ts`

**Funções principais:**
```typescript
// Sincronizar clientes do Asaas
syncCustomersFromAsaas(limit: number, offset: number)

// Obter clientes sincronizados
getSyncedCustomers(limit: number, offset: number)

// Filtrar clientes com múltiplos critérios
filterSyncedCustomers(searchTerm?, status?, limit?, offset?)

// Obter logs de sincronização
getSyncLogs(limit: number)
```

### 3. Rota de API para Sincronização

**Endpoint:** `POST /api/customers-sync`
- Inicia sincronização manual dos clientes

**Endpoint:** `GET /api/customers-sync`
- Recupera clientes sincronizados
- Suporta filtros: `search`, `status`, `limit`, `offset`
- Ação `count` para obter total de clientes

### 4. Componentes UI

**CustomerFilters** (`components/customer-filters.tsx`)
- Busca por nome, email ou CPF/CNPJ
- Filtro por status (ativo/inativo/arquivado)
- Filtro por tipo de pessoa (PF/PJ)
- Ordenação customizável
- Filtro por data de criação

**CustomerStats** (`components/customer-stats.tsx`)
- Total de clientes
- Total de clientes ativos
- Total de clientes inativos
- Data da última sincronização
- Percentuais de atividade

## 🔄 Fluxo de Sincronização

1. Usuário clica em "Sincronizar com Asaas"
2. Sistema faz requisição POST para `/api/customers-sync`
3. Serviço `asaas-sync.ts` busca clientes da API Asaas
4. Clientes são inseridos ou atualizados no Supabase
5. Log de sincronização é registrado
6. Toast notifica o usuário sobre o resultado

## 📋 Filtros Avançados

### Tipo de Filtro: Status
- Todos
- Ativo
- Inativo
- Arquivado

### Tipo de Filtro: Pessoa
- Todos
- Pessoa Física (PF)
- Pessoa Jurídica (PJ)

### Ordenação
- Nome (alfabético)
- Data de Criação
- Última Sincronização

### Intervalo de Datas
- Data inicial e final customizáveis

## 🛠️ Configuração

### Variáveis de Ambiente Necessárias

```
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anonima
ASAAS_API_KEY=sua-chave-api-asaas
ASAAS_WALLET_ID=seu-wallet-id
```

### Execução de Scripts SQL

Para aplicar as mudanças do banco de dados:

```bash
npm run db:migrate
# ou
npx supabase migration up
```

## 📈 Estatísticas Disponíveis

A nova seção de estatísticas fornece:

- **Total de Clientes**: Contagem total de clientes cadastrados
- **Clientes Ativos**: Número e percentual de clientes ativos
- **Clientes Inativos**: Número e percentual de clientes inativos
- **Última Sincronização**: Data e hora da última sincronização bem-sucedida

## 🚀 Próximos Passos (Sugestões)

1. **Agendamento de Sincronização**: Implementar sincronização automática em intervalos
2. **Exportação de Dados**: Adicionar exportação para CSV/Excel
3. **Dashboard Avançado**: Criar gráficos com análises de clientes
4. **Webhooks**: Sincronização em tempo real via webhooks do Asaas
5. **Segmentação**: Criar grupos de clientes para ações em massa

## 📝 Notas de Desenvolvimento

- O serviço de sincronização trata clientes duplicados atualizando registros existentes
- Todos os erros de sincronização são logados e podem ser consultados em `asaas_sync_logs`
- A paginação é implementada em todas as consultas para performance
- Filtros suportam buscas case-insensitive

## 🔐 Segurança

- Chaves de API do Asaas armazenadas em variáveis de ambiente
- Operações de banco de dados usando prepared statements
- Validação de entrada em todos os filtros
- Logs de auditoria de sincronizações

---

**Versão:** 1.0.0  
**Data:** 2024  
**Status:** Pronto para Produção
