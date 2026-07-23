-- Direct Promocoes - administracao, equipe, dados compartilhados e auditoria
-- Execute uma vez no Supabase > SQL Editor, depois da migracao de isolamento.

begin;

alter table public.profiles add column if not exists email text not null default '';
alter table public.profiles add column if not exists role text not null default 'supervisor';
alter table public.profiles add column if not exists active boolean not null default true;

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
set email = u.email
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

create or replace function public.is_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = check_user_id and role = 'admin' and active = true
  );
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated, service_role;

create or replace function public.is_active(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = check_user_id and active = true
  );
$$;

revoke all on function public.is_active(uuid) from public;
grant execute on function public.is_active(uuid) to authenticated, service_role;

create table if not exists public.supervisor_invites (
  id uuid primary key default extensions.gen_random_uuid(),
  email text not null,
  role text not null default 'supervisor' check (role in ('admin', 'supervisor')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled', 'failed')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  invited_user_id uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (email)
);

alter table public.supervisor_invites enable row level security;
grant select, insert, update, delete on public.supervisor_invites to authenticated;

drop policy if exists "admins manage supervisor invites" on public.supervisor_invites;
create policy "admins manage supervisor invites"
on public.supervisor_invites for all to authenticated
using (public.is_admin())
with check (public.is_admin() and invited_by = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invited_role text;
begin
  select role into invited_role
  from public.supervisor_invites
  where lower(email) = lower(new.email)
    and status = 'pending'
  limit 1;

  if lower(new.email) = lower('mvolv27@gmail.com') then
    invited_role := 'admin';
  end if;

  if invited_role is null then
    raise exception 'Este e-mail nao possui um convite ativo para o Direct Promocoes';
  end if;

  insert into public.profiles (id, nome, email, role, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(new.email, ''),
    coalesce(invited_role, 'supervisor'),
    true
  )
  on conflict (id) do update set
    email = excluded.email,
    nome = coalesce(public.profiles.nome, excluded.nome);

  update public.supervisor_invites
  set status = 'accepted', invited_user_id = new.id, accepted_at = now()
  where lower(email) = lower(new.email) and status = 'pending';

  return new;
end;
$$;

drop policy if exists "users manage own profile" on public.profiles;
drop policy if exists "profiles read own or admin" on public.profiles;
drop policy if exists "admins manage profiles" on public.profiles;
alter table public.profiles enable row level security;
grant select, update on public.profiles to authenticated;

create policy "profiles read own or admin"
on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin());

create policy "admins manage profiles"
on public.profiles for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Garante que novos usuarios passem pela regra de convite mesmo em projetos
-- onde o trigger original ainda nao tenha sido criado.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Dados operacionais continuam privados e deixam de responder para contas bloqueadas.
do $$
declare
  table_name text;
  policy_row record;
begin
  foreach table_name in array array['diaristas', 'demandas', 'registros_financeiros']
  loop
    for policy_row in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = table_name
    loop
      execute format('drop policy if exists %I on public.%I', policy_row.policyname, table_name);
    end loop;
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_active() and auth.uid() = user_id) with check (public.is_active() and auth.uid() = user_id)',
      'private active owner ' || table_name, table_name
    );
  end loop;
end;
$$;

-- Lojas, redes e setores sao catalogos compartilhados. Todos podem consultar
-- e cadastrar; somente o criador ou um administrador pode editar/excluir.
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
      'create policy %I on public.%I for select to authenticated using (public.is_active())',
      'shared read ' || table_name, table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.is_active() and auth.uid() = user_id)',
      'shared insert ' || table_name, table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.is_active() and (auth.uid() = user_id or public.is_admin())) with check (public.is_active() and (auth.uid() = user_id or public.is_admin()))',
      'shared update ' || table_name, table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_active() and (auth.uid() = user_id or public.is_admin()))',
      'shared delete ' || table_name, table_name
    );
  end loop;
end;
$$;

-- Os modelos de texto sao globais, mas apenas o administrador altera.
delete from public.copy_templates
where user_id <> (
  select id from auth.users where lower(email) = lower('mvolv27@gmail.com') limit 1
);

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

create policy "authenticated read copy templates"
on public.copy_templates for select to authenticated using (public.is_active());
create policy "admins insert copy templates"
on public.copy_templates for insert to authenticated
with check (public.is_active() and public.is_admin() and auth.uid() = user_id);
create policy "admins update copy templates"
on public.copy_templates for update to authenticated
using (public.is_active() and public.is_admin()) with check (public.is_active() and public.is_admin());
create policy "admins delete copy templates"
on public.copy_templates for delete to authenticated using (public.is_active() and public.is_admin());

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
create index if not exists audit_log_record_idx on public.audit_log (table_name, record_id);
alter table public.audit_log enable row level security;
grant select on public.audit_log to authenticated;

drop policy if exists "audit read own or admin" on public.audit_log;
create policy "audit read own or admin"
on public.audit_log for select to authenticated
using (public.is_active() and (public.is_admin() or actor_id = auth.uid() or owner_id = auth.uid()));

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_mail text := '';
  row_owner uuid;
  row_id text;
begin
  if actor is not null then
    select coalesce(email, '') into actor_mail from auth.users where id = actor;
  end if;

  if tg_op = 'DELETE' then
    row_id := old.id::text;
    row_owner := old.user_id;
    insert into public.audit_log (
      table_name, record_id, action, actor_id, actor_email, owner_id, old_data
    ) values (
      tg_table_name, row_id, 'deleted', actor, actor_mail, row_owner, to_jsonb(old)
    );
    return old;
  elsif tg_op = 'INSERT' then
    row_id := new.id::text;
    row_owner := new.user_id;
    insert into public.audit_log (
      table_name, record_id, action, actor_id, actor_email, owner_id, new_data
    ) values (
      tg_table_name, row_id, 'created', actor, actor_mail, row_owner, to_jsonb(new)
    );
    return new;
  else
    row_id := new.id::text;
    row_owner := new.user_id;
    insert into public.audit_log (
      table_name, record_id, action, actor_id, actor_email, owner_id, old_data, new_data
    ) values (
      tg_table_name, row_id, 'updated', actor, actor_mail, row_owner, to_jsonb(old), to_jsonb(new)
    );
    return new;
  end if;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'diaristas', 'demandas', 'registros_financeiros', 'setores_custom',
    'lojas', 'setor_valores', 'rede_valores', 'copy_templates'
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

-- Resultado esperado:
-- select email, role, active from public.profiles order by email;
-- select public.is_admin((select id from auth.users where email = 'mvolv27@gmail.com'));
