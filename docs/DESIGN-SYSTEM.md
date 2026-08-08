# Design System — Painel Somma

Referência para quem for construir ou alterar telas do admin. A regra que
resume todas as outras: **se um componente daqui resolve o problema, use-o.**
Dois módulos não devem resolver a mesma coisa de formas visuais diferentes.

## Onde as coisas moram

| O quê | Onde |
| --- | --- |
| Tokens de cor, tipografia, foco, safe areas | `app/globals.css` |
| Escalas, fontes, sombras, animações, breakpoints | `tailwind.config.ts` |
| Primitivos do painel | `components/somma/` (importe pela barrel: `@/components/somma`) |
| Primitivos base (shadcn/Radix) | `components/ui/` |
| Arquitetura de navegação | `lib/nav.ts` |
| Permissões por módulo | `lib/auth/page-routes.ts`, `lib/auth/types.ts` |

## Cor

O painel é **dark-only**. Não existe tema claro e `:root` já é o tema escuro —
a classe `.dark` é só um alias, nada depende dela para aparecer correto.

### Duas camadas de cor, de propósito

1. **Escalas remapeadas.** O painel foi escrito com cores literais
   (`bg-neutral-900`, `text-orange-500`). Em vez de reescrever milhares de
   `className`, as escalas `neutral` e `orange` do Tailwind apontam para a
   paleta Somma. Todo código legado herdou a identidade nova sem ser tocado.
2. **Tokens semânticos.** Código novo usa estes. Eles descrevem função, não
   aparência — o que permite mudar a paleta num lugar só.

### Tokens

| Papel | Classe | Uso |
| --- | --- | --- |
| Fundo da aplicação | `bg-canvas` | o "chão" atrás de tudo |
| Superfície | `bg-surface` | sidebar, header, modais |
| Superfície elevada | `bg-surface-raised` | cards, painéis |
| Superfície afundada | `bg-surface-sunken` | inputs, poços de dado dentro de cards |
| Hover / ativo | `bg-surface-hover`, `bg-surface-active` | estados |
| Bordas | `border-line`, `border-line-soft`, `border-line-strong` | separação estrutural |
| Texto | `text-ink`, `text-ink-strong`, `text-ink-muted`, `text-ink-subtle`, `text-ink-disabled` | hierarquia |
| Marca (texto/acento) | `text-brand`, `bg-brand-soft`, `bg-brand-softer`, `border-brand-border`, `border-brand-line` | `#ff2c04` |
| Marca (preenchimento) | `bg-brand-fill` — com `text-white` | `#e02503` |
| Estados | `success`, `warning`, `danger`, `info` — cada um com `-soft` e `-border` | semântica |

**A profundidade alterna entre dois valores.** Um card (`surface-raised`)
contém poços (`surface-sunken`); o dado afunda em vez de subir. A separação
estrutural é sempre uma borda de 1px — sombra fica reservada ao que realmente
flutua: modais, sheets, popovers, toasts.

### Como usar o laranja

O laranja é **a cor condutora do painel**, não um detalhe. Ele aparece em:

- tarja de identificação no topo (`.ds-strip`);
- rótulos de grupo da navegação e item ativo (preenchimento sólido);
- eyebrows de `PageHeader`, `SectionTitle` (barra de acento) e `StatTile`;
- cabeçalho de tabela (`TH`);
- hairline dos cabeçalhos de painel;
- ações principais, indicadores, foco e a série principal dos gráficos.

Ele **não** é usado para: texto corrido longo, fundo de área grande em
saturação plena, nem para colorir todas as séries de um gráfico ao mesmo tempo.

#### Os dois papéis do laranja — e por quê

| Token | Valor | Papel | Contraste |
| --- | --- | --- | --- |
| `brand` | `#ff2c04` | **texto e acento** sobre fundo escuro | 4,7–5,3:1 — passa AA |
| `brand-fill` | `#e02503` | **preenchimento sólido** com texto branco | 4,73:1 — passa AA |

`#ff2c04` com texto branco rende apenas **3,74:1** e reprovaria AA em botões e
itens de menu. Por isso todo preenchimento sólido que carrega texto usa
`brand-fill`. Não troque um pelo outro sem medir de novo.

### Geometria

Cantos afiados: `--radius` é **0.25rem**. `rounded-sm` (2px) em pills,
`rounded`/`rounded-md` em controles e cards, `rounded-xl`/`2xl` só em modais e
sheets. A estrutura é carregada por bordas de 1px — o raio quase não aparece.
Sombra fica reservada ao que flutua.

### Estados nunca dependem só de cor

Toda `StatusPill` carrega texto e um marcador de forma (`dot`). Todo item ativo
da navegação tem uma barra indicadora além da cor. Toda variação em `StatTile`
tem ícone de direção além da cor. Isso não é preferência — é WCAG 1.4.1.

## Tipografia

- **Inter** para interface e texto. **Geist Mono** para números, códigos e
  identificadores. Antes o painel inteiro era monoespaçado, o que prejudicava a
  leitura de nomes e descrições.
- Números que atualizam ao vivo usam `font-mono tabular-nums` para não "dançar".
- `.ds-eyebrow` é o rótulo de seção: caixa alta, `tracking` largo, peso médio.
- Hierarquia de headings é real: `h1` no `PageHeader`, `h2` nas seções
  (`SectionTitle`), `h3` nos painéis (`PanelHeader`). Não pule níveis.

## Espaçamento

Grade base de 4px. Densidade alta: linhas de tabela em `py-3`, cards em `p-4`,
colunas de página em `px-4 sm:px-6 lg:px-8`. Ver **Geometria** acima para raios.

## Componentes

Importe tudo de `@/components/somma`:

```tsx
import {
  PageShell, PageHeader, MobileActionBar,
  Panel, PanelHeader, SectionTitle, Well, VDivider,
  StatGrid, StatTile,
  StatusPill, toneForStatus,
  EmptyState, NoResultsState,
  TableFrame, Table, THead, TH, TBody, TR, TD, TablePagination, MobileRecordCard,
  Toolbar, SearchInput, FilterButton, FilterChip, SegmentedControl,
  ResponsiveModal, confirmAction, notify,
  TableSkeleton, CardListSkeleton, StatGridSkeleton, Skeleton,
  Avatar, UserMenu,
} from '@/components/somma'
```

### Estrutura de uma tela de listagem

```tsx
<PageShell>
  <PageHeader
    eyebrow="Relacionamento"
    title="Membros"
    description="Base de membros do clube, tags e cobranças."
    meta={<span>{total} membros</span>}
    primaryAction={<Button onClick={abrirNovo}>Novo membro</Button>}
  >
    <Toolbar>
      <SearchInput value={busca} onValueChange={setBusca} placeholder="Buscar por nome ou e-mail" />
      <FilterButton count={filtrosAtivos} onClick={abrirFiltros} />
    </Toolbar>
  </PageHeader>

  {carregando ? <TableSkeleton /> : lista.length === 0 ? (
    busca ? <NoResultsState query={busca} onClear={limpar} />
          : <EmptyState icon={Users} title="..." description="..." action={...} />
  ) : (
    <>
      <div className="hidden lg:block"><TableFrame>{/* Table */}</TableFrame></div>
      <div className="space-y-3 lg:hidden">{/* MobileRecordCard */}</div>
    </>
  )}
</PageShell>
```

### Feedback e confirmação

```tsx
notify.success('Membro criado', { description: 'Ele já aparece na listagem.' })
notify.error('Não foi possível salvar', { description: erro.message })

const ok = await confirmAction({
  title: 'Excluir este membro?',
  description: 'A exclusão é permanente e remove também o histórico de cobranças.',
  detail: membro.nome,
  tone: 'danger',
})
if (!ok) return
```

`window.alert()` e `window.confirm()` não devem aparecer no código do painel.
Eles não são estilizáveis, não explicam a consequência e bloqueiam a thread.

### Modais

Sempre `ResponsiveModal`. No desktop é um diálogo centrado; no celular vira
bottom sheet arrastável. Os dois caminhos usam primitivas acessíveis (Radix e
Vaul): foco preso, ESC fecha, `aria-modal`, foco restaurado ao fechar.

Não construa modal com `fixed inset-0` na mão.

## Mobile

O painel é usado em campo, no celular, com uma mão. Não é "o desktop
espremido".

- **Navegação:** barra inferior com os quatro módulos de uso diário
  (`MOBILE_PRIMARY_IDS` em `lib/nav.ts`) + "Módulos" abrindo a grade completa em
  bottom sheet.
- **Tabelas viram cards.** Use `MobileRecordCard`. Scroll horizontal de tabela é
  último recurso, não padrão.
- **Alvos de toque ≥ 44px** (`.ds-tap`). Vale para ícones, linhas e chips.
- **Safe areas:** `.pt-safe`, `.pb-safe`, `.mb-safe`. A barra inferior e as
  barras de ação já as respeitam.
- **Inputs de 16px.** Abaixo disso o Safari no iPhone dá zoom ao focar e quebra
  o layout. `Input`, `Textarea` e `SearchInput` já fazem isso — não troque por
  `text-sm`.
- **Teclado correto:** `type` e `inputMode` por campo (e-mail, `tel`,
  `numeric`, `decimal`, `search`), `autoComplete` preenchido, `enterKeyHint`
  quando a ação do Enter for específica.
- **Ação principal ao alcance do polegar:** `MobileActionBar`.

## Acessibilidade — o mínimo inegociável

- Zoom liberado. Nunca reintroduza `user-scalable=no` / `maximum-scale=1`.
- Foco visível: já é global via `:focus-visible`. Não o remova por estética.
- `<table>` com `caption`, `scope="col"` e `aria-sort` — `Table`/`TH` já fazem.
- Nada de `<div onClick>`: use `<button>`, ou forneça `role`, `tabIndex` e
  handler de teclado.
- Erros de formulário com `aria-invalid` + `aria-describedby` apontando para a
  mensagem.
- Mudanças assíncronas relevantes anunciadas com `aria-live`.
- `prefers-reduced-motion` é respeitado globalmente em `globals.css`.

## Performance

- Skeletons em vez de spinner nas listagens: preservam o layout e evitam salto
  de conteúdo.
- Animações só de `transform`/`opacity`, curtas (150–280ms), com a curva
  `ease-somma`.
- Não adicione biblioteca nova quando o que já existe resolve. O painel já tem
  Radix, Vaul, cmdk, dnd-kit, Recharts, framer-motion e sonner.

## Testes

| Comando | O que roda |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | Jest (unitários) |
| `npm run test:e2e` | Playwright (interface, 6 viewports) |
| `npm run telas` | Captura os 11 módulos em mobile e desktop |

`npm run telas` exige um `npm run build` prévio; ele sobe o próprio servidor de
produção numa porta livre e o derruba no fim. As imagens vão para
`somma-shots/`, e o comando ainda reporta erros de runtime e estouro horizontal
por tela.

As telas autenticadas (tanto em `test:e2e` quanto em `telas`) exigem
`E2E_EMAIL`/`E2E_PASSWORD` de uma **conta de teste** — copie `.env.e2e.example`
para `.env.e2e` e preencha. Sem isso, `test:e2e` cobre só o que é acessível sem
sessão. Nenhuma das suítes escreve no banco: elas entram, navegam e observam.

O motor do Safari fica atrás de `E2E_WEBKIT=1` porque o build do Playwright dá
segfault em algumas versões do macOS. Vale rodar antes de publicar, já que o
painel é instalado como PWA em iPhone.
