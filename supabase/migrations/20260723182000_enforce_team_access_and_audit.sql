-- Direct Promocoes - controle de acesso canonico e auditoria segura.
-- Requer que migracao-isolamento-por-supervisor.sql tenha sido aplicada.

begin;

do $$
declare
  required_table text;
begin
  foreach required_table in array array[
    'profiles', 'diaristas', 'demandas', 'registros_financeiros',
    'setores_custom', 'lojas', 'setor_valores', 'rede_valores', 'copy_templates'
  ]
  loop
    if to_regclass('public.' || required_table) is null then
      raise exception 'Pre-requisito ausente: tabela public.%', required_table;
    end if;
  end loop;

  foreach required_table in array array[
    'diaristas', 'demandas', 'registros_financeiros', 'setores_custom',
    'lojas', 'setor_valores', 'rede_valores', 'copy_templates'
  ]
  loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and information_schema.columns.table_name = required_table
        and information_schema.columns.column_name = 'user_id'
    ) then
      raise exception 'Pre-requisito ausente: public.%.user_id', required_table;
    end if;
  end loop;
end;
$$;

alter table public.profiles add column if not exists email text not null default '';
alter table public.profiles add column if not exists role text not null default 'supervisor';
alter table public.profiles add column if not exists active boolean not null default true;

update public.profiles
set role = 'supervisor'
where role not in ('admin', 'supervisor') or role is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_role_check check (role in ('admin', 'supervisor'));
  end if;
end;
$$;

update public.profiles p
set email = coalesce(u.email, '')
from auth.users u
where p.id = u.id and coalesce(p.email, '') = '';

insert into public.profiles (id, nome, email, role, active)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)),
  coalesce(u.email, ''),
  case when lower(u.email) = lower('mvolv27@gmail.com') then 'admin' else 'supervisor' end,
  true
from auth.users u
on conflict (id) do update set
  email = excluded.email,
  role = case
    when lower(excluded.email) = lower('mvolv27@gmail.com') then 'admin'
    else public.profiles.role
  end;

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
    select 1 from public.profiles
    where id = check_user_id and role = 'admin' and active = true
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
    select 1 from public.profiles
    where id = check_user_id and active = true
  );
$$;

revoke all on function private.direct_is_admin(uuid) from public, anon;
revoke all on function private.direct_is_active(uuid) from public, anon;
grant execute on function private.direct_is_admin(uuid) to authenticated, service_role;
grant execute on function private.direct_is_active(uuid) to authenticated, service_role;

create or replace function public.is_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = private, pg_temp
as $$ select private.direct_is_admin(check_user_id); $$;

create or replace function public.is_active(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = private, pg_temp
as $$ select private.direct_is_active(check_user_id); $$;

revoke all on function public.is_admin(uuid) from public, anon;
revoke all on function public.is_active(uuid) from public, anon;
grant execute on function public.is_admin(uuid) to authenticated, service_role;
grant execute on function public.is_active(uuid) to authenticated, service_role;

create table if not exists public.supervisor_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null default 'supervisor' check (role in ('admin', 'supervisor')),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'cancelled', 'failed')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  invited_user_id uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz
);

grant select, insert, update, delete on public.supervisor_invites to authenticated;
grant all on public.supervisor_invites to service_role;
alter table public.supervisor_invites enable row level security;
drop policy if exists "admins manage supervisor invites" on public.supervisor_invites;
create policy "admins manage supervisor invites"
on public.supervisor_invites for all to authenticated
using (private.direct_is_admin())
with check (private.direct_is_admin() and invited_by = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  invited_role text;
begin
  select role into invited_role
  from public.supervisor_invites
  where lower(email) = lower(new.email) and status = 'pending'
  limit 1;

  if lower(new.email) = lower('mvolv27@gmail.com') then
    invited_role := 'admin';
  end if;

  if invited_role is null then
    raise exception 'Este e-mail nao possui convite ativo para o Direct Promocoes';
  end if;

  insert into public.profiles (id, nome, email, role, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(new.email, ''),
    invited_role,
    true
  )
  on conflict (id) do update set
    email = excluded.email,
    nome = coalesce(nullif(public.profiles.nome, ''), excluded.nome);

  update public.supervisor_invites
  set status = 'accepted', invited_user_id = new.id, accepted_at = now()
  where lower(email) = lower(new.email) and status = 'pending';

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
grant select on public.profiles to authenticated;
revoke update on public.profiles from authenticated;
grant update (nome, email, role, active) on public.profiles to authenticated;
drop policy if exists "users manage own profile" on public.profiles;
drop policy if exists "profiles read own or admin" on public.profiles;
drop policy if exists "admins manage profiles" on public.profiles;
create policy "profiles read own or admin"
on public.profiles for select to authenticated
using (id = auth.uid() or private.direct_is_admin());
create policy "admins manage profiles"
on public.profiles for update to authenticated
using (private.direct_is_admin())
with check (private.direct_is_admin());

do $$
declare
  table_name text;
  policy_row record;
  null_count bigint;
begin
  foreach table_name in array array['diaristas', 'demandas', 'registros_financeiros']
  loop
    execute format('select count(*) from public.%I where user_id is null', table_name)
      into null_count;
    if null_count > 0 then
      raise exception 'Tabela % possui % registros sem proprietario.', table_name, null_count;
    end if;

    for policy_row in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = table_name
    loop
      execute format('drop policy if exists %I on public.%I', policy_row.policyname, table_name);
    end loop;

    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.direct_is_active() and (user_id = auth.uid() or private.direct_is_admin()))',
      'private select owner or admin ' || table_name, table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (private.direct_is_active() and user_id = auth.uid())',
      'private insert owner ' || table_name, table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (private.direct_is_active() and (user_id = auth.uid() or private.direct_is_admin())) with check (private.direct_is_active() and (user_id = auth.uid() or private.direct_is_admin()))',
      'private update owner or admin ' || table_name, table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (private.direct_is_active() and (user_id = auth.uid() or private.direct_is_admin()))',
      'private delete owner or admin ' || table_name, table_name
    );
  end loop;
end;
$$;

do $$
declare
  table_name text;
  policy_row record;
begin
  foreach table_name in array array['lojas', 'rede_valores', 'setor_valores', 'setores_custom']
  loop
    for policy_row in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = table_name
    loop
      execute format('drop policy if exists %I on public.%I', policy_row.policyname, table_name);
    end loop;

    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.direct_is_active())',
      'shared select active ' || table_name, table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (private.direct_is_active() and user_id = auth.uid())',
      'shared insert owner ' || table_name, table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (private.direct_is_active() and (user_id = auth.uid() or private.direct_is_admin())) with check (private.direct_is_active() and (user_id = auth.uid() or private.direct_is_admin()))',
      'shared update owner or admin ' || table_name, table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (private.direct_is_active() and (user_id = auth.uid() or private.direct_is_admin()))',
      'shared delete owner or admin ' || table_name, table_name
    );
  end loop;
end;
$$;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'copy_templates'
  loop
    execute format('drop policy if exists %I on public.copy_templates', policy_row.policyname);
  end loop;
end;
$$;

alter table public.copy_templates enable row level security;
create policy "copy templates read active"
on public.copy_templates for select to authenticated
using (private.direct_is_active());
create policy "copy templates insert admin"
on public.copy_templates for insert to authenticated
with check (private.direct_is_active() and private.direct_is_admin() and user_id = auth.uid());
create policy "copy templates update admin"
on public.copy_templates for update to authenticated
using (private.direct_is_active() and private.direct_is_admin())
with check (private.direct_is_active() and private.direct_is_admin());
create policy "copy templates delete admin"
on public.copy_templates for delete to authenticated
using (private.direct_is_active() and private.direct_is_admin());

create table if not exists public.audit_log (
  id bigint generated by default as identity primary key,
  table_name text not null,
  record_id text not null,
  action text not null check (action in ('created', 'updated', 'deleted')),
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text not null default '',
  owner_id uuid references auth.users(id) on delete set null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);
create index if not exists audit_log_actor_idx on public.audit_log (actor_id, created_at desc);
create index if not exists audit_log_owner_idx on public.audit_log (owner_id, created_at desc);
create index if not exists audit_log_record_idx on public.audit_log (table_name, record_id);
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
drop policy if exists "audit read own or admin" on public.audit_log;
create policy "audit read own or admin"
on public.audit_log for select to authenticated
using (
  private.direct_is_active()
  and (private.direct_is_admin() or actor_id = auth.uid() or owner_id = auth.uid())
);

create or replace function private.direct_redact_audit(payload jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $$
  select case when payload is null then null else payload - array[
    'cpf', 'telefone', 'endereco', 'cep', 'password',
    'access_token', 'refresh_token'
  ] end;
$$;

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  actor uuid := auth.uid();
  actor_mail text := '';
  source_row jsonb;
  row_owner uuid;
  row_id text;
begin
  if actor is not null then
    select coalesce(email, '') into actor_mail from auth.users where id = actor;
  end if;

  source_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  row_id := coalesce(source_row ->> 'id', '');
  row_owner := nullif(
    case when tg_table_name = 'profiles' then source_row ->> 'id' else source_row ->> 'user_id' end,
    ''
  )::uuid;

  if tg_op = 'DELETE' then
    insert into public.audit_log (
      table_name, record_id, action, actor_id, actor_email, owner_id, old_data
    ) values (
      tg_table_name, row_id, 'deleted', actor, actor_mail, row_owner,
      private.direct_redact_audit(to_jsonb(old))
    );
    return old;
  elsif tg_op = 'INSERT' then
    insert into public.audit_log (
      table_name, record_id, action, actor_id, actor_email, owner_id, new_data
    ) values (
      tg_table_name, row_id, 'created', actor, actor_mail, row_owner,
      private.direct_redact_audit(to_jsonb(new))
    );
    return new;
  else
    insert into public.audit_log (
      table_name, record_id, action, actor_id, actor_email, owner_id, old_data, new_data
    ) values (
      tg_table_name, row_id, 'updated', actor, actor_mail, row_owner,
      private.direct_redact_audit(to_jsonb(old)),
      private.direct_redact_audit(to_jsonb(new))
    );
    return new;
  end if;
end;
$$;

revoke all on function private.direct_redact_audit(jsonb) from public, anon, authenticated;
revoke all on function public.write_audit_log() from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'diaristas', 'demandas', 'registros_financeiros',
    'setores_custom', 'lojas', 'setor_valores', 'rede_valores', 'copy_templates'
  ]
  loop
    execute format('drop trigger if exists direct_audit_trigger on public.%I', table_name);
    execute format(
      'create trigger direct_audit_trigger after insert or update or delete on public.%I for each row execute function public.write_audit_log()',
      table_name
    );
  end loop;
end;
$$;

commit;
