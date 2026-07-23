# Direct Promocoes - Preparacao da Producao

Data: 2026-07-23

## Estado verificado

- Projeto de producao: `wmiqyzbnvbqzunlgcyqj`.
- Projeto de homologacao: `fnwiwixyzhcrvmucjkxg`.
- Os dois projetos estavam ativos e saudaveis no momento da verificacao.
- A producao possui 104 registros operacionais nas tabelas principais.
- Nenhuma linha operacional possui `user_id` nulo.
- A conta administrativa foi encontrada entre as duas contas existentes.
- As politicas antigas de isolamento por proprietario estao ativas.

## Incompatibilidades encontradas

- A producao ainda nao possui `public.profiles`.
- A producao nao possui `supabase_migrations.schema_migrations`.
- O dump nativo da CLI nao pode ser executado sem Docker Desktop ou um cliente
  PostgreSQL compativel.
- O teste Realtime apresentou uma falha transitoria e passou na repeticao. A
  janela de espera foi ampliada para reduzir falsos negativos em projetos frios.

## Protecao criada

- Foi gerado um snapshot JSON fora do repositorio com dados operacionais,
  metadados de contas, colunas e politicas.
- O snapshot recebeu hash SHA-256 e permissao NTFS restrita ao usuario local,
  sistema e administradores.
- Os scripts de preflight, postflight e rollback foram copiados para o mesmo
  diretorio protegido.
- A migration `20260723180500_bootstrap_legacy_profiles.sql` cria a tabela de
  perfis apenas quando ela estiver ausente e preserva ambientes ja atualizados.

## Validacao na homologacao

- Bootstrap legado: aprovado.
- Postflight V2: aprovado.
- Isolamento entre administrador e supervisores: aprovado.
- Realtime entre duas sessoes da mesma conta sem vazamento: aprovado na
  repeticao apos a primeira falha transitoria.

## Bloqueios antes de alterar a producao

1. Rotacionar a credencial que apareceu no historico publico do GitHub.
2. Produzir um dump PostgreSQL completo ou confirmar um backup gerenciado
   recuperavel no painel do Supabase.
3. Reconciliar o historico de migrations da producao.
4. Definir uma janela curta sem novas edicoes para aplicar e verificar as
   migrations.
