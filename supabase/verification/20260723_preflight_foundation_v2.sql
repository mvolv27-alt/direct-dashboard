-- Execute no SQL Editor antes das migrations 20260723182000 e 20260723183000.
-- Este arquivo nao altera dados.

do $$
declare
  required_table text;
  ownerless bigint;
begin
  foreach required_table in array array[
    'profiles', 'diaristas', 'demandas', 'registros_financeiros',
    'setores_custom', 'lojas', 'setor_valores', 'rede_valores', 'copy_templates'
  ]
  loop
    if to_regclass('public.' || required_table) is null then
      raise exception 'Tabela obrigatoria ausente: public.%', required_table;
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
        and table_name = required_table
        and column_name = 'user_id'
    ) then
      raise exception 'Coluna obrigatoria ausente: public.%.user_id', required_table;
    end if;

    execute format('select count(*) from public.%I where user_id is null', required_table)
      into ownerless;
    if ownerless > 0 then
      raise exception 'Tabela public.% possui % linhas sem user_id', required_table, ownerless;
    end if;
  end loop;

  if not exists (
    select 1 from auth.users where lower(email) = lower('mvolv27@gmail.com')
  ) then
    raise exception 'Conta administrativa mvolv27@gmail.com nao encontrada.';
  end if;
end;
$$;

select 'profiles' as tabela, count(*) as registros from public.profiles
union all select 'diaristas', count(*) from public.diaristas
union all select 'demandas', count(*) from public.demandas
union all select 'registros_financeiros', count(*) from public.registros_financeiros
union all select 'setores_custom', count(*) from public.setores_custom
union all select 'lojas', count(*) from public.lojas
union all select 'setor_valores', count(*) from public.setor_valores
union all select 'rede_valores', count(*) from public.rede_valores
union all select 'copy_templates', count(*) from public.copy_templates
order by tabela;

select table_name, policy_name, roles, command, qual, with_check
from (
  select
    tablename as table_name,
    policyname as policy_name,
    roles,
    cmd as command,
    qual,
    with_check
  from pg_policies
  where schemaname = 'public'
) policies
where table_name in (
  'profiles', 'diaristas', 'demandas', 'registros_financeiros',
  'setores_custom', 'lojas', 'setor_valores', 'rede_valores', 'copy_templates'
)
order by table_name, policy_name;

select lower(trim(rede)) as chave, count(*) as quantidade
from public.rede_valores
group by lower(trim(rede))
having count(*) > 1
order by quantidade desc, chave;

select lower(trim(rede)) as rede, lower(trim(nome)) as loja, count(*) as quantidade
from public.lojas
group by lower(trim(rede)), lower(trim(nome))
having count(*) > 1
order by quantidade desc, rede, loja;

