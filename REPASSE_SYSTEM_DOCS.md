# Sistema de Repasse de Professores - Documentação

## Visão Geral

O sistema de repasse permite que a Somma controle quais professores recebem repasse (quando `enable_repasse = false`, Somma não cobra taxa de comissão daquele professor).

## Tabelas no Banco

### `professor_repasse_settings`
Controla as configurações de repasse por professor:
- `id`: UUID primária
- `professor_id`: Referência para a tabela `professors`
- `enable_repasse`: Boolean (true = Somma cobra taxa | false = Professor recebe repasse)
- `notes`: Campo opcional para anotações
- `created_at` / `updated_at`: Timestamps

## APIs

### 1. GET `/api/professores/repasse?action=list`
Retorna todas as configurações de repasse com dados do professor.

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "professor_id": "uuid",
      "enable_repasse": true,
      "notes": "Somma cobra taxa de comissão",
      "professors": {
        "id": "uuid",
        "name": "Prof. João",
        "email": "joao@email.com",
        "status": "active"
      }
    }
  ]
}
```

### 2. POST `/api/professores/repasse`
Alterna (toggle) a configuração de repasse para um professor.

**Payload:**
```json
{
  "action": "toggle",
  "professor_id": "uuid",
  "enable_repasse": false,
  "notes": "Professor recebe repasse"
}
```

**Response:**
Retorna o objeto atualizado de `professor_repasse_settings`.

### 3. GET `/api/professores/repasse/report?action=generate`
Gera o relatório completo de repasse com breakdowns por professor e aluno.

**Response:**
```json
{
  "reportLines": [
    {
      "aluno_asaas_id": "id-asaas",
      "aluno_nome": "João da Silva",
      "professor_id": "uuid",
      "professor_nome": "Prof. Pedro",
      "total_pago": 500.00,
      "somma_taxa_cobrada": 50.00,
      "professor_repasse": 450.00,
      "take_somma_fee": true
    }
  ],
  "summary": [
    {
      "professor_id": "uuid",
      "professor_nome": "Prof. Pedro",
      "professor_email": "pedro@email.com",
      "total_alunos": 5,
      "total_pago": 2500.00,
      "total_taxa_somma": 250.00,
      "total_repasse": 2250.00,
      "alunos_com_repasse": 4,
      "alunos_sem_repasse": 1
    }
  ],
  "generatedAt": "2026-02-26T10:30:00Z"
}
```

## Fluxo de Funcionamento

### 1. Admin controla quem recebe repasse
- Acesso: Menu principal → **CARTEIRAS** → **Relatório de Repasse** (aba visível apenas para Admin)
- O admin vê uma lista de professores com toggle para habilitar/desabilitar repasse
- `enable_repasse = true`: Somma cobra a taxa fixa (`commission_config.somma_fixed_fee`)
- `enable_repasse = false`: Professor recebe o valor integral (repasse)

### 2. Cálculo automático no relatório
Quando o admin clica em **"Gerar"**:
1. Sistema busca todos os professores ativos
2. Para cada professor, identifica seus clientes vinculados
3. Busca as cobranças (payments) do Asaas marcadas como "confirmed"
4. Para cada cobrança, calcula:
   - Se `enable_repasse = true`: subtrai a taxa fixa Somma
   - Se `enable_repasse = false`: professor recebe 100% do valor

### 3. Download do relatório como CSV
Admin clica em **"CSV"** para baixar uma planilha contendo:
- Aluno (ID Asaas)
- Aluno (Nome)
- Professor (ID)
- Professor (Nome)
- Total Pago
- Somma Taxa
- Repasse Professor

## Exemplo Prático

**Cenário:**
- Taxa fixa Somma: R$ 50,00 por cliente
- Prof. Alexandre: `enable_repasse = false` (recebe repasse)
- Prof. Maria: `enable_repasse = true` (Somma cobra taxa)
- Ambos têm 2 clientes cada, cada cliente paga R$ 500/mês

**Resultado no relatório:**
| Professor | Alunos | Total Pago | Somma Taxa | Repasse Prof |
|-----------|--------|-----------|-----------|-------------|
| Alexandre | 2 | R$ 1.000 | R$ 0 | R$ 1.000 |
| Maria | 2 | R$ 1.000 | R$ 100 | R$ 900 |

Alexandre recebe o valor integral porque está com repasse habilitado (seu `enable_repasse = false`).
Maria tem R$ 100 descontados porque Somma cobra taxa dela (`enable_repasse = true`).

## Permissões

- **Apenas Admins** podem acessar a aba "Relatório de Repasse"
- A verificação é feita via `isAdmin` no componente
- As APIs não têm RLS/autenticação configuradas (confiar na middleware de autenticação da app)

## Notas Importantes

1. **Taxa Fixa Somma** é configurada em `commission_config.somma_fixed_fee`
2. Apenas cobranças com `status = 'confirmed'` no Asaas são consideradas
3. O relatório é **somente leitura** — não gera registros no banco
4. Cada professor tem no máximo 1 linha na tabela `professor_repasse_settings` (UNIQUE constraint)
