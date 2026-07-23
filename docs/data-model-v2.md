# Modelo de Dados Operacional V2

## Motivo

Uma demanda pode possuir varias vagas e cada vaga pode passar por alocacao,
confirmacao, presenca, falta e reposicao. Essas entidades precisam existir em
linhas separadas para permitir concorrencia segura, auditoria e calculo
financeiro confiavel.

## Entidades

### `demandas`

Mantem rede, loja, setor, data, horarios, valor pago e observacoes gerais. A
coluna legada `tarefas_total` permanece durante a transicao.

### `demanda_vagas`

Representa uma vaga individual da demanda.

- `demanda_id`: demanda de origem.
- `user_id`: supervisor proprietario.
- `numero`: ordem da vaga dentro da demanda.
- `status`: `aberta`, `alocada`, `concluida` ou `cancelada`.
- `version`: controle otimista de concorrencia.
- Restricao unica: `(demanda_id, numero)`.

### `demanda_alocacoes`

Registra quem foi colocado em uma vaga.

- Mantem `diarista_nome` como fotografia historica.
- Estados: `alocada`, `confirmada`, `recusada`, `removida` ou `substituida`.
- Uma vaga pode ter historico de varias alocacoes, mas somente uma ativa.
- Remocao e substituicao nao apagam o registro anterior.

### `demanda_frequencias`

Resultado operacional da alocacao.

- `resultado`: `presente` ou `falta`.
- `marcado_por` e `marcado_em`: responsabilidade e horario.
- Uma alocacao possui no maximo uma frequencia atual.
- Mudancas permanecem registradas no `audit_log`.

### `demanda_reposicoes`

Relaciona a alocacao ausente com a nova alocacao que ocupou a mesma vaga.

## Fluxo de estados

```text
vaga aberta
  -> alocacao criada
  -> confirmada ou recusada
  -> presente ou falta
  -> reposicao opcional
  -> concluida
  -> financeiro calculado
```

## Concorrencia

- Cada vaga possui `version` incrementada em toda alteracao.
- A interface envia a versao conhecida.
- Uma RPC rejeita a alteracao quando outra sessao ja atualizou a vaga.
- O usuario recebe os dados atuais e escolhe reaplicar ou cancelar.

## Financeiro

O calculo por vaga concluida sera:

```text
receita = valor recebido cadastrado para a rede
pagamento = valor da diaria salvo na demanda
lucro = receita - pagamento - custos adicionais
```

Faltas sem reposicao nao geram pagamento ao diarista. A regra de faturamento
da rede sera configuravel para nao presumir que toda falta deixa de ser
cobrada.

## Estrategia de migracao

1. Criar as novas tabelas sem alterar a interface.
2. Gerar uma vaga para cada unidade de `tarefas_total`.
3. Converter `alocacoes` do JSON legado para linhas.
4. Comparar totais por demanda e por supervisor.
5. Ativar leitura dupla temporaria e comparar resultados.
6. Trocar a escrita para o modelo V2.
7. Manter o JSON legado somente durante a janela de reversao.
8. Remover a dependencia do JSON em uma migration posterior.

## Invariantes de aceite

- Numero de vagas V2 igual a soma de `tarefas_total`.
- Toda alocacao legada possui uma alocacao V2 correspondente.
- Presencas, faltas e reposicoes mantem os mesmos totais.
- Nenhuma vaga pertence a supervisor diferente da demanda.
- Financeiro por supervisor permanece isolado.

