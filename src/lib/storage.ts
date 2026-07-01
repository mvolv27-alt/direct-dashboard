/**
 * Compatibility wrapper kept so existing pages keep working.
 * Reads return data from the in-memory localStorage cache that
 * the sync layer keeps up-to-date in real time. Writes are
 * forwarded to the cloud (optimistic + offline-queue).
 *
 * Pages should also call `useLiveData(...)` (from "@/lib/sync")
 * to automatically re-render when realtime events arrive.
 */
import { Diarista, RegistroFinanceiro, Demanda } from "@/types";
import {
  getCachedDiaristas,
  getCachedDemandas,
  getCachedRegistros,
  getCachedSetores,
  upsertDiarista,
  updateDiaristaCloud,
  deleteDiaristaCloud,
  upsertDemanda,
  updateDemandaCloud,
  deleteDemandaCloud,
  upsertRegistro,
  updateRegistroCloud,
  deleteRegistroCloud,
  upsertSetorCustom,
} from "@/lib/sync";

// ── Demandas
export const getDemandas = (): Demanda[] => getCachedDemandas();
export const saveDemanda = (d: Demanda) => {
  void upsertDemanda(d);
};
export const updateDemanda = (d: Demanda) => {
  void updateDemandaCloud(d);
};
export const deleteDemanda = (id: string) => {
  void deleteDemandaCloud(id);
};

// ── Diaristas
export const getDiaristas = (): Diarista[] => getCachedDiaristas();
export const saveDiarista = (d: Diarista) => {
  void upsertDiarista(d);
};
export const updateDiarista = (d: Diarista) => {
  void updateDiaristaCloud(d);
};
export const deleteDiarista = (id: string) => {
  void deleteDiaristaCloud(id);
};

// ── Registros financeiros
export const getRegistros = (): RegistroFinanceiro[] => getCachedRegistros();
export const saveRegistro = (r: RegistroFinanceiro) => {
  void upsertRegistro(r);
};
export const updateRegistro = (r: RegistroFinanceiro) => {
  void updateRegistroCloud(r);
};
export const deleteRegistro = (id: string) => {
  void deleteRegistroCloud(id);
};

// ── Setores customizados
export const getSetoresCustom = (): string[] => getCachedSetores();
export const saveSetorCustom = (setor: string) => {
  const trimmed = setor.trim();
  if (!trimmed) return;
  void upsertSetorCustom(trimmed);
};
