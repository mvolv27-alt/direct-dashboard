-- Restaura lojas, valores recebidos por rede e valores base por setor.
-- Rode este arquivo no Supabase SQL Editor depois de criar as tabelas.

insert into public.lojas (id, nome, rede, endereco, bairro, cidade, uf, ativo) values
('00000000-0000-4000-8000-000000000101', 'Frangolandia - Varjota', 'Frangolandia', 'Rua Frei Mansueto, 909', 'Varjota', 'Fortaleza', 'CE', true),
('00000000-0000-4000-8000-000000000102', 'Hipermarket - Vila Uniao', 'Hipermarket', 'Rua Livreiro Gualter, 123', 'Vila Uniao', 'Fortaleza', 'CE', true),
('00000000-0000-4000-8000-000000000103', 'Hipermarket - Jardim Cearense', 'Hipermarket', 'Rua Rubens Monte, 380', 'Jardim Cearense', 'Fortaleza', 'CE', true),
('00000000-0000-4000-8000-000000000104', 'Hipermarket - Serrinha', 'Hipermarket', 'Rua Freire Alemao, 356', 'Serrinha', 'Fortaleza', 'CE', true),
('00000000-0000-4000-8000-000000000105', 'Hipermarket - Mondubim', 'Hipermarket', 'Av. Benjamim Brasil, 1099', 'Mondubim', 'Fortaleza', 'CE', true),
('00000000-0000-4000-8000-000000000106', 'Hipermarket - Eusebio', 'Hipermarket', 'Rua Embauba, 5', 'Eusebio', 'Eusebio', 'CE', true)
on conflict (id) do update set
  nome = excluded.nome,
  rede = excluded.rede,
  endereco = excluded.endereco,
  bairro = excluded.bairro,
  cidade = excluded.cidade,
  uf = excluded.uf,
  ativo = excluded.ativo,
  updated_at = now();

insert into public.rede_valores (id, rede, valor_recebido) values
('00000000-0000-4000-8000-000000000201', 'Frangolandia', 109.25),
('00000000-0000-4000-8000-000000000202', 'Hipermarket', 124.50)
on conflict (rede) do update set
  valor_recebido = excluded.valor_recebido,
  updated_at = now();

insert into public.setor_valores (id, setor, valor_min, valor_max) values
('00000000-0000-4000-8000-000000000301', 'Acougueiro', 85, 90),
('00000000-0000-4000-8000-000000000302', 'Balconista de Acougue', 85, 90),
('00000000-0000-4000-8000-000000000303', 'Balconista de Frios', 85, 90),
('00000000-0000-4000-8000-000000000304', 'Balconista de Padaria', 85, 90),
('00000000-0000-4000-8000-000000000305', 'Forneiro', 85, 90),
('00000000-0000-4000-8000-000000000306', 'Limpeza', 85, 90),
('00000000-0000-4000-8000-000000000307', 'Operador de caixa', 85, 90),
('00000000-0000-4000-8000-000000000308', 'Repositor de Frios', 85, 90),
('00000000-0000-4000-8000-000000000309', 'Repositor de Hortifruti', 85, 90),
('00000000-0000-4000-8000-000000000310', 'Repositor de Mercearia', 85, 90)
on conflict (setor) do update set
  valor_min = excluded.valor_min,
  valor_max = excluded.valor_max,
  updated_at = now();
