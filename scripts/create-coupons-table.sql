-- Criar tabela de cupons para o módulo de Pagamentos

CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('PERCENTAGE', 'FIXED')),
  value DECIMAL(10, 2) NOT NULL,
  expiration_date DATE,
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'DISABLED')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_status ON coupons(status);

-- Criar tabela de resgates de cupons
CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID REFERENCES coupons(id) ON DELETE CASCADE,
  payment_id BIGINT REFERENCES payments(id) ON DELETE SET NULL,
  customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  discount_applied DECIMAL(10, 2) NOT NULL,
  redeemed_at TIMESTAMP DEFAULT NOW()
);

-- Índices para resgates
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon ON coupon_redemptions(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_customer ON coupon_redemptions(customer_id);

-- Trigger para atualizar usage_count automaticamente
CREATE OR REPLACE FUNCTION update_coupon_usage_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE coupons 
  SET usage_count = usage_count + 1, 
      updated_at = NOW()
  WHERE id = NEW.coupon_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_coupon_redemption ON coupon_redemptions;
CREATE TRIGGER trigger_coupon_redemption
AFTER INSERT ON coupon_redemptions
FOR EACH ROW
EXECUTE FUNCTION update_coupon_usage_count();

-- Trigger para expirar cupons automaticamente
CREATE OR REPLACE FUNCTION expire_coupons()
RETURNS void AS $$
BEGIN
  UPDATE coupons 
  SET status = 'EXPIRED', updated_at = NOW()
  WHERE expiration_date < CURRENT_DATE 
    AND status = 'ACTIVE';
  
  UPDATE coupons 
  SET status = 'DISABLED', updated_at = NOW()
  WHERE usage_limit IS NOT NULL 
    AND usage_count >= usage_limit 
    AND status = 'ACTIVE';
END;
$$ LANGUAGE plpgsql;
