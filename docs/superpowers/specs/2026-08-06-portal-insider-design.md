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

## Restrição estruturante: o middleware está ativo

Em 2026-08-06, depois da primeira versão desta spec, o commit `c888bee` versionou `middleware.ts` junto com o login que cria o cookie de sessão e a rota de logout. Verificado em produção: `/` sem sessão responde 307 para `/login?from=/`. **A proteção de rotas do admin está ativa.**

Duas consequências que o portal precisa respeitar, ou ele nasce quebrado:

1. **`OPEN_PAGES` é `/^\/insider$/` — exato.** `/insider/painel` seria capturado pelo middleware e redirecionado para o login **do admin**. Precisa virar `/^\/insider(\/|$)/`.
2. **A regra `/^\/api\/insider/` → permissão `pagamentos` casa com `/api/insiders/eu*`.** Sem liberação, o portal responderia 403 para os próprios Insiders, que não têm sessão de admin.

Ainda assim, **cada rota do portal valida a sessão de Insider dentro do próprio handler**, e a página `/insider/painel` confere o cookie no servidor antes de renderizar. O middleware apenas decide quem passa pela porta; quem verifica a identidade é a própria rota. Defesa em profundidade, e evita depender de uma configuração que já mudou uma vez hoje.

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

- `lib/auth/page-routes.ts`: `OPEN_PAGES` passa de `/^\/insider$/` para `/^\/insider(\/|$)/`. **Obrigatório** — sem isso o middleware manda o Insider para o login do admin.
- `lib/auth/route-permissions.ts`: adicionar a `PUBLIC_API_ROUTES` as rotas do portal — `POST /api/insiders/entrar`, `POST /api/insiders/sair` e o prefixo `/^\/api\/insiders\/eu(\/|$)/`. **Obrigatório**: sem isso a regra `/^\/api\/insider/` exige permissão `pagamentos` e o portal responde 403 ao Insider.

"Público" aqui significa apenas *o middleware não gateia*. As rotas `eu*` continuam exigindo sessão de Insider válida no próprio handler — nenhuma delas responde sem cookie assinado.

## Testes

Unitários (jest):
- `lib/insider/__tests__/beneficios.test.ts` — cada regra de tipo, valores vazios, e o teste de não-vazamento da anotação do Evolve.
- `lib/auth/__tests__/insider-session.test.ts` — criar/verificar, expiração, assinatura adulterada, **e que um token de admin é rejeitado** pelo verificador de Insider.

Verificação manual contra o banco real, ao fim de cada fatia, no mesmo formato da bateria de `/insider`: login correto, senha errada, CPF inexistente (mesma mensagem), rate limit, benefícios corretos por pessoa, e ausência da anotação interna.

## Emenda de 2026-08-08 — ajustes pedidos após ver o portal rodando

Três mudanças decididas pelo usuário depois de navegar na Fatia 1. Substituem o que estava definido acima onde houver conflito.

### 1. Quem existe na base mas não tem senha cria a senha e entra

Antes: caía no formulário de cadastro completo. Agora: tela curta com senha e confirmação, sob a nota "Encontramos seu cadastro. Crie uma senha para acessar seu perfil". Ao salvar, a sessão é emitida e a pessoa vai direto ao painel. Vale hoje para 14 dos 35 Insiders.

Rota nova `POST /api/insiders/criar-senha`, pública no middleware, com rate limit de 5/min:
- Localiza pelo CPF com `cpfCandidates`.
- **Recusa se já houver credencial** — nesse caso o caminho é o login. Responde 409 com `{ error: 'Este cadastro já tem senha. Use a opção de entrar.' }`.
- Aplica `validateSenha`, grava com `hashPassword` e emite o cookie de sessão.
- CPF ausente e demais falhas respondem a mesma mensagem genérica, pelo mesmo motivo do login.

**Risco aceito e registrado:** tomar posse de um cadastro sem senha passa de "preencher 13 campos" para "preencher 2". A exposição já existia pela rota de cadastro — muda a conveniência, não a natureza. Mitigação disponível se o usuário quiser depois: exigir a data de nascimento já gravada como conferência antes de aceitar a senha.

O link "Prefiro atualizar meus dados sem entrar" continua disponível nessa tela.

### 2. O painel mostra as sete parcerias, sempre

Antes: cartões sem valor eram escondidos. Agora todos aparecem; os que a pessoa não tem ficam esmaecidos com "Não incluído". Motivo: quem tem poucos benefícios via uma tela quase vazia sem entender o porquê, e o programa inteiro deixa de ser visível.

`montarBeneficios` não muda — quem decide exibir é o componente, usando `disponivel` para o estilo em vez de para filtrar.

### 3. Foto do perfil no painel

O `foto_url` já vem do banco e já é devolvido pela API, mas nenhum componente o renderizava. Passa a aparecer no cabeçalho, ao lado da saudação. Sem foto cadastrada, mostra as iniciais do nome num círculo com o laranja da marca — nunca um espaço quebrado.

## Achados da Fatia 1 que a Fatia 2 precisa resolver

Levantados na revisão final da Fatia 1 (2026-08-06). Nenhum bloqueou aquele merge; todos passam a importar quando a Fatia 2 adicionar escrita.

1. **CSRF em `POST /api/insiders/entrar`.** A rota usa `req.json()`, que aceita qualquer `Content-Type`. Um formulário cross-origin com `enctype="text/plain"` consegue forjar um corpo com formato JSON, e `SameSite=Lax` não impede a *resposta* de gravar o cookie. Hoje o dano é baixo (a vítima entra na conta do atacante e vê os cupons dele). Vira grave assim que existir `PUT /api/insiders/eu`, porque passa a ser primitiva de escrita. Corrigir com uma checagem de `Content-Type` ou de `Origin` **antes** de expor as rotas de escrita.

2. **Sem revogação de sessão.** O token dura 30 dias e não carrega versão de senha. A troca de senha da Fatia 2 **não** invalidará sessões já emitidas — exatamente o cenário do celular emprestado que motivou a correção do botão Sair. Acrescentar um claim `pwd_v` ao payload e compará-lo com um contador em `insider_credentials`.

3. **Rate limit é por instância, não por deploy.** `lib/insider/rate-limit.ts` é um `Map` em processo; na Vercel isso significa 5/min por lambda quente, não por IP global. Não é superfície econômica de força bruta contra bcrypt cost 12, mas a spec não deve descrever como "5/min por IP" sem a ressalva. Migrar para armazenamento compartilhado e somar um contador por CPF.

4. **Dívida de refatoração.** `components/insider/insider-cadastro-form.tsx` chegou a ~740 linhas e ganhou o modo de login. A quebra em blocos de campos, prevista nesta spec, ficou mais difícil por ter sido adiada. Fazer **antes** de acrescentar as seções de dados e senha.

## Configuração de produção pendente

`SESSION_SECRET` não está definido explicitamente na Vercel; a derivação cai no fallback `SUPABASE_SERVICE_ROLE_KEY`. Rotacionar a chave de serviço desconectaria todos os membros de uma vez. Definir a variável antes que a base de sessões cresça.

## Fora de escopo

- Recuperação de senha por e-mail ou WhatsApp. Quem esquecer fala com a equipe.
- Unificar as colunas `validated` / `validacao_do_checkin`.
- Estruturar as sete colunas de benefício no banco (a tradução fica na camada de apresentação).
- A camada de auth do admin — resolvida fora desta spec pelo commit `c888bee`.
