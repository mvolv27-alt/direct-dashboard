-- Read-only RLS smoke test for the administrator and supervisor profiles.
-- The transaction is always rolled back and does not change application data.

begin;

select set_config(
  'direct.test.admin_id',
  (select id::text from public.profiles where role = 'admin' and active limit 1),
  true
);
select set_config(
  'direct.test.supervisor_id',
  (select id::text from public.profiles where role = 'supervisor' and active limit 1),
  true
);
select set_config(
  'direct.test.private_total',
  (select count(*)::text from public.diaristas),
  true
);
select set_config(
  'direct.test.supervisor_private_total',
  (
    select count(*)::text
    from public.diaristas
    where user_id = current_setting('direct.test.supervisor_id')::uuid
  ),
  true
);
select set_config(
  'direct.test.shared_total',
  (select count(*)::text from public.lojas),
  true
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  current_setting('direct.test.supervisor_id'),
  true
);

do $$
declare
  visible_private bigint;
  visible_shared bigint;
  visible_profiles bigint;
begin
  select count(*) into visible_private from public.diaristas;
  select count(*) into visible_shared from public.lojas;
  select count(*) into visible_profiles from public.profiles;

  if visible_private <> current_setting('direct.test.supervisor_private_total')::bigint then
    raise exception 'RLS supervisor expôs registros privados de outro usuário';
  end if;
  if visible_shared <> current_setting('direct.test.shared_total')::bigint then
    raise exception 'RLS supervisor bloqueou cadastros compartilhados';
  end if;
  if visible_profiles <> 1 then
    raise exception 'RLS supervisor expôs perfis indevidos';
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  current_setting('direct.test.admin_id'),
  true
);

do $$
declare
  visible_private bigint;
  visible_profiles bigint;
begin
  select count(*) into visible_private from public.diaristas;
  select count(*) into visible_profiles from public.profiles;

  if visible_private <> current_setting('direct.test.private_total')::bigint then
    raise exception 'Administrador não consegue visualizar todos os registros privados';
  end if;
  if visible_profiles < 2 then
    raise exception 'Administrador não consegue visualizar a equipe';
  end if;
end;
$$;

reset role;

select
  'passed' as result,
  current_setting('direct.test.private_total')::bigint as admin_private_rows,
  current_setting('direct.test.supervisor_private_total')::bigint as supervisor_private_rows,
  current_setting('direct.test.shared_total')::bigint as shared_store_rows;

rollback;
