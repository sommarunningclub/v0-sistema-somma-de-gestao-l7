-- Atualizar tabela de resgates de cupons para suportar referencias do Asaas
-- Este script adiciona colunas para vincular com clientes e pagamentos do Asaas

-- Adicionar coluna para ID do cliente Asaas
ALTER TABLE coupon_redemptions 
ADD COLUMN IF NOT EXISTS asaas_customer_id VARCHAR(50);

-- Adicionar coluna para ID do pagamento Asaas
ALTER TABLE coupon_redemptions 
ADD COLUMN IF NOT EXISTS asaas_payment_id VARCHAR(50);

-- Tornar as colunas antigas opcionais (remover NOT NULL se existir)
-- payment_id e customer_id podem ser nulos se usarmos IDs do Asaas
ALTER TABLE coupon_redemptions 
ALTER COLUMN payment_id DROP NOT NULL;

ALTER TABLE coupon_redemptions 
ALTER COLUMN customer_id DROP NOT NULL;

-- Criar indices para melhor performance nas buscas
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_asaas_customer 
ON coupon_redemptions(asaas_customer_id);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_asaas_payment 
ON coupon_redemptions(asaas_payment_id);

-- Adicionar coluna de descricao opcional para cupons
ALTER TABLE coupons 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Adicionar coluna de valor minimo para aplicar cupom
ALTER TABLE coupons 
ADD COLUMN IF NOT EXISTS min_value DECIMAL(10, 2) DEFAULT 0;

-- Adicionar coluna para restringir a um cliente especifico
ALTER TABLE coupons 
ADD COLUMN IF NOT EXISTS customer_restriction VARCHAR(50);
