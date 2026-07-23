import type { Diarista } from "@/types";
import { normalizarBusca } from "@/lib/solicitacaoAgent";

export type TipoTextoAgente = "demanda" | "diarista";

export type CadastroDiaristaPlano = {
  campos: {
    nome: string;
    cpf: string;
    telefone: string;
    estado: string;
    cidade: string;
    bairro: string;
    endereco: string;
    cep: string;
    setores: string[];
  };
  existente: Diarista | null;
  avisos: string[];
};

function digits(value: string) {
  return String(value || "").replace(/\D/g, "");
}

export function formatarCPF(value: string) {
  const valueDigits = digits(value).slice(0, 11);
  return valueDigits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function formatarTelefone(value: string) {
  const valueDigits = digits(value).slice(0, 11);
  if (valueDigits.length > 10) {
    return valueDigits.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  }
  if (valueDigits.length > 6) {
    return valueDigits.replace(/^(\d{2})(\d{4})(\d{0,4})$/, "($1) $2-$3");
  }
  if (valueDigits.length > 2) {
    return valueDigits.replace(/^(\d{2})(\d{0,5})$/, "($1) $2");
  }
  return valueDigits;
}

export function formatarCEP(value: string) {
  return digits(value).slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
}

function titleCase(value: string) {
  const lowerWords = new Set(["da", "de", "do", "das", "dos", "e"]);
  return String(value || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) =>
      index > 0 && lowerWords.has(word)
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

function extrairCampo(texto: string, nomes: string[]) {
  const labels = nomes.map((nome) => nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const match = texto.match(new RegExp(`^[ \\t]*(?:${labels})[ \\t]*(?::|-)?[ \\t]*(.*)$`, "im"));
  return match?.[1]?.trim() || "";
}

function linhasLivres(texto: string) {
  return texto
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[*•-]\s*/, "").trim())
    .filter(Boolean)
    .filter((line) => !/dados\s+para\s+cadastro/i.test(line))
    .filter((line) => !/^(?:nome completo|cpf|estado|cidade|bairro|rua\/?n[ºo°]?|endere[cç]o|cep|telefone|whatsapp)\s*:?\s*$/i.test(line));
}

function pareceCPF(line: string) {
  return digits(line).length === 11 && !/[a-z]/i.test(line);
}

function pareceCEP(line: string) {
  return digits(line).length === 8 && !/[a-z]/i.test(line);
}

function pareceTelefone(line: string) {
  const count = digits(line).length;
  return count >= 10 && count <= 11 && !pareceCPF(line) && !/\b(?:cpf|cep)\b/i.test(line);
}

function pareceEndereco(line: string) {
  return /\b(?:rua|r\.?|avenida|av\.?|travessa|tv\.?|alameda|estrada|rodovia)\b/i.test(line) || /\d+[a-z]?\s*$/i.test(line);
}

function estadoCanonico(value: string, cidade: string) {
  const normalized = normalizarBusca(value);
  if (normalized === "ce" || normalized === "ceara") return "Ceará";
  if (!normalized && normalizarBusca(cidade) === "fortaleza") return "Ceará";
  return titleCase(value);
}

export function detectarTipoTextoAgente(texto: string): TipoTextoAgente {
  const normalized = normalizarBusca(texto);
  const hasDemand = /\b(?:loja|funcao|setor|horario|data de inicio|quantidade de dias)\b/.test(normalized);
  const hasCadastro = /dados para cadastro|nome completo|\bcpf\b|\bcep\b/.test(normalized);
  const hasCpfLine = texto.split(/\r?\n/).some(pareceCPF);
  if (hasCadastro || (hasCpfLine && !hasDemand)) return "diarista";
  return "demanda";
}

export function analisarCadastroDiarista(
  texto: string,
  diaristas: Diarista[],
): CadastroDiaristaPlano {
  const labeled = {
    nome: extrairCampo(texto, ["Nome Completo", "Nome"]),
    cpf: extrairCampo(texto, ["CPF"]),
    estado: extrairCampo(texto, ["Estado", "UF"]),
    cidade: extrairCampo(texto, ["Cidade"]),
    bairro: extrairCampo(texto, ["Bairro"]),
    endereco: extrairCampo(texto, ["Rua/Nº", "Rua/N°", "Rua/No", "Endereço", "Endereco"]),
    cep: extrairCampo(texto, ["CEP"]),
    telefone: extrairCampo(texto, ["Telefone", "WhatsApp", "Celular"]),
  };

  const lines = linhasLivres(texto);
  const cpfIndex = lines.findIndex(pareceCPF);
  const rawCpf = labeled.cpf || (cpfIndex >= 0 ? lines[cpfIndex] : "");
  const rawName = labeled.nome || (cpfIndex > 0 ? lines[cpfIndex - 1] : "");
  const remaining = cpfIndex >= 0 ? lines.slice(cpfIndex + 1) : lines;
  const rawCep = labeled.cep || remaining.find(pareceCEP) || "";
  const rawPhone = labeled.telefone || remaining.find(pareceTelefone) || "";
  const rawAddress =
    labeled.endereco ||
    remaining.find((line) => line !== rawCep && line !== rawPhone && pareceEndereco(line)) ||
    "";
  const locationLines = remaining.filter(
    (line) => line !== rawCep && line !== rawPhone && line !== rawAddress,
  );

  let rawState = labeled.estado;
  let rawCity = labeled.cidade;
  let rawDistrict = labeled.bairro;
  if (!rawCity && !rawDistrict) {
    if (locationLines.length >= 3) {
      [rawState, rawCity, rawDistrict] = locationLines.slice(0, 3);
    } else if (locationLines.length === 2) {
      [rawCity, rawDistrict] = locationLines;
    } else if (locationLines.length === 1) {
      [rawDistrict] = locationLines;
    }
  }

  const cpf = formatarCPF(rawCpf);
  const existing = diaristas.find((item) => digits(item.cpf) === digits(cpf)) || null;
  const operatorText = /cadastro\s+de\s+operadores|\boperador(?:es)?\b/i.test(texto);
  const parsedSectors = operatorText ? ["Operador de caixa"] : [];
  const cidade = titleCase(rawCity) || existing?.cidade || "";
  const campos = {
    nome: titleCase(rawName) || existing?.nome || "",
    cpf: cpf || existing?.cpf || "",
    telefone: formatarTelefone(rawPhone) || existing?.telefone || "",
    estado: estadoCanonico(rawState, cidade) || existing?.estado || "",
    cidade,
    bairro: titleCase(rawDistrict) || existing?.bairro || "",
    endereco: rawAddress || existing?.endereco || "",
    cep: formatarCEP(rawCep) || existing?.cep || "",
    setores: existing
      ? Array.from(new Set([...(existing.setorExperiencia || []), ...parsedSectors]))
      : parsedSectors,
  };
  const avisos: string[] = [];
  if (!campos.nome) avisos.push("Informe o nome completo.");
  if (digits(campos.cpf).length !== 11) avisos.push("Informe um CPF com 11 números.");
  if (!campos.telefone) avisos.push("Telefone não informado; você pode completar depois.");
  if (!campos.estado) avisos.push("Estado não informado; você pode completar depois.");
  if (!campos.cidade) avisos.push("Cidade não informada; você pode completar depois.");
  if (!campos.bairro) avisos.push("Bairro não informado; você pode completar depois.");
  if (!campos.endereco) avisos.push("Rua/número não informado; você pode completar depois.");
  if (!campos.cep) avisos.push("CEP não informado; você pode completar depois.");

  return { campos, existente: existing, avisos };
}
