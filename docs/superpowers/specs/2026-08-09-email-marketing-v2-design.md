# E-mail Marketing v2 — Design Specification

**Data:** 2026-08-09
**Status:** Aprovado
**Base:** módulo v1 em produção (`2ae1136`)

---

## Visão geral

Três acréscimos ao módulo de E-mail Marketing, já no ar:

1. **Envio individual** — mandar para uma pessoa só, buscada na base de membros ou digitada na hora.
2. **Template de HTML próprio** — subir um arquivo `.html` e usá-lo como corpo do e-mail.
3. **Responsividade e onboarding** — corrigir as quebras de layout, aproveitar melhor a tela e explicar a jornada de envio.

### Ordem de execução

Os três tocam os mesmos arquivos. A reestruturação do modal (item 3) muda a espinha do wizard, então ela vem **primeiro**; os itens 1 e 2 são construídos em cima da estrutura nova. Fazer na ordem inversa geraria retrabalho e conflito.

---

## Descoberta que motiva o item 3

O commit `6156918 feat(admin): redesenha o painel inteiro` introduziu um design system em `components/somma/`, incluindo `ResponsiveModal` — bottom-sheet no mobile (via `vaul`), `Dialog` do Radix no desktop, com header fixo, corpo rolável, rodapé fixo, `max-h-[92dvh]`, `env(safe-area-inset-bottom)`, foco preso e ESC.

**Vinte arquivos já usam.** O wizard de e-mail não foi migrado — foi construído antes e ficou com um modal artesanal. É a causa raiz das quebras relatadas.

### Defeitos concretos hoje

| Defeito | Onde | Efeito |
|---|---|---|
| `overflow-y-auto` no painel inteiro, não só no corpo | `email-campaign-modal.tsx:255` | O rodapé com "Próximo" rola junto; no passo 2 é preciso rolar todo o formulário para achá-lo |
| `max-h-[90vh]` sem `dvh` nem safe-area | `:255` | No iOS o rodapé fica atrás da barra do navegador |
| `grid-cols-2` sem breakpoint (Data/Local) | `email-content-form.tsx:177` | Inputs com ~140px úteis abaixo de 360px |
| `grid-cols-2` sem breakpoint (CTA) | `:203` | Mesmo problema |
| `iframe h-96` fixo | `:243` | 384px fixos consomem mais da metade de uma tela de 667px |
| Labels do stepper somem em mobile | `email-campaign-modal.tsx:284` | Sobram só círculos numerados, perde-se o contexto |
| `confirm()` nativo | `:174`, `:205` | Alerta do sistema, fora do padrão do painel |

---

## Item 3 — Reestruturação, responsividade e onboarding

### Porte para `ResponsiveModal`

`EmailCampaignModal` passa a usar `ResponsiveModal` com `size="xl"`. O stepper vai para a área de título; os botões Voltar/Próximo vão para o `footer`, que passa a ser fixo. Isso resolve sozinho seis dos sete defeitos da tabela acima.

### Melhor uso da tela

No passo 2 (Conteúdo), a partir de `lg` o layout vira **duas colunas: formulário à esquerda, preview ao vivo à direita**. Abaixo de `lg` empilham como hoje, com o preview em altura proporcional ao viewport em vez de 384px fixos.

Essa é a razão de `size="xl"` (`max-w-4xl`) em vez do `max-w-2xl` atual: duas colunas não cabem em 2xl.

### Correções pontuais

- Os dois `grid-cols-2` viram `grid-cols-1 sm:grid-cols-2`.
- `confirm()` → `confirmAction` de `components/somma/confirm.tsx`.
- Os dois modais de confirmação artesanais de `app/email-marketing/page.tsx:228-276` → `confirmAction`.

### Onboarding

Cada passo do wizard ganha uma linha curta de orientação, sempre visível, sem tour e sem estado persistido:

| Passo | Orientação |
|---|---|
| 1. Audiência | Explica que a contagem já desconta duplicados e descadastrados |
| 2. Conteúdo | Explica que `{{nome}}` é trocado pelo nome de cada destinatário |
| 3. Revisão | Explica por que enviar um teste para si antes de disparar |
| 4. Disparo | Explica que o disparo é irreversível para quem já recebeu |

Descartado: tour guiado (some depois da primeira vez, não ajuda uso esporádico) e checklist com estado (exigiria persistir progresso por usuário).

---

## Item 1 — Envio individual

### Modelo de dados

Destinatários individuais entram na **mesma** estrutura de audiência, como um campo irmão de `bases`:

```jsonc
{
  "bases": [ { "key": "membros", "filtros": {} } ],
  "individuais": [
    { "email": "joao@exemplo.com", "nome": "João Silva" },
    { "email": "avulso@exemplo.com", "nome": null }
  ]
}
```

`resolveAudience` acrescenta os individuais como mais uma lista antes do `dedupeRecipients`. A consequência é que eles herdam, sem código novo: deduplicação contra as bases, filtro de supressão, reserva atômica no disparo, rastreamento de abertura e clique, link de descadastro assinado e a tela de status.

**Um envio individual é uma campanha com um destinatário.** Não há conceito, tabela nem tela nova.

### Validação

`audienceSchema` hoje exige `bases.min(1)`. Passa a exigir **pelo menos um** entre `bases` e `individuais` não vazio. Cada individual valida o e-mail pelo mesmo `normalizeEmail` do resto do módulo, e `nome` é opcional.

Limite de 50 individuais por campanha — acima disso o caminho correto é uma base com filtro, não uma lista colada à mão.

### Busca de membros

Nova rota `GET /api/email-audiences/pessoas?q=termo`, exigindo apenas a permissão `email` e devolvendo **somente** `{ nome, email }`.

Motivo de não reusar `GET /api/membros`: ela exige a permissão `membros`, que dá acesso a CPF, telefone e edição de cadastro. Quem opera e-mail marketing não precisa disso — e a rota nova devolve um subconjunto deliberadamente magro.

A lógica de busca acento-insensível de `app/api/membros/route.ts:27-49` (`applySearch`) é extraída para um módulo compartilhado e reusada pelas duas rotas, para não haver duas buscas divergindo com o tempo.

### Interface

No passo 1, abaixo das bases, uma seção "Ou envie para pessoas específicas":

- Campo de busca com debounce que consulta a rota nova e mostra sugestões com nome e e-mail.
- O mesmo campo aceita um e-mail digitado que não esteja na base — se o texto é um e-mail válido, aparece a opção de adicioná-lo direto.
- Escolhidos viram fichas removíveis.
- A contagem de destinatários únicos passa a somar bases + individuais, já deduplicados.

---

## Item 2 — Template de HTML próprio

### Modelo

Novo `template_key`: `html_custom`. O corpo vai em `content.html`.

Não exige migração: `email_campaigns.template_key` é `text` sem CHECK constraint, e `content` é `jsonb`.

`TEMPLATE_KEYS` ganha a quarta entrada, o que propaga automaticamente para o `z.enum` da validação e para o seletor de template da interface.

### Validação por template

`campaignFieldsSchema` valida `content` de forma condicional ao `template_key`:

- `anuncio` / `simples` / `evento` — exigem `titulo` e `texto`, como hoje.
- `html_custom` — exige `html`, e não exige `titulo`/`texto`.

O gate `canGoStep2To3` do wizard segue a mesma regra.

Limite de **100 KB** para `content.html`. O Gmail trunca e-mails acima de ~102 KB; barrar no upload é melhor que descobrir depois que parte dos destinatários viu o e-mail cortado.

### Sanitização

O HTML passa por lista branca **no servidor**, ao salvar. Removidos: `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<base>`, atributos `on*` e qualquer URL cujo esquema não seja `http`, `https` ou `mailto`.

Isso é inegociável: hoje **todo** conteúdo do usuário é escapado pelos templates, e aceitar HTML arbitrário remove essa garantia inteira. O domínio de envio é compartilhado com o `1-ano-SommaDay` — um script ou pixel de terceiro num e-mail nosso afeta a reputação dos dois sistemas.

Dependência nova: `sanitize-html` (server-side, whitelist configurável, feito para exatamente este caso).

### Injeções obrigatórias

Sobre o HTML já sanitizado, o renderizador injeta:

1. **Rodapé de descadastro** antes de `</body>` (ou no fim, se não houver). Mesmo link assinado das demais campanhas. Exigência de LGPD, não opcional, não removível pelo usuário.
2. **Preheader** logo após `<body>`, se a campanha tiver um.
3. **`{{nome}}`** trocado pelo nome do destinatário, **escapado**, sem escapar o resto do documento — diferente do `interpolate` atual, que escapa o texto inteiro e destruiria o HTML.

O `subject` continua vindo do campo próprio da campanha, nunca do HTML.

### Interface

Um quarto card no seletor de template. Ao escolhê-lo, o formulário troca os campos de título/texto por um seletor de arquivo (`accept=".html,text/html"`).

O arquivo é lido no navegador com `FileReader` e enviado como texto no corpo da requisição — sem bucket, sem upload separado, sem dependência de rede no caminho crítico do disparo. Cabe folgado no limite de 4,5 MB da Vercel.

O preview usa o mesmo `iframe` sandboxed já existente, então mostra o HTML **depois** da sanitização e das injeções — o que você vê é o que sai.

---

## O que fica fora

Editor visual de HTML, versionamento de templates, biblioteca de templates salvos, agendamento de envio individual, e importação de CSV de destinatários. Nenhum foi pedido e cada um dobraria o escopo.

---

## Riscos

**Sanitização agressiva demais.** Templates exportados de ferramentas externas às vezes dependem de construções incomuns. A lista branca pode alterar o visual. Mitigação: o preview mostra o resultado final pós-sanitização, então a diferença aparece antes do disparo, não depois.

**Regressão no wizard.** O porte para `ResponsiveModal` reescreve a casca de um fluxo de 4 passos que hoje funciona em produção. Mitigação: fazer o porte isolado, sem mudança de comportamento, antes de acrescentar qualquer feature — assim, se algo quebrar, o culpado é óbvio.

**Envio individual como campanha.** A lista de campanhas pode encher de envios avulsos. Aceito conscientemente: a alternativa (entidade separada) exigiria uma segunda tela de status e duplicaria o motor. Se incomodar, um chip de filtro resolve depois.

---

## Pendências do v1 que este trabalho não resolve

Continuam abertas e não são escopo daqui: as variáveis de ambiente em produção, o registro do webhook na Resend, os achados I4/N2/N3/N4, a verificação manual no navegador e a decisão de consentimento para as bases grandes.
