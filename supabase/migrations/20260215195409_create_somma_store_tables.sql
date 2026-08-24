
-- Drop existing tables if they exist
DROP TABLE IF EXISTS pedido_itens CASCADE;
DROP TABLE IF EXISTS pedidos CASCADE;
DROP TABLE IF EXISTS clientes_pedidos CASCADE;
DROP TABLE IF EXISTS produto_variacoes CASCADE;
DROP TABLE IF EXISTS produtos CASCADE;
DROP SEQUENCE IF EXISTS pedido_numero_seq CASCADE;

-- Create produtos table
CREATE TABLE produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  preco NUMERIC(10,2) NOT NULL,
  imagem_url TEXT,
  categoria TEXT DEFAULT 'Unissex',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create produto_variacoes table
CREATE TABLE produto_variacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  tamanho TEXT NOT NULL,
  genero TEXT NOT NULL DEFAULT 'Unissex',
  estoque INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create sequence for pedido number
CREATE SEQUENCE pedido_numero_seq START 1000;

-- Create pedidos table
CREATE TABLE pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_pedido INTEGER NOT NULL DEFAULT nextval('pedido_numero_seq'),
  cliente_nome TEXT NOT NULL,
  cliente_email TEXT NOT NULL,
  cliente_telefone TEXT NOT NULL,
  cliente_cpf TEXT NOT NULL,
  cliente_cep TEXT NOT NULL,
  tipo_entrega TEXT NOT NULL DEFAULT 'entrega',
  valor_frete NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_total NUMERIC(10,2) NOT NULL,
  status_pagamento TEXT NOT NULL DEFAULT 'pendente',
  asaas_payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create pedido_itens table
CREATE TABLE pedido_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id),
  produto_nome TEXT NOT NULL,
  variacao TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 1,
  preco_unitario NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create clientes_pedidos table
CREATE TABLE clientes_pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE produto_variacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes_pedidos ENABLE ROW LEVEL SECURITY;

-- RLS policies - public read for products
CREATE POLICY "public_read_produtos" ON produtos FOR SELECT USING (true);
CREATE POLICY "public_read_variacoes" ON produto_variacoes FOR SELECT USING (true);

-- RLS policies - pedidos
CREATE POLICY "public_insert_pedidos" ON pedidos FOR INSERT WITH CHECK (true);
CREATE POLICY "public_select_pedidos" ON pedidos FOR SELECT USING (true);
CREATE POLICY "public_update_pedidos" ON pedidos FOR UPDATE USING (true);

-- RLS policies - pedido_itens
CREATE POLICY "public_insert_pedido_itens" ON pedido_itens FOR INSERT WITH CHECK (true);
CREATE POLICY "public_select_pedido_itens" ON pedido_itens FOR SELECT USING (true);

-- RLS policies - clientes_pedidos
CREATE POLICY "public_insert_clientes" ON clientes_pedidos FOR INSERT WITH CHECK (true);
CREATE POLICY "public_select_clientes" ON clientes_pedidos FOR SELECT USING (true);
CREATE POLICY "public_update_clientes" ON clientes_pedidos FOR UPDATE USING (true);
;
