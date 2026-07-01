import type { Demanda, DemandaAlocacao, Diarista } from "@/types";

export const COPY_TEMPLATES_KEY = "direct.copy-templates.v1";
export const COPY_TEMPLATES_EVENT = "direct:copy-templates-changed";

export type CopyTemplates = {
  escalaGerente: string;
  vagasDisponiveis: string;
  escalaDiarista: string;
  textoFalta: string;
};

export const DEFAULT_COPY_TEMPLATES: CopyTemplates = {
  escalaGerente:
    "📋 *ESCALA FECHADA*\n\n*Rede:* [Rede]\n*Loja:* [Loja]\n*Setor:* [Setor]\n*Data:* [Dia]\n*Entrada:* [Entrada]\n*Saída:* [Saida]\n\n*Diaristas:*\n[Diaristas]\n\n*Vagas:* [TotalVagas]",
  vagasDisponiveis:
    "🟢 *VAGAS DISPONÍVEIS*\n\n*Rede:* [Rede]\n*Loja:* [Loja]\n*Setor:* [Setor]\n*Data:* [Dia]\n*Horário:* [Horario]\n*Disponível:* [VagasLivres]",
  escalaDiarista:
    "✅ *CONFIRMAÇÃO DE ESCALA*\n\n*Diarista:* [Diarista]\n*Telefone:* [Telefone]\n*Bairro:* [Bairro]\n*Setores:* [Setores]\n\n*Diárias alocadas:*\n[Diarias]\n\n[FaltaTexto]",
  textoFalta:
    "⚠️ Em caso de falta, avise com antecedência. Faltas sem aviso podem impactar novas escalações.",
};

export function getCopyTemplates(): CopyTemplates {
  try {
    const raw = localStorage.getItem(COPY_TEMPLATES_KEY);
    return { ...DEFAULT_COPY_TEMPLATES, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return DEFAULT_COPY_TEMPLATES;
  }
}

export function saveCopyTemplates(templates: CopyTemplates) {
  localStorage.setItem(COPY_TEMPLATES_KEY, JSON.stringify(templates));
  window.dispatchEvent(new CustomEvent(COPY_TEMPLATES_EVENT));
}

export function applyTemplate(text: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`[${key}]`).join(String(value ?? "")),
    text,
  );
}

export function formatDiaCompleto(data: string) {
  if (!data) return "Sem data";
  const [y, m, d] = data.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
}

export function horarioDemanda(demanda: Demanda) {
  return [demanda.horario, demanda.horarioSaida].filter(Boolean).join(" às ");
}

export function nomeEfetivoAlocacao(alocacao: DemandaAlocacao) {
  return alocacao.reposicao?.diaristaNome || alocacao.diaristaNome;
}

export function telefoneEfetivoAlocacao(alocacao: DemandaAlocacao, diaristas: Diarista[] = []) {
  if (alocacao.reposicao?.telefone) return alocacao.reposicao.telefone;
  const id = alocacao.reposicao?.diaristaId || alocacao.diaristaId;
  return diaristas.find((d) => d.id === id)?.telefone || "";
}
