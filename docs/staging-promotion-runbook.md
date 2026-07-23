# Homologacao e Promocao da Fundacao V2

## Estado atual

As migrations e os testes de isolamento estao preparados. Este computador nao
possui Docker, PostgreSQL, Supabase CLI, token de gerenciamento, senha do banco
nem tres contas exclusivas de teste. Por isso nenhum banco remoto foi alterado.

## Regra principal

Nao use `supabase db push` no projeto de producao enquanto o historico de
migrations executadas manualmente nao estiver reconciliado. Os scripts antigos
foram aplicados pelo SQL Editor e podem nao constar na tabela de historico da
CLI.

## Preparacao da homologacao

1. Criar um projeto Supabase separado para homologacao.
2. Nunca copiar CPF, telefone ou endereco reais para esse projeto.
3. Criar tres contas exclusivas:
   - administrador `mvolv27@gmail.com`;
   - supervisor A;
   - supervisor B.
   Todas devem estar confirmadas antes de executar as migrations.
4. Copiar `.env.test.example` para `.env.test`.
5. Preencher apenas chaves publicas e credenciais dessas contas.
6. Confirmar `TEST_EXPECTED_PROJECT_ID`.
7. Manter `TEST_ALLOW_REMOTE_MUTATION=false` ate a conferencia final.

## Projeto novo de homologacao

1. Criar e confirmar as tres contas em Authentication > Users.
2. Vincular a CLI ao projeto de homologacao.
3. Executar as migrations na ordem dos nomes dos arquivos. A migration
   `20260723181000_prepare_team_isolation.sql` fecha a lacuna existente no
   historico antigo e prepara o banco para as migrations de seguranca e V2.
4. Executar `verification/20260723_preflight_foundation_v2.sql` antes da V2.
5. Executar `verification/20260723_postflight_foundation_v2.sql` ao final.

Se o schema-base for aplicado manualmente pelo SQL Editor, use esta ordem:

1. `schema-direct-promocoes-executavel.sql`.
2. `migrations/20260723181000_prepare_team_isolation.sql`.
3. `migrations/20260723182000_enforce_team_access_and_audit.sql`.
4. `verification/20260723_preflight_foundation_v2.sql`.
5. `migrations/20260723183000_create_operational_v2_foundation.sql`.
6. `verification/20260723_postflight_foundation_v2.sql`.

Nao execute simultaneamente o schema avulso e toda a cadeia antiga de
migrations. Escolha um unico caminho para evitar objetos e seeds duplicados.

## Teste de isolamento

Depois da verificacao manual:

```powershell
$env:TEST_ALLOW_REMOTE_MUTATION='true'
npm.cmd run test:isolation
```

O teste cria registros identificados como homologacao e os remove no bloco
`finally`. Ele valida:

- cada supervisor le apenas seus dados privados;
- o administrador le dados dos dois supervisores;
- lojas sao compartilhadas para leitura;
- um supervisor nao edita a loja criada pelo outro;
- o administrador pode administrar a loja;
- supervisor nao cria modelo global de texto.

## Backup de producao

Antes da promocao:

1. Confirmar um backup recuperavel no painel do Supabase.
2. Exportar as contagens do preflight.
3. Registrar o horario e o responsavel pela janela de manutencao.
4. Suspender temporariamente novas edicoes durante a migration.
5. Manter os arquivos de rollback disponiveis.

## Criterios para promover

- Preflight sem erro.
- Postflight sem erro.
- Teste de tres contas aprovado.
- `npm.cmd run verify` aprovado.
- `npm.cmd audit --omit=dev` sem vulnerabilidades.
- Login, convite e primeiro acesso verificados.
- Realtime confirmado entre dois navegadores.
- Nenhuma duplicidade nova em redes e lojas.
- Contagens antes e depois documentadas.

## Retorno

Se a criacao das tabelas V2 falhar antes do backfill, executar o rollback V2.
Se o controle administrativo causar regressao, executar o rollback nao
destrutivo de acesso. Depois de existir backfill, nenhum rollback pode apagar
tabelas V2; a reversao passa a ser feita por compatibilidade de leitura.
