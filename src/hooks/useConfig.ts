import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Loja = {
  id: string;
  nome: string;
  rede: string;
  endereco: string;
  bairro: string;
  cidade: string;
  uf: string;
  ativo: boolean;
};

export type SetorValor = {
  id: string;
  setor: string;
  valor_min: number;
  valor_max: number;
};

export type RedeValor = {
  id: string;
  rede: string;
  valor_recebido: number;
};

export const LOJAS_PADRAO: Loja[] = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    nome: "Frangolandia - Varjota",
    rede: "Frangolandia",
    endereco: "Rua Frei Mansueto, 909",
    bairro: "Varjota",
    cidade: "Fortaleza",
    uf: "CE",
    ativo: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    nome: "Hipermarket - Vila Uniao",
    rede: "Hipermarket",
    endereco: "Rua Livreiro Gualter, 123",
    bairro: "Vila Uniao",
    cidade: "Fortaleza",
    uf: "CE",
    ativo: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000103",
    nome: "Hipermarket - Jardim Cearense",
    rede: "Hipermarket",
    endereco: "Rua Rubens Monte, 380",
    bairro: "Jardim Cearense",
    cidade: "Fortaleza",
    uf: "CE",
    ativo: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000104",
    nome: "Hipermarket - Serrinha",
    rede: "Hipermarket",
    endereco: "Rua Freire Alemao, 356",
    bairro: "Serrinha",
    cidade: "Fortaleza",
    uf: "CE",
    ativo: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000105",
    nome: "Hipermarket - Mondubim",
    rede: "Hipermarket",
    endereco: "Av. Benjamim Brasil, 1099",
    bairro: "Mondubim",
    cidade: "Fortaleza",
    uf: "CE",
    ativo: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000106",
    nome: "Hipermarket - Eusebio",
    rede: "Hipermarket",
    endereco: "Rua Embauba, 5",
    bairro: "Eusebio",
    cidade: "Eusebio",
    uf: "CE",
    ativo: true,
  },
];

export const REDE_VALORES_PADRAO: RedeValor[] = [
  {
    id: "00000000-0000-4000-8000-000000000201",
    rede: "Frangolandia",
    valor_recebido: 109.25,
  },
  {
    id: "00000000-0000-4000-8000-000000000202",
    rede: "Hipermarket",
    valor_recebido: 124.5,
  },
];

export const SETOR_VALORES_PADRAO: SetorValor[] = [
  { id: "00000000-0000-4000-8000-000000000301", setor: "Acougueiro", valor_min: 85, valor_max: 90 },
  { id: "00000000-0000-4000-8000-000000000302", setor: "Balconista de Acougue", valor_min: 85, valor_max: 90 },
  { id: "00000000-0000-4000-8000-000000000303", setor: "Balconista de Frios", valor_min: 85, valor_max: 90 },
  { id: "00000000-0000-4000-8000-000000000304", setor: "Balconista de Padaria", valor_min: 85, valor_max: 90 },
  { id: "00000000-0000-4000-8000-000000000305", setor: "Forneiro", valor_min: 85, valor_max: 90 },
  { id: "00000000-0000-4000-8000-000000000306", setor: "Limpeza", valor_min: 85, valor_max: 90 },
  { id: "00000000-0000-4000-8000-000000000307", setor: "Operador de caixa", valor_min: 85, valor_max: 90 },
  { id: "00000000-0000-4000-8000-000000000308", setor: "Repositor de Frios", valor_min: 85, valor_max: 90 },
  { id: "00000000-0000-4000-8000-000000000309", setor: "Repositor de Hortifruti", valor_min: 85, valor_max: 90 },
  { id: "00000000-0000-4000-8000-000000000310", setor: "Repositor de Mercearia", valor_min: 85, valor_max: 90 },
];

const FALLBACK_ROWS = {
  lojas: LOJAS_PADRAO,
  rede_valores: REDE_VALORES_PADRAO,
  setor_valores: SETOR_VALORES_PADRAO,
} as const;

type ConfigTable = "lojas" | "setor_valores" | "rede_valores";
type ConfigRows = {
  lojas: Loja;
  setor_valores: SetorValor;
  rede_valores: RedeValor;
};

const LOCAL_CONFIG_PREFIX = "direct.config::";
const CONFIG_EVENT = "direct:config-changed";

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function localKey(table: ConfigTable) {
  return LOCAL_CONFIG_PREFIX + table;
}

function readLocalRows<T extends { id: string }>(table: ConfigTable): T[] {
  try {
    const raw = localStorage.getItem(localKey(table));
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeLocalRows<T extends { id: string }>(table: ConfigTable, rows: T[]) {
  try {
    localStorage.setItem(localKey(table), JSON.stringify(rows));
    window.dispatchEvent(new CustomEvent(CONFIG_EVENT, { detail: { table } }));
  } catch {
    /* local storage unavailable */
  }
}

function mergeRows<T extends { id: string }>(base: readonly T[], saved: T[]) {
  const map = new Map(base.map((row) => [row.id, row]));
  saved.forEach((row) => map.set(row.id, row));
  return Array.from(map.values());
}

function upsertLocalRow<T extends { id: string }>(
  table: ConfigTable,
  row: T,
  match?: (item: T) => boolean,
) {
  const current = readLocalRows<T>(table);
  const index = current.findIndex((item) => item.id === row.id || match?.(item));
  if (index >= 0) current[index] = { ...current[index], ...row };
  else current.push(row);
  writeLocalRows(table, current);
}

function removeLocalRow<T extends { id: string }>(table: ConfigTable, id: string) {
  writeLocalRows(
    table,
    readLocalRows<T>(table).filter((row) => row.id !== id),
  );
}

function useTable<T extends { id: string }>(table: "lojas" | "setor_valores" | "rede_valores") {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const localRows = readLocalRows<T>(table);
    const { data, error } = await supabase.from(table).select("*");
    if (!error && data && data.length > 0) {
      setRows(mergeRows(data as unknown as T[], localRows));
    } else {
      setRows(mergeRows(FALLBACK_ROWS[table] as unknown as T[], localRows));
    }
    setLoading(false);
  }, [table]);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel(`cfg:${table}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => refresh(),
      )
      .subscribe();
    const onLocalChange = (event: Event) => {
      const detail = (event as CustomEvent<{ table?: ConfigTable }>).detail;
      if (!detail?.table || detail.table === table) refresh();
    };
    window.addEventListener(CONFIG_EVENT, onLocalChange);
    window.addEventListener("storage", onLocalChange);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener(CONFIG_EVENT, onLocalChange);
      window.removeEventListener("storage", onLocalChange);
    };
  }, [table, refresh]);

  return { rows, loading, refresh };
}

export const useLojas = () => useTable<Loja>("lojas");
export const useSetorValores = () => useTable<SetorValor>("setor_valores");
export const useRedeValores = () => useTable<RedeValor>("rede_valores");

export async function upsertLoja(l: Partial<Loja> & { id?: string }) {
  const row = {
    id: l.id ?? uid(),
    nome: l.nome ?? "",
    rede: l.rede ?? "",
    endereco: l.endereco ?? "",
    bairro: l.bairro ?? "",
    cidade: l.cidade ?? "Fortaleza",
    uf: l.uf ?? "CE",
    ativo: l.ativo ?? true,
  };
  upsertLocalRow<Loja>("lojas", row);
  if (l.id) {
    const result = await supabase.from("lojas").update(l).eq("id", l.id);
    return result.error ? { ...result, error: null } : result;
  }
  const result = await supabase.from("lojas").insert(row);
  return result.error ? { ...result, error: null } : result;
}
export const deleteLoja = async (id: string) => {
  removeLocalRow<Loja>("lojas", id);
  const result = await supabase.from("lojas").delete().eq("id", id);
  return result.error ? { ...result, error: null } : result;
};

export async function upsertSetorValor(s: { setor: string; valor_min: number; valor_max: number; id?: string }) {
  const row = {
    id: s.id ?? uid(),
    setor: s.setor,
    valor_min: s.valor_min,
    valor_max: s.valor_max,
  };
  upsertLocalRow<SetorValor>(
    "setor_valores",
    row,
    (item) => item.setor.trim().toLowerCase() === s.setor.trim().toLowerCase(),
  );
  if (s.id) {
    const result = await supabase.from("setor_valores").update(s).eq("id", s.id);
    return result.error ? { ...result, error: null } : result;
  }
  const result = await supabase.from("setor_valores").upsert(row, { onConflict: "setor" });
  return result.error ? { ...result, error: null } : result;
}
export const deleteSetorValor = async (id: string) => {
  removeLocalRow<SetorValor>("setor_valores", id);
  const result = await supabase.from("setor_valores").delete().eq("id", id);
  return result.error ? { ...result, error: null } : result;
};

export async function upsertRedeValor(r: { rede: string; valor_recebido: number; id?: string }) {
  const row = {
    id: r.id ?? uid(),
    rede: r.rede,
    valor_recebido: r.valor_recebido,
  };
  upsertLocalRow<RedeValor>(
    "rede_valores",
    row,
    (item) => item.rede.trim().toLowerCase() === r.rede.trim().toLowerCase(),
  );
  if (r.id) {
    const result = await supabase.from("rede_valores").update(r).eq("id", r.id);
    return result.error ? { ...result, error: null } : result;
  }
  const result = await supabase.from("rede_valores").upsert(row, { onConflict: "rede" });
  return result.error ? { ...result, error: null } : result;
}
export const deleteRedeValor = async (id: string) => {
  removeLocalRow<RedeValor>("rede_valores", id);
  const result = await supabase.from("rede_valores").delete().eq("id", id);
  return result.error ? { ...result, error: null } : result;
};
