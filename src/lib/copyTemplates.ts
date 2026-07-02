import type { Demanda, DemandaAlocacao, Diarista } from "@/types";

export const COPY_TEMPLATES_KEY = "direct.copy-templates.v2";
export const COPY_TEMPLATES_EVENT = "direct:copy-templates-changed";

export type CopyTemplates = {
  escalaGerente: string;
  vagasDisponiveis: string;
  escalaDiarista: string;
  textoFalta: string;
};

export const DEFAULT_COPY_TEMPLATES: CopyTemplates = {
  escalaGerente: "📋 *ESCALA FECHADA*\n\n[Escala]",
  vagasDisponiveis: "🟢 *VAGAS DISPONÍVEIS*\n\n[Vagas]",
  escalaDiarista:
    "✅ *CONFIRMAÇÃO DE ESCALA*\n\n*Diarista:* [Diarista]\n*Telefone:* [Telefone]\n*CPF:* [CPF]\n*Bairro:* [Bairro]\n*Setores:* [Setores]\n\n*Diárias alocadas:*\n[Diarias]\n\n[FaltaTexto]",
  textoFalta:
    "⚠️ Em caso de falta, avise com antecedência. Faltas sem aviso podem impactar novas escalações.",
};

function hasEncodingArtifacts(value: unknown) {
  return typeof value === "string" && /(Ã[\u0080-\u00bf]|Ã§|Ã£|Ã¡|Ã©|Ã­|Ã³|Ãº|Ã‡|Â|â[^\s]?|ðŸ|�)/.test(value);
}

export function getCopyTemplates(): CopyTemplates {
  try {
    const raw = localStorage.getItem(COPY_TEMPLATES_KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<CopyTemplates>) : {};
    return (Object.keys(DEFAULT_COPY_TEMPLATES) as Array<keyof CopyTemplates>).reduce(
      (templates, key) => ({
        ...templates,
        [key]: hasEncodingArtifacts(saved[key]) ? DEFAULT_COPY_TEMPLATES[key] : saved[key] || DEFAULT_COPY_TEMPLATES[key],
      }),
      {} as CopyTemplates,
    );
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
