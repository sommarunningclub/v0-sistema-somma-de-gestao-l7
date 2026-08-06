# Spec — Portal do Insider

Data: 2026-08-06
Status: aprovada pelo usuário — entrega em duas fatias

## Objetivo

Dar ao Insider do Somma Club uma área própria, autenticada por CPF + senha, onde ele vê seus benefícios, mantém o cadastro atualizado, troca a senha e acompanha os encontros.

A senha já é coletada e guardada em `insider_credentials` (bcrypt, cost 12) pela página `/insider` publicada em 2026-08-06, mas hoje serve apenas para autorizar a edição do próprio cadastro. Esta spec dá a ela a função para a qual foi criada.

## Entrega em duas fatias

**Fatia 1 — o núcleo:** sessão do Insider, login, logout e a seção de benefícios. É útil sozinha e é o que o usuário pediu primeiro ("ver todos os benefícios dele").

**Fatia 2 — o resto do painel:** meus dados, troca de senha e eventos.

Cada fatia tem seu próprio plano de implementação.

## Decisões aprovadas

1. **Entrada única.** `/insider` continua sendo o único endereço divulgado. O CPF decide o destino.
2. **Evolve exibe apenas `Ativo`/`Inativo`.** O texto cru contém anotação administrativa interna ("POSSUI SALDO DEVEDOR, SENDO NECESSÁRIO O CANCELAMENTO NA UNIDADE") que não pode chegar ao Insider.
3. **Dopamina exibe `10% de desconto`,** derivado do valor `0.1`.
4. **Eventos sem selo de validação.** As colunas `validated` e `validacao_do_checkin` divergem entre rotas; exibir o selo mostraria presenças legítimas como não validadas.

## Contexto do banco (levantado, não suposto)

Amostra de 31 Insiders:

| Coluna | Natureza real | Preenchimento |
|---|---|---|
| `evolve` | Status + anotação interna | 31/31 |
| `dopahmina` | Taxa (`0.1`) | 31/31 |
| `tex_barbearia` | Descrição, igual para todos | 31/31 |
| `cupom_loja_somma` | **Cupom individual** (`INSIDERES27`…) | 31/31, 29 distintos |
| `big_box` | Cupom compartilhado (`BIGSOMMA`) | 31/31 |
| `assessoria_somma` | Flag (`Sim`) | 20/31 |
| `estamina_recovery` | Descrição, igual para todos | 31/31 |

`checkins` liga à pessoa **apenas por CPF em texto** (com e sem máscara); não há FK para `dados_insiders`. `checkins.evento_id` → `eventos.id` é nullable.

## Restrição estruturante: o middleware não está em produção

`middleware.ts` não é versionado e não foi publicado. Portanto:

- **Cada rota do portal valida a sessão dentro do próprio handler.** Nada depende de `route-permissions.ts` ser aplicado.
- **A página `/insider/painel` confere o cookie no servidor** antes de renderizar e redireciona para `/insider` se ausente.

`OPEN_PAGES` e `PUBLIC_API_ROUTES` recebem as entradas correspondentes mesmo assim, para que o dia em que o middleware for publicado não quebre o portal.

## Sessão do Insider

Módulo novo `lib/auth/insider-session.ts`, independente de `lib/auth/session.ts`:

- Cookie **`somma_insider_session`**, `httpOnly`, `sameSite: 'lax'`, `secure` em produção, `path: '/'`, validade **30 dias**.
- Payload: `{ sub: insider_id, cpf, nome, typ: 'insider', exp }`.
- Token no mesmo formato do admin: `base64url(payload).base64url(HMAC-SHA256)`.
- **Chave HMAC derivada:** `${SESSION_SECRET || SUPABASE_SERVICE_ROLE_KEY}:insider`. Sem isso, um token de admin assinado com o mesmo segredo poderia ser aceito. O campo `typ` é verificado adicionalmente.
- Exporta `createInsiderSession`, `verifyInsiderSession`, `attachInsiderCookie`, `clearInsiderCookie`, `getInsiderFromRequest`.

## Apresentação dos benefícios

Módulo puro `lib/insider/beneficios.ts`, sem I/O, coberto por testes.

```
type BeneficioTipo = 'status' | 'cupom' | 'descricao' | 'percentual'
type Beneficio = { chave, rotulo, tipo, valor: string, disponivel: boolean }
export function montarBeneficios(row: Record<string, unknown>): Beneficio[]
```

Regras por coluna:

| Coluna | Rótulo | Tipo | Regra |
|---|---|---|---|
| `evolve` | Evolve | status | Começa com "ativo" (case-insensitive, após `trim`) → `Ativo`; senão `Inativo`. **O texto cru nunca sai daqui.** |
| `dopahmina` | Dopamina | percentual | `parseFloat` × 100 → `10% de desconto`. Não numérico ou vazio → `disponivel: false`. |
| `tex_barbearia` | Tex Barbearia | descricao | Texto como está. Vazio → indisponível. |
| `cupom_loja_somma` | Loja Somma | cupom | Código, com botão de copiar. Vazio → indisponível. |
| `big_box` | Big Box | cupom | Código, com botão de copiar. Vazio → indisponível. |
| `assessoria_somma` | Assessoria Somma | status | `Sim` (case-insensitive) → `Ativo`; senão `Não incluído`. |
| `estamina_recovery` | Estamina Recovery | descricao | Texto como está. Vazio → indisponível. |

Benefícios do tipo `status` aparecem sempre (informar "Não incluído" é útil). Os demais só quando têm valor.

Um teste obrigatório garante que nenhuma saída de `montarBeneficios` contém as palavras `SALDO DEVEDOR`, `CANCELAMENTO` ou `BOLSA`, partindo dos valores reais observados na base.

## Rotas

Todas verificam a sessão no handler. Erros no formato `{ error: string }`; logs prefixados `[insiders/<rota>]`.

### `POST /api/insiders/entrar` — fatia 1
- Body `{ cpf, senha }`. Rate limit **5/min** por IP (`lib/insider/rate-limit.ts`).
- Busca por `cpfCandidates`, lê `senha_hash` de `insider_credentials`, valida com `verifyPassword`.
- **Mesma resposta 401 `{ error: 'CPF ou senha incorretos.' }`** para CPF inexistente, sem credencial ou senha errada.
- **Equalizador de timing:** no caminho sem credencial, executa um `verifyPassword` contra um hash fixo descartável, como já faz `register`.
- Sucesso → 200 `{ success: true }` + cookie de sessão.

### `POST /api/insiders/sair` — fatia 1
Limpa o cookie. 200 sempre.

### `GET /api/insiders/eu` — fatia 1
- Exige sessão. **O `insider_id` vem do cookie, nunca do cliente.**
- Retorna `{ insider: InsiderPublic, beneficios: Beneficio[] }`.
- Nunca retorna `senha_hash` nem o texto cru dos benefícios.

### `PUT /api/insiders/eu` — fatia 2
- Exige sessão. Edita o cadastro do dono da sessão; **não pede `senha_atual`** — a sessão é a prova.
- Reusa `insiderFormSchema` (sem o campo `cpf`, que não muda) e `buildInsiderRow`.
- Aceita foto pelo mesmo caminho do `register` (multipart, jpeg/png/webp, 5MB, bucket `insider-fotos`).

### `POST /api/insiders/eu/senha` — fatia 2
- Exige sessão **e** `senha_atual` (prática padrão mesmo autenticado).
- Aplica `validateSenha`; grava com `hashPassword` em `insider_credentials`.

### `GET /api/insiders/eu/eventos` — fatia 2
- Exige sessão.
- `proximos`: reusa a consulta de `app/api/eventos/ativos/route.ts`.
- `historico`: `checkins` filtrados pelo CPF da sessão (ambas as grafias), com `nome_do_evento` e `data_hora_checkin`, mais recentes primeiro, limite 50. **Sem campo de validação.**

## Páginas

### `/insider` (modificar)
Quarto estado no formulário: quando o lookup retorna `found && tem_senha`, revela o campo de senha e o botão "Entrar", em vez do formulário de cadastro. Sucesso → `router.push('/insider/painel')`. Um link discreto "Prefiro atualizar meus dados sem entrar" mantém o caminho atual acessível a quem esqueceu a senha — esse caminho continua exigindo `senha_atual`, então não é um contorno da autenticação.

### `/insider/painel` (novo)
Server Component. Lê e verifica o cookie; sem sessão válida, `redirect('/insider')`. Renderiza, em seções empilhadas:

1. **Benefícios** (fatia 1) — cartões por parceria; cupons com botão de copiar.
2. **Meus dados** (fatia 2) — formulário reaproveitando os blocos de campos.
3. **Senha** (fatia 2).
4. **Eventos** (fatia 2) — próximos e histórico.

Cabeçalho com o primeiro nome e botão "Sair". Mesma paleta de `/insider`: fundo `#0A0A0A`, cartões brancos, acento `#FF2C03`, fonte Geist herdada de `app/insider/layout.tsx`.

## Refatoração incluída

`components/insider/insider-cadastro-form.tsx` tem 674 linhas e ganharia mais um estado. Antes de estender, quebrar em:

- `components/insider/campos-dados-pessoais.tsx`
- `components/insider/campos-endereco.tsx`
- `components/insider/campos-senha.tsx`

O componente principal mantém o estado e o fluxo; os blocos recebem valores e handlers por props. Sem mudança de comportamento — os 32 cenários verificados contra o banco devem continuar passando.

## Configuração de rotas

- `lib/auth/page-routes.ts`: `OPEN_PAGES` passa de `/^\/insider$/` para `/^\/insider(\/|$)/`.
- `lib/auth/route-permissions.ts`: adicionar às públicas `POST /api/insiders/entrar` e `POST /api/insiders/sair`. As rotas `/api/insiders/eu*` **não** entram nas públicas nem nas de permissão de admin — elas se protegem sozinhas pela sessão de Insider.

## Testes

Unitários (jest):
- `lib/insider/__tests__/beneficios.test.ts` — cada regra de tipo, valores vazios, e o teste de não-vazamento da anotação do Evolve.
- `lib/auth/__tests__/insider-session.test.ts` — criar/verificar, expiração, assinatura adulterada, **e que um token de admin é rejeitado** pelo verificador de Insider.

Verificação manual contra o banco real, ao fim de cada fatia, no mesmo formato da bateria de `/insider`: login correto, senha errada, CPF inexistente (mesma mensagem), rate limit, benefícios corretos por pessoa, e ausência da anotação interna.

## Fora de escopo

- Recuperação de senha por e-mail ou WhatsApp. Quem esquecer fala com a equipe.
- Unificar as colunas `validated` / `validacao_do_checkin`.
- Estruturar as sete colunas de benefício no banco (a tradução fica na camada de apresentação).
- Publicar o `middleware.ts` e completar a camada de auth do admin — trabalho próprio, já registrado.
