# Mobile UX — Pagamentos & Check-in

**Data:** 2026-03-13
**Status:** Aprovado
**Módulos:** Pagamentos, Check-in & Operações

---

## Contexto

O sistema já possui uma base mobile funcional (mobile-header, mobile-navigation, mobile-bottom-sheet, module-mobile-layout). A abordagem escolhida é **Sistema de Design Mobile** (Opção C): criar padrões reutilizáveis e aplicá-los nos dois módulos prioritários sem reescrever toda a arquitetura.

### Dores identificadas
- **A** — Listas difíceis de ler e navegar no toque (tabela que scrolla horizontalmente)
- **C** — Formulários chatos de preencher no teclado mobile (muitos campos em modal único)
- **D** — Informações importantes escondidas ou cortadas na tela pequena

---

## Padrões do Sistema

### 1. Pill Tabs (sub-módulos)
- Scrollável horizontalmente, sem menu hambúrguer para troca de sub-seção
- Ativo: `bg-orange-500 text-white`
- Inativo: `bg-neutral-800 text-neutral-400 border border-neutral-700`
- Padding: `py-1.5 px-3 rounded-full text-xs font-semibold`

### 2. Sticky Summary Bar
- Fixo abaixo dos pill tabs, visível enquanto a lista scrolla
- Grid 3 colunas com chips coloridos por status
- Cores: verde (pago/validado), amarelo (pendente), vermelho (vencido/atrasado), laranja (total)

### 3. Status Cards com Borda Colorida
- `border-l-[3px]` colorido por status: verde=pago, amarelo=pendente, vermelho=vencido
- Avatar circular com iniciais (bg por pelotão/categoria)
- Nome + detalhe na primeira linha, info secundária abaixo
- Valor/status à direita em destaque

### 4. Card Expansível Inline
- Tap no card revela seção expandida com grid 2 colunas de campos
- Ações (Validar, Editar, Excluir) na última linha do expansion
- Animação: `transition-all duration-200`
- Sem abrir modal para detalhes simples

### 5. Swipe Actions
- Swipe-left no card revela 1–2 ações rápidas
- Implementado com `translateX` via `onTouchStart/onTouchMove/onTouchEnd`
- Threshold: 60px para revelar, 120px para ação automática
- Ações: cores semânticas (verde=validar, azul=ver, laranja=cobrar)

### 6. FAB — Floating Action Button
- Posição: `fixed bottom-20 right-4` (acima da bottom nav)
- Tamanho: `w-14 h-14` (56px, acima do mínimo iOS de 44px)
- `bg-orange-500 shadow-lg shadow-orange-500/40 rounded-full`
- Ícone Plus com label opcional

### 7. Formulário em Etapas (Bottom Sheet)
- 2–3 etapas exibidas num bottom sheet de altura total (`h-[90vh]`)
- Barra de progresso: dots ou segmentos coloridos no topo
- Cada etapa cabe na tela sem scroll
- Botão "Próximo" fixo no rodapé da etapa
- Etapa final: resumo + confirmação

### 8. Filtros em Bottom Sheet
- Chips visuais agrupados por categoria (pelotão, status, período)
- Multi-select com estado visual claro
- Botão "Aplicar" fixo no rodapé

---

## Módulo: Pagamentos

### Sub-módulos com Pill Tabs
```
Dashboard | Cobranças | Clientes | Assinaturas | Membros Insider
```

### Lista de Cobranças (mobile)
- Sticky summary: R$ Pago (verde) | R$ Pendente (amarelo) | R$ Vencido (vermelho)
- Card: avatar iniciais + nome + vencimento + forma de pagamento | valor + badge status
- Borda esquerda: verde=RECEIVED, amarelo=PENDING, vermelho=OVERDUE
- Swipe actions: 👁 Ver detalhes | 💬 Cobrar (só para PENDING/OVERDUE)
- FAB: abre formulário "Nova Cobrança"

### Nova Cobrança — 3 etapas
1. **Cliente** — busca com lista filtrada (avatar + nome + email)
2. **Valor & Vencimento** — campo de valor grande em destaque, forma de pagamento (PIX/Cartão), data, descrição opcional
3. **Confirmação** — resumo completo + botão "Criar Cobrança"

### Lista de Clientes (mobile)
- Sticky summary: Total | Ativos | Inativos
- Card: avatar + nome + email truncado + cidade/UF | LTV + badge status
- Borda: verde=ativo, cinza=inativo
- Swipe actions: 👁 Ver | 📄 Nova cobrança
- Tap expande: e-mail, telefone, CPF/CNPJ, grupo
- FAB: abre formulário "Novo Cliente" (já existe, apenas adaptar para bottom sheet)

---

## Módulo: Check-in & Operações

### Pill Tabs de período
```
Hoje | Semana | Mês
```

### Lista de Check-ins (mobile)
- Sticky summary: Total (laranja) | Validados (verde) | Pendentes (amarelo)
- Card: avatar (cor por pelotão) + nome + hora + pelotão badge | botão "Validar" direto
- Botão validar: inativo=`bg-neutral-800 text-neutral-400`, ativo=`bg-green-500/15 text-green-400`
- Swipe actions: ✓ Validar | 👁 Ver
- Tap expande: CPF, telefone, e-mail, hora — com ações Validar / Editar / Excluir

### Filtros
- Bottom sheet com chips: Pelotão (Alfa, Bravo, Charlie…) | Status | Período
- Botão de filtro no header com badge de contagem quando filtros ativos

### FAB
- Abre bottom sheet "Novo Check-in" com campos: Membro (busca), Pelotão, Hora (default: agora)

---

## Arquitetura de Implementação

### Novos componentes
- `components/mobile/swipe-card.tsx` — wrapper de card com suporte a swipe
- `components/mobile/pill-tab-bar.tsx` — tabs em pill scrollável
- `components/mobile/sticky-summary.tsx` — barra de métricas fixas
- `components/mobile/step-form.tsx` — bottom sheet multi-etapas com progresso
- `components/mobile/fab.tsx` — botão flutuante configurável

### Arquivos modificados
- `app/pagamentos/cobrancas/page.tsx` — usar novos componentes no mobile
- `app/pagamentos/clientes/page.tsx` — usar novos componentes no mobile
- `app/checkin/page.tsx` — refatorar seção mobile com novos padrões

### Sem quebrar desktop
- Todos os novos componentes ficam em blocos `md:hidden`
- Desktop continua igual (tabela, modais existentes)

---

## Critérios de Sucesso
- [ ] Sem scroll horizontal em nenhuma lista mobile
- [ ] Ação principal (validar check-in, criar cobrança) alcançável em ≤2 toques
- [ ] Todos os campos de formulário visíveis sem scroll dentro da etapa
- [ ] Todos os touch targets ≥ 44px (iOS HIG)
- [ ] Desktop inalterado (zero regressão)
