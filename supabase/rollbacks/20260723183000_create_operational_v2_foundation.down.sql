-- Rollback protegido da fundacao operacional V2.
-- So funciona antes do backfill. Se houver dados, interrompe sem apagar nada.

begin;

do $$
declare
  total bigint;
begin
  select
    (select count(*) from public.demanda_vagas)
    + (select count(*) from public.demanda_alocacoes)
    + (select count(*) from public.demanda_frequencias)
    + (select count(*) from public.demanda_reposicoes)
  into total;

  if total > 0 then
    raise exception 'Rollback interrompido: existem % registros nas tabelas V2.', total;
  end if;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'demanda_reposicoes',
    'demanda_frequencias',
    'demanda_alocacoes',
    'demanda_vagas'
  ]
  loop
    if exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime drop table public.%I', table_name);
    end if;
  end loop;
end;
$$;

drop table public.demanda_reposicoes;
drop table public.demanda_frequencias;
drop table public.demanda_alocacoes;
drop table public.demanda_vagas;

drop function private.direct_set_updated_at();
drop function private.direct_alocacao_owned(uuid, uuid, uuid);
drop function private.direct_diarista_owned(uuid, uuid);
drop function private.direct_vaga_owned(uuid, uuid);
drop function private.direct_demanda_owned(uuid, uuid);
drop function private.direct_is_active(uuid);
drop function private.direct_is_admin(uuid);

commit;
