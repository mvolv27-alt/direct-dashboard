/**
 * ============================================================
 *  Hybrid Cloud + Offline Sync Layer
 * ------------------------------------------------------------
 *  - Hidrata a UI imediatamente a partir do cache local.
 *  - Faz fetch da nuvem em background e reconcilia.
 *  - Subscreve Realtime (postgres_changes) ? atualiza cache.
 *  - Mutações offline vão para uma fila e são drenadas
 *    quando a conexão volta.
 *  - As páginas continuam usando a API síncrona de
 *    `storage.ts` (que agora delega para esta camada),
 *    então recebem dados na hora e re-renderizam via
 *    o evento `direct:data-changed`.
 * ============================================================
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Diarista, RegistroFinanceiro, Demanda } from "@/types";

export type TableName =
  | "diaristas"
  | "demandas"
  | "registros_financeiros"
  | "setores_custom";

type DbRow = Record<string, unknown>;
type MapperResult = Diarista | Demanda | RegistroFinanceiro | string;
type CloudResult = PromiseLike<{ error: unknown }>;
type RealtimePayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: DbRow;
  old: DbRow;
};

const CACHE_PREFIX = "direct.cache::";
const OUTBOX_KEY = "direct.outbox::v1";
const DATA_EVENT = "direct:data-changed";
const STATUS_EVENT = "direct:sync-status";

// ------------------------------------------------------------
//  Cache helpers
// ------------------------------------------------------------
function readCache<T>(key: TableName): T[] {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeCache<T>(key: TableName, rows: T[]) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(rows));
    window.dispatchEvent(new CustomEvent(DATA_EVENT, { detail: { table: key } }));
  } catch {
    /* ignore quota */
  }
}

function upsertInCache<T extends { id: string }>(key: TableName, row: T) {
  const list = readCache<T>(key);
  const idx = list.findIndex((r) => r.id === row.id);
  if (idx === -1) list.push(row);
  else list[idx] = { ...list[idx], ...row };
  writeCache(key, list);
}

function removeFromCache<T extends { id: string }>(key: TableName, id: string) {
  const list = readCache<T>(key).filter((r) => r.id !== id);
  writeCache(key, list);
}

// ------------------------------------------------------------
//  Mappers: DB row <-> app type
// ------------------------------------------------------------
const num = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);
const text = (v: unknown): string => (typeof v === "string" ? v : "");
const dateText = (v: unknown): string => text(v) || new Date().toISOString();

function diaristaFromRow(r: DbRow): Diarista {
  return {
    id: text(r.id),
    nome: text(r.nome),
    cpf: text(r.cpf),
    telefone: text(r.telefone),
    bairro: text(r.bairro),
    setorExperiencia: Array.isArray(r.setor_experiencia) ? r.setor_experiencia : [],
    presencas: num(r.presencas),
    faltas: num(r.faltas),
    createdAt: dateText(r.created_at),
  };
}
function diaristaToRow(d: Diarista) {
  return {
    id: d.id,
    nome: d.nome,
    cpf: d.cpf,
    telefone: d.telefone,
    bairro: d.bairro,
    setor_experiencia: d.setorExperiencia ?? [],
    presencas: d.presencas ?? 0,
    faltas: d.faltas ?? 0,
  };
}

function demandaFromRow(r: DbRow): Demanda {
  let observacoes = text(r.observacoes);
  let alocacoes: Demanda["alocacoes"] = undefined;
  try {
    const meta = JSON.parse(observacoes);
    if (typeof meta === "object" && meta && "__directMeta" in meta) {
      const typed = meta as { __directMeta?: number; observacoes?: unknown; alocacoes?: unknown };
      if (typed.__directMeta === 1) {
        observacoes = text(typed.observacoes);
        alocacoes = Array.isArray(typed.alocacoes) ? (typed.alocacoes as Demanda["alocacoes"]) : undefined;
      }
    }
  } catch {
    /* observacoes antigas em texto puro */
  }

  return {
    id: text(r.id),
    codigo: text(r.codigo),
    data: text(r.data),
    horario: text(r.horario || r.horario_entrada),
    horarioSaida: text(r.horario_saida),
    rede: text(r.rede),
    loja: text(r.loja),
    setor: text(r.setor),
    valor: num(r.valor),
    diaristaId: text(r.diarista_id) || undefined,
    diaristaNome: text(r.diarista_nome),
    tarefasTotal: num(r.tarefas_total) || 1,
    tarefasConcluidas: num(r.tarefas_concluidas),
    status: (text(r.status) || "pendente") as Demanda["status"],
    checkInAt: text(r.check_in_at) || undefined,
    checkInBy: text(r.check_in_by) || undefined,
    alocacoes,
    observacoes,
    createdAt: dateText(r.created_at),
  };
}
function demandaToRow(d: Demanda) {
  const observacoes = JSON.stringify({
    __directMeta: 1,
    observacoes: d.observacoes ?? "",
    alocacoes: d.alocacoes ?? [],
  });

  return {
    id: d.id,
    codigo: d.codigo ?? "",
    data: d.data,
    horario: d.horario ?? "",
    rede: d.rede ?? "",
    loja: d.loja ?? "",
    setor: d.setor ?? "",
    horario_entrada: d.horario ?? "",
    horario_saida: d.horarioSaida ?? "",
    valor: d.valor ?? 0,
    diarista_id: d.diaristaId ?? null,
    diarista_nome: d.diaristaNome ?? "",
    tarefas_total: d.tarefasTotal ?? 1,
    tarefas_concluidas: d.tarefasConcluidas ?? 0,
    status: d.status ?? "pendente",
    check_in_at: d.checkInAt ?? null,
    check_in_by: d.checkInBy ?? "",
    observacoes,
  };
}

function registroFromRow(r: DbRow): RegistroFinanceiro {
  return {
    id: text(r.id),
    diaristaId: text(r.diarista_id),
    diaristaNome: text(r.diarista_nome),
    loja: text(r.loja),
    data: text(r.data),
    horarioEntrada: text(r.horario_entrada),
    horarioSaida: text(r.horario_saida),
    setor: text(r.setor),
    valorDiaria: num(r.valor_diaria),
    passagem: num(r.passagem),
    adiantamento: num(r.adiantamento),
    custosAdicionais: num(r.custos_adicionais),
    pago: !!r.pago,
    pagoEm: text(r.pago_em) || null,
    observacoes: text(r.observacoes),
    createdAt: dateText(r.created_at),
  };
}
function registroToRow(r: RegistroFinanceiro) {
  return {
    id: r.id,
    diarista_id: r.diaristaId || null,
    diarista_nome: r.diaristaNome ?? "",
    loja: r.loja ?? "",
    data: r.data,
    horario_entrada: r.horarioEntrada ?? "",
    horario_saida: r.horarioSaida ?? "",
    setor: r.setor ?? "",
    valor_diaria: r.valorDiaria ?? 0,
    passagem: r.passagem ?? 0,
    adiantamento: r.adiantamento ?? 0,
    custos_adicionais: r.custosAdicionais ?? 0,
    pago: !!r.pago,
    pago_em: r.pagoEm ?? null,
    observacoes: r.observacoes ?? "",
  };
}

function setorFromRow(r: DbRow): string {
  return text(r.nome);
}

// Generic mapping registry
const mappers: Record<TableName, { fromRow: (r: DbRow) => MapperResult; toRow: (r: unknown) => DbRow }> = {
  diaristas: { fromRow: diaristaFromRow, toRow: diaristaToRow },
  demandas: { fromRow: demandaFromRow, toRow: demandaToRow },
  registros_financeiros: { fromRow: registroFromRow, toRow: registroToRow },
  setores_custom: { fromRow: setorFromRow, toRow: (s: string) => ({ nome: s }) },
};

// ------------------------------------------------------------
//  Outbox (offline write queue)
// ------------------------------------------------------------
type OutboxOp =
  | { table: TableName; op: "insert"; payload: DbRow }
  | { table: TableName; op: "update"; payload: DbRow & { id: string } }
  | { table: TableName; op: "delete"; id: string };

function tableQuery(table: TableName) {
  return supabase.from(table as never);
}

function readOutbox(): OutboxOp[] {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]");
  } catch {
    return [];
  }
}
function writeOutbox(ops: OutboxOp[]) {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(ops));
  emitStatus();
}
function enqueue(op: OutboxOp) {
  const all = readOutbox();
  all.push(op);
  writeOutbox(all);
}

function localCacheHasRows(table: TableName) {
  return readCache<unknown>(table).length > 0;
}

function upsertPayload(table: TableName, payload: DbRow): CloudResult {
  if (table === "setores_custom") {
    return supabase
      .from("setores_custom")
      .upsert(payload as never, { onConflict: "nome" }) as CloudResult;
  }
  return tableQuery(table).upsert(payload as never, { onConflict: "id" }) as CloudResult;
}

async function flushOutbox(): Promise<void> {
  if (!navigator.onLine) return;
  const all = readOutbox();
  if (all.length === 0) return;
  const remaining: OutboxOp[] = [];
  for (const op of all) {
    try {
      if (op.op === "insert") {
        const { error } = await upsertPayload(op.table, op.payload);
        if (error) throw error;
      } else if (op.op === "update") {
        await tableQuery(op.table).update(op.payload as never).eq("id", op.payload.id);
      } else {
        await tableQuery(op.table).delete().eq("id", op.id);
      }
    } catch {
      remaining.push(op);
    }
  }
  writeOutbox(remaining);
}

// ------------------------------------------------------------
//  Public read API (synchronous, from cache)
// ------------------------------------------------------------
export const getCachedDiaristas = (): Diarista[] => readCache<Diarista>("diaristas");
export const getCachedDemandas = (): Demanda[] => readCache<Demanda>("demandas");
export const getCachedRegistros = (): RegistroFinanceiro[] =>
  readCache<RegistroFinanceiro>("registros_financeiros");
export const getCachedSetores = (): string[] => readCache<string>("setores_custom");

// ------------------------------------------------------------
//  Public write API (optimistic, async, queues if offline)
// ------------------------------------------------------------
async function tryCloud(fn: () => CloudResult, fallback: () => void) {
  if (!navigator.onLine) {
    fallback();
    return;
  }
  try {
    const { error } = await fn();
    if (error) throw error;
  } catch {
    fallback();
  }
}

async function cloudInsert<T extends { id: string }>(table: TableName, row: T) {
  upsertInCache(table, row);
  const payload = mappers[table].toRow(row);
  await tryCloud(
    () => upsertPayload(table, payload),
    () => enqueue({ table, op: "insert", payload }),
  );
}
async function cloudUpdate<T extends { id: string }>(table: TableName, row: T) {
  upsertInCache(table, row);
  const payload = mappers[table].toRow(row) as DbRow & { id: string };
  await tryCloud(
    () => tableQuery(table).update(payload as never).eq("id", row.id) as CloudResult,
    () => enqueue({ table, op: "update", payload }),
  );
}
async function cloudDelete(table: TableName, id: string) {
  removeFromCache(table, id);
  await tryCloud(
    () => tableQuery(table).delete().eq("id", id) as CloudResult,
    () => enqueue({ table, op: "delete", id }),
  );
}

// Strongly-typed wrappers used by storage.ts
export const upsertDiarista = (d: Diarista) => cloudInsert("diaristas", d);
export const updateDiaristaCloud = (d: Diarista) => cloudUpdate("diaristas", d);
export const deleteDiaristaCloud = (id: string) => cloudDelete("diaristas", id);

export const upsertDemanda = (d: Demanda) => cloudInsert("demandas", d);
export const updateDemandaCloud = (d: Demanda) => cloudUpdate("demandas", d);
export const deleteDemandaCloud = (id: string) => cloudDelete("demandas", id);

export const upsertRegistro = (r: RegistroFinanceiro) =>
  cloudInsert("registros_financeiros", r);
export const updateRegistroCloud = (r: RegistroFinanceiro) =>
  cloudUpdate("registros_financeiros", r);
export const deleteRegistroCloud = (id: string) =>
  cloudDelete("registros_financeiros", id);

export async function upsertSetorCustom(nome: string) {
  const all = readCache<string>("setores_custom");
  if (!all.includes(nome)) {
    all.push(nome);
    writeCache("setores_custom", all);
  }
  await tryCloud(
    () =>
      supabase
        .from("setores_custom")
        .upsert({ nome }, { onConflict: "nome" }) as CloudResult,
    () => enqueue({ table: "setores_custom", op: "insert", payload: { nome } }),
  );
}

// ------------------------------------------------------------
//  Sync status (online + pending writes)
// ------------------------------------------------------------
export type SyncStatus = {
  online: boolean;
  pending: number;
  lastSyncedAt: number | null;
};

let currentStatus: SyncStatus = {
  online: typeof navigator !== "undefined" ? navigator.onLine : true,
  pending: readOutbox().length,
  lastSyncedAt: null,
};

function emitStatus(patch?: Partial<SyncStatus>) {
  currentStatus = {
    ...currentStatus,
    ...patch,
    online: navigator.onLine,
    pending: readOutbox().length,
  };
  window.dispatchEvent(new CustomEvent(STATUS_EVENT, { detail: currentStatus }));
}

export function useSyncStatus(): SyncStatus {
  const [s, setS] = useState<SyncStatus>(currentStatus);
  useEffect(() => {
    const onStatus = (e: Event) => setS((e as CustomEvent).detail);
    window.addEventListener(STATUS_EVENT, onStatus);
    const tick = setInterval(() => emitStatus(), 5000);
    return () => {
      window.removeEventListener(STATUS_EVENT, onStatus);
      clearInterval(tick);
    };
  }, []);
  return s;
}

// ------------------------------------------------------------
//  Live data hook used by pages
// ------------------------------------------------------------
export function useLiveData<T>(getter: () => T, tables: TableName[]): T {
  const [data, setData] = useState<T>(getter);
  useEffect(() => {
    const refresh = (e?: Event) => {
      if (e instanceof CustomEvent && e.detail?.table) {
        if (!tables.includes(e.detail.table)) return;
      }
      setData(getter());
    };
    window.addEventListener(DATA_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(DATA_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(",")]);
  return data;
}

// ------------------------------------------------------------
//  Realtime + initial fetch (called once from AppLayout)
// ------------------------------------------------------------
let started = false;

async function fetchAll(table: TableName) {
  const { data, error } = await tableQuery(table).select("*");
  if (error || !data) return;
  const rows = (data as DbRow[]).map(mappers[table].fromRow);
  if (rows.length === 0 && localCacheHasRows(table)) {
    emitStatus({ lastSyncedAt: Date.now() });
    return;
  }
  writeCache(table, rows);
  emitStatus({ lastSyncedAt: Date.now() });
}

async function uploadCurrentCacheToCloud(tables: TableName[]) {
  if (!navigator.onLine) return;
  for (const table of tables) {
    const rows = readCache<unknown>(table);
    for (const row of rows) {
      const payload = mappers[table].toRow(row);
      if (table !== "setores_custom" && !payload.id) continue;
      try {
        const { error } = await upsertPayload(table, payload);
        if (error) throw error;
      } catch {
        enqueue({ table, op: "insert", payload });
      }
    }
  }
}

function subscribeRealtime(table: TableName) {
  const channel = supabase
    .channel(`direct:${table}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      (payload: RealtimePayload) => {
        const map = mappers[table];
        if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
          const row = map.fromRow(payload.new);
          if (table === "setores_custom") {
            const setor = String(row || "");
            const all = readCache<string>("setores_custom");
            if (setor && !all.includes(setor)) {
              all.push(setor);
              writeCache("setores_custom", all);
            }
          } else {
            upsertInCache(table, row as Diarista | Demanda | RegistroFinanceiro);
          }
        } else if (payload.eventType === "DELETE") {
          if (table === "setores_custom") {
            const removed = text(payload.old?.nome);
            const all = readCache<string>("setores_custom").filter((n) => n !== removed);
            writeCache("setores_custom", all);
          } else if (payload.old?.id) {
            removeFromCache(table, text(payload.old.id));
          }
        }
        emitStatus({ lastSyncedAt: Date.now() });
      },
    )
    .subscribe();
  return channel;
}

export async function startSync() {
  if (started) return;
  started = true;
  const tables: TableName[] = [
    "diaristas",
    "demandas",
    "registros_financeiros",
    "setores_custom",
  ];

  window.addEventListener("online", () => {
    emitStatus();
    flushOutbox();
  });
  window.addEventListener("offline", () => emitStatus());

  // First send local cached rows and queued writes so data created in local/offline mode reaches the cloud.
  await uploadCurrentCacheToCloud(tables);
  await flushOutbox();
  // Then hydrate from cloud with the latest shared data.
  await Promise.all(tables.map(fetchAll));
  // Retry anything that could not be sent on the first pass.
  await flushOutbox();
  // realtime subscriptions
  tables.forEach(subscribeRealtime);
  emitStatus({ lastSyncedAt: Date.now() });
}

// ------------------------------------------------------------
//  One-shot migration of legacy localStorage data
// ------------------------------------------------------------
const MIGRATED_FLAG = "direct.migrated.v1";
const LEGACY = {
  diaristas: "direct_diaristas",
  financeiro: "direct_financeiro",
  setores: "direct_setores_custom",
  demandas: "direct_demandas",
};

export async function migrateLegacyLocalData(): Promise<{
  diaristas: number;
  demandas: number;
  registros: number;
  setores: number;
}> {
  const result = { diaristas: 0, demandas: 0, registros: 0, setores: 0 };
  if (localStorage.getItem(MIGRATED_FLAG)) return result;

  const legacyDiaristas = JSON.parse(localStorage.getItem(LEGACY.diaristas) || "[]");
  for (const d of legacyDiaristas) {
    await cloudInsert("diaristas", d);
    result.diaristas++;
  }

  const legacyDemandas = JSON.parse(localStorage.getItem(LEGACY.demandas) || "[]");
  for (const d of legacyDemandas) {
    await cloudInsert("demandas", d);
    result.demandas++;
  }

  const legacyRegistros = JSON.parse(localStorage.getItem(LEGACY.financeiro) || "[]");
  for (const r of legacyRegistros) {
    // legacy registros sem novos campos ? defaults
    const filled = {
      ...r,
      passagem: r.passagem ?? 0,
      adiantamento: r.adiantamento ?? 0,
      pago: r.pago ?? false,
      pagoEm: r.pagoEm ?? null,
    };
    await cloudInsert("registros_financeiros", filled);
    result.registros++;
  }

  const legacySetores = JSON.parse(localStorage.getItem(LEGACY.setores) || "[]");
  for (const s of legacySetores) {
    await upsertSetorCustom(s);
    result.setores++;
  }

  localStorage.setItem(MIGRATED_FLAG, new Date().toISOString());
  return result;
}

export function hasLegacyLocalData(): boolean {
  if (localStorage.getItem(MIGRATED_FLAG)) return false;
  return [LEGACY.diaristas, LEGACY.financeiro, LEGACY.setores, LEGACY.demandas].some(
    (k) => {
      try {
        const arr = JSON.parse(localStorage.getItem(k) || "[]");
        return Array.isArray(arr) && arr.length > 0;
      } catch {
        return false;
      }
    },
  );
}
