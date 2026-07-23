-- Direct Promocoes - preparar/acertar o acesso de Marcus Venicius
-- Execute no Supabase SQL Editor DEPOIS de migracao-administracao-equipe-auditoria.sql.

begin;

do $$
begin
  if to_regclass('public.supervisor_invites') is null then
    raise exception 'Execute primeiro migracao-administracao-equipe-auditoria.sql';
  end if;
  if not exists (
    select 1 from auth.users where lower(email) = lower('mvolv27@gmail.com')
  ) then
    raise exception 'O usuario administrador mvolv27@gmail.com nao foi encontrado em Authentication';
  end if;
end;
$$;

-- Se o usuario ainda nao existe no Auth, deixa o convite preparado.
insert into public.supervisor_invites (
  email,
  role,
  status,
  invited_by,
  invited_user_id,
  invited_at,
  accepted_at
)
select
  'marcustuf@gmail.com',
  'supervisor',
  case when invited.id is null then 'pending' else 'accepted' end,
  admin_user.id,
  invited.id,
  now(),
  case when invited.id is null then null else now() end
from auth.users admin_user
left join auth.users invited
  on lower(invited.email) = lower('marcustuf@gmail.com')
where lower(admin_user.email) = lower('mvolv27@gmail.com')
limit 1
on conflict (email) do update set
  role = 'supervisor',
  status = excluded.status,
  invited_by = excluded.invited_by,
  invited_user_id = excluded.invited_user_id,
  invited_at = excluded.invited_at,
  accepted_at = excluded.accepted_at;

-- Se Marcus ja estiver em Authentication > Users, cria ou corrige o perfil.
insert into public.profiles (id, nome, email, role, active)
select
  id,
  'Marcus Venicius',
  coalesce(email, 'marcustuf@gmail.com'),
  'supervisor',
  true
from auth.users
where lower(email) = lower('marcustuf@gmail.com')
on conflict (id) do update set
  nome = 'Marcus Venicius',
  email = 'marcustuf@gmail.com',
  role = 'supervisor',
  active = true;

commit;

-- Resultado esperado: perfil ativo se o usuario ja existir; caso contrario,
-- convite pendente pronto para ser enviado pela aba Configuracoes > Equipe.
select
  invite.email,
  invite.role,
  invite.status,
  profile.nome,
  profile.active
from public.supervisor_invites invite
left join public.profiles profile on profile.id = invite.invited_user_id
where lower(invite.email) = lower('marcustuf@gmail.com');
