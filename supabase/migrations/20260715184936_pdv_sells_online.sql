-- Pagamento pelo app (Asaas). Independente da categoria do PDV.
alter table mafood.pdvs
  add column if not exists sells_online boolean not null default false;

comment on column mafood.pdvs.sells_online is
  'Se true, o PDV aceita pedido e pagamento pelo app (Pix/cartão).';

-- Backfill: bebidas já vendiam online; Crepe passa a vender também
update mafood.pdvs
set sells_online = true
where lower(trim(category)) = 'bebidas'
   or slug = 'crepe-do-bob';

notify pgrst, 'reload schema';;
