-- Make asaas_customer_id nullable in professor_clients table
-- This allows linking clients from the waitlist who don't have an Asaas account yet

ALTER TABLE professor_clients 
ALTER COLUMN asaas_customer_id DROP NOT NULL;

-- Also make customer_cpf_cnpj nullable since waitlist clients might not have CPF yet
ALTER TABLE professor_clients 
ALTER COLUMN customer_cpf_cnpj DROP NOT NULL;
