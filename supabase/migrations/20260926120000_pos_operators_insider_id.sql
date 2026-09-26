-- Vínculo do operador do PDV com o registro SOMMA Insider
-- =====================================================
--
-- O PDV aceita login com a senha do Insider Connect. Conferir só "este CPF é
-- Insider com senha" não basta: o portal Insider deixa qualquer pessoa se
-- cadastrar com um CPF novo e criar a primeira senha de um Insider que ainda
-- não tem. Quem soubesse o CPF de um operador conseguiria, assim, fabricar uma
-- senha de Insider para ele e entrar no caixa.
--
-- Por isso o vínculo é gravado no cadastro do operador: `insider_id` guarda o
-- `dados_insiders.id` que JÁ tinha senha quando o painel liberou o acesso. O
-- login por senha do Insider só vale se o registro atual daquele CPF for este
-- mesmo id. Operador liberado com código fica com null e nunca entra por
-- senha de Insider, mesmo que alguém crie uma depois.

alter table public.pos_operators
  add column if not exists insider_id uuid;

comment on column public.pos_operators.insider_id is
  'dados_insiders.id vinculado na liberação (Insider já com senha). Só com este vínculo o PDV aceita a senha do Insider Connect.';
