import type { Loja, RedeValor, SetorValor } from "@/hooks/useConfig";

export type AgenteSolicitacaoPlano = {
  textoOriginal: string;
  campos: {
    rede: string;
    loja: string;
    bairro: string;
    endereco: string;
    responsavel: string;
    cidade: string;
    uf: string;
    setor: string;
    entrada: string;
    saida: string;
    datas: string[];
    vagas: number;
    valorDiaria: number;
    valorRecebidoRede: number;
    observacao: string;
  };
  encontrados: {
    rede: boolean;
    loja: boolean;
    setor: boolean;
  };
  avisos: string[];
};

const aliasesSetor: Record<string, string> = {
  fflv: "Balconista FLV",
  flv: "Balconista FLV",
  "balconista fflv": "Balconista FLV",
  "balconista flv": "Balconista FLV",
  caixa: "Operador de caixa",
  operador: "Operador de caixa",
  mercearia: "Repositor de Mercearia",
  frios: "Balconista de Frios",
  padaria: "Balconista de Padaria",
  acougue: "Balconista de Açougue",
};

const VALOR_DIARIA_PADRAO = 90;

export function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function codigoDemanda() {
  return "DM" + Math.floor(1000 + Math.random() * 9000);
}

export function normalizarBusca(texto: string) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(texto: string) {
  return String(texto || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(" ");
}

function extrairCampo(texto: string, nomes: string[]) {
  const labels = nomes.map((nome) => nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const match = texto.match(new RegExp(`^\\s*(?:${labels})\\s*(?::|-)?\\s*(.+)$`, "im"));
  return match?.[1]?.trim() || "";
}

function parseHorario(valor: string) {
  const match = valor.match(/(\d{1,2}:\d{2})\s*(?:as|às|a|-)\s*(\d{1,2}:\d{2})/i);
  return {
    entrada: match?.[1] || "",
    saida: match?.[2] || "",
  };
}

function inferirRedeELoja(lojaTexto: string, redes: RedeValor[]) {
  const alvo = normalizarBusca(lojaTexto);
  const redeCadastrada = [...redes]
    .sort((a, b) => normalizarBusca(b.rede).length - normalizarBusca(a.rede).length)
    .find((item) => {
      const redeNormalizada = normalizarBusca(item.rede);
      return alvo === redeNormalizada || alvo.startsWith(`${redeNormalizada} `);
    });

  if (redeCadastrada) {
    const redeNormalizada = normalizarBusca(redeCadastrada.rede);
    const unidade = alvo
      .slice(redeNormalizada.length)
      .trim()
      .replace(/^(?:loja|unidade|filial)\s+/, "");
    const bairro = titleCase(unidade);
    return {
      rede: redeCadastrada.rede,
      loja: bairro ? `${redeCadastrada.rede} - ${bairro}` : redeCadastrada.rede,
      bairro,
    };
  }

  const palavras = lojaTexto.split(/\s+/).filter(Boolean);
  if (palavras.length <= 2) {
    const nome = titleCase(lojaTexto);
    return { rede: nome, loja: nome, bairro: "" };
  }
  const bairro = titleCase(palavras.slice(-1).join(" "));
  const rede = titleCase(palavras.slice(0, -1).join(" "));
  return {
    rede,
    loja: `${rede} - ${bairro}`,
    bairro,
  };
}

function resolverLoja(lojaTexto: string, lojas: Loja[], redes: RedeValor[]) {
  const alvo = normalizarBusca(lojaTexto);
  if (!alvo) {
    const inferida = inferirRedeELoja("", redes);
    return {
      existente: false,
      loja: {
        id: "",
        nome: inferida.loja,
        rede: inferida.rede,
        endereco: "",
        responsavel: "",
        bairro: inferida.bairro,
        cidade: "Fortaleza",
        uf: "CE",
        ativo: true,
      } satisfies Loja,
    };
  }
  const encontrada = lojas.find((loja) => {
    const nome = normalizarBusca(loja.nome);
    const rede = normalizarBusca(loja.rede);
    const redeBairro = normalizarBusca(`${loja.rede} ${loja.bairro}`);
    if (alvo === rede) return false;
    return alvo === nome || alvo === redeBairro || alvo.includes(nome) || redeBairro.includes(alvo);
  });
  if (encontrada) return { existente: true, loja: encontrada };

  const inferida = inferirRedeELoja(lojaTexto, redes);
  return {
    existente: false,
    loja: {
      id: "",
      nome: inferida.loja,
      rede: inferida.rede,
      endereco: "",
      responsavel: "",
      bairro: inferida.bairro,
      cidade: "Fortaleza",
      uf: "CE",
      ativo: true,
    } satisfies Loja,
  };
}

function resolverSetor(funcao: string, observacao: string, setores: SetorValor[]) {
  const base = normalizarBusca(`${observacao} ${funcao}`);
  const alias = Object.entries(aliasesSetor).find(([chave]) => base.includes(chave));
  const nome = alias?.[1] || titleCase(funcao);
  const encontrado = setores.find((setor) => normalizarBusca(setor.setor) === normalizarBusca(nome));
  return {
    existente: Boolean(encontrado),
    setor: encontrado?.setor || nome,
    valorDiaria: VALOR_DIARIA_PADRAO,
  };
}

function resolverRede(rede: string, redes: RedeValor[]) {
  const encontrada = redes.find(
    (item) => normalizarBusca(item.rede) === normalizarBusca(rede),
  );
  return {
    existente: Boolean(encontrada),
    valorRecebido: encontrada?.valor_recebido || 0,
  };
}

function extrairVagas(observacao: string) {
  const match = observacao.match(/\b(\d+)\s+[a-zà-ú]/i);
  return Math.max(1, Number(match?.[1] || 1));
}

function parseDataInicial(valor: string, hoje: Date) {
  const match = valor.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (!match) return null;
  const ano = match[3]
    ? Number(match[3].length === 2 ? `20${match[3]}` : match[3])
    : hoje.getFullYear();
  const mes = Number(match[2]);
  const dia = Number(match[1]);
  const data = new Date(ano, mes - 1, dia);
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) {
    return null;
  }
  return data;
}

function toISODate(data: Date) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function datasSequenciais(inicio: Date, quantidade: number) {
  return Array.from({ length: Math.max(1, quantidade) }, (_, index) => {
    const data = new Date(inicio);
    data.setDate(inicio.getDate() + index);
    return toISODate(data);
  });
}

export function analisarSolicitacao(
  texto: string,
  contexto: {
    lojas: Loja[];
    setores: SetorValor[];
    redes: RedeValor[];
    hoje?: Date;
  },
): AgenteSolicitacaoPlano {
  const lojaTexto = extrairCampo(texto, ["Loja"]);
  const funcao = extrairCampo(texto, ["Função", "Funcao", "Setor"]);
  const horarioTexto = extrairCampo(texto, ["Horário", "Horario"]);
  const dataTexto = extrairCampo(texto, ["Data de inicio", "Data de início", "Data"]);
  const quantidadeTexto = extrairCampo(texto, ["Quantidade de dias", "Qtd dias", "Dias"]);
  const observacao = extrairCampo(texto, ["observação", "observacao", "obs"]);

  const loja = resolverLoja(lojaTexto, contexto.lojas, contexto.redes);
  const setor = resolverSetor(funcao, observacao, contexto.setores);
  const rede = resolverRede(loja.loja.rede, contexto.redes);
  const horario = parseHorario(horarioTexto);
  const quantidadeDias = Math.min(366, Math.max(1, Number(quantidadeTexto.match(/\d+/)?.[0] || 1)));
  const inicio = parseDataInicial(dataTexto, contexto.hoje || new Date());
  const datas = inicio ? datasSequenciais(inicio, quantidadeDias) : [];
  const avisos: string[] = [];

  if (!lojaTexto) avisos.push("Informe a loja.");
  if (!funcao) avisos.push("Informe a função/setor.");
  if (!horario.entrada || !horario.saida) avisos.push("Informe entrada e saída.");
  if (!inicio) avisos.push("Informe a data inicial.");
  if (!loja.existente) avisos.push("Loja ainda não cadastrada. Revise endereço e responsável antes de confirmar.");
  if (!setor.existente) avisos.push("Setor ainda não cadastrado. Informe o valor da diária antes de confirmar.");
  if (!rede.existente) avisos.push("Rede ainda não cadastrada. Informe o valor recebido por diária antes de confirmar.");

  return {
    textoOriginal: texto,
    campos: {
      rede: loja.loja.rede,
      loja: loja.loja.nome,
      bairro: loja.loja.bairro,
      endereco: loja.loja.endereco,
      responsavel: loja.loja.responsavel,
      cidade: loja.loja.cidade || "Fortaleza",
      uf: loja.loja.uf || "CE",
      setor: setor.setor,
      entrada: horario.entrada,
      saida: horario.saida,
      datas,
      vagas: extrairVagas(observacao),
      valorDiaria: setor.valorDiaria,
      valorRecebidoRede: rede.valorRecebido,
      observacao,
    },
    encontrados: {
      rede: rede.existente,
      loja: loja.existente,
      setor: setor.existente,
    },
    avisos,
  };
}
