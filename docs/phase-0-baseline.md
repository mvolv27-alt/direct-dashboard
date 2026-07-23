# Direct Promocoes - Baseline da Fase 0

Data: 2026-07-23

## Objetivo

Registrar um ponto de partida verificavel antes da normalizacao do banco e das
mudancas de seguranca. Nenhuma migration da Fase 1 foi aplicada em producao.

## Estado tecnico confirmado

- Aplicacao: React 18, Vite 6, TypeScript, Tailwind e Supabase.
- Hospedagem atual: Vercel.
- Rotas protegidas: Central, Agente, Demandas, Diaristas, Financeiro e
  Configuracoes.
- Sincronizacao: cache local por usuario, outbox offline, Realtime e consulta
  periodica de reconciliacao.
- Dados privados atuais: diaristas, demandas e registros financeiros.
- Catalogos compartilhados atuais: redes, lojas, setores e setores
  personalizados.
- Modelos de texto: leitura compartilhada e edicao administrativa.

## Validacoes executadas

- `npx.cmd tsc --noEmit -p tsconfig.app.json`: aprovado.
- `npm.cmd audit --omit=dev`: zero vulnerabilidades conhecidas.
- `npm.cmd run test:agent`: nove cenarios aprovados.
- `npm.cmd run build`: aprovado.
- `npm.cmd run lint`: zero erros e oito avisos de Fast Refresh em componentes
  compartilhados.
- `npm.cmd run test:isolation`: bloqueado ate a configuracao das duas contas de
  teste no ambiente local.

## Correcoes da Fase 0

- Removida a referencia inexistente a `vitest/globals` do TypeScript.
- Dependencias transitivas vulneraveis atualizadas pelo lockfile.
- Backup de fonte criado sem `.env`, `node_modules`, `dist`, logs ou artefatos
  antigos de auditoria.

## Ponto de restauracao

Arquivo:

`C:\Users\vinip\OneDrive\Documentos\Codex\2026-06-28\com\work\backups\direct-promocoes-fase0-20260723-163506.zip`

SHA-256:

`175907DA516AD6605EB6E75595016AC1A03882C9A5B83A1A8659C473E7E77C2C`

O arquivo contem 134 entradas. O banco remoto ainda precisa de um backup
independente no Supabase antes da primeira migration de producao.

## Riscos conhecidos antes da Fase 1

1. As alocacoes ainda ficam serializadas dentro de `demandas.observacoes`.
2. Duas edicoes concorrentes podem substituir o conjunto completo de
   alocacoes de uma demanda.
3. A politica atual de dados privados nao inclui explicitamente a leitura do
   administrador sobre dados dos supervisores.
4. CPF, telefone e endereco podem permanecer no cache local do navegador.
5. Scripts SQL importantes ainda estao separados da sequencia principal de
   migrations.
6. O TypeScript ainda usa modo gradual (`strict: false`). A ativacao sera feita
   por modulo, com testes, para nao criar uma alteracao ampla e insegura.
7. O bundle principal possui aproximadamente 589 kB antes da compressao e deve
   ser dividido nas fases de desempenho.
8. A migration V2 foi revisada estaticamente, mas ainda nao foi executada por
   um PostgreSQL local nem pelo Supabase remoto.

## Regra de liberacao

Uma etapa so pode seguir para producao quando tiver:

- migration de subida;
- rollback protegido;
- contagem antes e depois;
- testes com administrador e dois supervisores;
- build, TypeScript, lint e testes aprovados;
- confirmacao de que nenhuma linha privada ficou visivel para outro supervisor.
