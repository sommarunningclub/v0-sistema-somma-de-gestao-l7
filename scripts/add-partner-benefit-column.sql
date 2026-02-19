-- Add benefit column to partners table
ALTER TABLE partners ADD COLUMN IF NOT EXISTS benefit TEXT;

-- Add benefit_type column to categorize the benefit
ALTER TABLE partners ADD COLUMN IF NOT EXISTS benefit_type VARCHAR(50);

-- Comment on columns
COMMENT ON COLUMN partners.benefit IS 'Description of the benefit offered by the partnership';
COMMENT ON COLUMN partners.benefit_type IS 'Type/category of the benefit (discount, cashback, free_service, etc.)';
