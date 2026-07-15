import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  adoptLegacyStorage,
  getActiveUserId,
  requireActiveUserId,
  scopedStorageKey,
  USER_SCOPE_EVENT,
} from "@/lib/userScope";

export type Loja = {
  id: string;
  nome: string;
  rede: string;
  endereco: string;
  responsavel: string;
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
    responsavel: "",
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
    responsavel: "",
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
    responsavel: "",
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
    responsavel: "",
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
    responsavel: "",
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
    responsavel: "",
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
  return scopedStorageKey(LOCAL_CONFIG_PREFIX + table);
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

function rowIdentity(table: ConfigTable, row: { id: string } & Record<string, unknown>) {
  if (table === "lojas") return `${String(row.rede).toLowerCase()}|${String(row.nome).toLowerCase()}`;
  if (table === "setor_valores") return String(row.setor).trim().toLowerCase();
  return String(row.rede).trim().toLowerCase();
}

function mergeRows<T extends { id: string }>(table: ConfigTable, base: readonly T[], saved: T[]) {
  const map = new Map(
    base.map((row) => [rowIdentity(table, row as T & Record<string, unknown>), row]),
  );
  saved.forEach((row) =>
    map.set(rowIdentity(table, row as T & Record<string, unknown>), row),
  );
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
    const userId = getActiveUserId();
    if (!userId) {
      setRows([]);
      setLoading(false);
      return;
    }
    adoptLegacyStorage([LOCAL_CONFIG_PREFIX + table]);
    const localRows = readLocalRows<T>(table);
    const { data, error } = await supabase.from(table).select("*").eq("user_id", userId);
    if (!error && data && data.length > 0) {
      setRows(mergeRows(table, data as unknown as T[], localRows));
    } else {
      setRows(mergeRows(table, FALLBACK_ROWS[table] as unknown as T[], localRows));
    }
    setLoading(false);
  }, [table]);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel(`cfg:${requireActiveUserId()}:${table}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `user_id=eq.${requireActiveUserId()}`,
        },
        () => refresh(),
      )
      .subscribe();
    const onLocalChange = (event: Event) => {
      const detail = (event as CustomEvent<{ table?: ConfigTable }>).detail;
      if (!detail?.table || detail.table === table) refresh();
    };
    window.addEventListener(CONFIG_EVENT, onLocalChange);
    window.addEventListener("storage", onLocalChange);
    window.addEventListener(USER_SCOPE_EVENT, onLocalChange);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener(CONFIG_EVENT, onLocalChange);
      window.removeEventListener("storage", onLocalChange);
      window.removeEventListener(USER_SCOPE_EVENT, onLocalChange);
    };
  }, [table, refresh]);

  return { rows, loading, refresh };
}

export const useLojas = () => useTable<Loja>("lojas");
export const useSetorValores = () => useTable<SetorValor>("setor_valores");
export const useRedeValores = () => useTable<RedeValor>("rede_valores");

export async function upsertLoja(l: Partial<Loja> & { id?: string }) {
  const userId = requireActiveUserId();
  const isDefaultId = !!l.id && l.id.startsWith("00000000-0000-4000-8000-");
  const row = {
    id: !l.id || isDefaultId ? uid() : l.id,
    nome: l.nome ?? "",
    rede: l.rede ?? "",
    endereco: l.endereco ?? "",
    responsavel: l.responsavel ?? "",
    bairro: l.bairro ?? "",
    cidade: l.cidade ?? "Fortaleza",
    uf: l.uf ?? "CE",
    ativo: l.ativo ?? true,
  };
  const result = await supabase
    .from("lojas")
    .upsert({ ...row, user_id: userId }, { onConflict: "id" });
  if (!result.error) {
    upsertLocalRow<Loja>(
      "lojas",
      row,
      (item) => item.nome === row.nome && item.rede === row.rede,
    );
  }
  return result;
}
export const deleteLoja = async (id: string) => {
  const result = await supabase
    .from("lojas")
    .delete()
    .eq("id", id)
    .eq("user_id", requireActiveUserId());
  if (!result.error) removeLocalRow<Loja>("lojas", id);
  return result;
};

export async function upsertSetorValor(s: { setor: string; valor_min: number; valor_max: number; id?: string }) {
  const userId = requireActiveUserId();
  const isDefaultId = !!s.id && s.id.startsWith("00000000-0000-4000-8000-");
  const row = {
    id: !s.id || isDefaultId ? uid() : s.id,
    setor: s.setor,
    valor_min: s.valor_min,
    valor_max: s.valor_max,
  };
  const result = await supabase
    .from("setor_valores")
    .upsert({ ...row, user_id: userId }, { onConflict: "user_id,setor" });
  if (!result.error) {
    upsertLocalRow<SetorValor>(
      "setor_valores",
      row,
      (item) => item.setor.trim().toLowerCase() === s.setor.trim().toLowerCase(),
    );
  }
  return result;
}
export const deleteSetorValor = async (id: string) => {
  const result = await supabase
    .from("setor_valores")
    .delete()
    .eq("id", id)
    .eq("user_id", requireActiveUserId());
  if (!result.error) removeLocalRow<SetorValor>("setor_valores", id);
  return result;
};

export async function upsertRedeValor(r: { rede: string; valor_recebido: number; id?: string }) {
  const userId = requireActiveUserId();
  const isDefaultId = !!r.id && r.id.startsWith("00000000-0000-4000-8000-");
  const row = {
    id: !r.id || isDefaultId ? uid() : r.id,
    rede: r.rede,
    valor_recebido: r.valor_recebido,
  };
  const result = await supabase
    .from("rede_valores")
    .upsert({ ...row, user_id: userId }, { onConflict: "user_id,rede" });
  if (!result.error) {
    upsertLocalRow<RedeValor>(
      "rede_valores",
      row,
      (item) => item.rede.trim().toLowerCase() === r.rede.trim().toLowerCase(),
    );
  }
  return result;
}
export const deleteRedeValor = async (id: string) => {
  const result = await supabase
    .from("rede_valores")
    .delete()
    .eq("id", id)
    .eq("user_id", requireActiveUserId());
  if (!result.error) removeLocalRow<RedeValor>("rede_valores", id);
  return result;
};
