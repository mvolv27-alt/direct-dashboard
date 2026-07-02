import type { Demanda, DemandaAlocacao, Diarista } from "@/types";
import { supabase } from "@/integrations/supabase/client";

export const COPY_TEMPLATES_KEY = "direct.copy-templates.v6";
export const COPY_TEMPLATES_EVENT = "direct:copy-templates-changed";

export type CopyTemplates = {
  escalaGerente: string;
  vagasDisponiveis: string;
  escalaDiarista: string;
  textoFalta: string;
};

export const DEFAULT_COPY_TEMPLATES: CopyTemplates = {
  escalaGerente: "\uD83D\uDCCB *ESCALA FECHADA*\n\n[Escala]",
  vagasDisponiveis: "\uD83D\uDFE2 *VAGAS DISPON\u00CDVEIS*\n\n[Vagas]",
  escalaDiarista:
    "\u2705 *CONFIRMA\u00C7\u00C3O DE ESCALA*\n\n\uD83D\uDCCD [RedeLoja]\n\uD83C\uDFF7\uFE0F [Setor]\n\n*Diarista:* [Diarista]\n*CPF:* [CPF]\n\n[EscalaDiarista]\n\n\n[FaltaTexto]",
  textoFalta:
    "\u26A0\uFE0F Em caso de falta, avise com anteced\u00EAncia. Faltas sem aviso podem prejudicar as empresas e oportunidades futuras.",
};

const COPY_TEMPLATES_ROW_ID = "default";

function hasEncodingArtifacts(value: unknown) {
  return (
    typeof value === "string" &&
    /(?:\u00C3[\u0080-\u00BF]|\u00C2|\u00E2|\u00F0\u0178|\uFFFD)/.test(value)
  );
}

function normalizeTemplates(saved: Partial<CopyTemplates> = {}): CopyTemplates {
  return (Object.keys(DEFAULT_COPY_TEMPLATES) as Array<keyof CopyTemplates>).reduce(
    (templates, key) => ({
      ...templates,
      [key]: hasEncodingArtifacts(saved[key])
        ? DEFAULT_COPY_TEMPLATES[key]
        : saved[key] || DEFAULT_COPY_TEMPLATES[key],
    }),
    {} as CopyTemplates,
  );
}

function writeLocalCopyTemplates(templates: CopyTemplates) {
  localStorage.setItem(COPY_TEMPLATES_KEY, JSON.stringify(templates));
  window.dispatchEvent(new CustomEvent(COPY_TEMPLATES_EVENT));
}

function templatesToRow(templates: CopyTemplates) {
  return {
    id: COPY_TEMPLATES_ROW_ID,
    escala_gerente: templates.escalaGerente,
    vagas_disponiveis: templates.vagasDisponiveis,
    escala_diarista: templates.escalaDiarista,
    texto_falta: templates.textoFalta,
  };
}

function rowToTemplates(row: {
  escala_gerente?: string | null;
  vagas_disponiveis?: string | null;
  escala_diarista?: string | null;
  texto_falta?: string | null;
}) {
  return normalizeTemplates({
    escalaGerente: row.escala_gerente || undefined,
    vagasDisponiveis: row.vagas_disponiveis || undefined,
    escalaDiarista: row.escala_diarista || undefined,
    textoFalta: row.texto_falta || undefined,
  });
}

async function saveCopyTemplatesToCloud(templates: CopyTemplates) {
  try {
    await supabase
      .from("copy_templates")
      .upsert(templatesToRow(templates), { onConflict: "id" });
  } catch {
    /* local copy remains available until the next sync */
  }
}

export function getCopyTemplates(): CopyTemplates {
  try {
    const raw = localStorage.getItem(COPY_TEMPLATES_KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<CopyTemplates>) : {};
    return normalizeTemplates(saved);
  } catch {
    return DEFAULT_COPY_TEMPLATES;
  }
}

export function saveCopyTemplates(templates: CopyTemplates) {
  writeLocalCopyTemplates(templates);
  void saveCopyTemplatesToCloud(templates);
}

export async function syncCopyTemplatesFromCloud() {
  const localTemplates = getCopyTemplates();
  try {
    const { data, error } = await supabase
      .from("copy_templates")
      .select("*")
      .eq("id", COPY_TEMPLATES_ROW_ID)
      .maybeSingle();
    if (!error && data) {
      writeLocalCopyTemplates(rowToTemplates(data));
      return;
    }
    await saveCopyTemplatesToCloud(localTemplates);
  } catch {
    /* keep local templates */
  }
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
  return [demanda.horario, demanda.horarioSaida].filter(Boolean).join(" \u00E0s ");
}

export function nomeEfetivoAlocacao(alocacao: DemandaAlocacao) {
  return alocacao.reposicao?.diaristaNome || alocacao.diaristaNome;
}

export function telefoneEfetivoAlocacao(alocacao: DemandaAlocacao, diaristas: Diarista[] = []) {
  if (alocacao.reposicao?.telefone) return alocacao.reposicao.telefone;
  const id = alocacao.reposicao?.diaristaId || alocacao.diaristaId;
  return diaristas.find((d) => d.id === id)?.telefone || "";
}
