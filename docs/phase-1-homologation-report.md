# Relatorio da Homologacao - Fase 1

Data: 2026-07-23

Projeto Supabase: `direct-promocoes-homologacao`

Project ID: `fnwiwixyzhcrvmucjkxg`

## Resultado

A fundacao de banco, seguranca, isolamento, auditoria e Realtime foi aprovada
na homologacao. Nenhuma migration desta fase foi aplicada ao projeto de
producao.

## Validacoes aprovadas

- Projeto de homologacao confirmado como diferente da producao.
- Cadeia completa de migrations aplicada e registrada no historico remoto.
- Preflight e postflight SQL executados sem erro.
- Administrador ativo e reconhecido por perfil.
- Supervisor A nao le dados privados do Supervisor B.
- Supervisor B nao le demandas nem financeiro do Supervisor A.
- Administrador le os registros dos dois supervisores.
- Catalogos compartilhados podem ser lidos por supervisores ativos.
- Supervisor nao edita catalogo criado por outro supervisor.
- Administrador consegue administrar catalogos compartilhados.
- Supervisor nao consegue criar modelos globais de texto.
- Auditoria registra criacao, edicao e exclusao.
- CPF, telefone, endereco, CEP, senhas e tokens sao removidos do payload de auditoria.
- Realtime atualiza duas sessoes da mesma conta.
- Realtime nao entrega registro privado a outro supervisor.
- Registros temporarios dos testes foram removidos.
- TypeScript, lint, agente e build de producao aprovados.
- `npm audit --omit=dev`: zero vulnerabilidades conhecidas.

## Falhas encontradas e corrigidas

1. O historico antigo nao criava todos os pre-requisitos para um banco novo.
   Foi adicionada a migration de preparacao `20260723181000`.
2. Migrations antigas tentavam alterar `realtime.messages`, uma tabela interna
   que nao pertence ao usuario PostgreSQL em projetos hospedados. Os comandos
   desnecessarios foram removidos.
3. Os wrappers publicos `is_admin` e `is_active` estavam expostos como RPC com
   `SECURITY DEFINER`. A migration `20260723184000` removeu a execucao para
   usuarios autenticados.
4. O primeiro teste Realtime nao reproduzia o filtro usado pelo aplicativo.
   O teste foi alinhado ao filtro por `user_id` e comprovou sincronizacao sem
   vazamento entre supervisores.
5. O React Router possuia duas vulnerabilidades moderadas conhecidas. A
   dependencia foi atualizada para a linha corrigida e toda a suite passou.

## Avisos restantes

- O Security Advisor informa que a protecao contra senhas vazadas esta
  desativada. O recurso depende do plano Pro do Supabase. Enquanto nao estiver
  disponivel, usar senhas unicas, fortes e armazenadas em gerenciador.
- O ESLint possui oito avisos de Fast Refresh, sem erros.
- O bundle principal esta acima de 500 kB e deve ser dividido na fase de
  desempenho mobile.
- O teste visual completo do deploy web ainda deve ser realizado antes de
  promover as migrations para producao.

## Proxima decisao

Nao promover diretamente para producao ainda. Primeiro:

1. Publicar os arquivos desta fase no GitHub e no deploy de homologacao.
2. Executar smoke test visual de login, demandas, diaristas, financeiro,
   configuracoes e agente no desktop e no iPhone.
3. Criar backup recuperavel da producao.
4. Reconciliar o historico de migrations da producao antes de qualquer
   `db push`.
5. Repetir isolamento e Realtime contra o deploy final de homologacao.
