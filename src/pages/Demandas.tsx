import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveData } from "@/lib/sync";
import {
  getDemandas,
  saveDemanda,
  updateDemanda,
  deleteDemanda,
  getDiaristas,
  getSetoresCustom,
} from "@/lib/storage";
import { Demanda, DemandaAlocacao, DemandaStatus, Diarista } from "@/types";
import {
  formatDiaCompleto,
  getCopyTemplates,
  horarioDemanda,
  nomeEfetivoAlocacao,
  telefoneEfetivoAlocacao,
  applyTemplate,
} from "@/lib/copyTemplates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Plus,
  Search,
  Store,
  CheckCircle2,
  CircleDashed,
  Clock,
  Copy,
  Pencil,
  Trash2,
  CalendarIcon,
  X,
  User,
  ChevronDown,
  ChevronRight,
  UserCheck,
  UserX,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

const SETORES_PADRAO = [
  "Açougueiro",
  "Balconista de Açougue",
  "Balconista de Frios",
  "Balconista de Padaria",
  "Forneiro",
  "Limpeza",
  "Operador de caixa",
  "Repositor de Frios",
  "Repositor de Hortifruti",
  "Repositor de Mercearia",
];

function uid() {
  return crypto.randomUUID();
}
function codigo() {
  return "DM" + Math.floor(1000 + Math.random() * 9000);
}
function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fromISODate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function formatDateBR(s: string) {
  if (!s) return "";
  return fromISODate(s).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

type FormState = {
  datas: string[];
  horario: string;
  horarioSaida: string;
  setor: string;
  valor: number;
  rede: string;
  loja: string;
  vagas: number;
  diaristaId: string;
  diaristaNome: string;
  alocacoes: DemandaAlocacao[];
};

const emptyForm: FormState = {
  datas: [new Date().toISOString().slice(0, 10)],
  horario: "",
  horarioSaida: "",
  setor: "",
  valor: 0,
  rede: "",
  loja: "",
  vagas: 1,
  diaristaId: "",
  diaristaNome: "",
  alocacoes: [],
};

const statusLabel: Record<DemandaStatus, string> = {
  pendente: "Aguardando",
  em_andamento: "Em andamento",
  concluida: "Presente",
  falta: "Falta",
};

const DEMANDA_PREFS_KEY = "direct.demanda.prefs.v1";

function readDemandaPrefs() {
  try {
    return JSON.parse(localStorage.getItem(DEMANDA_PREFS_KEY) || "{}") as {
      rede?: string;
      loja?: string;
      horario?: string;
      horarioSaida?: string;
      redes?: string[];
      lojas?: string[];
      horarios?: string[];
      horariosSaida?: string[];
    };
  } catch {
    return {};
  }
}

function rememberDemandaPrefs(rede: string, loja: string, horario: string, horarioSaida: string) {
  const prefs = readDemandaPrefs();
  const redes = Array.from(new Set([...(prefs.redes || []), rede].filter(Boolean)));
  const lojas = Array.from(new Set([...(prefs.lojas || []), loja].filter(Boolean)));
  const horarios = Array.from(new Set([...(prefs.horarios || []), horario].filter(Boolean)));
  const horariosSaida = Array.from(new Set([...(prefs.horariosSaida || []), horarioSaida].filter(Boolean)));
  localStorage.setItem(
    DEMANDA_PREFS_KEY,
    JSON.stringify({
      rede,
      loja,
      horario,
      horarioSaida,
      redes: redes.slice(-30),
      lojas: lojas.slice(-50),
      horarios: horarios.slice(-50),
      horariosSaida: horariosSaida.slice(-50),
    })
  );
}

function createEmptyForm(): FormState {
  const prefs = readDemandaPrefs();
  return {
    ...emptyForm,
    datas: [new Date().toISOString().slice(0, 10)],
    horario: "",
    horarioSaida: "",
    rede: prefs.rede || "",
    loja: prefs.loja || "",
    alocacoes: [],
  };
}

function normalizeAlocacoes(d: Demanda): DemandaAlocacao[] {
  if (Array.isArray(d.alocacoes) && d.alocacoes.length > 0) {
    return d.alocacoes;
  }
  if (d.diaristaId || d.diaristaNome) {
    return [
      {
        id: d.diaristaId || "legacy-1",
        diaristaId: d.diaristaId || "",
        diaristaNome: d.diaristaNome || "Diarista",
        status:
          d.status === "concluida" ? "presente" : d.status === "falta" ? "falta" : "pendente",
        marcadoEm: d.checkInAt,
      },
    ];
  }
  return [];
}

function demandaStatusFromAlocacoes(alocacoes: DemandaAlocacao[], vagas: number): DemandaStatus {
  if (alocacoes.length === 0) return "pendente";
  const presentes = alocacoes.filter((a) => a.status === "presente" || a.reposicao).length;
  const faltas = alocacoes.filter((a) => a.status === "falta" && !a.reposicao).length;
  const marcadas = presentes + faltas;
  if (marcadas === 0) return "pendente";
  if (presentes === vagas) return "concluida";
  if (faltas === vagas) return "falta";
  return "em_andamento";
}

function totalVagasDemanda(d: Demanda) {
  return Math.max(1, d.tarefasTotal || normalizeAlocacoes(d).length || 1);
}

function vagasLivresDemanda(d: Demanda) {
  return Math.max(0, totalVagasDemanda(d) - normalizeAlocacoes(d).length);
}

function cloneAlocacoesForDemanda(alocacoes: DemandaAlocacao[]) {
  return alocacoes.map((alocacao) => ({
    ...alocacao,
    id: uid(),
    status: "pendente" as const,
    marcadoEm: undefined,
    reposicao: undefined,
  }));
}

function demandaRede(d: Demanda) {
  return (d.rede || d.cliente || "Sem rede").trim() || "Sem rede";
}

function demandaLoja(d: Demanda) {
  return (d.loja || "Sem loja").trim() || "Sem loja";
}

function demandaSetor(d: Demanda) {
  return (d.setor || "Sem setor").trim() || "Sem setor";
}

function groupDemandasForCopy(demandas: Demanda[]) {
  const grupos = new Map<string, Map<string, Map<string, Map<string, Map<string, Demanda[]>>>>>();
  for (const d of demandas) {
    const rede = demandaRede(d);
    const loja = demandaLoja(d);
    const setor = demandaSetor(d);
    const dia = d.data || "Sem data";
    const horario = horarioDemanda(d) || "Sem horário";

    if (!grupos.has(rede)) grupos.set(rede, new Map());
    const lojas = grupos.get(rede)!;
    if (!lojas.has(loja)) lojas.set(loja, new Map());
    const setores = lojas.get(loja)!;
    if (!setores.has(setor)) setores.set(setor, new Map());
    const dias = setores.get(setor)!;
    if (!dias.has(dia)) dias.set(dia, new Map());
    const horarios = dias.get(dia)!;
    if (!horarios.has(horario)) horarios.set(horario, []);
    horarios.get(horario)!.push(d);
  }
  return grupos;
}

function sortedKeys<T>(map: Map<string, T>) {
  return Array.from(map.keys()).sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
}

function cpfAlocacao(alocacao: DemandaAlocacao, diaristas: Diarista[]) {
  const id = alocacao.reposicao?.diaristaId || alocacao.diaristaId;
  return diaristas.find((d) => d.id === id)?.cpf || "";
}

function alocacaoMatchesDiarista(alocacao: DemandaAlocacao, diaristaId: string, diaristaNome: string) {
  const idEfetivo = alocacao.reposicao?.diaristaId || alocacao.diaristaId;
  const nomeEfetivo = nomeEfetivoAlocacao(alocacao).trim().toLowerCase();
  const nomeBusca = diaristaNome.trim().toLowerCase();
  return diaristaId ? idEfetivo === diaristaId : nomeEfetivo === nomeBusca;
}

function buildEscalaBody(demandas: Demanda[], diaristas: Diarista[]) {
  const grupos = groupDemandasForCopy(demandas);
  const linhas: string[] = [];

  for (const rede of sortedKeys(grupos)) {
    const lojas = grupos.get(rede)!;
    for (const loja of sortedKeys(lojas)) {
      if (linhas.length > 0) linhas.push("");
      linhas.push(`*${rede} - ${loja}*`);
      const setores = lojas.get(loja)!;
      for (const setor of sortedKeys(setores)) {
        const dias = setores.get(setor)!;
        for (const dia of sortedKeys(dias)) {
          linhas.push("");
          linhas.push(`*${setor} - ${formatDiaCompleto(dia)}*`);
          const horarios = dias.get(dia)!;
          for (const horario of sortedKeys(horarios)) {
            const demandasHorario = horarios.get(horario)!;
            const primeiro = demandasHorario[0];
            linhas.push(horarioDemanda(primeiro) || horario);

            const alocacoes = demandasHorario.flatMap(normalizeAlocacoes);
            if (alocacoes.length === 0) {
              linhas.push("Sem diarista alocado");
              continue;
            }

            alocacoes.forEach((alocacao) => {
              const nome = nomeEfetivoAlocacao(alocacao);
              const cpf = cpfAlocacao(alocacao, diaristas);
              const reposicao = alocacao.reposicao ? ` - reposição de ${alocacao.diaristaNome}` : "";
              linhas.push(`- ${nome}${cpf ? ` - CPF: ${cpf}` : ""}${reposicao}`);
            });
          }
        }
      }
    }
  }

  return linhas.join("\n").trim();
}

function buildVagasBody(demandas: Demanda[]) {
  const grupos = groupDemandasForCopy(demandas.filter((d) => vagasLivresDemanda(d) > 0));
  const linhas: string[] = [];

  for (const rede of sortedKeys(grupos)) {
    const lojas = grupos.get(rede)!;
    for (const loja of sortedKeys(lojas)) {
      if (linhas.length > 0) linhas.push("");
      linhas.push(`*${rede} - ${loja}*`);
      const setores = lojas.get(loja)!;
      for (const setor of sortedKeys(setores)) {
        const dias = setores.get(setor)!;
        for (const dia of sortedKeys(dias)) {
          linhas.push("");
          linhas.push(`*${setor} - ${formatDiaCompleto(dia)}*`);
          const horarios = dias.get(dia)!;
          for (const horario of sortedKeys(horarios)) {
            const demandasHorario = horarios.get(horario)!;
            const primeiro = demandasHorario[0];
            const vagas = demandasHorario.reduce((sum, d) => sum + vagasLivresDemanda(d), 0);
            linhas.push(`${horarioDemanda(primeiro) || horario} - ${vagas} ${vagas === 1 ? "vaga disponível" : "vagas disponíveis"}`);
          }
        }
      }
    }
  }

  return linhas.join("\n").trim();
}

function buildEscalaGerenteText(demandas: Demanda[], diaristas: Diarista[]) {
  if (demandas.length === 0) return "";
  const template = getCopyTemplates().escalaGerente;
  return applyTemplate(template, { Escala: buildEscalaBody(demandas, diaristas) }).trim();
}

function buildVagasDisponiveisText(demandas: Demanda[]) {
  const disponiveis = demandas.filter((d) => vagasLivresDemanda(d) > 0);
  if (disponiveis.length === 0) return "";
  const template = getCopyTemplates().vagasDisponiveis;
  return applyTemplate(template, { Vagas: buildVagasBody(disponiveis) }).trim();
}

export default function DemandasPage() {
  const demandas = useLiveData(getDemandas, ["demandas"]);
  const diaristas = useLiveData(getDiaristas, ["diaristas"]);
  const setoresExtra = useLiveData(getSetoresCustom, ["setores_custom"]);
  const setores = Array.from(new Set([...SETORES_PADRAO, ...setoresExtra]));

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"todas" | DemandaStatus>("todas");
  const [redeFilter, setRedeFilter] = useState("todas");
  const [lojaFilter, setLojaFilter] = useState("todas");
  const [setorFilter, setSetorFilter] = useState("todos");
  const [diaFilter, setDiaFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(createEmptyForm);
  const [diaristaSearch, setDiaristaSearch] = useState("");
  const [diaristaPickerOpen, setDiaristaPickerOpen] = useState(false);
  const [collapsedRedes, setCollapsedRedes] = useState<Set<string>>(new Set());
  const [collapsedLojas, setCollapsedLojas] = useState<Set<string>>(new Set());
  const [copyPanel, setCopyPanel] = useState<"gerente" | "vagas" | null>(null);
  const [copyDraft, setCopyDraft] = useState("");
  const [copyFilters, setCopyFilters] = useState({
    rede: "todas",
    loja: "todas",
    setor: "todos",
    dias: [] as string[],
    horario: "todos",
  });
  const knownGroupsRef = useRef({ redes: new Set<string>(), lojas: new Set<string>() });

  const toggleRede = (rede: string) =>
    setCollapsedRedes((prev) => {
      const next = new Set(prev);
      if (next.has(rede)) next.delete(rede);
      else next.add(rede);
      return next;
    });
  const toggleLoja = (key: string) =>
    setCollapsedLojas((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  useEffect(() => {
    const novasRedes: string[] = [];
    const novasLojas: string[] = [];

    for (const d of demandas) {
      const rede = (d.rede || d.cliente || "Sem rede").trim() || "Sem rede";
      const loja = (d.loja || "Sem loja").trim() || "Sem loja";
      const lojaKey = `${rede}::${loja}`;

      if (!knownGroupsRef.current.redes.has(rede)) {
        knownGroupsRef.current.redes.add(rede);
        novasRedes.push(rede);
      }
      if (!knownGroupsRef.current.lojas.has(lojaKey)) {
        knownGroupsRef.current.lojas.add(lojaKey);
        novasLojas.push(lojaKey);
      }
    }

    if (novasRedes.length > 0) {
      setCollapsedRedes((prev) => new Set([...prev, ...novasRedes]));
    }
    if (novasLojas.length > 0) {
      setCollapsedLojas((prev) => new Set([...prev, ...novasLojas]));
    }
  }, [demandas]);

  const filterOptions = useMemo(() => {
    const unique = (values: string[]) =>
      Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));
    const byRede = demandas.filter((d) => redeFilter === "todas" || demandaRede(d) === redeFilter);
    const byRedeLoja = byRede.filter((d) => lojaFilter === "todas" || demandaLoja(d) === lojaFilter);
    const byRedeLojaSetor = byRedeLoja.filter(
      (d) => setorFilter === "todos" || demandaSetor(d) === setorFilter,
    );
    return {
      redes: unique(demandas.map(demandaRede)),
      lojas: unique(byRede.map(demandaLoja)),
      setores: unique(byRedeLoja.map(demandaSetor)),
      dias: unique(byRedeLojaSetor.map((d) => d.data)),
    };
  }, [demandas, redeFilter, lojaFilter, setorFilter]);

  const filteredBase = useMemo(() => {
    return demandas
      .filter((d) => redeFilter === "todas" || demandaRede(d) === redeFilter)
      .filter((d) => lojaFilter === "todas" || demandaLoja(d) === lojaFilter)
      .filter((d) => setorFilter === "todos" || demandaSetor(d) === setorFilter)
      .filter((d) => !diaFilter || d.data === diaFilter)
      .filter((d) => {
        const s = search.toLowerCase();
        return (
          !s ||
          d.loja.toLowerCase().includes(s) ||
          (d.rede || "").toLowerCase().includes(s) ||
          d.setor.toLowerCase().includes(s) ||
          d.codigo.toLowerCase().includes(s) ||
          (d.diaristaNome || "").toLowerCase().includes(s) ||
          normalizeAlocacoes(d).some((a) => a.diaristaNome.toLowerCase().includes(s))
        );
      });
  }, [demandas, redeFilter, lojaFilter, setorFilter, diaFilter, search]);

  const counts = useMemo(() => {
    const total = filteredBase.reduce((sum, d) => sum + totalVagasDemanda(d), 0);
    const presente = filteredBase.reduce(
      (sum, d) => sum + normalizeAlocacoes(d).filter((a) => a.status === "presente").length,
      0,
    );
    const falta = filteredBase.reduce(
      (sum, d) => sum + normalizeAlocacoes(d).filter((a) => a.status === "falta").length,
      0,
    );
    return {
      total,
      pendente: Math.max(0, total - presente - falta),
      presente,
      falta,
    };
  }, [filteredBase]);

  const matchesTab = useCallback((d: Demanda, t: typeof tab) => {
    const vagas = totalVagasDemanda(d);
    const alocacoes = normalizeAlocacoes(d);
    const presentes = alocacoes.filter((a) => a.status === "presente").length;
    const faltas = alocacoes.filter((a) => a.status === "falta").length;
    const aguardando = Math.max(0, vagas - presentes - faltas);
    if (t === "todas") return true;
    if (t === "pendente") return aguardando > 0;
    if (t === "concluida") return presentes > 0;
    if (t === "falta") return faltas > 0;
    return d.status === t;
  }, []);

  const filtered = useMemo(() => {
    return filteredBase
      .filter((d) => matchesTab(d, tab))
      .sort((a, b) =>
        `${a.data}${horarioDemanda(a)}${demandaSetor(a)}`.localeCompare(
          `${b.data}${horarioDemanda(b)}${demandaSetor(b)}`,
          "pt-BR",
          { numeric: true },
        ),
      );
  }, [filteredBase, tab, matchesTab]);

  const copyDemandas = useMemo(() => {
    return demandas
      .filter((d) => copyFilters.rede === "todas" || demandaRede(d) === copyFilters.rede)
      .filter((d) => copyFilters.loja === "todas" || demandaLoja(d) === copyFilters.loja)
      .filter((d) => copyFilters.setor === "todos" || demandaSetor(d) === copyFilters.setor)
      .filter((d) => copyFilters.dias.length === 0 || copyFilters.dias.includes(d.data))
      .filter((d) => copyFilters.horario === "todos" || horarioDemanda(d) === copyFilters.horario)
      .sort((a, b) =>
        `${a.data}${horarioDemanda(a)}${demandaSetor(a)}`.localeCompare(
          `${b.data}${horarioDemanda(b)}${demandaSetor(b)}`,
          "pt-BR",
          { numeric: true },
        ),
      );
  }, [demandas, copyFilters]);

  const copyOptions = useMemo(() => {
    const unique = (values: string[]) =>
      Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));
    const base = demandas
      .filter((d) => copyFilters.rede === "todas" || demandaRede(d) === copyFilters.rede)
      .filter((d) => copyFilters.loja === "todas" || demandaLoja(d) === copyFilters.loja)
      .filter((d) => copyFilters.setor === "todos" || demandaSetor(d) === copyFilters.setor)
      .filter((d) => copyFilters.dias.length === 0 || copyFilters.dias.includes(d.data));
    return {
      redes: unique(demandas.map(demandaRede)),
      lojas: unique(base.map(demandaLoja)),
      setores: unique(base.map(demandaSetor)),
      dias: unique(base.map((d) => d.data)),
      horarios: unique(base.map(horarioDemanda)),
    };
  }, [demandas, copyFilters]);

  useEffect(() => {
    if (!copyPanel) return;
    setCopyDraft(
      copyPanel === "gerente"
        ? buildEscalaGerenteText(copyDemandas, diaristas)
        : buildVagasDisponiveisText(copyDemandas),
    );
  }, [copyPanel, copyDemandas, diaristas]);

  const diaristasFiltrados = useMemo(() => {
    const q = diaristaSearch.toLowerCase().trim();
    return diaristas.filter(
      (d) =>
        !q ||
        d.nome.toLowerCase().includes(q) ||
        d.bairro.toLowerCase().includes(q) ||
        d.setorExperiencia.some((s) => s.toLowerCase().includes(q))
    );
  }, [diaristas, diaristaSearch]);

  const savedDemandOptions = useMemo(() => {
    const prefs = readDemandaPrefs();
    const redes = new Set<string>(prefs.redes || []);
    const lojas = new Set<string>(prefs.lojas || []);
    const horarios = new Set<string>(prefs.horarios || []);
    const horariosSaida = new Set<string>(prefs.horariosSaida || []);
    demandas.forEach((d) => {
      if (d.rede) redes.add(d.rede);
      if (d.loja) lojas.add(d.loja);
      if (d.horario) horarios.add(d.horario);
      if (d.horarioSaida) horariosSaida.add(d.horarioSaida);
    });
    return {
      redes: Array.from(redes).filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR")),
      lojas: Array.from(lojas).filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR")),
      horarios: Array.from(horarios).filter(Boolean).sort(),
      horariosSaida: Array.from(horariosSaida).filter(Boolean).sort(),
    };
  }, [demandas]);

  function refresh() {
    /* dados atualizam automaticamente via Realtime */
  }

  async function copyToClipboard(texto: string, successMessage: string) {
    if (!texto.trim()) {
      toast.error("Nenhuma informação encontrada para copiar");
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto);
      } else {
        const area = document.createElement("textarea");
        area.value = texto;
        area.style.position = "fixed";
        area.style.left = "-9999px";
        document.body.appendChild(area);
        area.focus();
        area.select();
        document.execCommand("copy");
        document.body.removeChild(area);
      }
      toast.success(successMessage);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  function handleSelectFormDiarista(d: Diarista) {
    const vagas = Math.max(1, Math.floor(form.vagas || 1));
    if (form.alocacoes.some((a) => a.diaristaId === d.id)) {
      toast.error(`${d.nome} já foi selecionado`);
      return;
    }
    if (form.alocacoes.length >= vagas) {
      toast.error("A quantidade de diaristas já atingiu o número de vagas");
      return;
    }
    const next = [
      ...form.alocacoes,
      {
        id: uid(),
        diaristaId: d.id,
        diaristaNome: d.nome,
        status: "pendente" as const,
      },
    ];
    setForm({
      ...form,
      alocacoes: next,
      diaristaId: next[0]?.diaristaId || "",
      diaristaNome: next[0]?.diaristaNome || "",
    });
    setDiaristaSearch("");
    if (next.length >= vagas) setDiaristaPickerOpen(false);
  }

  function handleRemoveFormDiarista(alocacaoId: string) {
    const next = form.alocacoes.filter((a) => a.id !== alocacaoId);
    setForm({
      ...form,
      alocacoes: next,
      diaristaId: next[0]?.diaristaId || "",
      diaristaNome: next[0]?.diaristaNome || "",
    });
  }

  function handleSave() {
    if (!form.loja || form.datas.length === 0 || !form.setor) {
      toast.error("Loja, data e setor são obrigatórios");
      return;
    }
    const vagas = Math.max(1, Math.floor(form.vagas || 1));
    const selectedAlocacoes = form.alocacoes.slice(0, vagas);

    if (editingId) {
      const existing = demandas.find((d) => d.id === editingId)!;
      const alocacoes = (selectedAlocacoes.length > 0 ? selectedAlocacoes : normalizeAlocacoes(existing)).slice(0, vagas);
      const first = alocacoes[0];
      const updated: Demanda = {
        ...existing,
        data: form.datas[0],
        horario: form.horario,
        horarioSaida: form.horarioSaida,
        setor: form.setor,
        valor: form.valor,
        rede: form.rede,
        loja: form.loja,
        diaristaId: first?.diaristaId || undefined,
        diaristaNome: first?.diaristaNome || undefined,
        alocacoes,
        tarefasTotal: vagas,
        tarefasConcluidas: alocacoes.filter((a) => a.status === "presente").length,
      };
      updated.status = demandaStatusFromAlocacoes(updated.alocacoes || [], vagas);
      updateDemanda(updated);
      toast.success("Demanda atualizada");
    } else {
      for (const dataISO of form.datas) {
        const alocacoesDaDemanda = cloneAlocacoesForDemanda(selectedAlocacoes);
        const primeiraAlocacao = alocacoesDaDemanda[0];
        const nova: Demanda = {
          id: uid(),
          codigo: codigo(),
          data: dataISO,
          horario: form.horario,
          horarioSaida: form.horarioSaida,
          rede: form.rede,
          loja: form.loja,
          setor: form.setor,
          valor: form.valor,
          diaristaId: primeiraAlocacao?.diaristaId || undefined,
          diaristaNome: primeiraAlocacao?.diaristaNome || undefined,
          alocacoes: alocacoesDaDemanda,
          tarefasTotal: vagas,
          tarefasConcluidas: 0,
          status: "pendente",
          createdAt: new Date().toISOString(),
        };
        saveDemanda(nova);
      }
      toast.success(
        form.datas.length > 1
          ? `${form.datas.length} demandas criadas`
          : "Demanda criada"
      );
    }
    refresh();
    rememberDemandaPrefs(
      form.rede.trim(),
      form.loja.trim(),
      form.horario.trim(),
      form.horarioSaida.trim()
    );
    setForm(createEmptyForm());
    setEditingId(null);
    setOpen(false);
    setDiaristaSearch("");
  }

  function handleEdit(d: Demanda) {
    setForm({
      datas: [d.data],
      horario: d.horario,
      horarioSaida: d.horarioSaida || "",
      setor: d.setor,
      valor: d.valor || 0,
      rede: d.rede || d.cliente || "",
      loja: d.loja,
      vagas: Math.max(1, d.tarefasTotal || normalizeAlocacoes(d).length || 1),
      diaristaId: normalizeAlocacoes(d)[0]?.diaristaId || d.diaristaId || "",
      diaristaNome: normalizeAlocacoes(d)[0]?.diaristaNome || d.diaristaNome || "",
      alocacoes: normalizeAlocacoes(d),
    });
    setEditingId(d.id);
    setOpen(true);
  }

  function handleDelete(id: string) {
    if (!confirm("Excluir esta demanda?")) return;
    deleteDemanda(id);
    refresh();
    toast.success("Demanda excluída");
  }

  function handleRenameRede(rede: string) {
    const novoNome = window.prompt("Novo nome da rede", rede)?.trim();
    if (!novoNome || novoNome === rede) return;
    demandas
      .filter((d) => ((d.rede || d.cliente || "Sem rede").trim() || "Sem rede") === rede)
      .forEach((d) => updateDemanda({ ...d, rede: novoNome }));
    refresh();
    toast.success("Rede atualizada");
  }

  function handleDeleteRede(rede: string) {
    const itens = demandas.filter(
      (d) => ((d.rede || d.cliente || "Sem rede").trim() || "Sem rede") === rede
    );
    if (!confirm(`Excluir ${itens.length} diária(s) da rede ${rede}?`)) return;
    itens.forEach((d) => deleteDemanda(d.id));
    refresh();
    toast.success("Rede removida");
  }

  function handleRenameLoja(rede: string, loja: string) {
    const novoNome = window.prompt("Novo nome da loja", loja)?.trim();
    if (!novoNome || novoNome === loja) return;
    demandas
      .filter((d) => {
        const dRede = (d.rede || d.cliente || "Sem rede").trim() || "Sem rede";
        const dLoja = (d.loja || "Sem loja").trim() || "Sem loja";
        return dRede === rede && dLoja === loja;
      })
      .forEach((d) => updateDemanda({ ...d, loja: novoNome }));
    refresh();
    toast.success("Loja atualizada");
  }

  function handleDeleteLoja(rede: string, loja: string) {
    const itens = demandas.filter((d) => {
      const dRede = (d.rede || d.cliente || "Sem rede").trim() || "Sem rede";
      const dLoja = (d.loja || "Sem loja").trim() || "Sem loja";
      return dRede === rede && dLoja === loja;
    });
    if (!confirm(`Excluir ${itens.length} diária(s) da loja ${loja}?`)) return;
    itens.forEach((d) => deleteDemanda(d.id));
    refresh();
    toast.success("Loja removida");
  }

  function handleStatusAlocacao(
    d: Demanda,
    alocacaoId: string,
    status: "presente" | "falta",
  ) {
    const vagas = Math.max(1, d.tarefasTotal || 1);
    const alocacoes = normalizeAlocacoes(d).map((a) =>
      a.id === alocacaoId
        ? {
            ...a,
            status,
            marcadoEm: new Date().toISOString(),
            reposicao: status === "presente" ? undefined : a.reposicao,
          }
        : a
    );
    const tarefasConcluidas = alocacoes.filter((a) => a.status === "presente" || a.reposicao).length;
    updateDemanda({
      ...d,
      alocacoes,
      status: demandaStatusFromAlocacoes(alocacoes, vagas),
      checkInAt: new Date().toISOString(),
      checkInBy: alocacoes.find((a) => a.id === alocacaoId)?.diaristaNome || "Operador",
      tarefasConcluidas,
    });
    refresh();
    const nome = alocacoes.find((a) => a.id === alocacaoId)?.diaristaNome || "Diarista";
    if (status === "presente") {
      toast.success(`${nome} marcado como Presente`);
    } else {
      toast.error(`${nome} marcado como Falta`);
    }
  }

  function openCopyPanel(type: "gerente" | "vagas") {
    setCopyFilters({
      rede: "todas",
      loja: "todas",
      setor: "todos",
      dias: [],
      horario: "todos",
    });
    setCopyPanel(type);
  }

  function handleReposicaoAlocacao(
    d: Demanda,
    alocacaoId: string,
    reposicao: { diaristaId?: string; diaristaNome: string; telefone?: string; observacoes?: string },
  ) {
    const nome = reposicao.diaristaNome.trim();
    if (!nome) {
      toast.error("Informe o nome do diarista da reposição");
      return;
    }
    const vagas = Math.max(1, d.tarefasTotal || 1);
    const alocacoes = normalizeAlocacoes(d).map((a) =>
      a.id === alocacaoId
        ? {
            ...a,
            status: "falta" as const,
            marcadoEm: a.marcadoEm || new Date().toISOString(),
            reposicao: {
              diaristaId: reposicao.diaristaId,
              diaristaNome: nome,
              telefone: reposicao.telefone?.trim(),
              observacoes: reposicao.observacoes?.trim(),
              criadoEm: new Date().toISOString(),
            },
          }
        : a,
    );
    updateDemanda({
      ...d,
      alocacoes,
      status: demandaStatusFromAlocacoes(alocacoes, vagas),
      checkInAt: new Date().toISOString(),
      checkInBy: nome,
      tarefasConcluidas: alocacoes.filter((a) => a.status === "presente" || a.reposicao).length,
    });
    refresh();
    toast.success(`Reposição registrada com ${nome}`);
  }

  function handleAlocarDiarista(d: Demanda, diaristaId: string, diaristaNome: string) {
    const vagas = Math.max(1, d.tarefasTotal || 1);
    const alocacoes = normalizeAlocacoes(d);
    if (alocacoes.some((a) => a.diaristaId === diaristaId)) {
      toast.error(`${diaristaNome} já está nessa demanda`);
      return;
    }
    if (alocacoes.length >= vagas) {
      toast.error("Todas as vagas dessa demanda já foram preenchidas");
      return;
    }
    const next = [
      ...alocacoes,
      {
        id: uid(),
        diaristaId,
        diaristaNome,
        status: "pendente" as const,
      },
    ];
    updateDemanda({
      ...d,
      diaristaId: d.diaristaId || diaristaId,
      diaristaNome: d.diaristaNome || diaristaNome,
      alocacoes: next,
      status: demandaStatusFromAlocacoes(next, vagas),
      tarefasConcluidas: next.filter((a) => a.status === "presente").length,
    });
    refresh();
    toast.success(`${diaristaNome} alocado na demanda ${d.codigo}`);
  }

  function handleRemoverAlocacao(d: Demanda, alocacaoId: string) {
    const vagas = Math.max(1, d.tarefasTotal || 1);
    const alocacoesAtuais = normalizeAlocacoes(d);
    const removida = alocacoesAtuais.find((a) => a.id === alocacaoId);
    const next = alocacoesAtuais.filter((a) => a.id !== alocacaoId);
    const primeira = next[0];

    updateDemanda({
      ...d,
      diaristaId: primeira?.diaristaId || undefined,
      diaristaNome: primeira?.diaristaNome || undefined,
      alocacoes: next,
      status: demandaStatusFromAlocacoes(next, vagas),
      tarefasConcluidas: next.filter((a) => a.status === "presente" || a.reposicao).length,
    });
    refresh();
    toast.success(`${removida?.diaristaNome || "Diarista"} removido da demanda ${d.codigo}`);
  }

  function handleAdicionarVaga(d: Demanda) {
    const vagasAtuais = Math.max(1, d.tarefasTotal || normalizeAlocacoes(d).length || 1);
    updateDemanda({
      ...d,
      tarefasTotal: vagasAtuais + 1,
      status: demandaStatusFromAlocacoes(normalizeAlocacoes(d), vagasAtuais + 1),
    });
    refresh();
    toast.success(`Mais 1 vaga adicionada na demanda ${d.codigo}`);
  }

  function renderCopyPopoverContent(type: "gerente" | "vagas") {
    const demandasNoTexto =
      type === "vagas" ? copyDemandas.filter((d) => vagasLivresDemanda(d) > 0) : copyDemandas;

    return (
      <PopoverContent
        className="z-[120] w-[min(92vw,620px)] rounded-xl p-3"
        align="end"
        sideOffset={4}
      >
        <div className="grid gap-2.5">
          <div>
            <p className="text-sm font-semibold leading-tight text-foreground">
              {type === "gerente" ? "Copiar escala para gerente" : "Copiar vagas disponíveis"}
            </p>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Texto pré-salvo, editável e atualizado pelos filtros.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-[1fr_1fr_1fr_130px_110px]">
            <Select
              value={copyFilters.rede}
              onValueChange={(rede) =>
                setCopyFilters((prev) => ({ ...prev, rede, loja: "todas", setor: "todos" }))
              }
            >
              <SelectTrigger className="h-9"><SelectValue placeholder="Rede" /></SelectTrigger>
              <SelectContent side="bottom" align="start" avoidCollisions={false} className="z-[220]">
                <SelectItem value="todas">Todas as redes</SelectItem>
                {copyOptions.redes.map((rede) => (
                  <SelectItem key={rede} value={rede}>{rede}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={copyFilters.loja}
              onValueChange={(loja) => setCopyFilters((prev) => ({ ...prev, loja }))}
            >
              <SelectTrigger className="h-9"><SelectValue placeholder="Loja" /></SelectTrigger>
              <SelectContent side="bottom" align="start" avoidCollisions={false} className="z-[220]">
                <SelectItem value="todas">Todas as lojas</SelectItem>
                {copyOptions.lojas.map((loja) => (
                  <SelectItem key={loja} value={loja}>{loja}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={copyFilters.setor}
              onValueChange={(setor) => setCopyFilters((prev) => ({ ...prev, setor }))}
            >
              <SelectTrigger className="h-9"><SelectValue placeholder="Setor" /></SelectTrigger>
              <SelectContent side="bottom" align="start" avoidCollisions={false} className="z-[220]">
                <SelectItem value="todos">Todos os setores</SelectItem>
                {copyOptions.setores.map((setor) => (
                  <SelectItem key={setor} value={setor}>{setor}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="h-9 justify-start gap-2 px-3">
                  <CalendarIcon size={14} />
                  <span className="truncate">
                    {copyFilters.dias.length === 0
                      ? "Todos os dias"
                      : copyFilters.dias.length === 1
                        ? formatDateBR(copyFilters.dias[0])
                        : `${copyFilters.dias.length} dias`}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="z-[220] w-auto p-0" align="start" side="bottom" sideOffset={6}>
                <Calendar
                  mode="multiple"
                  selected={copyFilters.dias.map(fromISODate)}
                  onSelect={(dates) =>
                    setCopyFilters((prev) => ({
                      ...prev,
                      dias: (dates || []).map(toISODate).sort(),
                    }))
                  }
                  initialFocus
                />
                {copyFilters.dias.length > 0 && (
                  <div className="border-t border-border/60 p-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-full"
                      onClick={() => setCopyFilters((prev) => ({ ...prev, dias: [] }))}
                    >
                      Limpar dias
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
            <Select
              value={copyFilters.horario}
              onValueChange={(horario) => setCopyFilters((prev) => ({ ...prev, horario }))}
            >
              <SelectTrigger className="h-9"><SelectValue placeholder="Horário" /></SelectTrigger>
              <SelectContent side="bottom" align="start" avoidCollisions={false} className="z-[220]">
                <SelectItem value="todos">Todos os horários</SelectItem>
                {copyOptions.horarios.map((horario) => (
                  <SelectItem key={horario} value={horario}>{horario}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {copyFilters.dias.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {copyFilters.dias.map((dia) => (
                <button
                  key={dia}
                  type="button"
                  className="inline-flex h-7 items-center gap-1 rounded-full bg-primary/10 px-2 text-xs font-medium text-primary"
                  onClick={() =>
                    setCopyFilters((prev) => ({
                      ...prev,
                      dias: prev.dias.filter((d) => d !== dia),
                    }))
                  }
                >
                  {formatDateBR(dia)}
                  <X size={12} />
                </button>
              ))}
            </div>
          )}
          <Textarea
            className="h-56 max-h-56 resize-none overflow-y-auto font-mono text-xs leading-relaxed"
            value={copyDraft}
            onChange={(e) => setCopyDraft(e.target.value)}
            placeholder="O texto pré-salvo aparece aqui e você pode editar antes de copiar..."
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-muted-foreground">
              {demandasNoTexto.length} demanda(s) incluída(s) nesse texto. Você pode editar antes de copiar.
            </p>
            <Button
              size="sm"
              onClick={() =>
                copyToClipboard(
                  copyDraft,
                  type === "gerente"
                    ? "Escala copiada para enviar ao gerente"
                    : "Vagas disponíveis copiadas",
                )
              }
            >
              <Copy size={15} className="mr-2" />
              Copiar texto
            </Button>
          </div>
        </div>
      </PopoverContent>
    );
  }

  const selectedDates = form.datas.map(fromISODate);

  return (
    <div className="space-y-6 min-w-0 overflow-x-hidden">
      {/* Header */}
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-foreground">Demandas</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe as diárias de supermercado
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) {
              setForm(createEmptyForm());
              setEditingId(null);
              setDiaristaSearch("");
            }
          }}
        >
          <DialogTrigger asChild>
            <Button
              className="w-full justify-center gap-2 sm:w-auto"
              onClick={() => {
                setEditingId(null);
                setForm(createEmptyForm());
                setDiaristaSearch("");
              }}
            >
              <Plus size={16} />
              Nova Demanda
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md w-full max-h-[85vh] overflow-y-auto rounded-2xl p-4 sm:p-5 text-sm">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar" : "Nova"} Demanda</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              {/* Datas (multi-select) */}
              <div className="grid gap-1.5">
                <Label>Data{editingId ? "" : "s"} *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="justify-start font-normal h-10 rounded-lg w-full"
                    >
                      <CalendarIcon size={16} className="mr-2 text-muted-foreground" />
                      {form.datas.length === 0
                        ? "Selecione a(s) data(s)"
                        : form.datas.length === 1
                        ? formatDateBR(form.datas[0])
                        : `${form.datas.length} dias selecionados`}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    {editingId ? (
                      <Calendar
                        mode="single"
                        selected={selectedDates[0]}
                        onSelect={(d) =>
                          d && setForm({ ...form, datas: [toISODate(d)] })
                        }
                        initialFocus
                      />
                    ) : (
                      <Calendar
                        mode="multiple"
                        selected={selectedDates}
                        onSelect={(dates) =>
                          setForm({
                            ...form,
                            datas: (dates || []).map(toISODate).sort(),
                          })
                        }
                        initialFocus
                      />
                    )}
                  </PopoverContent>
                </Popover>
                {form.datas.length > 1 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {form.datas.map((d) => (
                      <span
                        key={d}
                        className="text-[11px] bg-accent text-accent-foreground rounded-full px-2 py-0.5 inline-flex items-center gap-1"
                      >
                        {formatDateBR(d)}
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              datas: form.datas.filter((x) => x !== d),
                            })
                          }
                          className="hover:text-destructive"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Horários & Valor */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="grid gap-1.5 min-w-0">
                  <Label>Entrada</Label>
                  <Input
                    className="h-10 rounded-lg"
                    list="demanda-horarios-entrada-salvos"
                    value={form.horario}
                    onChange={(e) => setForm({ ...form, horario: e.target.value })}
                  />
                  <datalist id="demanda-horarios-entrada-salvos">
                    {savedDemandOptions.horarios.map((horario) => (
                      <option key={horario} value={horario} />
                    ))}
                  </datalist>
                </div>
                <div className="grid gap-1.5 min-w-0">
                  <Label>Saída</Label>
                  <Input
                    className="h-10 rounded-lg"
                    list="demanda-horarios-saida-salvos"
                    value={form.horarioSaida}
                    onChange={(e) => setForm({ ...form, horarioSaida: e.target.value })}
                  />
                  <datalist id="demanda-horarios-saida-salvos">
                    {savedDemandOptions.horariosSaida.map((horario) => (
                      <option key={horario} value={horario} />
                    ))}
                  </datalist>
                </div>
                <div className="grid gap-1.5 min-w-0">
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    className="h-10 rounded-lg w-full min-w-0"
                    value={form.valor || ""}
                    onChange={(e) =>
                      setForm({ ...form, valor: parseFloat(e.target.value) || 0 })
                    }
                    placeholder="0,00"
                  />
                </div>
                <div className="grid gap-1.5 min-w-0">
                  <Label>Vagas</Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    className="h-10 rounded-lg w-full min-w-0"
                    value={form.vagas || 1}
                    onChange={(e) => {
                      const vagas = Math.max(1, Math.floor(parseInt(e.target.value, 10) || 1));
                      const alocacoes = form.alocacoes.slice(0, vagas);
                      setForm({
                        ...form,
                        vagas,
                        alocacoes,
                        diaristaId: alocacoes[0]?.diaristaId || "",
                        diaristaNome: alocacoes[0]?.diaristaNome || "",
                      });
                    }}
                    placeholder="1"
                  />
                </div>
              </div>

              {/* Setor */}
              <div className="grid gap-1.5">
                <Label>Setor *</Label>
                <Select
                  value={form.setor}
                  onValueChange={(v) => setForm({ ...form, setor: v })}
                >
                  <SelectTrigger className="h-10 rounded-lg w-full">
                    <SelectValue placeholder="Selecione o setor" />
                  </SelectTrigger>
                  <SelectContent side="bottom" align="start" sideOffset={6} className="max-h-72">
                    {setores.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Rede & Loja */}
              <div className="grid grid-cols-2 gap-3 min-w-0">
                <div className="grid gap-1.5">
                  <Label>Rede</Label>
                  <Input
                    className="h-10 rounded-lg"
                    list="demanda-redes-salvas"
                    value={form.rede}
                    onChange={(e) => setForm({ ...form, rede: e.target.value })}
                    placeholder="Ex: Pão de Açúcar"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Loja *</Label>
                  <Input
                    className="h-10 rounded-lg"
                    list="demanda-lojas-salvas"
                    value={form.loja}
                    onChange={(e) => setForm({ ...form, loja: e.target.value })}
                    placeholder="Ex: Loja Itaim"
                  />
                </div>
                <datalist id="demanda-redes-salvas">
                  {savedDemandOptions.redes.map((rede) => (
                    <option key={rede} value={rede} />
                  ))}
                </datalist>
                <datalist id="demanda-lojas-salvas">
                  {savedDemandOptions.lojas.map((loja) => (
                    <option key={loja} value={loja} />
                  ))}
                </datalist>
              </div>

              {/* Diarista picker */}
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label>Alocar diaristas</Label>
                  <span className="text-[11px] text-muted-foreground">
                    {form.alocacoes.length}/{Math.max(1, form.vagas || 1)} selecionados
                  </span>
                </div>
                {form.alocacoes.length > 0 && (
                  <div className="space-y-1.5">
                    {form.alocacoes.map((alocacao) => (
                      <div
                        key={alocacao.id}
                        className="flex items-center justify-between gap-2 border rounded-lg px-3 py-2 bg-accent/40 min-w-0"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                            {alocacao.diaristaNome
                              .split(" ")
                              .slice(0, 2)
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()}
                          </div>
                          <span className="text-sm font-medium truncate">
                            {alocacao.diaristaNome}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFormDiarista(alocacao.id)}
                          className="text-muted-foreground hover:text-destructive p-1"
                          aria-label="Remover"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {form.alocacoes.length < Math.max(1, form.vagas || 1) && (
                  <Popover open={diaristaPickerOpen} onOpenChange={setDiaristaPickerOpen}>
                    <PopoverTrigger asChild>
                      <div className="relative">
                        <Search
                          size={14}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        />
                        <Input
                          className="pl-8 h-10 rounded-lg"
                          placeholder={
                            form.vagas > 1
                              ? "Buscar e adicionar diarista..."
                              : "Buscar diarista pelo nome..."
                          }
                          value={diaristaSearch}
                          onChange={(e) => {
                            setDiaristaSearch(e.target.value);
                            setDiaristaPickerOpen(true);
                          }}
                          onFocus={() => setDiaristaPickerOpen(true)}
                        />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[--radix-popover-trigger-width] p-1 max-h-64 overflow-y-auto"
                      align="start"
                      onOpenAutoFocus={(e) => e.preventDefault()}
                    >
                      {diaristasFiltrados.length === 0 ? (
                        <p className="text-xs text-muted-foreground p-3 text-center">
                          Nenhum diarista encontrado
                        </p>
                      ) : (
                        diaristasFiltrados.map((d) => (
                          <button
                            type="button"
                            key={d.id}
                            onClick={() => {
                              handleSelectFormDiarista(d);
                            }}
                            disabled={form.alocacoes.some((a) => a.diaristaId === d.id)}
                            className="w-full text-left flex items-center gap-2 px-2 py-2 rounded-md hover:bg-accent disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            <div className="w-7 h-7 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                              {d.nome
                                .split(" ")
                                .slice(0, 2)
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{d.nome}</p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {d.setorExperiencia.slice(0, 2).join(", ") || d.bairro || "-"}
                              </p>
                            </div>
                          </button>
                        ))
                      )}
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              <Button onClick={handleSave} className="w-full mt-2">
                {editingId ? "Salvar Alterações" : "Criar Demanda"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<Store size={20} />} value={counts.total} label="Total de diárias" tone="primary" />
        <StatCard icon={<CircleDashed size={20} />} value={counts.pendente} label="Aguardando" tone="muted" />
        <StatCard icon={<UserCheck size={20} />} value={counts.presente} label="Presentes" tone="success" />
        <StatCard icon={<UserX size={20} />} value={counts.falta} label="Faltas" tone="warning" />
      </div>

      {/* Tabs + Search */}
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted/50 p-1 sm:flex sm:flex-wrap">
          <TabBtn active={tab === "todas"} onClick={() => setTab("todas")} label="Todas" count={counts.total} />
          <TabBtn active={tab === "pendente"} onClick={() => setTab("pendente")} label="Aguardando" count={counts.pendente} />
          <TabBtn active={tab === "concluida"} onClick={() => setTab("concluida")} label="Presentes" count={counts.presente} />
          <TabBtn active={tab === "falta"} onClick={() => setTab("falta")} label="Faltas" count={counts.falta} />
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-72 lg:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar demanda..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-2 sm:flex sm:items-center">
            <Popover
              open={copyPanel === "gerente"}
              onOpenChange={(open) => (open ? openCopyPanel("gerente") : setCopyPanel(null))}
            >
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 whitespace-nowrap"
                  disabled={demandas.length === 0}
                >
                  <Copy size={15} />
                  Copiar escala gerente
                </Button>
              </PopoverTrigger>
              {renderCopyPopoverContent("gerente")}
            </Popover>
            <Popover
              open={copyPanel === "vagas"}
              onOpenChange={(open) => (open ? openCopyPanel("vagas") : setCopyPanel(null))}
            >
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 whitespace-nowrap"
                  disabled={!demandas.some((d) => vagasLivresDemanda(d) > 0)}
                >
                  <Copy size={15} />
                  Copiar vagas disponíveis
                </Button>
              </PopoverTrigger>
              {renderCopyPopoverContent("vagas")}
            </Popover>
          </div>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-2 overflow-hidden rounded-xl border border-border/60 bg-card/55 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_160px_auto]">
        <Select
          value={redeFilter}
          onValueChange={(value) => {
            setRedeFilter(value);
            setLojaFilter("todas");
            setSetorFilter("todos");
          }}
        >
          <SelectTrigger className="h-9 rounded-lg">
            <SelectValue placeholder="Rede" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as redes</SelectItem>
            {filterOptions.redes.map((rede) => (
              <SelectItem key={rede} value={rede}>
                {rede}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={lojaFilter}
          onValueChange={(value) => {
            setLojaFilter(value);
            setSetorFilter("todos");
          }}
        >
          <SelectTrigger className="h-9 rounded-lg">
            <SelectValue placeholder="Loja" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as lojas</SelectItem>
            {filterOptions.lojas.map((loja) => (
              <SelectItem key={loja} value={loja}>
                {loja}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={setorFilter} onValueChange={setSetorFilter}>
          <SelectTrigger className="h-9 rounded-lg">
            <SelectValue placeholder="Setor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os setores</SelectItem>
            {filterOptions.setores.map((setor) => (
              <SelectItem key={setor} value={setor}>
                {setor}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={diaFilter || "todos"} onValueChange={(value) => setDiaFilter(value === "todos" ? "" : value)}>
          <SelectTrigger className="h-9 rounded-lg sm:hidden">
            <SelectValue placeholder="Dia" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os dias</SelectItem>
            {filterOptions.dias.map((dia) => (
              <SelectItem key={dia} value={dia}>
                {formatDateBR(dia)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          className="hidden h-9 min-w-0 rounded-lg sm:block"
          value={diaFilter}
          onChange={(e) => setDiaFilter(e.target.value)}
          aria-label="Filtrar por dia"
        />

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          onClick={() => {
            setRedeFilter("todas");
            setLojaFilter("todas");
            setSetorFilter("todos");
            setDiaFilter("");
            setSearch("");
            setTab("todas");
          }}
        >
          Limpar
        </Button>
      </div>


      {/* Lista agrupada por Rede > Loja > Dia > Horário > Setor */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="glass border-soft rounded-2xl hover-lift p-8 text-center text-muted-foreground text-sm">
            Nenhuma demanda encontrada.
          </div>
        ) : (
          (() => {
            const grupos = new Map<string, Map<string, Map<string, Map<string, Map<string, Demanda[]>>>>>();
            for (const d of filtered) {
              const rede = demandaRede(d);
              const loja = demandaLoja(d);
              const dia = d.data || "Sem data";
              const horario = horarioDemanda(d) || "Sem horário";
              const setor = demandaSetor(d);

              if (!grupos.has(rede)) grupos.set(rede, new Map());
              const lojas = grupos.get(rede)!;
              if (!lojas.has(loja)) lojas.set(loja, new Map());
              const dias = lojas.get(loja)!;
              if (!dias.has(dia)) dias.set(dia, new Map());
              const horarios = dias.get(dia)!;
              if (!horarios.has(horario)) horarios.set(horario, new Map());
              const setores = horarios.get(horario)!;
              if (!setores.has(setor)) setores.set(setor, []);
              setores.get(setor)!.push(d);
            }
            const redesOrdenadas = Array.from(grupos.keys()).sort((a, b) =>
              a.localeCompare(b, "pt-BR")
            );
            return redesOrdenadas.map((rede) => {
              const lojas = grupos.get(rede)!;
              const totalRede = filtered
                .filter((d) => demandaRede(d) === rede)
                .reduce((sum, d) => sum + totalVagasDemanda(d), 0);
              const lojasOrdenadas = Array.from(lojas.keys()).sort((a, b) =>
                a.localeCompare(b, "pt-BR")
              );
              const redeCollapsed = collapsedRedes.has(rede);
              return (
                <div
                  key={rede}
                  className="bg-card/50 rounded-2xl border border-border overflow-hidden"
                >
                  <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-primary/5 border-b border-border">
                    <button
                      type="button"
                      onClick={() => toggleRede(rede)}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left transition-colors hover:text-primary"
                      aria-expanded={!redeCollapsed}
                    >
                      {redeCollapsed ? (
                        <ChevronRight size={16} className="text-primary shrink-0" />
                      ) : (
                        <ChevronDown size={16} className="text-primary shrink-0" />
                      )}
                      <Store size={16} className="text-primary shrink-0" />
                      <h2 className="font-bold text-foreground text-sm sm:text-base truncate">
                        {rede}
                      </h2>
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRenameRede(rede)}
                        className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        aria-label="Editar rede"
                        title="Editar rede"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRede(rede)}
                        className="p-1.5 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        aria-label="Remover rede"
                        title="Remover rede"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {!redeCollapsed && (
                    <div className="p-3 space-y-4">
                      {lojasOrdenadas.map((loja) => {
                        const dias = lojas.get(loja)!;
                        const totalLoja = filtered
                          .filter((d) => demandaRede(d) === rede && demandaLoja(d) === loja)
                          .reduce((sum, d) => sum + totalVagasDemanda(d), 0);
                        const diasOrdenados = Array.from(dias.keys()).sort((a, b) =>
                          a.localeCompare(b, "pt-BR", { numeric: true }),
                        );
                        const lojaKey = `${rede}::${loja}`;
                        const lojaCollapsed = collapsedLojas.has(lojaKey);
                        return (
                          <div key={loja} className="space-y-2">
                            <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/40 transition-colors">
                              <button
                                type="button"
                                onClick={() => toggleLoja(lojaKey)}
                                className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                                aria-expanded={!lojaCollapsed}
                              >
                                {lojaCollapsed ? (
                                  <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                                ) : (
                                  <ChevronDown size={14} className="text-muted-foreground shrink-0" />
                                )}
                                <h3 className="text-sm font-semibold text-foreground truncate">
                                  {loja}
                                </h3>
                              </button>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[10px] text-muted-foreground">
                                  {totalLoja} {totalLoja === 1 ? "diária" : "diárias"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRenameLoja(rede, loja)}
                                  className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                  aria-label="Editar loja"
                                  title="Editar loja"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteLoja(rede, loja)}
                                  className="p-1.5 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                                  aria-label="Remover loja"
                                  title="Remover loja"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                            {!lojaCollapsed && (
                              <div className="space-y-4 pl-2">
                                {diasOrdenados.map((dia) => {
                                  const horarios = dias.get(dia)!;
                                  const horariosOrdenados = Array.from(horarios.keys()).sort((a, b) =>
                                    a.localeCompare(b, "pt-BR", { numeric: true }),
                                  );
                                  const totalDia = Array.from(horarios.values()).reduce(
                                    (acc, setores) =>
                                      acc +
                                      Array.from(setores.values()).reduce(
                                        (sum, arr) =>
                                          sum + arr.reduce((total, d) => total + totalVagasDemanda(d), 0),
                                        0,
                                      ),
                                    0,
                                  );

                                  return (
                                    <div key={dia} className="space-y-3">
                                      <div className="flex items-center gap-2 px-1">
                                        <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                                          {dia === "Sem data" ? dia : formatDiaCompleto(dia)}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">
                                          {totalDia} {totalDia === 1 ? "diária" : "diárias"}
                                        </span>
                                      </div>
                                      {horariosOrdenados.map((horario) => {
                                        const setores = horarios.get(horario)!;
                                        const setoresOrdenados = Array.from(setores.keys()).sort((a, b) =>
                                          a.localeCompare(b, "pt-BR"),
                                        );
                                        const totalHorario = Array.from(setores.values()).reduce(
                                          (sum, arr) =>
                                            sum + arr.reduce((total, d) => total + totalVagasDemanda(d), 0),
                                          0,
                                        );

                                        return (
                                          <div key={`${dia}-${horario}`} className="space-y-2 pl-2">
                                            <div className="flex items-center gap-2 px-1">
                                              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                                                <Clock size={12} />
                                                {horario}
                                              </span>
                                              <span className="text-[10px] text-muted-foreground">
                                                {totalHorario} {totalHorario === 1 ? "diária" : "diárias"}
                                              </span>
                                            </div>
                                            {setoresOrdenados.map((setor) => {
                                              const demandasDoSetor = setores
                                                .get(setor)!
                                                .slice()
                                                .sort((a, b) =>
                                                  a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }),
                                                );
                                              const totalSetor = demandasDoSetor.reduce(
                                                (sum, d) => sum + totalVagasDemanda(d),
                                                0,
                                              );

                                              return (
                                                <div key={`${dia}-${horario}-${setor}`} className="space-y-2 pl-2">
                                                  <div className="flex items-center gap-2 px-1">
                                                    <span className="text-[10px] uppercase tracking-wide bg-accent text-accent-foreground px-1.5 py-0.5 rounded font-medium">
                                                      {setor}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground">
                                                      {totalSetor}
                                                    </span>
                                                  </div>
                                                  <div className="space-y-2">
                                                    {demandasDoSetor.map((d) => (
                                                      <DemandaCard
                                                        key={d.id}
                                                        demanda={d}
                                                        demandas={demandas}
                                                        diaristas={diaristas}
                                                        onEdit={() => handleEdit(d)}
                                                        onAddVaga={() => handleAdicionarVaga(d)}
                                                        onDelete={() => handleDelete(d.id)}
                                                        onStatusAlocacao={(alocacaoId, status) =>
                                                          handleStatusAlocacao(d, alocacaoId, status)
                                                        }
                                                        onReposicao={(alocacaoId, reposicao) =>
                                                          handleReposicaoAlocacao(d, alocacaoId, reposicao)
                                                        }
                                                        onAlocar={(did, dnome) => {
                                                          handleAlocarDiarista(d, did, dnome);
                                                        }}
                                                        onRemoverAlocacao={(alocacaoId) =>
                                                          handleRemoverAlocacao(d, alocacaoId)
                                                        }
                                                      />
                                                    ))}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            });
          })()
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
  tone,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  tone: "primary" | "success" | "warning" | "muted";
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <div className="glass border-soft rounded-2xl hover-lift p-4 flex items-center gap-3">
      <div className={`p-2.5 rounded-lg ${tones[tone]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-card-foreground leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground truncate">{label}</p>
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm rounded-md whitespace-nowrap transition-colors flex items-center gap-1.5 ${
        active
          ? "bg-card text-foreground shadow-sm font-medium"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
      <span
        className={`text-xs px-1.5 rounded ${
          active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function DemandaCard({
  demanda,
  demandas,
  diaristas,
  onEdit,
  onAddVaga,
  onDelete,
  onStatusAlocacao,
  onReposicao,
  onAlocar,
  onRemoverAlocacao,
}: {
  demanda: Demanda;
  demandas: Demanda[];
  diaristas: Diarista[];
  onEdit: () => void;
  onAddVaga: () => void;
  onDelete: () => void;
  onStatusAlocacao: (alocacaoId: string, status: "presente" | "falta") => void;
  onReposicao: (
    alocacaoId: string,
    reposicao: { diaristaId?: string; diaristaNome: string; telefone?: string; observacoes?: string },
  ) => void;
  onAlocar: (diaristaId: string, diaristaNome: string) => void;
  onRemoverAlocacao: (alocacaoId: string) => void;
}) {
  const statusBadge =
    demanda.status === "concluida"
      ? "bg-success/10 text-success"
      : demanda.status === "falta"
      ? "bg-destructive/10 text-destructive"
      : "bg-muted text-muted-foreground";

  const [alocarOpen, setAlocarOpen] = useState(false);
  const [alocarSearch, setAlocarSearch] = useState("");
  const [reposicaoOpen, setReposicaoOpen] = useState<string | null>(null);
  const [reposicaoSearch, setReposicaoSearch] = useState("");
  const [reposicaoForm, setReposicaoForm] = useState({ nome: "", telefone: "", observacoes: "", diaristaId: "" });
  const [escalaOpen, setEscalaOpen] = useState<string | null>(null);
  const [escalaDraft, setEscalaDraft] = useState("");
  const vagas = Math.max(1, demanda.tarefasTotal || 1);
  const alocacoes = normalizeAlocacoes(demanda);
  const vagasLivres = Math.max(0, vagas - alocacoes.length);

  const diaristasFiltrados = useMemo(() => {
    const q = alocarSearch.toLowerCase().trim();
    return diaristas.filter(
      (d) =>
        !q ||
        d.nome.toLowerCase().includes(q) ||
        d.bairro.toLowerCase().includes(q) ||
        d.setorExperiencia.some((s) => s.toLowerCase().includes(q))
    );
  }, [diaristas, alocarSearch]);

  const reposicaoDiaristasFiltrados = useMemo(() => {
    const q = reposicaoSearch.toLowerCase().trim();
    return diaristas.filter(
      (d) =>
        !q ||
        d.nome.toLowerCase().includes(q) ||
        d.telefone.includes(q) ||
        d.bairro.toLowerCase().includes(q),
    );
  }, [diaristas, reposicaoSearch]);

  function openReposicao(alocacao: DemandaAlocacao) {
    setReposicaoForm({
      nome: alocacao.reposicao?.diaristaNome || "",
      telefone: alocacao.reposicao?.telefone || "",
      observacoes: alocacao.reposicao?.observacoes || "",
      diaristaId: alocacao.reposicao?.diaristaId || "",
    });
    setReposicaoSearch("");
    setReposicaoOpen(alocacao.id);
  }

  function salvarReposicao(alocacaoId: string) {
    onReposicao(alocacaoId, {
      diaristaId: reposicaoForm.diaristaId || undefined,
      diaristaNome: reposicaoForm.nome,
      telefone: reposicaoForm.telefone,
      observacoes: reposicaoForm.observacoes,
    });
    setReposicaoOpen(null);
    setReposicaoSearch("");
  }

  function formatDiaEscalaDiarista(data: string) {
    if (!data) return "Sem data";
    const [y, m, d] = data.split("-").map(Number);
    const date = new Date(y, (m || 1) - 1, d || 1);
    const weekday = date.toLocaleDateString("pt-BR", { weekday: "long" });
    const dayMonth = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} \u2014 ${dayMonth}`;
  }

  function buildEscalaAlocacaoText(alocacao: DemandaAlocacao) {
    const templates = getCopyTemplates();
    const diaristaId = alocacao.reposicao?.diaristaId || alocacao.diaristaId;
    const diarista = diaristas.find((d) => d.id === diaristaId);
    const nome = nomeEfetivoAlocacao(alocacao);
    const itens = demandas
      .flatMap((d) =>
        normalizeAlocacoes(d)
          .filter((a) => alocacaoMatchesDiarista(a, diaristaId, nome))
          .map((a) => ({ demanda: d, alocacao: a })),
      )
      .sort((a, b) =>
        `${a.demanda.data}${horarioDemanda(a.demanda)}${demandaRede(a.demanda)}${demandaLoja(a.demanda)}${demandaSetor(a.demanda)}`.localeCompare(
          `${b.demanda.data}${horarioDemanda(b.demanda)}${demandaRede(b.demanda)}${demandaLoja(b.demanda)}${demandaSetor(b.demanda)}`,
          "pt-BR",
          { numeric: true },
        ),
      );

    const blocos = new Map<string, { redeLoja: string; setor: string; dias: Map<string, string[]> }>();
    itens.forEach(({ demanda: itemDemanda, alocacao: itemAlocacao }) => {
      const redeLoja = [demandaRede(itemDemanda), demandaLoja(itemDemanda)]
        .filter((value) => value && !/^sem /i.test(value))
        .join(" ");
      const setor = demandaSetor(itemDemanda);
      const key = `${redeLoja}::${setor}`;
      if (!blocos.has(key)) {
        blocos.set(key, { redeLoja: redeLoja || demandaLoja(itemDemanda), setor, dias: new Map() });
      }
      const grupo = blocos.get(key)!;
      const horarios = grupo.dias.get(itemDemanda.data) || [];
      const horarioLinha = `   \uD83D\uDD50 ${horarioDemanda(itemDemanda) || "Sem hor\u00E1rio"}${
          itemAlocacao.reposicao ? "\n   Reposi\u00E7\u00E3o de falta" : ""
        }`;
      if (!horarios.includes(horarioLinha)) {
        horarios.push(horarioLinha);
        grupo.dias.set(itemDemanda.data, horarios);
      }
    });

    const gruposEscala = Array.from(blocos.values());
    const cabecalhoEscala = gruposEscala
      .map((grupo) => `\uD83D\uDCCD ${grupo.redeLoja}\n\uD83C\uDFF7\uFE0F ${grupo.setor}`)
      .join("\n\n");
    const agenda = gruposEscala
      .map((grupo, index) => {
        const agendaGrupo = Array.from(grupo.dias.entries())
          .sort(([a], [b]) => a.localeCompare(b, "pt-BR", { numeric: true }))
          .map(
            ([data, horarios]) =>
              `\uD83D\uDCC5 ${formatDiaEscalaDiarista(data)}\n${horarios.join("\n")}`,
          )
          .join("\n\n");
        return index === 0
          ? agendaGrupo
          : `\uD83D\uDCCD ${grupo.redeLoja}\n\uD83C\uDFF7\uFE0F ${grupo.setor}\n\n${agendaGrupo}`;
      })
      .join("\n\n");
    const primeiraDemanda = itens[0]?.demanda || demanda;
    const redeLojaPrincipal = [demandaRede(primeiraDemanda), demandaLoja(primeiraDemanda)]
      .filter((value) => value && !/^sem /i.test(value))
      .join(" ");
    const agendaCompleta = `*Di\u00E1rias agendadas:*\n${agenda}`.trim();
    return applyTemplate(templates.escalaDiarista, {
      EscalaDiarista: agendaCompleta,
      Diarista: nome,
      Telefone: telefoneEfetivoAlocacao(alocacao, diaristas),
      CPF: diarista?.cpf || "",
      Bairro: diarista?.bairro || "",
      Rede: demandaRede(primeiraDemanda),
      Loja: demandaLoja(primeiraDemanda),
      RedeLoja: redeLojaPrincipal || demandaLoja(primeiraDemanda),
      Local: redeLojaPrincipal || demandaLoja(primeiraDemanda),
      Setor: demandaSetor(primeiraDemanda),
      Data: formatDiaEscalaDiarista(primeiraDemanda.data),
      Horario: horarioDemanda(primeiraDemanda) || "",
      Setores: Array.from(new Set(itens.map((item) => demandaSetor(item.demanda)))).join(", ") || demanda.setor || "",
      TotalDiarias: itens.length || 1,
      DiariaTexto: (itens.length || 1) === 1 ? "di\u00E1ria" : "di\u00E1rias",
      Diarias: cabecalhoEscala,
      Agenda: agenda,
      FaltaTexto: templates.textoFalta,
    });
  }

  function openEscalaAlocacao(alocacao: DemandaAlocacao) {
    setEscalaDraft(buildEscalaAlocacaoText(alocacao));
    setEscalaOpen(alocacao.id);
  }

  async function copiarEscalaDraft(alocacao: DemandaAlocacao) {
    const nome = nomeEfetivoAlocacao(alocacao);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(escalaDraft);
      } else {
        const area = document.createElement("textarea");
        area.value = escalaDraft;
        area.style.position = "fixed";
        area.style.left = "-9999px";
        document.body.appendChild(area);
        area.focus();
        area.select();
        document.execCommand("copy");
        document.body.removeChild(area);
      }
      toast.success(`Escala de ${nome} copiada`);
      setEscalaOpen(null);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  const alocarButton = (
    <Popover open={alocarOpen} onOpenChange={setAlocarOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-full px-2.5 py-1 transition-colors"
        >
          <Plus size={11} />
          Alocar diarista
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-2 max-h-72 overflow-y-auto"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="relative mb-2">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            className="pl-8 h-9 rounded-lg text-sm"
            placeholder="Buscar diarista..."
            value={alocarSearch}
            onChange={(e) => setAlocarSearch(e.target.value)}
            autoFocus
          />
        </div>
        {diaristasFiltrados.length === 0 ? (
          <p className="text-xs text-muted-foreground p-3 text-center">
            Nenhum diarista encontrado
          </p>
        ) : (
          <div className="space-y-0.5">
            {diaristasFiltrados.map((d) => (
              <button
                type="button"
                key={d.id}
                onClick={() => {
                  onAlocar(d.id, d.nome);
                  setAlocarOpen(false);
                  setAlocarSearch("");
                }}
                className="w-full text-left flex items-center gap-2 px-2 py-2 rounded-md hover:bg-accent transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                  {d.nome
                    .split(" ")
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{d.nome}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {d.setorExperiencia.slice(0, 2).join(", ") || d.bairro || "-"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="glass border-soft rounded-2xl hover-lift p-4 grid md:grid-cols-[110px_1fr_auto] gap-4 items-start shadow-sm">
      {/* Time column */}
      <div className="flex md:flex-col md:items-start items-center gap-2 md:gap-0">
        <p className="text-xl font-bold text-foreground leading-none">{demanda.horario}</p>
        <p className="text-xs text-muted-foreground">{formatDateBR(demanda.data)}</p>
        <p className="text-xs text-muted-foreground font-mono">#{demanda.codigo}</p>
      </div>

      {/* Loja info */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-card-foreground truncate">{demanda.loja || "-"}</h3>
          <span className="text-[10px] uppercase tracking-wide bg-accent text-accent-foreground px-1.5 py-0.5 rounded">
            {demanda.setor || "Visita"}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusBadge}`}>
            {statusLabel[demanda.status]}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-primary/10 text-primary">
            {alocacoes.length}/{vagas} vagas
          </span>
        </div>
        {demanda.valor > 0 && (
          <p className="text-xs text-card-foreground font-medium mt-1">
            R$ {demanda.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        )}
        <div className="mt-2 space-y-2">
          {alocacoes.map((alocacao) => (
            <div
              key={alocacao.id}
              className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/20 p-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <User size={11} /> {alocacao.diaristaNome}
                </p>
                {alocacao.status !== "pendente" && (
                  <span
                    className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      alocacao.status === "presente"
                        ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300"
                        : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
                    }`}
                  >
                    {alocacao.status === "presente" ? "Presente" : "Falta"}
                  </span>
                )}
                {alocacao.reposicao && (
                  <p className="mt-1 text-[11px] font-medium text-green-700 dark:text-green-300">
                    Reposição: {alocacao.reposicao.diaristaNome}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Popover
                  open={escalaOpen === alocacao.id}
                  onOpenChange={(open) => (open ? openEscalaAlocacao(alocacao) : setEscalaOpen(null))}
                >
                  <PopoverTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-8 rounded-lg"
                      title="Copiar escala do diarista"
                    >
                      <Copy size={13} />
                      Copiar
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="z-[120] w-[min(92vw,520px)] rounded-2xl p-3" align="end" sideOffset={8}>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          Confirmar escala de {nomeEfetivoAlocacao(alocacao)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Texto pré-salvo das configurações. Revise e edite antes de copiar.
                        </p>
                      </div>
                      <Textarea
                        className="min-h-56 font-mono text-xs"
                        value={escalaDraft}
                        onChange={(e) => setEscalaDraft(e.target.value)}
                      />
                      <Button className="w-full" size="sm" onClick={() => copiarEscalaDraft(alocacao)}>
                        <Copy size={14} className="mr-2" />
                        Copiar escala
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-lg border-red-500/50 px-2 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10"
                  onClick={() => onRemoverAlocacao(alocacao.id)}
                  title="Remover diarista desta demanda"
                >
                  <Trash2 size={13} />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={`gap-1.5 h-8 rounded-lg ${
                    alocacao.status === "presente"
                      ? "border-green-600 bg-green-600 text-white shadow-lg shadow-green-600/25 hover:bg-green-700 hover:text-white"
                      : "border-green-500/60 text-green-600 hover:bg-green-50 hover:text-green-700 dark:text-green-400 dark:hover:bg-green-500/10"
                  }`}
                  onClick={() => onStatusAlocacao(alocacao.id, "presente")}
                >
                  <UserCheck size={13} />
                  Presente
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={`gap-1.5 h-8 rounded-lg ${
                    alocacao.status === "falta"
                      ? "border-red-600 bg-red-600 text-white shadow-lg shadow-red-600/25 hover:bg-red-700 hover:text-white"
                      : "border-red-500/60 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10"
                  }`}
                  onClick={() => onStatusAlocacao(alocacao.id, "falta")}
                >
                  <UserX size={13} />
                  Falta
                </Button>
                {alocacao.status === "falta" && (
                  <Popover
                    open={reposicaoOpen === alocacao.id}
                    onOpenChange={(open) => (open ? openReposicao(alocacao) : setReposicaoOpen(null))}
                  >
                    <PopoverTrigger asChild>
                      <Button size="sm" variant="outline" className="gap-1.5 h-8 rounded-lg">
                        <RefreshCw size={13} />
                        Reposição
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-3" align="end">
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-semibold text-foreground">Diarista da reposição</p>
                          <p className="text-[11px] text-muted-foreground">
                            Use um cadastro existente ou digite os dados manualmente.
                          </p>
                        </div>
                        <div className="relative">
                          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            className="h-9 pl-8"
                            placeholder="Buscar diarista..."
                            value={reposicaoSearch}
                            onChange={(e) => setReposicaoSearch(e.target.value)}
                          />
                        </div>
                        {reposicaoSearch && reposicaoDiaristasFiltrados.length > 0 && (
                          <div className="max-h-32 overflow-y-auto rounded-lg border border-border/60">
                            {reposicaoDiaristasFiltrados.slice(0, 6).map((d) => (
                              <button
                                key={d.id}
                                type="button"
                                className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-xs hover:bg-muted"
                                onClick={() => {
                                  setReposicaoForm({
                                    nome: d.nome,
                                    telefone: d.telefone,
                                    observacoes: reposicaoForm.observacoes,
                                    diaristaId: d.id,
                                  });
                                  setReposicaoSearch("");
                                }}
                              >
                                <span className="font-medium">{d.nome}</span>
                                <span className="text-muted-foreground">{d.telefone}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        <Input
                          className="h-9"
                          placeholder="Nome do diarista"
                          value={reposicaoForm.nome}
                          onChange={(e) =>
                            setReposicaoForm({ ...reposicaoForm, nome: e.target.value, diaristaId: "" })
                          }
                        />
                        <Input
                          className="h-9"
                          placeholder="Telefone"
                          value={reposicaoForm.telefone}
                          onChange={(e) => setReposicaoForm({ ...reposicaoForm, telefone: e.target.value })}
                        />
                        <Input
                          className="h-9"
                          placeholder="Observação opcional"
                          value={reposicaoForm.observacoes}
                          onChange={(e) => setReposicaoForm({ ...reposicaoForm, observacoes: e.target.value })}
                        />
                        <Button className="w-full" size="sm" onClick={() => salvarReposicao(alocacao.id)}>
                          Salvar reposição
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
          ))}
          {vagasLivres > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {alocarButton}
              <span className="text-[11px] text-muted-foreground">
                {vagasLivres} {vagasLivres === 1 ? "vaga livre" : "vagas livres"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex md:flex-col items-end gap-1.5">
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Editar diária"
            title="Editar diária"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onAddVaga}
            className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
            aria-label="Adicionar vaga"
            title="Adicionar mais 1 vaga"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            aria-label="Remover diária"
            title="Remover diária"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
