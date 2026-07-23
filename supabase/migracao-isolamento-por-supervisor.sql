-- Direct Promocoes - isolamento de dados por supervisor
-- Execute este arquivo uma vez no Supabase > SQL Editor ANTES de publicar o novo front-end.
-- Os dados existentes serao vinculados ao login abaixo. Novas contas comecam vazias.

begin;

alter table public.lojas
  add column if not exists responsavel text not null default '';

do $$
declare
  owner_id uuid;
  table_name text;
begin
  select id into owner_id
  from auth.users
  where lower(email) = lower('mvolv27@gmail.com')
  limit 1;

  if owner_id is null then
    raise exception 'Usuario mvolv27@gmail.com nao encontrado em Authentication > Users';
  end if;

  foreach table_name in array array[
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
    execute format(
      'alter table public.%I add column if not exists user_id uuid default auth.uid()',
      table_name
    );
    execute format(
      'update public.%I set user_id = $1 where user_id is null',
      table_name
    ) using owner_id;
    execute format(
      'alter table public.%I alter column user_id set default auth.uid()',
      table_name
    );
    execute format(
      'alter table public.%I alter column user_id set not null',
      table_name
    );

    if not exists (
      select 1
      from pg_constraint
      where conname = table_name || '_user_id_fkey'
        and conrelid = ('public.' || table_name)::regclass
    ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (user_id) references auth.users(id) on delete cascade',
        table_name,
        table_name || '_user_id_fkey'
      );
    end if;
  end loop;
end;
$$;

-- As antigas restricoes eram globais e impediam dois supervisores de usarem o mesmo nome.
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

-- Remove as politicas antigas que permitiam acesso a todos os autenticados.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'diaristas',
        'demandas',
        'registros_financeiros',
        'setores_custom',
        'lojas',
        'setor_valores',
        'rede_valores',
        'copy_templates'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  end loop;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
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
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      'direct own rows ' || table_name,
      table_name
    );
  end loop;
end;
$$;

-- Interrompe a migracao caso alguma tabela ainda esteja sem isolamento.
do $$
declare
  table_name text;
  null_count bigint;
  protected_tables integer;
begin
  foreach table_name in array array[
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
    execute format('select count(*) from public.%I where user_id is null', table_name)
      into null_count;

    if null_count > 0 then
      raise exception 'A tabela % possui % registro(s) sem user_id', table_name, null_count;
    end if;
  end loop;

  select count(distinct tablename)
    into protected_tables
  from pg_policies
  where schemaname = 'public'
    and tablename in (
      'diaristas',
      'demandas',
      'registros_financeiros',
      'setores_custom',
      'lojas',
      'setor_valores',
      'rede_valores',
      'copy_templates'
    )
    and roles @> array['authenticated']::name[]
    and coalesce(qual, '') like '%auth.uid()%user_id%'
    and coalesce(with_check, '') like '%auth.uid()%user_id%';

  if protected_tables <> 8 then
    raise exception 'Isolamento incompleto: somente % de 8 tabelas possuem politica por usuario', protected_tables;
  end if;
end;
$$;

commit;

-- Verificacao opcional: cada linha deve possuir user_id.
-- select 'demandas' tabela, user_id, count(*) from public.demandas group by user_id;
-- select 'diaristas' tabela, user_id, count(*) from public.diaristas group by user_id;
