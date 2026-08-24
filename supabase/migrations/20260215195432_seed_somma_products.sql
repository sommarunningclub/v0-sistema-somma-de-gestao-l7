
-- Insert products
INSERT INTO produtos (id, nome, descricao, preco, imagem_url, categoria) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'Regata Somma Essentials', 'Regata leve e respiravel para treinos intensos. Tecido dry-fit premium.', 89.90, '/images/regata.jpg', 'Unissex'),
  ('a2222222-2222-2222-2222-222222222222', 'Cropped Somma Power', 'Cropped feminino com suporte medio e tecido compressivo.', 119.90, '/images/cropped.jpg', 'Feminino'),
  ('a3333333-3333-3333-3333-333333333333', 'Hoodie Somma Oversized', 'Moletom oversized para pre e pos treino. Algodao premium 100%.', 199.90, '/images/hoodie.jpg', 'Unissex'),
  ('a4444444-4444-4444-4444-444444444444', 'Bone Somma Logo', 'Bone estruturado com logo bordado. Ajuste snapback.', 79.90, '/images/bone.jpg', 'Unissex'),
  ('a5555555-5555-5555-5555-555555555555', 'Short Somma Training', 'Short de treino com bolso lateral e tecido ultra leve.', 99.90, '/images/short.jpg', 'Masculino'),
  ('a6666666-6666-6666-6666-666666666666', 'Legging Somma Sculpt', 'Legging de alta compressao com cos largo. Tecido squat-proof.', 149.90, '/images/legging.jpg', 'Feminino');

-- Insert variations for Regata
INSERT INTO produto_variacoes (produto_id, tamanho, genero, estoque) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'P', 'Unissex', 15),
  ('a1111111-1111-1111-1111-111111111111', 'M', 'Unissex', 20),
  ('a1111111-1111-1111-1111-111111111111', 'G', 'Unissex', 10),
  ('a1111111-1111-1111-1111-111111111111', 'GG', 'Unissex', 5);

-- Insert variations for Cropped
INSERT INTO produto_variacoes (produto_id, tamanho, genero, estoque) VALUES
  ('a2222222-2222-2222-2222-222222222222', 'P', 'Feminino', 12),
  ('a2222222-2222-2222-2222-222222222222', 'M', 'Feminino', 18),
  ('a2222222-2222-2222-2222-222222222222', 'G', 'Feminino', 8);

-- Insert variations for Hoodie
INSERT INTO produto_variacoes (produto_id, tamanho, genero, estoque) VALUES
  ('a3333333-3333-3333-3333-333333333333', 'P', 'Unissex', 10),
  ('a3333333-3333-3333-3333-333333333333', 'M', 'Unissex', 15),
  ('a3333333-3333-3333-3333-333333333333', 'G', 'Unissex', 12),
  ('a3333333-3333-3333-3333-333333333333', 'GG', 'Unissex', 6);

-- Insert variations for Bone
INSERT INTO produto_variacoes (produto_id, tamanho, genero, estoque) VALUES
  ('a4444444-4444-4444-4444-444444444444', 'Unico', 'Unissex', 30);

-- Insert variations for Short
INSERT INTO produto_variacoes (produto_id, tamanho, genero, estoque) VALUES
  ('a5555555-5555-5555-5555-555555555555', 'P', 'Masculino', 10),
  ('a5555555-5555-5555-5555-555555555555', 'M', 'Masculino', 14),
  ('a5555555-5555-5555-5555-555555555555', 'G', 'Masculino', 8),
  ('a5555555-5555-5555-5555-555555555555', 'GG', 'Masculino', 4);

-- Insert variations for Legging
INSERT INTO produto_variacoes (produto_id, tamanho, genero, estoque) VALUES
  ('a6666666-6666-6666-6666-666666666666', 'P', 'Feminino', 10),
  ('a6666666-6666-6666-6666-666666666666', 'M', 'Feminino', 16),
  ('a6666666-6666-6666-6666-666666666666', 'G', 'Feminino', 9);
;
