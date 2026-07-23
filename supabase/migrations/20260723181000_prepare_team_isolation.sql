-- Direct Promocoes - prepara o schema legado para isolamento por supervisor.
-- Requer que o usuario administrador ja exista em Authentication > Users.

begin;

do $$
declare
  required_table text;
begin
  foreach required_table in array array[
    'profiles', 'diaristas', 'demandas', 'registros_financeiros',
    'setores_custom', 'lojas', 'setor_valores', 'rede_valores'
  ]
  loop
    if to_regclass('public.' || required_table) is null then
      raise exception 'Pre-requisito ausente: tabela public.%', required_table;
    end if;
  end loop;

  if not exists (
    select 1
    from auth.users
    where lower(email) = lower('mvolv27@gmail.com')
  ) then
    raise exception 'Crie e confirme mvolv27@gmail.com em Authentication > Users antes desta migration';
  end if;
end;
$$;

alter table public.lojas
  add column if not exists responsavel text not null default '';

create table if not exists public.copy_templates (
  id text primary key default gen_random_uuid()::text,
  user_id uuid default auth.uid() references auth.users(id) on delete cascade,
  escala_gerente text not null default 'ESCALA FECHADA' || chr(10) || chr(10) || '[Escala]',
  vagas_disponiveis text not null default 'VAGAS DISPONIVEIS' || chr(10) || chr(10) || '[Vagas]',
  escala_diarista text not null default 'CONFIRMACAO DE ESCALA' || chr(10) || chr(10) || '[EscalaDiarista]',
  texto_falta text not null default 'Em caso de falta, avise com antecedencia.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_copy_templates_updated_at on public.copy_templates;
create trigger trg_copy_templates_updated_at
before update on public.copy_templates
for each row execute function public.update_updated_at_column();

grant select, insert, update, delete on public.copy_templates to authenticated;
grant all on public.copy_templates to service_role;
alter table public.copy_templates enable row level security;

do $$
declare
  owner_id uuid;
  target_table text;
begin
  select id into owner_id
  from auth.users
  where lower(email) = lower('mvolv27@gmail.com')
  limit 1;

  foreach target_table in array array[
    'diaristas', 'demandas', 'registros_financeiros', 'setores_custom',
    'lojas', 'setor_valores', 'rede_valores', 'copy_templates'
  ]
  loop
    execute format(
      'alter table public.%I add column if not exists user_id uuid default auth.uid()',
      target_table
    );
    execute format(
      'update public.%I set user_id = $1 where user_id is null',
      target_table
    ) using owner_id;
    execute format(
      'alter table public.%I alter column user_id set default auth.uid()',
      target_table
    );
    execute format(
      'alter table public.%I alter column user_id set not null',
      target_table
    );

    if not exists (
      select 1
      from pg_constraint
      where conname = target_table || '_user_id_fkey'
        and conrelid = ('public.' || target_table)::regclass
    ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (user_id) references auth.users(id) on delete cascade',
        target_table,
        target_table || '_user_id_fkey'
      );
    end if;
  end loop;
end;
$$;

alter table public.setores_custom drop constraint if exists setores_custom_nome_key;
alter table public.setor_valores drop constraint if exists setor_valores_setor_key;
alter table public.rede_valores drop constraint if exists rede_valores_rede_key;

create unique index if not exists setores_custom_user_nome_key
  on public.setores_custom (user_id, nome);
create unique index if not exists setor_valores_user_setor_key
  on public.setor_valores (user_id, setor);
create unique index if not exists rede_valores_user_rede_key
  on public.rede_valores (user_id, rede);
create unique index if not exists copy_templates_user_key
  on public.copy_templates (user_id);

create index if not exists diaristas_user_id_idx on public.diaristas (user_id);
create index if not exists demandas_user_data_idx on public.demandas (user_id, data);
create index if not exists registros_financeiros_user_data_idx
  on public.registros_financeiros (user_id, data);
create index if not exists lojas_user_rede_idx on public.lojas (user_id, rede);

do $$
declare
  policy_row record;
  target_table text;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'diaristas', 'demandas', 'registros_financeiros', 'setores_custom',
        'lojas', 'setor_valores', 'rede_valores', 'copy_templates'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  end loop;

  foreach target_table in array array[
    'diaristas', 'demandas', 'registros_financeiros', 'setores_custom',
    'lojas', 'setor_valores', 'rede_valores', 'copy_templates'
  ]
  loop
    execute format('alter table public.%I enable row level security', target_table);
    execute format(
      'create policy %I on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      'direct own rows ' || target_table,
      target_table
    );
  end loop;
end;
$$;

do $$
declare
  target_table text;
  null_count bigint;
begin
  foreach target_table in array array[
    'diaristas', 'demandas', 'registros_financeiros', 'setores_custom',
    'lojas', 'setor_valores', 'rede_valores', 'copy_templates'
  ]
  loop
    execute format('select count(*) from public.%I where user_id is null', target_table)
      into null_count;

    if null_count > 0 then
      raise exception 'A tabela % possui % registro(s) sem user_id', target_table, null_count;
    end if;
  end loop;
end;
$$;

commit;
