-- Direct Promocoes - impede chamadas RPC diretas aos wrappers de autorizacao.
-- As politicas RLS usam exclusivamente as funcoes no schema private.

begin;

revoke all on function public.is_admin(uuid) from public, anon, authenticated;
revoke all on function public.is_active(uuid) from public, anon, authenticated;

grant execute on function public.is_admin(uuid) to service_role;
grant execute on function public.is_active(uuid) to service_role;

revoke all on function public.write_audit_log() from public, anon, authenticated;
grant execute on function public.write_audit_log() to service_role;

commit;
