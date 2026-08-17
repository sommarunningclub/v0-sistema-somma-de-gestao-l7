-- 017-add-evento-lp-url.sql
-- Link da landing page do evento.
--
-- Quando preenchido, o card do evento no /check-in público leva direto para a
-- LP em vez de abrir o wizard de check-in — eventos que têm inscrição própria
-- (Desafio das Esteiras, Wings, etc.) deixam de precisar de UUID chumbado no
-- código do site.
--
-- Deliberadamente separado de `local_url`, que é o link do mapa do endereço.

ALTER TABLE eventos ADD COLUMN IF NOT EXISTS lp_url TEXT;

COMMENT ON COLUMN eventos.lp_url IS
  'URL da landing page do evento. Preenchido: o card no /check-in público redireciona para cá em vez de abrir o wizard. Vazio: fluxo normal de check-in.';
