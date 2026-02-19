# Sistema de Gestão - Somma Running Club

*Automatically synced with your [v0.app](https://v0.app) deployments*

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/somma-running-clubs-projects/sistema-somma-de-gestao)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/nFMILGV0HBD)

## Visão Geral

Sistema completo de gestão para o Somma Running Club, incluindo:
- Gestão de membros e check-ins
- Sistema de pagamentos e cobranças (Asaas)
- Gestão de assinaturas recorrentes
- Gestão de parceiros e cupons
- Dashboards e inteligência operacional

## Configuração Inicial

### 1. Copie o arquivo de exemplo
```bash
cp .env.example .env.local
```

### 2. Configure as variáveis de ambiente

Edite o arquivo `.env.local` com suas credenciais:

#### Asaas (Pagamentos)
```env
NEXT_PUBLIC_ASAAS_API_URL=https://sandbox.asaas.com/api/v3
ASAAS_API_KEY=sua_chave_api_aqui
ASAAS_WALLET_ID=sua_wallet_id_aqui
```

Consulte o guia completo: [INTEGRACAO_ASAAS.md](./INTEGRACAO_ASAAS.md)

#### Supabase (Banco de Dados)
```env
NEXT_PUBLIC_SUPABASE_URL=seu_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anonima
SUPABASE_SERVICE_ROLE_KEY=sua_service_key
```

### 3. Instale as dependências
```bash
npm install
```

### 4. Execute o projeto
```bash
npm run dev
```

## Integrações

### Asaas
Sistema de pagamentos e cobranças. Veja [INTEGRACAO_ASAAS.md](./INTEGRACAO_ASAAS.md) para instruções completas.

### Supabase
Banco de dados PostgreSQL com autenticação integrada.

## Documentação

- [Integração Asaas](./INTEGRACAO_ASAAS.md)
- [Diagnóstico de Carteiras](./DIAGNOSTICO_CARTEIRAS.md)
- [Otimizações de Membros](./OTIMIZACOES_MEMBROS.md)
- [Status de Carteiras](./CARTEIRAS_STATUS.md)

## Sincronização v0

This repository will stay in sync with your deployed chats on [v0.app](https://v0.app).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.app](https://v0.app).

## Deployment

Your project is live at:

**[https://vercel.com/somma-running-clubs-projects/sistema-somma-de-gestao](https://vercel.com/somma-running-clubs-projects/sistema-somma-de-gestao)**

## Build your app

Continue building your app on:

**[https://v0.app/chat/nFMILGV0HBD](https://v0.app/chat/nFMILGV0HBD)**

## How It Works

1. Create and modify your project using [v0.app](https://v0.app)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository
