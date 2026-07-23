-- Execute depois das migrations 20260723182000 e 20260723183000.
-- As assercoes interrompem a verificacao quando a fundacao estiver incompleta.

do $$
declare
  required_table text;
  policy_count integer;
begin
  foreach required_table in array array[
    'demanda_vagas', 'demanda_alocacoes',
    'demanda_frequencias', 'demanda_reposicoes', 'audit_log'
  ]
  loop
    if to_regclass('public.' || required_table) is null then
      raise exception 'Tabela V2 ausente: public.%', required_table;
    end if;
  end loop;

  if to_regprocedure('private.direct_is_admin(uuid)') is null
    or to_regprocedure('private.direct_is_active(uuid)') is null then
    raise exception 'Funcoes privadas de autorizacao nao foram criadas.';
  end if;

  select count(*) into policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename in ('diaristas', 'demandas', 'registros_financeiros')
    and coalesce(qual, '') like '%direct_is_admin%';

  if policy_count < 3 then
    raise exception 'Politicas administrativas incompletas nas tabelas privadas.';
  end if;

  if not exists (
    select 1
    from public.profiles
    where lower(email) = lower('mvolv27@gmail.com')
      and role = 'admin'
      and active = true
  ) then
    raise exception 'Perfil administrativo principal nao esta ativo.';
  end if;

  if has_function_privilege('authenticated', 'public.is_admin(uuid)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.is_active(uuid)', 'EXECUTE') then
    raise exception 'Wrappers publicos de autorizacao ainda estao expostos como RPC.';
  end if;
end;
$$;

select
  p.email,
  p.role,
  p.active,
  count(distinct d.id) as diaristas,
  count(distinct dm.id) as demandas,
  count(distinct rf.id) as registros_financeiros
from public.profiles p
left join public.diaristas d on d.user_id = p.id
left join public.demandas dm on dm.user_id = p.id
left join public.registros_financeiros rf on rf.user_id = p.id
group by p.id, p.email, p.role, p.active
order by p.role, p.email;

select
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles', 'diaristas', 'demandas', 'registros_financeiros',
    'lojas', 'rede_valores', 'setor_valores', 'setores_custom',
    'copy_templates', 'audit_log', 'demanda_vagas', 'demanda_alocacoes',
    'demanda_frequencias', 'demanda_reposicoes'
  )
order by tablename, policyname;

select
  schemaname,
  tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and tablename in (
    'demanda_vagas', 'demanda_alocacoes',
    'demanda_frequencias', 'demanda_reposicoes'
  )
order by tablename;
