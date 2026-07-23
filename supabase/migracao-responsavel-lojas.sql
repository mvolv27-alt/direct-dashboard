-- Direct Promocoes - adiciona o responsavel ao cadastro de lojas.
-- Execute no Supabase > SQL Editor. Pode ser executado mais de uma vez.

alter table public.lojas
  add column if not exists responsavel text not null default '';
