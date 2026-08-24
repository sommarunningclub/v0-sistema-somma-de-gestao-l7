alter table mafood.customers
  add column if not exists postal_code text,
  add column if not exists address_number text,
  add column if not exists address_complement text;

comment on column mafood.customers.postal_code is 'CEP (8 dígitos) — usado no creditCardHolderInfo do Asaas';
comment on column mafood.customers.address_number is 'Número do endereço — Asaas';
comment on column mafood.customers.address_complement is 'Complemento (opcional)';;
