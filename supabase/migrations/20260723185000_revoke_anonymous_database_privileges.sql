-- Direct Promocoes - least privilege for unauthenticated API access.
-- Authenticated grants and RLS policies remain unchanged.

begin;

revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;
revoke execute on all functions in schema public from public, anon;

alter default privileges in schema public
  revoke all privileges on tables from anon;
alter default privileges in schema public
  revoke all privileges on sequences from anon;
alter default privileges in schema public
  revoke execute on functions from public, anon;

-- Trigger and authorization helpers are invoked by table owners or through RLS,
-- not as direct client RPCs.
revoke all on function public.update_updated_at_column() from authenticated;

grant execute on function public.is_admin(uuid) to service_role;
grant execute on function public.is_active(uuid) to service_role;
grant execute on function public.write_audit_log() to service_role;

commit;
