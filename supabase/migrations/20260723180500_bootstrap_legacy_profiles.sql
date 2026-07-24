-- Bootstrap idempotente para instalacoes legadas que criaram as tabelas
-- operacionais sem a tabela de perfis.

begin;

do $$
begin
  if to_regclass('public.profiles') is null then
    create table public.profiles (
      id uuid primary key references auth.users(id) on delete cascade,
      nome text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    grant select, insert, update, delete on public.profiles to authenticated;
    grant all on public.profiles to service_role;
    alter table public.profiles enable row level security;

    create policy "users manage own profile"
    on public.profiles for all to authenticated
    using (auth.uid() = id)
    with check (auth.uid() = id);
  end if;
end;
$$;

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated
before update on public.profiles
for each row execute function public.update_updated_at_column();

insert into public.profiles (id, nome)
select
  users.id,
  coalesce(
    users.raw_user_meta_data ->> 'nome',
    users.raw_user_meta_data ->> 'full_name',
    split_part(users.email, '@', 1)
  )
from auth.users as users
on conflict (id) do update set
  nome = coalesce(nullif(public.profiles.nome, ''), excluded.nome);

commit;
