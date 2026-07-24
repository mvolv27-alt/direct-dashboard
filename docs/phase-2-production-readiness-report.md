# Direct Promocoes - Relatorio da Fase 2

Data: 2026-07-23

## Resultado

A promocao da fundacao de seguranca para producao foi concluida sem perda de
dados. O schema legado foi preservado e a estrutura V2 foi adicionada de forma
compativel com identificadores `text` e `uuid`.

## Backup e recuperacao

- Backup protegido em `C:\Users\vinip\Documents\Direct-Backups\2026-07-23-pre-producao-fase2`.
- Dump PostgreSQL completo, schema SQL, dados SQL e snapshot JSON incluidos.
- Todos os arquivos possuem hash SHA-256 registrado no `manifest.json`.
- `pg_restore --list` e a descompactacao integral do archive foram aprovados.
- O teste de restauracao em banco descartavel depende apenas de reiniciar o
  Windows para concluir a inicializacao do Docker Desktop.

## Seguranca aplicada

- Senha do banco de producao rotacionada e conexao validada.
- Senha da conta administrativa rotacionada; a senha antiga foi rejeitada e a
  nova foi validada.
- Credencial administrativa guardada fora do repositorio com ACL NTFS restrita.
- Perfis `admin` e `supervisor` ativos no banco.
- RLS habilitado nas 15 tabelas operacionais e administrativas verificadas.
- Nenhuma linha operacional ficou sem `user_id`.
- O papel `anon` ficou com zero permissoes em tabelas e funcoes do schema
  `public`; usuarios autenticados continuam funcionando normalmente.
- Wrappers publicos de autorizacao e auditoria ficaram acessiveis apenas ao
  `service_role`.

## Dados preservados

- 45 diaristas.
- 25 demandas.
- 18 lojas.
- 11 valores por setor.
- 3 valores por rede.
- 1 setor customizado.
- 1 conjunto de textos pre-salvos.
- 0 registros financeiros existentes antes e depois da promocao.
- Total operacional preservado: 104 registros.

## Banco e migrations

- Bootstrap de `public.profiles` aplicado.
- Isolamento por supervisor, equipe, convites e auditoria aplicados.
- Fundacao V2 de vagas, alocacoes, frequencias e reposicoes aplicada.
- Compatibilidade automatica entre IDs legados `text` e instalacoes `uuid`.
- Privilegios anonimos redundantes removidos.
- Historico local e remoto reconciliado, com 13 migrations alinhadas.
- Postflight V2 aprovado.

## Testes aprovados

- TypeScript sem erros.
- ESLint sem erros; permanecem 8 avisos de Fast Refresh em componentes de UI.
- Agente de solicitacoes: 9 cenarios aprovados.
- Build de producao aprovado.
- Isolamento real: supervisor nao le dados privados do administrador.
- Catalogos compartilhados: supervisor le as 18 lojas.
- Administrador le os 45 diaristas privados e os dois perfis da equipe.
- Realtime em homologacao aprovado na repeticao apos uma falha transitoria.
- Cliente anonimo bloqueado e cliente autenticado aprovado em producao.

## Pendencias nao bloqueantes

- Reiniciar o Windows e executar um restore completo do dump em banco
  descartavel para comprovar o ciclo de desastre ponta a ponta.
- Separar o chunk principal de aproximadamente 606 kB para melhorar o primeiro
  carregamento em celulares.
- Atualizar a base Browserslist, atualmente desatualizada.
- Eliminar os 8 avisos de Fast Refresh reorganizando exports utilitarios.
