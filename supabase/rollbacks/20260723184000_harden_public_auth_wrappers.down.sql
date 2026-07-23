-- Rollback de compatibilidade. Reabre somente os wrappers publicos antigos.

begin;

grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.is_active(uuid) to authenticated;

commit;
