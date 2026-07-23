import assert from "node:assert/strict";
import { analisarSolicitacao } from "../src/lib/solicitacaoAgent";
import type { Loja, RedeValor, SetorValor } from "../src/hooks/useConfig";

const lojas: Loja[] = [
  {
    id: "loja-1",
    nome: "Frangolandia - Varjota",
    rede: "Frangolandia",
    endereco: "Rua Teste, 100",
    responsavel: "Ana",
    bairro: "Varjota",
    cidade: "Fortaleza",
    uf: "CE",
    ativo: true,
  },
];

const setores: SetorValor[] = [
  { id: "setor-1", setor: "Operador de caixa", valor_min: 90, valor_max: 90 },
];

const redes: RedeValor[] = [
  { id: "rede-1", rede: "Frangolandia", valor_recebido: 124.5 },
];

const novaSolicitacao = analisarSolicitacao(
  `*NOVA SOLICITAÇÃO*

Loja: super do povo passare
Função: fflv
Horário: 10:00 as 18:20
Data de inicio: 23/07
Quantidade de dias: 5
observação: 2 balconista fflv`,
  { lojas, setores, redes, hoje: new Date(2026, 6, 22) },
);

assert.equal(novaSolicitacao.campos.rede, "Super Do Povo");
assert.equal(novaSolicitacao.campos.loja, "Super Do Povo - Passare");
assert.equal(novaSolicitacao.campos.setor, "Balconista FLV");
assert.equal(novaSolicitacao.campos.entrada, "10:00");
assert.equal(novaSolicitacao.campos.saida, "18:20");
assert.equal(novaSolicitacao.campos.vagas, 2);
assert.deepEqual(novaSolicitacao.campos.datas, [
  "2026-07-23",
  "2026-07-24",
  "2026-07-25",
  "2026-07-26",
  "2026-07-27",
]);
assert.equal(novaSolicitacao.encontrados.rede, false);
assert.equal(novaSolicitacao.encontrados.loja, false);
assert.equal(novaSolicitacao.encontrados.setor, false);

const existente = analisarSolicitacao(
  `Loja: Frangolandia Varjota
Função: caixa
Horário: 08:00 às 17:00
Data: 24/07/2026
Quantidade de dias: 1`,
  { lojas, setores, redes, hoje: new Date(2026, 6, 22) },
);

assert.equal(existente.encontrados.rede, true);
assert.equal(existente.encontrados.loja, true);
assert.equal(existente.encontrados.setor, true);
assert.equal(existente.campos.valorDiaria, 90);
assert.equal(existente.campos.valorRecebidoRede, 124.5);

const incompleta = analisarSolicitacao("Função: caixa", {
  lojas,
  setores,
  redes,
  hoje: new Date(2026, 6, 22),
});

assert.equal(incompleta.campos.loja, "");
assert.equal(incompleta.campos.rede, "");
assert.ok(incompleta.avisos.includes("Informe a loja."));
assert.ok(incompleta.avisos.includes("Informe entrada e saída."));
assert.ok(incompleta.avisos.includes("Informe a data inicial."));

const dataInvalida = analisarSolicitacao(
  `Loja: Frangolandia Varjota
Função: caixa
Horário: 08:00 às 17:00
Data: 31/02/2026
Quantidade de dias: 1`,
  { lojas, setores, redes, hoje: new Date(2026, 6, 22) },
);

assert.deepEqual(dataInvalida.campos.datas, []);
assert.ok(dataInvalida.avisos.includes("Informe a data inicial."));

console.log("Agente: 4 cenários validados com sucesso.");
