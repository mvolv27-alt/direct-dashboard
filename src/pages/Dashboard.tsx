import { useEffect, useMemo, useRef, useState, type ElementType } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CloudUpload,
  History,
  LayoutDashboard,
  Plus,
  RefreshCw,
  ShieldAlert,
  Store,
  UserCheck,
  UserRoundX,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLojas, useRedeValores } from "@/hooks/useConfig";
import { supabase } from "@/integrations/supabase/client";
import { useLiveData, useSyncStatus } from "@/lib/sync";
import { getDemandas } from "@/lib/storage";
import type { Demanda, DemandaAlocacao } from "@/types";

type PriorityTone = "critical" | "high" | "medium" | "info";
type Priority = {
  id: string;
  tone: PriorityTone;
  icon: ElementType;
  title: string;
  description: string;
  context: string;
  demandCode?: string;
  sortTime: number;
};
type AuditRow = {
  id: number;
  action: string;
  actor_email: string;
  created_at: string;
  table_name: string;
};

const periods = [
  { label: "06-09", start: 360, end: 540 },
  { label: "09-13", start: 540, end: 780 },
  { label: "13-17", start: 780, end: 1020 },
  { label: "17-22", start: 1020, end: 1320 },
];

function localISODate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

function allocationsOf(demand: Demanda): DemandaAlocacao[] {
  if (demand.alocacoes?.length) return demand.alocacoes;
  if (!demand.diaristaId && !demand.diaristaNome) return [];
  return [{
    id: demand.diaristaId || `legacy-${demand.id}`,
    diaristaId: demand.diaristaId || "",
    diaristaNome: demand.diaristaNome || "Diarista",
    status: demand.status === "concluida" ? "presente" : demand.status === "falta" ? "falta" : "pendente",
  }];
}

function statsOf(demand: Demanda) {
  const allocations = allocationsOf(demand);
  const slots = Math.max(1, demand.tarefasTotal || allocations.length || 1);
  const present = allocations.filter((item) => item.status === "presente" || item.reposicao).length;
  const absent = allocations.filter((item) => item.status === "falta" && !item.reposicao).length;
  return {
    slots,
    allocations,
    allocated: Math.min(slots, allocations.length),
    open: Math.max(0, slots - allocations.length),
    present,
    absent,
  };
}

function toMinutes(value?: string) {
  const [hours, minutes] = (value || "00:00").split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function rangeOf(demand: Demanda) {
  const start = toMinutes(demand.horario);
  let end = demand.horarioSaida ? toMinutes(demand.horarioSaida) : start + 480;
  if (end <= start) end += 1440;
  return { start, end };
}

function overlaps(first: Demanda, second: Demanda) {
  const a = rangeOf(first);
  const b = rangeOf(second);
  return a.start < b.end && b.start < a.end;
}

function workerKey(allocation: DemandaAlocacao) {
  return (
    allocation.reposicao?.diaristaId ||
    allocation.diaristaId ||
    allocation.reposicao?.diaristaNome ||
    allocation.diaristaNome
  ).trim().toLowerCase();
}

function workerName(allocation: DemandaAlocacao) {
  return allocation.reposicao?.diaristaNome || allocation.diaristaNome || "Diarista";
}

function lookup(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  if (minutes < 1440) return `há ${Math.floor(minutes / 60)} h`;
  return new Date(value).toLocaleDateString("pt-BR");
}

function MetricCard({ icon: Icon, label, value, helper, tone }: {
  icon: ElementType;
  label: string;
  value: string;
  helper: string;
  tone: "primary" | "success" | "destructive" | "warning" | "secondary";
}) {
  const colors = {
    primary: { icon: "bg-primary/10 text-primary", edge: "border-l-primary" },
    success: { icon: "bg-success/10 text-success", edge: "border-l-success" },
    destructive: { icon: "bg-destructive/10 text-destructive", edge: "border-l-destructive" },
    warning: { icon: "bg-warning/10 text-warning", edge: "border-l-warning" },
    secondary: { icon: "bg-secondary/10 text-secondary", edge: "border-l-secondary" },
  }[tone];
  return (
    <div className={`surface-panel hover-lift min-h-[118px] border-l-[3px] p-4 ${colors.edge}`}>
      <div className="flex items-center gap-2.5">
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${colors.icon}`}><Icon size={18} /></div>
        <span className="text-[11px] font-bold uppercase text-muted-foreground">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-extrabold leading-none text-card-foreground">{value}</p>
      <p className="mt-2 text-[11px] text-muted-foreground">{helper}</p>
    </div>
  );
}

function PriorityBadge({ tone }: { tone: PriorityTone }) {
  const labels = { critical: "Crítica", high: "Alta", medium: "Média", info: "Informação" };
  const colors = {
    critical: "border-destructive/25 bg-destructive/10 text-destructive",
    high: "border-warning/25 bg-warning/10 text-warning",
    medium: "border-primary/25 bg-primary/10 text-primary",
    info: "border-secondary/25 bg-secondary/10 text-secondary",
  };
  return <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${colors[tone]}`}>{labels[tone]}</span>;
}

export default function Dashboard() {
  const demands = useLiveData(getDemandas, ["demandas"]);
  const sync = useSyncStatus();
  const { rows: stores } = useLojas();
  const { rows: rates } = useRedeValores();
  const [selectedDate, setSelectedDate] = useState(localISODate);
  const [activities, setActivities] = useState<AuditRow[]>([]);
  const prioritiesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id,action,actor_email,created_at,table_name")
        .order("created_at", { ascending: false })
        .limit(8);
      if (active && !error) setActivities((data as AuditRow[]) || []);
    };
    void refresh();
    const channel = supabase
      .channel(`central-activity:${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "audit_log" }, () => void refresh())
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  const dayDemands = useMemo(
    () => demands.filter((demand) => demand.data === selectedDate),
    [demands, selectedDate],
  );

  const rateMap = useMemo(
    () => new Map(rates.map((item) => [lookup(item.rede), item.valor_recebido || 0])),
    [rates],
  );

  const metrics = useMemo(() => {
    const summary = dayDemands.reduce((acc, demand) => {
      const stats = statsOf(demand);
      const received = rateMap.get(lookup(demand.rede || "")) ?? demand.valor ?? 0;
      acc.slots += stats.slots;
      acc.allocated += stats.allocated;
      acc.present += stats.present;
      acc.absent += stats.absent;
      acc.profit += stats.present * (received - (demand.valor || 0));
      return acc;
    }, { slots: 0, allocated: 0, present: 0, absent: 0, profit: 0 });
    return {
      ...summary,
      coverage: summary.slots ? Math.round((summary.allocated / summary.slots) * 100) : 0,
    };
  }, [dayDemands, rateMap]);

  const conflicts = useMemo(() => {
    const workers = new Map<string, Array<{ demand: Demanda; name: string }>>();
    dayDemands.forEach((demand) => allocationsOf(demand).forEach((allocation) => {
      const key = workerKey(allocation);
      if (!key) return;
      workers.set(key, [...(workers.get(key) || []), { demand, name: workerName(allocation) }]);
    }));
    const found: Array<{ first: Demanda; second: Demanda; name: string }> = [];
    workers.forEach((entries) => {
      entries.forEach((entry, index) => entries.slice(index + 1).forEach((other) => {
        if (entry.demand.id !== other.demand.id && overlaps(entry.demand, other.demand)) {
          found.push({ first: entry.demand, second: other.demand, name: entry.name });
        }
      }));
    });
    return found;
  }, [dayDemands]);

  const priorities = useMemo(() => {
    const items: Priority[] = conflicts.map((conflict, index) => ({
      id: `conflict-${conflict.first.id}-${conflict.second.id}-${index}`,
      tone: "critical",
      icon: ShieldAlert,
      title: "Conflito de horário",
      description: `${conflict.name} está em duas demandas sobrepostas.`,
      context: `${conflict.first.loja} e ${conflict.second.loja}`,
      demandCode: conflict.first.codigo,
      sortTime: rangeOf(conflict.first).start,
    }));

    dayDemands.forEach((demand) => {
      const stats = statsOf(demand);
      stats.allocations.forEach((allocation) => {
        if (allocation.status === "falta" && !allocation.reposicao) {
          items.push({
            id: `absence-${demand.id}-${allocation.id}`,
            tone: "critical",
            icon: UserRoundX,
            title: "Falta sem reposição",
            description: `${workerName(allocation)} precisa ser substituído.`,
            context: `${demand.loja} · ${demand.setor} · ${demand.horario}`,
            demandCode: demand.codigo,
            sortTime: rangeOf(demand).start,
          });
        }
      });
      if (stats.open) {
        items.push({
          id: `open-${demand.id}`,
          tone: "high",
          icon: Users,
          title: stats.open === 1 ? "Vaga aberta" : `${stats.open} vagas abertas`,
          description: "A demanda ainda não possui todos os diaristas alocados.",
          context: `${demand.loja} · ${demand.setor} · ${demand.horario}`,
          demandCode: demand.codigo,
          sortTime: rangeOf(demand).start,
        });
      }
      const pending = stats.allocations.filter((allocation) => allocation.status === "pendente").length;
      if (pending) {
        items.push({
          id: `pending-${demand.id}`,
          tone: "medium",
          icon: UserCheck,
          title: "Presença não registrada",
          description: `${pending} diarista(s) ainda aguardando marcação.`,
          context: `${demand.loja} · ${demand.setor} · ${demand.horario}`,
          demandCode: demand.codigo,
          sortTime: rangeOf(demand).start,
        });
      }
      const store = stores.find((item) => lookup(item.nome) === lookup(demand.loja) || lookup(item.nome).includes(lookup(demand.loja)));
      const missing = [!store?.endereco?.trim() && "endereço", !store?.responsavel?.trim() && "responsável"].filter(Boolean);
      if (missing.length) {
        items.push({
          id: `store-${demand.id}`,
          tone: "info",
          icon: Store,
          title: "Cadastro da loja incompleto",
          description: `Falta informar ${missing.join(" e ")}.`,
          context: demand.loja,
          demandCode: demand.codigo,
          sortTime: rangeOf(demand).start,
        });
      }
    });
    if (sync.pending) {
      items.push({
        id: "sync-pending",
        tone: "info",
        icon: CloudUpload,
        title: "Envios aguardando sincronização",
        description: `${sync.pending} alteração(ões) ainda não chegaram à nuvem.`,
        context: sync.online ? "Nova tentativa automática em andamento." : "Dispositivo sem internet.",
        sortTime: Number.MAX_SAFE_INTEGER,
      });
    }
    const weight = { critical: 0, high: 1, medium: 2, info: 3 };
    return items.sort((a, b) => weight[a.tone] - weight[b.tone] || a.sortTime - b.sortTime);
  }, [conflicts, dayDemands, stores, sync.online, sync.pending]);

  const coverage = useMemo(() => {
    const groups = new Map<string, Demanda[]>();
    dayDemands.forEach((demand) => {
      const key = `${demand.loja}::${demand.setor}`;
      groups.set(key, [...(groups.get(key) || []), demand]);
    });
    return Array.from(groups.entries()).map(([key, group]) => {
      const [store, sector] = key.split("::");
      const percentage = (matching: Demanda[]) => {
        const total = matching.reduce((acc, demand) => {
          const stats = statsOf(demand);
          return { slots: acc.slots + stats.slots, allocated: acc.allocated + stats.allocated };
        }, { slots: 0, allocated: 0 });
        return total.slots ? Math.round((total.allocated / total.slots) * 100) : null;
      };
      const cells = periods.map((period) => percentage(group.filter((demand) => {
        const range = rangeOf(demand);
        return range.start < period.end && period.start < range.end;
      })));
      return { key, store, sector, cells, total: percentage(group) || 0 };
    }).sort((a, b) => a.store.localeCompare(b.store, "pt-BR") || a.sector.localeCompare(b.sector, "pt-BR"));
  }, [dayDemands]);

  const actionNames: Record<string, string> = { INSERT: "Registro criado", UPDATE: "Registro atualizado", DELETE: "Registro excluído" };
  const tableNames: Record<string, string> = { demandas: "Demanda", diaristas: "Diarista", registros_financeiros: "Financeiro", lojas: "Loja", profiles: "Supervisor" };

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 pb-2">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary"><LayoutDashboard size={19} /></div>
            <h1 className="page-heading text-foreground">Central de Operação</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Prioridades, cobertura e atividade em tempo real.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative block">
            <span className="sr-only">Dia da operação</span>
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="h-10 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm text-foreground shadow-2xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 sm:w-[168px]" />
          </label>
          <Button asChild variant="outline" className="h-10 gap-2"><Link to="/demandas?nova=1"><Plus size={16} /> Nova demanda</Link></Button>
          <Button className="h-10 gap-2" disabled={!priorities.length} onClick={() => prioritiesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}><Zap size={16} /> Resolver prioridades</Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="capitalize">{formatDate(selectedDate)}</span>
        <span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${sync.online ? "bg-success" : "bg-destructive"}`} />{sync.online ? "Dados sincronizados" : "Trabalhando offline"}</span>
        {selectedDate !== localISODate() && <button onClick={() => setSelectedDate(localISODate())} className="font-medium text-primary hover:underline">Voltar para hoje</button>}
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" aria-label="Resumo do dia">
        <MetricCard icon={Users} label="Cobertura" value={`${metrics.coverage}%`} helper={`${metrics.allocated} de ${metrics.slots} vagas preenchidas`} tone={!metrics.slots ? "primary" : metrics.coverage >= 90 ? "success" : metrics.coverage >= 70 ? "warning" : "destructive"} />
        <MetricCard icon={CheckCircle2} label="Presentes" value={String(metrics.present)} helper={`${metrics.allocated} diarista(s) alocado(s)`} tone="success" />
        <MetricCard icon={UserRoundX} label="Faltas" value={String(metrics.absent)} helper={metrics.absent ? "Precisam de acompanhamento" : "Nenhuma falta registrada"} tone="destructive" />
        <MetricCard icon={CircleDollarSign} label="Lucro confirmado" value={formatCurrency(metrics.profit)} helper="Presenças × margem de cada rede" tone="warning" />
        <MetricCard icon={CloudUpload} label="Envios pendentes" value={String(sync.pending)} helper={sync.pending ? "Aguardando sincronização" : "Tudo enviado para a nuvem"} tone="secondary" />
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.15fr)_300px]">
        <section ref={prioritiesRef} className="surface-panel scroll-mt-24 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
            <div><h2 className="font-semibold text-card-foreground">Prioridades</h2><p className="text-xs text-muted-foreground">Ordenadas por urgência e horário</p></div>
            <span className="rounded-md bg-destructive/10 px-2 py-1 text-xs font-bold text-destructive">{priorities.length}</span>
          </div>
          {!priorities.length ? (
            <div className="grid min-h-[280px] place-items-center px-5 py-10 text-center"><div><CheckCircle2 className="mx-auto text-success" size={30} /><p className="mt-3 font-medium text-card-foreground">Operação sem pendências</p><p className="mt-1 text-sm text-muted-foreground">Nenhuma ação urgente para este dia.</p></div></div>
          ) : (
            <div className="divide-y divide-border/60">{priorities.slice(0, 10).map((priority) => {
              const Icon = priority.icon;
              const iconColor = priority.tone === "critical" ? "bg-destructive/10 text-destructive" : priority.tone === "high" ? "bg-warning/10 text-warning" : priority.tone === "medium" ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary";
              return <Link key={priority.id} to={priority.demandCode ? `/demandas?busca=${encodeURIComponent(priority.demandCode)}` : "/demandas"} className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">
                <div className={`grid h-9 w-9 place-items-center rounded-lg ${iconColor}`}><Icon size={17} /></div>
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-card-foreground">{priority.title}</p><PriorityBadge tone={priority.tone} /></div><p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{priority.description}</p><p className="mt-1 truncate text-[11px] text-muted-foreground/80">{priority.context}</p></div>
                <ArrowRight size={16} className="text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>;
            })}</div>
          )}
        </section>

        <section className="surface-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/70 px-4 py-3"><div><h2 className="font-semibold text-card-foreground">Cobertura por loja e período</h2><p className="text-xs text-muted-foreground">Vagas preenchidas em cada faixa de horário</p></div><Store size={18} className="text-primary" /></div>
          {!coverage.length ? (
            <div className="grid min-h-[280px] place-items-center px-5 py-10 text-center"><div><CalendarDays className="mx-auto text-muted-foreground" size={28} /><p className="mt-3 font-medium text-card-foreground">Sem demandas neste dia</p><p className="mt-1 text-sm text-muted-foreground">Escolha outra data ou crie uma nova demanda.</p></div></div>
          ) : (
            <>
              <div className="divide-y divide-border/55 sm:hidden">
                {coverage.map((row) => (
                  <div key={row.key} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-card-foreground">{row.store}</p>
                        <p className="truncate text-xs text-muted-foreground">{row.sector}</p>
                      </div>
                      <span className={`text-sm font-bold ${row.total >= 100 ? "text-success" : row.total >= 60 ? "text-warning" : "text-destructive"}`}>
                        {row.total}%
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-1.5">
                      {row.cells.map((value, index) => (
                        <div key={`${row.key}-mobile-${index}`} className="rounded-md bg-muted/35 px-1 py-2 text-center">
                          <p className="text-[9px] font-semibold text-muted-foreground">{periods[index].label}</p>
                          <p className={`mt-1 text-xs font-bold ${value === null ? "text-muted-foreground/45" : value >= 100 ? "text-success" : value >= 60 ? "text-warning" : "text-destructive"}`}>
                            {value === null ? "—" : `${value}%`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full min-w-[620px] text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-[10px] uppercase text-muted-foreground">
                      <th className="px-4 py-3 text-left font-semibold">Loja / Setor</th>
                      {periods.map((period) => <th key={period.label} className="px-2 py-3 text-center font-semibold">{period.label}</th>)}
                      <th className="px-4 py-3 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/55">
                    {coverage.map((row) => (
                      <tr key={row.key} className="hover:bg-muted/25">
                        <td className="px-4 py-3"><p className="max-w-[190px] truncate font-medium text-card-foreground">{row.store}</p><p className="max-w-[190px] truncate text-xs text-muted-foreground">{row.sector}</p></td>
                        {row.cells.map((value, index) => <td key={`${row.key}-${index}`} className="px-2 py-3 text-center">{value === null ? <span className="text-muted-foreground/45">—</span> : <span className={`inline-grid h-7 min-w-9 place-items-center rounded-md px-1 text-[11px] font-bold ${value >= 100 ? "bg-success/10 text-success" : value >= 60 ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"}`}>{value}%</span>}</td>)}
                        <td className={`px-4 py-3 text-right font-bold ${row.total >= 100 ? "text-success" : row.total >= 60 ? "text-warning" : "text-destructive"}`}>{row.total}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        <aside className="surface-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/70 px-4 py-3"><div><h2 className="font-semibold text-card-foreground">Atividade recente</h2><p className="text-xs text-muted-foreground">Histórico da equipe</p></div><History size={17} className="text-primary" /></div>
          {!activities.length ? <div className="px-4 py-10 text-center text-sm text-muted-foreground">Nenhuma atividade disponível.</div> : <div className="divide-y divide-border/55">{activities.map((activity) => <div key={activity.id} className="px-4 py-3"><div className="flex items-start gap-2.5"><div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><RefreshCw size={13} /></div><div className="min-w-0"><p className="text-xs font-semibold text-card-foreground">{actionNames[activity.action.toUpperCase()] || activity.action}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{tableNames[activity.table_name] || activity.table_name.replace(/_/g, " ")}</p><p className="mt-1 truncate text-[10px] text-muted-foreground/75" title={activity.actor_email}>{activity.actor_email || "Sistema"} · {relativeTime(activity.created_at)}</p></div></div></div>)}</div>}
        </aside>
      </div>

      <footer className="flex flex-col gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span className="inline-flex items-center gap-2"><Clock3 size={13} /> Atualização automática com os dados da sua conta.</span><Button asChild variant="ghost" size="sm" className="h-8 justify-start gap-2 px-2 text-xs sm:justify-center"><Link to="/demandas">Abrir todas as demandas <ArrowRight size={13} /></Link></Button></footer>
    </div>
  );
}
