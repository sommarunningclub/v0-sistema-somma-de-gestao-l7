-- Vinculo entre codigo de parceiro e evento
-- =========================================
--
-- O codigo de parceiro existe desde sempre em `codigo_parceiro`, e a LP do
-- evento ja sabe ler `?parceiro=` da URL e gravar `evento_participantes.
-- parceiro_slug` com `origem='parceiro'`. As duas pontas existem e nunca se
-- encontraram: nao ha atribuicao nenhuma na base (195 inscricoes por `site`,
-- zero por `parceiro`), porque o painel gera o codigo sem dizer que ele pode
-- virar link de evento — ninguem monta a URL na mao.
--
-- Esta tabela e o meio de campo: diz a quais eventos um codigo se aplica, para
-- o painel gerar o link pronto e contar quantas inscricoes vieram de cada
-- parceiro em cada evento.
--
-- N:N de proposito: o mesmo parceiro divulga varios eventos, e um evento tem
-- varios parceiros divulgando.

create table if not exists codigo_parceiro_eventos (
  id         uuid primary key default gen_random_uuid(),
  codigo_id  uuid not null references codigo_parceiro(id) on delete cascade,
  evento_id  uuid not null references eventos(id)         on delete cascade,
  created_at timestamptz not null default now(),
  created_by text,
  unique (codigo_id, evento_id)
);

comment on table codigo_parceiro_eventos is
  'A quais eventos um codigo de parceiro se aplica. Serve para gerar o link de divulgacao e atribuir inscricoes; nao bloqueia nada no site.';

-- ON DELETE CASCADE nos dois lados: o vinculo nao sobrevive ao codigo nem ao
-- evento, e manter a linha orfa so criaria link para lugar nenhum. A inscricao
-- ja feita nao depende desta tabela — ela guarda o `parceiro_slug` em texto.

create index if not exists codigo_parceiro_eventos_evento_idx
  on codigo_parceiro_eventos (evento_id);

-- A contagem "quantas inscricoes este parceiro trouxe" varre
-- evento_participantes por parceiro_slug, que hoje nao tem indice nenhum.
-- Parcial porque a esmagadora maioria das linhas tem slug nulo.
create index if not exists evento_participantes_parceiro_slug_idx
  on evento_participantes (parceiro_slug)
  where parceiro_slug is not null;

-- O codigo e a chave pela qual a atribuicao acontece (`?parceiro=CODIGO`).
-- Dois cadastros com o mesmo codigo dividiriam as inscricoes de um parceiro em
-- duas linhas, sem ninguem perceber. Hoje ha um unico codigo na tabela, entao
-- o indice entra sem risco de conflito.
create unique index if not exists codigo_parceiro_codigo_unique
  on codigo_parceiro (upper(codigo));
