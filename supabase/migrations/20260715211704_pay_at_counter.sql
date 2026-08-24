alter type mafood.payment_method add value if not exists 'counter';

alter table mafood.pdvs
  add column if not exists pay_at_counter boolean not null default false;

comment on column mafood.pdvs.pay_at_counter is
  'Cliente pede pelo app; pagamento na tenda/balcão (sem Asaas). Pedido entra como paid no Kanban.';

update mafood.pdvs
set pay_at_counter = true
where slug = 'dopahmina';;
