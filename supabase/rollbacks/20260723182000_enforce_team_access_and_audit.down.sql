-- Rollback nao destrutivo: remove a visibilidade administrativa dos dados
-- privados. Convites, perfis e auditoria sao preservados para nao perder dados.

begin;

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

    execute format(
      'create policy %I on public.%I for all to authenticated using (private.direct_is_active() and user_id = auth.uid()) with check (private.direct_is_active() and user_id = auth.uid())',
      'rollback private owner ' || table_name, table_name
    );
  end loop;
end;
$$;

commit;

