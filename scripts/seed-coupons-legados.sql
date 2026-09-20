-- Cupons legados do checkout -> tabela `coupons`
-- ==============================================
--
-- Gerado a partir da lista hardcoded do site (NOVO-SITE-SOMMA-V3,
-- lib/checkout/cupons.ts) para que o modulo de Cupons do painel nasca com tudo
-- que ja esta em circulacao, em vez de uma tela vazia ao lado de 61 cupons que
-- so existem no codigo.
--
-- ORDEM IMPORTA. Rodar:
--   1. supabase/migrations/20260920223743_coupon_rules.sql       (colunas professor/plan_type/first_month_only)
--   2. deploy do site lendo essas colunas (lib/checkout/cupons.ts)
--   3. este arquivo
--
-- Invertendo 2 e 3, os quatro cupons com restricao (ANALU, JO150, ALE200,
-- ALE180) passariam a valer para qualquer professor e qualquer plano, porque o
-- cupom do banco tem PRECEDENCIA sobre o hardcoded do site.
--
-- `on conflict do nothing`: rodar de novo nao sobrescreve o que ja foi editado
-- pelo painel.
--
-- Os 6 cupons inativos no codigo (SOMMA5/10/20/50, PRIMEIRACOMPRA, SOMMA99)
-- entram como DISABLED -- inclusive o SOMMA99, que da 99% de desconto e nao
-- pode ressuscitar por acidente.

insert into coupons (code, type, value, description, status, professor, plan_type, first_month_only)
values
  ('ANALU', 'PERCENTAGE', 20, '20% no 1º mês', 'ACTIVE', null, 'recurring', true),
  ('SOMMA5', 'PERCENTAGE', 5, '5% de desconto', 'DISABLED', null, null, false),
  ('SOMMA10', 'PERCENTAGE', 10, '10% de desconto', 'DISABLED', null, null, false),
  ('SOMMA20', 'PERCENTAGE', 20, '20% de desconto', 'DISABLED', null, null, false),
  ('SOMMA50', 'FIXED', 50, 'R$ 50,00 de desconto', 'DISABLED', null, null, false),
  ('PRIMEIRACOMPRA', 'PERCENTAGE', 15, '15% na primeira compra', 'DISABLED', null, null, false),
  ('SOMMA99', 'PERCENTAGE', 99, '99% de desconto', 'DISABLED', null, null, false),
  ('JO130', 'FIXED', 90, 'Desconto de R$ 90,00 - Assinatura por R$ 130', 'ACTIVE', null, null, false),
  ('JO150', 'FIXED', 70, 'Desconto de R$ 70,00 - Assinatura por R$ 150', 'ACTIVE', 'Joseph Pereira', 'recurring', false),
  ('ALE200', 'FIXED', 20, 'Desconto de R$ 20,00 - Assinatura por R$ 200', 'ACTIVE', 'Alexandre Alves', 'recurring', false),
  ('ALE180', 'FIXED', 40, 'Desconto de R$ 40,00 - Assinatura por R$ 180', 'ACTIVE', 'Alexandre Alves', 'recurring', false),
  ('ALEX10', 'PERCENTAGE', 10, '10% desconto - Familiares', 'ACTIVE', null, null, false),
  ('ANDERSON10', 'PERCENTAGE', 10, '10% desconto - Familiares', 'ACTIVE', null, null, false),
  ('ARTHUR10', 'PERCENTAGE', 10, '10% desconto - Familiares', 'ACTIVE', null, null, false),
  ('BRUNA10', 'PERCENTAGE', 10, '10% desconto - Familiares', 'ACTIVE', null, null, false),
  ('CAROLINA10', 'PERCENTAGE', 10, '10% desconto - Familiares', 'ACTIVE', null, null, false),
  ('CRIS10', 'PERCENTAGE', 10, '10% desconto - Familiares', 'ACTIVE', null, null, false),
  ('CAMILLA10', 'PERCENTAGE', 10, '10% desconto - Familiares', 'ACTIVE', null, null, false),
  ('DIOGO10', 'PERCENTAGE', 10, '10% desconto - Familiares', 'ACTIVE', null, null, false),
  ('PRISCYLA10', 'PERCENTAGE', 10, '10% desconto - Familiares', 'ACTIVE', null, null, false),
  ('PRISCILA10', 'PERCENTAGE', 10, '10% desconto - Familiares', 'ACTIVE', null, null, false),
  ('GUSTAVO10', 'PERCENTAGE', 10, '10% desconto - Familiares', 'ACTIVE', null, null, false),
  ('JOAO10', 'PERCENTAGE', 10, '10% desconto - Familiares', 'ACTIVE', null, null, false),
  ('JOSEPH10', 'PERCENTAGE', 10, '10% desconto - Familiares', 'ACTIVE', null, null, false),
  ('KAMILA10', 'PERCENTAGE', 10, '10% desconto - Familiares', 'ACTIVE', null, null, false),
  ('LETICIA10', 'PERCENTAGE', 10, '10% desconto - Familiares', 'ACTIVE', null, null, false),
  ('LUANA10', 'PERCENTAGE', 10, '10% desconto - Familiares', 'ACTIVE', null, null, false),
  ('LUISA10', 'PERCENTAGE', 10, '10% desconto - Familiares', 'ACTIVE', null, null, false),
  ('MATEUS10', 'PERCENTAGE', 10, '10% desconto - Familiares', 'ACTIVE', null, null, false),
  ('MATHEUS10', 'PERCENTAGE', 10, '10% desconto - Familiares', 'ACTIVE', null, null, false),
  ('RAYSSA10', 'PERCENTAGE', 10, '10% desconto - Familiares', 'ACTIVE', null, null, false),
  ('RUAN10', 'PERCENTAGE', 10, '10% desconto - Familiares', 'ACTIVE', null, null, false),
  ('YASMIM10', 'PERCENTAGE', 10, '10% desconto - Familiares', 'ACTIVE', null, null, false),
  ('YASMIN10', 'PERCENTAGE', 10, '10% desconto - Familiares', 'ACTIVE', null, null, false),
  ('ANA10', 'PERCENTAGE', 10, '10% desconto - Familiares', 'ACTIVE', null, null, false),
  ('DAYANE10', 'PERCENTAGE', 10, '10% desconto - Familiares', 'ACTIVE', null, null, false),
  ('ALEX5', 'PERCENTAGE', 5, '5% desconto - Público Geral', 'ACTIVE', null, null, false),
  ('ANDERSON5', 'PERCENTAGE', 5, '5% desconto - Público Geral', 'ACTIVE', null, null, false),
  ('ARTHUR5', 'PERCENTAGE', 5, '5% desconto - Público Geral', 'ACTIVE', null, null, false),
  ('BRUNA5', 'PERCENTAGE', 5, '5% desconto - Público Geral', 'ACTIVE', null, null, false),
  ('CAROLINA5', 'PERCENTAGE', 5, '5% desconto - Público Geral', 'ACTIVE', null, null, false),
  ('CRIS5', 'PERCENTAGE', 5, '5% desconto - Público Geral', 'ACTIVE', null, null, false),
  ('CAMILLA5', 'PERCENTAGE', 5, '5% desconto - Público Geral', 'ACTIVE', null, null, false),
  ('DIOGO5', 'PERCENTAGE', 5, '5% desconto - Público Geral', 'ACTIVE', null, null, false),
  ('PRISCYLA5', 'PERCENTAGE', 5, '5% desconto - Público Geral', 'ACTIVE', null, null, false),
  ('PRISCILA5', 'PERCENTAGE', 5, '5% desconto - Público Geral', 'ACTIVE', null, null, false),
  ('GUSTAVO5', 'PERCENTAGE', 5, '5% desconto - Público Geral', 'ACTIVE', null, null, false),
  ('JOAO5', 'PERCENTAGE', 5, '5% desconto - Público Geral', 'ACTIVE', null, null, false),
  ('JOSEPH5', 'PERCENTAGE', 5, '5% desconto - Público Geral', 'ACTIVE', null, null, false),
  ('KAMILA5', 'PERCENTAGE', 5, '5% desconto - Público Geral', 'ACTIVE', null, null, false),
  ('LETICIA5', 'PERCENTAGE', 5, '5% desconto - Público Geral', 'ACTIVE', null, null, false),
  ('LUANA5', 'PERCENTAGE', 5, '5% desconto - Público Geral', 'ACTIVE', null, null, false),
  ('LUISA5', 'PERCENTAGE', 5, '5% desconto - Público Geral', 'ACTIVE', null, null, false),
  ('MATEUS5', 'PERCENTAGE', 5, '5% desconto - Público Geral', 'ACTIVE', null, null, false),
  ('MATHEUS5', 'PERCENTAGE', 5, '5% desconto - Público Geral', 'ACTIVE', null, null, false),
  ('RAYSSA5', 'PERCENTAGE', 5, '5% desconto - Público Geral', 'ACTIVE', null, null, false),
  ('RUAN5', 'PERCENTAGE', 5, '5% desconto - Público Geral', 'ACTIVE', null, null, false),
  ('YASMIM5', 'PERCENTAGE', 5, '5% desconto - Público Geral', 'ACTIVE', null, null, false),
  ('YASMIN5', 'PERCENTAGE', 5, '5% desconto - Público Geral', 'ACTIVE', null, null, false),
  ('ANA5', 'PERCENTAGE', 5, '5% desconto - Público Geral', 'ACTIVE', null, null, false),
  ('DAYANE5', 'PERCENTAGE', 5, '5% desconto - Público Geral', 'ACTIVE', null, null, false)
on conflict do nothing;
