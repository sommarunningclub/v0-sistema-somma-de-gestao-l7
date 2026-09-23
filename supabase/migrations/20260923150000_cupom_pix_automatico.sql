-- Cupom valendo no Pix Automatico
-- ===============================
--
-- O checkout do site recusa cupom no Pix Automatico hoje, e de proposito: a
-- rota `/api/asaas/pix-automatico` e publica e tira o valor de um catalogo
-- proprio no servidor (lib/checkout/planos-pix-automatico.ts), nunca do
-- navegador. Sem isso a tela mostraria um preco e o banco debitaria outro.
--
-- Esta coluna e o interruptor: so o cupom marcado aqui passa a ser aceito la,
-- e o desconto continua sendo calculado no servidor. Default `false` porque os
-- cupons que ja existem foram criados sob a regra antiga — nenhum deles deve
-- comecar a descontar debito recorrente sozinho.
--
-- Quanto ele desconta segue a regra que o cupom ja tem:
--   first_month_only = true  -> desconta so o QR da 1a mensalidade
--   first_month_only = false -> desconta o debito recorrente inteiro
-- Nao ha meio-termo: o cliente autoriza no app do banco UM valor de debito,
-- fixado na criacao da autorizacao, e muda-lo depois exigiria nova
-- autorizacao dele.

alter table coupons add column if not exists pix_automatico boolean not null default false;

comment on column coupons.pix_automatico is
  'Cupom tambem aceito no checkout via Pix Automatico. Default false: o padrao continua sendo cartao apenas.';
