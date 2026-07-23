# Matriz de Acesso

## Perfis

### Administrador

- Visualiza dados operacionais de todos os supervisores.
- Filtra resultados por supervisor.
- Gerencia equipe, convites, perfis ativos e permissoes.
- Cadastra, edita e remove redes, lojas e setores.
- Edita os modelos globais de texto.
- Consulta a auditoria completa.
- Nao pode apagar o historico de auditoria pela aplicacao.

### Supervisor

- Visualiza e altera somente seus diaristas, demandas, vagas, alocacoes,
  frequencias e financeiro.
- Consulta todos os catalogos compartilhados.
- Pode criar itens em catalogos compartilhados.
- Pode editar ou remover um item compartilhado criado por ele, enquanto nao
  existir dependencia operacional; o administrador pode administrar qualquer
  item.
- Consulta os modelos globais de texto, sem permissao de alteracao.
- Consulta apenas eventos de auditoria ligados aos seus registros.

### Conta inativa

- Nao consulta nem altera dados.
- Nao recebe eventos Realtime privados.
- Precisa ter sessoes revogadas quando for desativada.

## Matriz por recurso

| Recurso | Administrador | Supervisor |
| --- | --- | --- |
| Perfis e convites | Gerencia todos | Le o proprio perfil |
| Redes, lojas e setores | Gerencia todos | Le todos; gerencia os proprios |
| Diaristas | Le e gerencia todos | Le e gerencia os proprios |
| Demandas e vagas | Le e gerencia todas | Le e gerencia as proprias |
| Alocacoes e frequencias | Le e gerencia todas | Le e gerencia as proprias |
| Financeiro | Le e gerencia todos | Le e gerencia o proprio |
| Modelos de texto | Le e edita | Somente leitura |
| Auditoria | Le tudo | Le eventos dos proprios registros |

## Regras obrigatorias de banco

- Toda tabela operacional possui `user_id not null`.
- `user_id` nunca e aceito como autoridade vindo da interface; a policy exige
  `auth.uid()` ou privilegio administrativo.
- Toda leitura e escrita passa por RLS.
- Funcoes administrativas usam `security definer`, `search_path` fixo e
  permissao de execucao restrita.
- Chaves de servico existem somente em Edge Functions.
- Views expostas usam `security_invoker = true`.
- Operacoes financeiras e de presenca que alteram mais de uma tabela usam RPC
  transacional.

## Testes de isolamento

1. Supervisor A cria diarista, demanda, vaga e lancamento.
2. Supervisor B nao consegue ler, editar nem excluir esses registros.
3. Administrador consegue consultar os dois supervisores.
4. Os dois supervisores conseguem consultar redes, lojas e setores.
5. Supervisor B nao consegue editar um modelo global de texto.
6. Conta desativada perde leitura, escrita e Realtime.

