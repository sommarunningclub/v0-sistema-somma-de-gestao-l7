# Mobile UX — Pagamentos & Check-in

**Data:** 2026-03-13
**Status:** Aprovado
**Módulos em escopo:** Pagamentos › Cobranças, Pagamentos › Clientes, Check-in & Operações
**Fora de escopo (esta iteração):** Pagamentos › Assinaturas, Pagamentos › Membros Insider, Pagamentos › Dashboard

---

## Contexto

O sistema já possui uma base mobile funcional (mobile-header, mobile-navigation, mobile-bottom-sheet, module-mobile-layout). A abordagem escolhida é **Sistema de Design Mobile**: criar padrões reutilizáveis e aplicá-los nos módulos prioritários sem reescrever a arquitetura desktop.

### Dores identificadas
- **A** — Listas difíceis de ler/navegar no toque (tabela com scroll horizontal)
- **C** — Formulários chatos no teclado mobile (muitos campos em modal único)
- **D** — Informações importantes escondidas ou cortadas na tela pequena

---

## Padrões do Sistema

### 1. PillTabBar
Tabs scrolláveis horizontalmente. Substitui menu hambúrguer para troca de sub-seção.

```typescript
interface PillTabBarProps {
  tabs: { key: string; label: string }[]
  activeTab: string
  onChange: (key: string) => void
  className?: string
}
```
- Ativo: `bg-orange-500 text-white`
- Inativo: `bg-neutral-800 text-neutral-400 border border-neutral-700`
- `py-1.5 px-3 rounded-full text-xs font-semibold whitespace-nowrap`

### 2. StickySummary
Barra de métricas fixas, visível enquanto a lista scrolla. **Substitui** o `stats` prop do `ModuleMobileLayout` — ao usar `StickySummary`, não passar `stats` para `ModuleMobileLayout`.

```typescript
interface SummaryItem {
  label: string
  value: string | number
  color: 'green' | 'yellow' | 'red' | 'orange' | 'blue' | 'neutral'
}
interface StickySummaryProps {
  items: SummaryItem[]   // max 4 itens
  className?: string
}
```

### 3. StatusCard (extensão de MobileCard)
**Estende** o `MobileCard` existente via props adicionais — não é um componente separado. Adicionar ao `mobile-card.tsx`:

```typescript
// Novas props adicionadas ao MobileCardProps existente:
borderColor?: 'green' | 'yellow' | 'red' | 'orange' | 'blue' | 'none'
expandable?: boolean
expandedContent?: React.ReactNode
defaultExpanded?: boolean
```
- Borda esquerda: `border-l-[3px]` com cor semântica
- Animação de expansão: `transition-all duration-200`
- Quando `expandable=true`, tap no card alterna `isExpanded` (estado local)

### 4. SwipeCard

```typescript
interface SwipeAction {
  key: string
  label: string
  icon: React.ReactNode
  color: 'green' | 'blue' | 'orange' | 'red'
  onTrigger: () => void | Promise<void>
}
interface SwipeCardProps {
  children: React.ReactNode
  actions: SwipeAction[]          // max 2 ações
  disabled?: boolean              // desativa swipe (ex: durante loading)
  revealThreshold?: number        // px para revelar ações (default: 60)
  autoTriggerThreshold?: number   // px para disparar ação automática (default: 120)
  className?: string
}
```

**Comportamento de swipe:**
- `onTouchStart`: registra `startX`, `startY`
- `onTouchMove`: se `|deltaY| > |deltaX|` nos primeiros 10px → cancela (scroll vertical tem prioridade)
- `revealThreshold` (60px): exibe ações com `translateX(-actionsWidth)`
- `autoTriggerThreshold` (120px): dispara `actions[0].onTrigger()` automaticamente ao soltar
- Release entre 60–120px: mantém ações visíveis até tap fora ou swipe de volta
- Release < 60px: retorna ao estado fechado (snap back)
- `disabled=true` durante loading: swipe congelado via `touch-action: none`

### 5. StepForm

```typescript
interface StepFormStep {
  title: string
  content: React.ReactNode
  isValid?: () => boolean   // bloqueia "Próximo" se retornar false
}
interface StepFormProps {
  title: string
  steps: StepFormStep[]
  onComplete: (data?: unknown) => Promise<void>
  onClose: () => void
  isOpen: boolean
  isSubmitting?: boolean
  submitError?: string | null
}
```

**Comportamento:**
- Renderizado como bottom sheet de `h-[90vh]`
- Barra de progresso: segmentos coloridos (laranja=feito, neutro=pendente)
- Botão "← Voltar" visível da etapa 2 em diante (retorna à etapa anterior)
- Botão "Próximo →" / "Confirmar": desabilitado se `isValid()` retornar `false`
- Teclado virtual (iOS): `paddingBottom: env(safe-area-inset-bottom, 16px)` + `padding-bottom` extra de 80px no container de conteúdo para não ficar sob o botão/teclado
- Viewport mínimo alvo: **iPhone SE — 375×667px** (menor dispositivo suportado)

### 6. FAB (Floating Action Button)

```typescript
interface FABProps {
  onClick: () => void
  icon?: React.ReactNode    // default: Plus
  label?: string            // se fornecido, exibido ao lado do ícone
  loading?: boolean
  className?: string
}
```
- Posição: `fixed bottom-20 right-4 z-40` (acima da bottom nav de 56px + 16px gap)
- Tamanho: `w-14 h-14` (56px — acima do mínimo iOS de 44px)
- `bg-orange-500 shadow-lg shadow-orange-500/40 rounded-full`

---

## Módulo: Pagamentos › Cobranças

### Layout mobile
```
[PillTabBar: Dashboard | Cobranças* | Clientes | Assinaturas | ...]
[StickySummary: R$ Pago (green) | R$ Pendente (yellow) | R$ Vencido (red)]
[Lista de SwipeCard > StatusCard]
[FAB: + Nova Cobrança]
```

### StatusCard — Cobrança
- Avatar: iniciais do cliente (cor derivada do nome, bg neutral-800)
- Linha 1: nome do cliente
- Linha 2: `Venc. DD/MM · FORMA_PAGAMENTO`
- Direita: valor + badge status
- `borderColor`: `green`=RECEIVED, `yellow`=PENDING, `red`=OVERDUE/CANCELLED
- `expandable=false` (cobrança expande via modal existente)

### SwipeCard — ações por status
- PENDING/OVERDUE: `[👁 Ver, 💬 Cobrar]`
- RECEIVED/CANCELLED: `[👁 Ver]`

### Nova Cobrança — StepForm (3 etapas)
**Etapa 1 — Cliente**
- Campo de busca (filtra clientes enquanto digita)
- Lista de resultados: avatar + nome + email
- `isValid`: cliente selecionado !== null

**Etapa 2 — Valor & Vencimento**
- Valor: input numérico em destaque (fonte grande, bg orange-500)
- Forma de pagamento: PIX | Cartão (botões toggles)
- Data de vencimento: date input
- Descrição: textarea opcional
- `isValid`: valor > 0 && data preenchida

**Etapa 3 — Confirmação**
- Resumo: cliente, valor, forma, vencimento, descrição
- Botão "Criar Cobrança" → `onComplete()`

**Integração com `?cliente=` URL param:**
- `useEffect` no componente pai verifica `searchParams.get('cliente')`
- Se presente → pré-seleciona cliente na etapa 1 E abre o StepForm automaticamente (pula a busca)

---

## Módulo: Pagamentos › Clientes

### Layout mobile
```
[Busca + botão Filtros]
[StickySummary: Total (orange) | Ativos (green) | Inativos (neutral)]
[Lista de SwipeCard > StatusCard com expandable=true]
[FAB: + Novo Cliente]
```

### StatusCard — Cliente (expandable)
- Avatar: iniciais (cor derivada do nome)
- Linha 1: nome
- Linha 2: email truncado
- Direita: LTV + badge (Ativo verde / Inativo cinza)
- `borderColor`: `green`=ativo, `neutral`=inativo
- `expandedContent`: grid 2 cols com campos (e-mail, telefone, CPF/CNPJ, grupo) + ações (Ver detalhes, Nova cobrança)

### SwipeCard — ações
- `[👁 Ver detalhes, 📄 Nova cobrança]`

---

## Módulo: Check-in & Operações

### Layout mobile
```
[PillTabBar: Hoje* | Semana | Mês]
[StickySummary: Total (orange) | Validados (green) | Pendentes (yellow)]
[Busca + botão Filtros (com badge de contagem ativa)]
[Lista de SwipeCard > StatusCard com expandable=true]
[FAB: + Novo Check-in]
```

### StatusCard — Check-in (expandable)
- Avatar: iniciais (cor por pelotão: Alfa=orange, Bravo=blue, Charlie=purple, Delta=green)
- Linha 1: nome do membro
- Linha 2: `HH:MM · Pelotão`
- Badge inline: nome do pelotão
- Direita: botão "Validar" / "✓ OK" (direto no card, sem abrir modal)
- `borderColor`: `green`=validado, `yellow`=pendente
- `expandedContent`: CPF, telefone, e-mail, hora + ações (Validar, Editar, Excluir)

**Loading state no botão Validar:**
- O card recebe prop `isUpdating?: boolean` (derivado do `updatingId` state da page)
- Enquanto `isUpdating=true`: botão desabilitado com spinner, swipe `disabled=true`
- Após resolução: border/badge atualiza com dado fresh do state da page

### SwipeCard — ações
- `[✓ Validar (green), 👁 Ver (blue)]` — "Validar" chama `handleToggleValidation(id)` da page
- Se já validado: `[↩ Desvalidar (yellow), 👁 Ver (blue)]`

### Filtros — Bottom Sheet
Chips multi-select agrupados:
- **Pelotão**: Todos | Alfa | Bravo | Charlie | Delta | …
- **Status**: Todos | Validados | Pendentes
- Badge no botão de filtros: contagem de filtros ativos (ex: "2")

### Novo Check-in — StepForm (2 etapas)
**Etapa 1 — Membro**
- Busca por nome/CPF, lista de resultados
- `isValid`: membro selecionado !== null

**Etapa 2 — Detalhes**
- Pelotão: selector visual (chips)
- Hora: time input (default: hora atual)
- Botão "Registrar Check-in" → `onComplete()`

---

## Empty States

Todos os três módulos mostram o mesmo padrão de empty state quando a lista está vazia:

```tsx
// Quando não há registros (sem filtros)
<div className="flex flex-col items-center justify-center py-16 gap-3">
  <Icon className="w-10 h-10 text-neutral-600" />
  <p className="text-neutral-500 text-sm font-medium">Nenhum registro encontrado</p>
  <p className="text-neutral-600 text-xs">Toque em + para criar o primeiro</p>
</div>

// Quando filtros ativos retornam zero
<div className="flex flex-col items-center justify-center py-16 gap-3">
  <FilterX className="w-10 h-10 text-neutral-600" />
  <p className="text-neutral-500 text-sm font-medium">Nenhum resultado</p>
  <button onClick={clearFilters} className="text-orange-400 text-xs">Limpar filtros</button>
</div>
```

---

## Arquitetura de Implementação

### Novos componentes (em `components/mobile/`)
- `swipe-card.tsx`
- `pill-tab-bar.tsx`
- `sticky-summary.tsx`
- `step-form.tsx`
- `fab.tsx`

### Componente modificado
- `components/mobile/mobile-card.tsx` — adicionar props `borderColor`, `expandable`, `expandedContent`, `defaultExpanded`, `isUpdating`

### Páginas modificadas (apenas bloco mobile `md:hidden`)
- `app/pagamentos/cobrancas/page.tsx`
- `app/pagamentos/clientes/page.tsx`
- `app/checkin/page.tsx`

### Desktop inalterado
- Novos componentes ficam exclusivamente em blocos `md:hidden`
- Nenhum `md:hidden` wrapping de elementos que já eram visíveis no desktop
- Viewport de referência para regressão desktop: Chrome 1280px

---

## Critérios de Sucesso
- [ ] Sem scroll horizontal em nenhuma lista mobile (sem `overflow-x` nos containers de lista)
- [ ] Ação principal (validar check-in, criar cobrança) alcançável em ≤ 2 toques
- [ ] Todos os campos de cada etapa visíveis sem scroll no iPhone SE (375×667px)
- [ ] Todos os touch targets ≥ 44px
- [ ] Desktop renderiza corretamente no Chrome 1280px — nenhuma regressão visual
