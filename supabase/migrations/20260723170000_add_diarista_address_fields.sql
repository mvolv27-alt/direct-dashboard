alter table public.diaristas
  add column if not exists estado text not null default '',
  add column if not exists cidade text not null default '',
  add column if not exists endereco text not null default '',
  add column if not exists cep text not null default '';
