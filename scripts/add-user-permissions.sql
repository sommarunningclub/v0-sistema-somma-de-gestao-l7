-- Add permissions column to users table for module-level access control
-- Run this migration to enable per-module permissions

-- Add permissions column as JSONB (flexible structure for modules)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{
  "dashboard": true,
  "checkin": false,
  "membros": false,
  "assinantes": false,
  "parceiro": false,
  "carteiras": false,
  "pagamentos": false,
  "admin": false
}'::jsonb;

-- Update existing admin users to have full permissions
UPDATE users 
SET permissions = '{
  "dashboard": true,
  "checkin": true,
  "membros": true,
  "assinantes": true,
  "parceiro": true,
  "carteiras": true,
  "pagamentos": true,
  "admin": true
}'::jsonb
WHERE role = 'admin';

-- Update existing manager users to have limited permissions  
UPDATE users 
SET permissions = '{
  "dashboard": true,
  "checkin": true,
  "membros": true,
  "assinantes": true,
  "parceiro": false,
  "carteiras": false,
  "pagamentos": false,
  "admin": false
}'::jsonb
WHERE role = 'manager';

-- Create index for faster permission queries
CREATE INDEX IF NOT EXISTS idx_users_permissions ON users USING gin(permissions);

-- Comment for documentation
COMMENT ON COLUMN users.permissions IS 'JSON object with module access permissions: dashboard, checkin, membros, assinantes, parceiro, carteiras, pagamentos, admin';
