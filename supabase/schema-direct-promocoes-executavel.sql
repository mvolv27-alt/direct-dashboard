-- Direct Promocoes - schema executavel para Supabase
-- Como usar:
-- 1. Abra o Supabase > SQL Editor.
-- 2. Cole este arquivo inteiro.
-- 3. Clique em Run.
-- 4. Na Vercel, configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.
--
-- O app atual usa estas tabelas:
-- diaristas, demandas, registros_financeiros, setores_custom,
-- lojas, setor_valores, rede_valores e copy_templates.
-- As tabelas antigas direct_diaristas/direct_solicitacoes nao sao usadas pelo codigo atual.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================
-- DIARISTAS
-- =========================
create table if not exists public.diaristas (
  id text primary key default gen_random_uuid()::text,
  nome text not null,
  cpf text not null default '',
  telefone text not null default '',
  bairro text not null default '',
  setor_experiencia text[] not null default '{}',
  presencas integer not null default 0,
  faltas integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_diaristas_updated_at on public.diaristas;
create trigger trg_diaristas_updated_at
before update on public.diaristas
for each row execute function public.update_updated_at_column();

-- =========================
-- DEMANDAS
-- =========================
create table if not exists public.demandas (
  id text primary key default gen_random_uuid()::text,
  codigo text not null default '',
  data date not null,
  horario text not null default '',
  horario_entrada text not null default '',
  horario_saida text not null default '',
  rede text not null default '',
  loja text not null default '',
  setor text not null default '',
  valor numeric(10,2) not null default 0,
  diarista_id text null,
  diarista_nome text not null default '',
  tarefas_total integer not null default 1,
  tarefas_concluidas integer not null default 0,
  status text not null default 'pendente',
  check_in_at timestamptz null,
  check_in_by text not null default '',
  observacoes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_demandas_updated_at on public.demandas;
create trigger trg_demandas_updated_at
before update on public.demandas
for each row execute function public.update_updated_at_column();

create index if not exists idx_demandas_data on public.demandas(data);
create index if not exists idx_demandas_status on public.demandas(status);
create index if not exists idx_demandas_diarista on public.demandas(diarista_id);
create index if not exists idx_demandas_rede_loja_setor on public.demandas(rede, loja, setor);

-- =========================
-- REGISTROS FINANCEIROS
-- =========================
create table if not exists public.registros_financeiros (
  id text primary key default gen_random_uuid()::text,
  diarista_id text null,
  diarista_nome text not null default '',
  loja text not null default '',
  data date not null,
  horario_entrada text not null default '',
  horario_saida text not null default '',
  setor text not null default '',
  valor_diaria numeric(10,2) not null default 0,
  passagem numeric(10,2) not null default 0,
  adiantamento numeric(10,2) not null default 0,
  custos_adicionais numeric(10,2) not null default 0,
  pago boolean not null default false,
  pago_em timestamptz null,
  observacoes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_registros_financeiros_updated_at on public.registros_financeiros;
create trigger trg_registros_financeiros_updated_at
before update on public.registros_financeiros
for each row execute function public.update_updated_at_column();

create index if not exists idx_registros_data on public.registros_financeiros(data);
create index if not exists idx_registros_diarista on public.registros_financeiros(diarista_id);
create index if not exists idx_registros_pago on public.registros_financeiros(pago);

-- =========================
-- SETORES CUSTOMIZADOS
-- =========================
create table if not exists public.setores_custom (
  id text primary key default gen_random_uuid()::text,
  nome text not null unique,
  created_at timestamptz not null default now()
);

-- =========================
-- LOJAS
-- =========================
create table if not exists public.lojas (
  id text primary key default gen_random_uuid()::text,
  nome text not null,
  rede text not null default '',
  endereco text not null default '',
  bairro text not null default '',
  cidade text not null default 'Fortaleza',
  uf text not null default 'CE',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_lojas_updated_at on public.lojas;
create trigger trg_lojas_updated_at
before update on public.lojas
for each row execute function public.update_updated_at_column();

create index if not exists idx_lojas_rede on public.lojas(rede);

-- =========================
-- VALORES POR SETOR
-- =========================
create table if not exists public.setor_valores (
  id text primary key default gen_random_uuid()::text,
  setor text not null unique,
  valor_min numeric(10,2) not null default 0,
  valor_max numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_setor_valores_updated_at on public.setor_valores;
create trigger trg_setor_valores_updated_at
before update on public.setor_valores
for each row execute function public.update_updated_at_column();

-- =========================
-- VALORES RECEBIDOS POR REDE
-- =========================
create table if not exists public.rede_valores (
  id text primary key default gen_random_uuid()::text,
  rede text not null unique,
  valor_recebido numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_rede_valores_updated_at on public.rede_valores;
create trigger trg_rede_valores_updated_at
before update on public.rede_valores
for each row execute function public.update_updated_at_column();

-- =========================
-- TEXTOS PRE-SALVOS DE COPIA
-- =========================
create table if not exists public.copy_templates (
  id text primary key default 'default',
  escala_gerente text not null default '📋 *ESCALA FECHADA*' || chr(10) || chr(10) || '[Escala]',
  vagas_disponiveis text not null default '🟢 *VAGAS DISPONÍVEIS*' || chr(10) || chr(10) || '[Vagas]',
  escala_diarista text not null default '✅ *CONFIRMAÇÃO DE ESCALA*' || chr(10) || chr(10) || '📍 [RedeLoja]' || chr(10) || '🏷️ [Setor]' || chr(10) || chr(10) || '*Diarista:* [Diarista]' || chr(10) || '*CPF:* [CPF]' || chr(10) || chr(10) || '[EscalaDiarista]' || chr(10) || chr(10) || chr(10) || '[FaltaTexto]',
  texto_falta text not null default '⚠️ Em caso de falta, avise com antecedência. Faltas sem aviso podem prejudicar as empresas e oportunidades futuras.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_copy_templates_updated_at on public.copy_templates;
create trigger trg_copy_templates_updated_at
before update on public.copy_templates
for each row execute function public.update_updated_at_column();

-- =========================
-- RLS / PERMISSOES
-- =========================
grant select, insert, update, delete on public.diaristas to authenticated;
grant select, insert, update, delete on public.demandas to authenticated;
grant select, insert, update, delete on public.registros_financeiros to authenticated;
grant select, insert, update, delete on public.setores_custom to authenticated;
grant select, insert, update, delete on public.lojas to authenticated;
grant select, insert, update, delete on public.setor_valores to authenticated;
grant select, insert, update, delete on public.rede_valores to authenticated;
grant select, insert, update, delete on public.copy_templates to authenticated;

alter table public.diaristas enable row level security;
alter table public.demandas enable row level security;
alter table public.registros_financeiros enable row level security;
alter table public.setores_custom enable row level security;
alter table public.lojas enable row level security;
alter table public.setor_valores enable row level security;
alter table public.rede_valores enable row level security;
alter table public.copy_templates enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'diaristas',
    'demandas',
    'registros_financeiros',
    'setores_custom',
    'lojas',
    'setor_valores',
    'rede_valores',
    'copy_templates'
  ]
  loop
    execute format('drop policy if exists "direct authenticated read %1$s" on public.%1$I', t);
    execute format('drop policy if exists "direct authenticated insert %1$s" on public.%1$I', t);
    execute format('drop policy if exists "direct authenticated update %1$s" on public.%1$I', t);
    execute format('drop policy if exists "direct authenticated delete %1$s" on public.%1$I', t);

    execute format('create policy "direct authenticated read %1$s" on public.%1$I for select to authenticated using (true)', t);
    execute format('create policy "direct authenticated insert %1$s" on public.%1$I for insert to authenticated with check (true)', t);
    execute format('create policy "direct authenticated update %1$s" on public.%1$I for update to authenticated using (true) with check (true)', t);
    execute format('create policy "direct authenticated delete %1$s" on public.%1$I for delete to authenticated using (true)', t);
  end loop;
end;
$$;

-- =========================
-- SEEDS BASICOS
-- =========================
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
  ativo = excluded.ativo;

insert into public.rede_valores (id, rede, valor_recebido) values
('00000000-0000-4000-8000-000000000201', 'Frangolandia', 109.25),
('00000000-0000-4000-8000-000000000202', 'Hipermarket', 124.50)
on conflict (rede) do update set valor_recebido = excluded.valor_recebido;

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
  valor_max = excluded.valor_max;

insert into public.copy_templates (id)
values ('default')
on conflict (id) do nothing;

-- =========================
-- REALTIME
-- =========================
alter table public.diaristas replica identity full;
alter table public.demandas replica identity full;
alter table public.registros_financeiros replica identity full;
alter table public.setores_custom replica identity full;
alter table public.lojas replica identity full;
alter table public.setor_valores replica identity full;
alter table public.rede_valores replica identity full;
alter table public.copy_templates replica identity full;

do $$
declare
  t text;
begin
  foreach t in array array[
    'diaristas',
    'demandas',
    'registros_financeiros',
    'setores_custom',
    'lojas',
    'setor_valores',
    'rede_valores',
    'copy_templates'
  ]
  loop
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
      and not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = t
      )
    then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

-- Resultado esperado:
-- select table_name from information_schema.tables
-- where table_schema = 'public'
-- and table_name in (
--   'diaristas','demandas','registros_financeiros','setores_custom',
--   'lojas','setor_valores','rede_valores','copy_templates'
-- );
