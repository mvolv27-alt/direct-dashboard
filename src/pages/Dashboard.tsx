import { getDemandas, getDiaristas, getRegistros } from "@/lib/storage";
import { useLiveData } from "@/lib/sync";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  Store,
  TrendingUp,
  Users,
} from "lucide-react";
import { useMemo } from "react";

function formatMoney(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function formatDateBR(value: string) {
  if (!value) return "-";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

export default function Dashboard() {
  const diaristas = useLiveData(getDiaristas, ["diaristas"]);
  const registros = useLiveData(getRegistros, ["registros_financeiros"]);
  const demandas = useLiveData(getDemandas, ["demandas"]);

  const stats = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    const valorRegistro = (r: (typeof registros)[number]) =>
      (r.valorDiaria || 0) +
      (r.passagem || 0) +
      (r.adiantamento || 0) +
      (r.custosAdicionais || 0);
    const demandasAtivas = demandas.filter((d) => d.status !== "falta");
    const demandasHoje = demandasAtivas.filter((d) => d.data === hoje);
    const demandasPendentes = demandas.filter(
      (d) => d.status === "pendente" || d.status === "em_andamento"
    );
    const demandasPresentes = demandas.filter((d) => d.status === "concluida");
    const lojas = new Set([
      ...registros.map((r) => r.loja).filter(Boolean),
      ...demandas.map((d) => d.loja).filter(Boolean),
    ]).size;

    return {
      lojas,
      demandasHoje: demandasHoje.length,
      pendentes: demandasPendentes.length,
      presentes: demandasPresentes.length,
      valorPrevisto: demandasAtivas.reduce((sum, d) => sum + (d.valor || 0), 0),
      totalPago: registros.filter((r) => r.pago).reduce((sum, r) => sum + valorRegistro(r), 0),
      totalAPagar: registros.filter((r) => !r.pago).reduce((sum, r) => sum + valorRegistro(r), 0),
    };
  }, [demandas, registros]);

  const proximasDemandas = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    return demandas
      .filter((d) => d.status !== "falta" && d.data >= hoje)
      .sort((a, b) => `${a.data}${a.horario}`.localeCompare(`${b.data}${b.horario}`))
      .slice(0, 5);
  }, [demandas]);

  const cards = [
    {
      label: "Diaristas",
      value: diaristas.length,
      icon: Users,
      accent: "bg-primary/10 text-primary",
    },
    {
      label: "Demandas hoje",
      value: stats.demandasHoje,
      icon: CalendarDays,
      accent: "bg-secondary/10 text-secondary",
    },
    {
      label: "Pendentes",
      value: stats.pendentes,
      icon: ClipboardList,
      accent: "bg-warning/10 text-warning",
    },
    {
      label: "Lojas Atendidas",
      value: stats.lojas,
      icon: Store,
      accent: "bg-accent text-accent-foreground",
    },
    {
      label: "Total pago",
      value: formatMoney(stats.totalPago),
      icon: DollarSign,
      accent: "bg-success/10 text-success",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Painel Geral</h1>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="glass border-soft rounded-xl hover-lift p-5 flex items-center gap-4"
          >
            <div className={`p-3 rounded-lg ${c.accent}`}>
              <c.icon size={22} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-xl font-bold text-card-foreground mt-0.5">{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-4">
        <div className="glass border-soft rounded-xl hover-lift p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-card-foreground">Resumo operacional</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Acompanhe o previsto, o confirmado e o que ainda precisa de atenção.
              </p>
            </div>
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-3 mt-5">
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
              <p className="text-[11px] uppercase font-medium text-primary">Previsto</p>
              <p className="text-lg font-bold text-card-foreground mt-1">
                {formatMoney(stats.valorPrevisto)}
              </p>
            </div>
            <div className="rounded-lg bg-success/5 border border-success/20 p-3">
              <p className="text-[11px] uppercase font-medium text-success">Presenças</p>
              <p className="text-lg font-bold text-card-foreground mt-1">{stats.presentes}</p>
            </div>
            <div className="rounded-lg bg-warning/5 border border-warning/20 p-3">
              <p className="text-[11px] uppercase font-medium text-warning">A pagar</p>
              <p className="text-lg font-bold text-card-foreground mt-1">
                {formatMoney(stats.totalAPagar)}
              </p>
            </div>
          </div>
        </div>

        <div className="glass border-soft rounded-xl hover-lift p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="font-semibold text-card-foreground">Próximas diárias</h3>
            <CalendarDays size={18} className="text-primary" />
          </div>
          {proximasDemandas.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma demanda futura cadastrada.
            </div>
          ) : (
            <div className="space-y-2">
              {proximasDemandas.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-muted/35 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-card-foreground truncate">{d.loja}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {d.setor} - {d.diaristaNome || "Sem diarista"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-card-foreground">{d.horario}</p>
                    <p className="text-xs text-muted-foreground">{formatDateBR(d.data)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="glass border-soft rounded-xl hover-lift">
        <div className="p-5 border-b border-border">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-card-foreground">Últimos registros financeiros</h3>
            {stats.pendentes > 0 ? (
              <span className="inline-flex items-center gap-1 text-xs text-warning">
                <AlertTriangle size={13} /> {stats.pendentes} pendente(s)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-success">
                <CheckCircle2 size={13} /> Sem pendências
              </span>
            )}
          </div>
        </div>
        {registros.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Nenhum registro ainda. Vá ao <span className="font-medium text-primary">Financeiro</span> para adicionar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left p-3 font-medium">Diarista</th>
                  <th className="text-left p-3 font-medium">Loja</th>
                  <th className="text-left p-3 font-medium hidden sm:table-cell">Data</th>
                  <th className="text-right p-3 font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {registros.slice(-5).reverse().map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="p-3 text-card-foreground font-medium">{r.diaristaNome}</td>
                    <td className="p-3 text-card-foreground">{r.loja}</td>
                    <td className="p-3 text-muted-foreground hidden sm:table-cell">{r.data}</td>
                    <td className="p-3 text-right font-medium text-card-foreground">
                      R$ {r.valorDiaria.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
