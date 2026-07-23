-- Direct Promocoes - fundacao operacional V2
-- Esta migration cria a estrutura normalizada sem migrar nem alterar os dados
-- legados. Execute somente depois do backup remoto e dos testes de RLS.

begin;

do $$
declare
  requirement text;
begin
  foreach requirement in array array[
    'profiles.role',
    'profiles.active',
    'demandas.user_id',
    'diaristas.user_id'
  ]
  loop
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = split_part(requirement, '.', 1)
        and column_name = split_part(requirement, '.', 2)
    ) then
      raise exception 'Pre-requisito ausente: coluna public.%', requirement;
    end if;
  end loop;
end;
$$;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.direct_is_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = check_user_id
      and role = 'admin'
      and active = true
  );
$$;

create or replace function private.direct_is_active(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = check_user_id
      and active = true
  );
$$;

revoke all on function private.direct_is_admin(uuid) from public, anon;
revoke all on function private.direct_is_active(uuid) from public, anon;
grant execute on function private.direct_is_admin(uuid) to authenticated, service_role;
grant execute on function private.direct_is_active(uuid) to authenticated, service_role;

create or replace function private.direct_demanda_owned(check_id uuid, check_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.demandas
    where id = check_id and user_id = check_owner
  );
$$;

create or replace function private.direct_diarista_owned(check_id uuid, check_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.diaristas
    where id = check_id and user_id = check_owner
  );
$$;

revoke all on function private.direct_demanda_owned(uuid, uuid) from public, anon;
revoke all on function private.direct_diarista_owned(uuid, uuid) from public, anon;
grant execute on function private.direct_demanda_owned(uuid, uuid) to authenticated, service_role;
grant execute on function private.direct_diarista_owned(uuid, uuid) to authenticated, service_role;

create or replace function private.direct_set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.direct_set_updated_at() from public, anon, authenticated;

create table if not exists public.demanda_vagas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  demanda_id uuid not null references public.demandas(id) on delete cascade,
  numero integer not null check (numero > 0),
  status text not null default 'aberta'
    check (status in ('aberta', 'alocada', 'concluida', 'cancelada')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (demanda_id, numero)
);

create table if not exists public.demanda_alocacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vaga_id uuid not null references public.demanda_vagas(id) on delete cascade,
  diarista_id uuid references public.diaristas(id) on delete set null,
  diarista_nome text not null default '',
  status text not null default 'alocada'
    check (status in ('alocada', 'confirmada', 'recusada', 'removida', 'substituida')),
  alocado_em timestamptz not null default now(),
  confirmado_em timestamptz,
  encerrado_em timestamptz,
  observacoes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists demanda_alocacoes_vaga_ativa_key
on public.demanda_alocacoes (vaga_id)
where status in ('alocada', 'confirmada');

create table if not exists public.demanda_frequencias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  alocacao_id uuid not null unique references public.demanda_alocacoes(id) on delete cascade,
  resultado text not null check (resultado in ('presente', 'falta')),
  marcado_por uuid not null default auth.uid() references auth.users(id) on delete restrict,
  marcado_em timestamptz not null default now(),
  observacoes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.demanda_reposicoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vaga_id uuid not null references public.demanda_vagas(id) on delete cascade,
  alocacao_original_id uuid not null references public.demanda_alocacoes(id) on delete restrict,
  alocacao_reposicao_id uuid not null references public.demanda_alocacoes(id) on delete restrict,
  motivo text not null default '',
  criado_por uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (alocacao_original_id, alocacao_reposicao_id),
  check (alocacao_original_id <> alocacao_reposicao_id)
);

create or replace function private.direct_vaga_owned(check_id uuid, check_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.demanda_vagas
    where id = check_id and user_id = check_owner
  );
$$;

create or replace function private.direct_alocacao_owned(
  check_id uuid,
  check_owner uuid,
  check_vaga uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.demanda_alocacoes
    where id = check_id
      and user_id = check_owner
      and (check_vaga is null or vaga_id = check_vaga)
  );
$$;

revoke all on function private.direct_vaga_owned(uuid, uuid) from public, anon;
revoke all on function private.direct_alocacao_owned(uuid, uuid, uuid) from public, anon;
grant execute on function private.direct_vaga_owned(uuid, uuid) to authenticated, service_role;
grant execute on function private.direct_alocacao_owned(uuid, uuid, uuid) to authenticated, service_role;

create index if not exists demanda_vagas_owner_idx
  on public.demanda_vagas (user_id, demanda_id);
create index if not exists demanda_vagas_status_idx
  on public.demanda_vagas (user_id, status);
create index if not exists demanda_alocacoes_owner_idx
  on public.demanda_alocacoes (user_id, vaga_id);
create index if not exists demanda_alocacoes_diarista_idx
  on public.demanda_alocacoes (user_id, diarista_id);
create index if not exists demanda_frequencias_owner_idx
  on public.demanda_frequencias (user_id, resultado, marcado_em desc);
create index if not exists demanda_reposicoes_owner_idx
  on public.demanda_reposicoes (user_id, vaga_id);

create trigger demanda_vagas_set_updated_at
before update on public.demanda_vagas
for each row execute function private.direct_set_updated_at();

create trigger demanda_alocacoes_set_updated_at
before update on public.demanda_alocacoes
for each row execute function private.direct_set_updated_at();

create trigger demanda_frequencias_set_updated_at
before update on public.demanda_frequencias
for each row execute function private.direct_set_updated_at();

grant select, insert, update, delete on public.demanda_vagas to authenticated;
grant select, insert, update, delete on public.demanda_alocacoes to authenticated;
grant select, insert, update, delete on public.demanda_frequencias to authenticated;
grant select, insert, update, delete on public.demanda_reposicoes to authenticated;
grant all on public.demanda_vagas to service_role;
grant all on public.demanda_alocacoes to service_role;
grant all on public.demanda_frequencias to service_role;
grant all on public.demanda_reposicoes to service_role;

alter table public.demanda_vagas enable row level security;
alter table public.demanda_alocacoes enable row level security;
alter table public.demanda_frequencias enable row level security;
alter table public.demanda_reposicoes enable row level security;

create policy "v2 owner or admin demanda vagas"
on public.demanda_vagas for all to authenticated
using (
  private.direct_is_active()
  and (user_id = auth.uid() or private.direct_is_admin())
)
with check (
  private.direct_is_active()
  and (user_id = auth.uid() or private.direct_is_admin())
  and private.direct_demanda_owned(demanda_id, user_id)
);

create policy "v2 owner or admin demanda alocacoes"
on public.demanda_alocacoes for all to authenticated
using (
  private.direct_is_active()
  and (user_id = auth.uid() or private.direct_is_admin())
)
with check (
  private.direct_is_active()
  and (user_id = auth.uid() or private.direct_is_admin())
  and private.direct_vaga_owned(vaga_id, user_id)
  and (
    diarista_id is null
    or private.direct_diarista_owned(diarista_id, user_id)
  )
);

create policy "v2 owner or admin demanda frequencias"
on public.demanda_frequencias for all to authenticated
using (
  private.direct_is_active()
  and (user_id = auth.uid() or private.direct_is_admin())
)
with check (
  private.direct_is_active()
  and (user_id = auth.uid() or private.direct_is_admin())
  and private.direct_alocacao_owned(alocacao_id, user_id)
);

create policy "v2 owner or admin demanda reposicoes"
on public.demanda_reposicoes for all to authenticated
using (
  private.direct_is_active()
  and (user_id = auth.uid() or private.direct_is_admin())
)
with check (
  private.direct_is_active()
  and (user_id = auth.uid() or private.direct_is_admin())
  and private.direct_vaga_owned(vaga_id, user_id)
  and private.direct_alocacao_owned(alocacao_original_id, user_id, vaga_id)
  and private.direct_alocacao_owned(alocacao_reposicao_id, user_id, vaga_id)
);

alter table public.demanda_vagas replica identity full;
alter table public.demanda_alocacoes replica identity full;
alter table public.demanda_frequencias replica identity full;
alter table public.demanda_reposicoes replica identity full;

do $$
declare
  table_name text;
begin
  if to_regprocedure('public.write_audit_log()') is null then
    return;
  end if;

  foreach table_name in array array[
    'demanda_vagas',
    'demanda_alocacoes',
    'demanda_frequencias',
    'demanda_reposicoes'
  ]
  loop
    execute format(
      'create trigger direct_audit_trigger after insert or update or delete on public.%I for each row execute function public.write_audit_log()',
      table_name
    );
  end loop;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'demanda_vagas',
    'demanda_alocacoes',
    'demanda_frequencias',
    'demanda_reposicoes'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;

commit;
