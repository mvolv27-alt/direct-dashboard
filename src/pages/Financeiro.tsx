import { useState, useEffect, useMemo, type ElementType } from "react";
import { getDiaristas, getRegistros, saveRegistro, updateRegistro, deleteRegistro, getDemandas } from "@/lib/storage";
import { useLiveData } from "@/lib/sync";
import { useRedeValores } from "@/hooks/useConfig";
import { SkeletonStat, SkeletonRow } from "@/components/ui/skeleton";
import { Demanda, RegistroFinanceiro } from "@/types";
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
import { Plus, Pencil, Trash2, Search, DollarSign, TrendingUp, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function generateId() {
  return crypto.randomUUID();
}

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

const registroTotal = (r: RegistroFinanceiro) =>
  (r.valorDiaria || 0) +
  (r.passagem || 0) +
  (r.adiantamento || 0) +
  (r.custosAdicionais || 0);

function getVagaStats(d: Demanda) {
  const vagas = Math.max(1, d.tarefasTotal || d.alocacoes?.length || 1);
  const alocacoes = Array.isArray(d.alocacoes) ? d.alocacoes : [];
  let presentes = alocacoes.filter((a) => a.status === "presente" || a.reposicao).length;
  let faltas = alocacoes.filter((a) => a.status === "falta" && !a.reposicao).length;

  if (alocacoes.length === 0) {
    presentes = d.status === "concluida" ? vagas : 0;
    faltas = d.status === "falta" ? vagas : 0;
  }

  const marcadas = Math.min(vagas, presentes + faltas);
  return {
    vagas,
    presentes,
    faltas,
    aguardando: Math.max(0, vagas - marcadas),
    ativas: Math.max(0, vagas - faltas),
  };
}

function KpiCard({
  title,
  value,
  icon: Icon,
  tone = "text-primary",
  border = "",
}: {
  title: string;
  value: number;
  icon?: ElementType;
  tone?: string;
  border?: string;
}) {
  return (
    <div
      className={`glass border-soft rounded-xl hover-lift min-h-[118px] p-3.5 flex flex-col justify-between overflow-hidden ${border}`}
    >
      <div className={`flex items-start gap-1.5 min-h-[34px] ${tone}`}>
        {Icon && <Icon size={15} className="mt-0.5 shrink-0" />}
        <span className="text-[9px] uppercase leading-tight font-semibold break-words">
          {title}
        </span>
      </div>
      <p className={`text-xl font-bold text-center leading-none ${tone.includes("success") || tone.includes("destructive") ? tone : "text-card-foreground"}`}>
        R$ {formatCurrency(value)}
      </p>
    </div>
  );
}

const emptyForm: Omit<RegistroFinanceiro, "id" | "createdAt"> = {
  diaristaId: "",
  diaristaNome: "",
  loja: "",
  data: "",
  horarioEntrada: "",
  horarioSaida: "",
  setor: "",
  valorDiaria: 0,
  passagem: 0,
  adiantamento: 0,
  custosAdicionais: 0,
  pago: false,
  pagoEm: null,
  observacoes: "",
};

export default function FinanceiroPage() {
  const registros = useLiveData(getRegistros, ["registros_financeiros"]);
  const demandas = useLiveData(getDemandas, ["demandas"]);
  const diaristas = useLiveData(getDiaristas, ["diaristas"]);
  const { rows: redeValores } = useRedeValores();
  const [search, setSearch] = useState("");
  const [redeFilter, setRedeFilter] = useState("todas");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!search) return;
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 180);
    return () => clearTimeout(t);
  }, [search]);

  const redes = useMemo(() => {
    return Array.from(
      new Set(
        demandas
          .map((d) => d.rede?.trim())
          .filter((rede): rede is string => Boolean(rede))
      )
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [demandas]);

  const lojaRedeMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    demandas.forEach((d) => {
      const loja = d.loja?.trim().toLowerCase();
      const rede = d.rede?.trim();
      if (!loja || !rede) return;
      const redesDaLoja = map.get(loja) ?? new Set<string>();
      redesDaLoja.add(rede);
      map.set(loja, redesDaLoja);
    });
    return map;
  }, [demandas]);

  const redeValorMap = useMemo(() => {
    return new Map(
      redeValores.map((r) => [r.rede.trim().toLowerCase(), r.valor_recebido || 0])
    );
  }, [redeValores]);

  const filteredDemandas = useMemo(() => {
    if (redeFilter === "todas") return demandas;
    return demandas.filter((d) => d.rede?.trim() === redeFilter);
  }, [demandas, redeFilter]);

  const registrosDaRede = useMemo(() => {
    return registros.filter((r) => {
      const redesDaLoja = lojaRedeMap.get(r.loja?.trim().toLowerCase());
      return redeFilter === "todas" || Boolean(redesDaLoja?.has(redeFilter));
    });
  }, [registros, lojaRedeMap, redeFilter]);

  const filtered = useMemo(() => {
    const termo = search.toLowerCase();
    return registrosDaRede.filter((r) => {
      const buscaOk =
        !termo ||
        r.diaristaNome.toLowerCase().includes(termo) ||
        r.loja.toLowerCase().includes(termo) ||
        r.setor.toLowerCase().includes(termo);
      return buscaOk;
    });
  }, [registrosDaRede, search]);

  const forecast = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    const valorRecebido = (d: (typeof filteredDemandas)[number]) =>
      redeValorMap.get(d.rede?.trim().toLowerCase()) ?? d.valor ?? 0;
    const registroDaDemanda = (d: (typeof filteredDemandas)[number]) =>
      registrosDaRede.find((r) => {
        const sameDate = r.data === d.data;
        const sameStore = r.loja.trim().toLowerCase() === d.loja.trim().toLowerCase();
        const sameWorker =
          (d.diaristaId && r.diaristaId === d.diaristaId) ||
          (d.diaristaNome &&
            r.diaristaNome.trim().toLowerCase() === d.diaristaNome.trim().toLowerCase());
        return sameDate && sameStore && Boolean(sameWorker);
      });
    const valorDiariaDiarista = (d: (typeof filteredDemandas)[number]) =>
      d.valor || registroDaDemanda(d)?.valorDiaria || 0;

    const resumo = filteredDemandas.reduce(
      (acc, d) => {
        const stats = getVagaStats(d);
        const recebido = valorRecebido(d);
        const diaria = valorDiariaDiarista(d);
        const isHoje = d.data === hoje;

        acc.confirmado += stats.presentes * recebido;
        acc.aguardando += stats.aguardando * recebido;
        acc.perdido += stats.faltas * recebido;
        acc.faturamentoPrevisto += stats.ativas * recebido;
        acc.pagamentoPrevisto += stats.presentes * diaria;
        acc.pagamentoAtivo += stats.ativas * diaria;
        acc.lucroPrevisto += stats.presentes * (recebido - diaria);
        acc.diaristasAguardando += stats.aguardando * diaria;
        acc.diaristasPerdido += stats.faltas * diaria;
        acc.countAtivas += stats.ativas;
        acc.countPresentes += stats.presentes;
        acc.countAguardando += stats.aguardando;
        acc.countFaltas += stats.faltas;

        if (isHoje) {
          acc.hoje += stats.ativas * recebido;
          acc.diaristasHoje += stats.ativas * diaria;
          acc.countHoje += stats.ativas;
        }

        return acc;
      },
      {
        confirmado: 0,
        aguardando: 0,
        perdido: 0,
        hoje: 0,
        faturamentoPrevisto: 0,
        pagamentoPrevisto: 0,
        pagamentoAtivo: 0,
        lucroPrevisto: 0,
        diaristasAguardando: 0,
        diaristasPerdido: 0,
        diaristasHoje: 0,
        countAtivas: 0,
        countPresentes: 0,
        countAguardando: 0,
        countFaltas: 0,
        countHoje: 0,
      },
    );

    const lucroMedioDiaria =
      resumo.countPresentes > 0 ? resumo.lucroPrevisto / resumo.countPresentes : 0;
    return {
      confirmado: resumo.confirmado,
      aguardando: resumo.aguardando,
      perdido: resumo.perdido,
      hoje: resumo.hoje,
      faturamentoPrevisto: resumo.faturamentoPrevisto,
      pagamentoPrevisto: resumo.pagamentoPrevisto,
      pagamentoAtivo: resumo.pagamentoAtivo,
      lucroPrevisto: resumo.lucroPrevisto,
      lucroMedioDiaria,
      diaristasConfirmado: resumo.pagamentoPrevisto,
      diaristasAguardando: resumo.diaristasAguardando,
      diaristasPerdido: resumo.diaristasPerdido,
      diaristasHoje: resumo.diaristasHoje,
      countAtivas: resumo.countAtivas,
      countPresentes: resumo.countPresentes,
      countAguardando: resumo.countAguardando,
      countFaltas: resumo.countFaltas,
      countHoje: resumo.countHoje,
    };
  }, [filteredDemandas, registrosDaRede, redeValorMap]);

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const totalDiarias = filtered.reduce((s, r) => s + (r.valorDiaria || 0), 0);
  const totalPassagens = filtered.reduce((s, r) => s + (r.passagem || 0), 0);
  const totalAdiantamentos = filtered.reduce((s, r) => s + (r.adiantamento || 0), 0);
  const totalCustos = filtered.reduce((s, r) => s + (r.custosAdicionais || 0), 0);
  const totalPagos = filtered.filter((r) => r.pago).reduce((s, r) => s + registroTotal(r), 0);
  const totalAPagar = filtered.filter((r) => !r.pago).reduce((s, r) => s + registroTotal(r), 0);
  const registrosComDiaria = filtered.filter((r) => (r.valorDiaria || 0) > 0).length;
  const mediaDiaria = registrosComDiaria > 0 ? totalDiarias / registrosComDiaria : 0;

  async function togglePago(r: RegistroFinanceiro) {
    updateRegistro({
      ...r,
      pago: !r.pago,
      pagoEm: !r.pago ? new Date().toISOString() : null,
    });
    toast.success(!r.pago ? "Marcado como pago" : "Pagamento desfeito");
  }

  function handleDiaristaSelect(id: string) {
    const d = diaristas.find((x) => x.id === id);
    if (d) {
      setForm({ ...form, diaristaId: id, diaristaNome: d.nome });
    }
  }

  function handleSave() {
    if (!form.diaristaId || !form.loja || !form.data) {
      toast.error("Diarista, loja e data são obrigatórios");
      return;
    }

    if (editingId) {
      const updated: RegistroFinanceiro = { ...form, id: editingId, createdAt: "" };
      updateRegistro(updated);
      toast.success("Registro atualizado");
    } else {
      const novo: RegistroFinanceiro = {
        ...form,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };
      saveRegistro(novo);
      toast.success("Registro adicionado");
    }

    setForm(emptyForm);
    setEditingId(null);
    setOpen(false);
  }

  function handleEdit(r: RegistroFinanceiro) {
    setForm({
      diaristaId: r.diaristaId,
      diaristaNome: r.diaristaNome,
      loja: r.loja,
      data: r.data,
      horarioEntrada: r.horarioEntrada,
      horarioSaida: r.horarioSaida,
      setor: r.setor,
      valorDiaria: r.valorDiaria,
      passagem: r.passagem ?? 0,
      adiantamento: r.adiantamento ?? 0,
      custosAdicionais: r.custosAdicionais,
      pago: r.pago ?? false,
      pagoEm: r.pagoEm ?? null,
      observacoes: r.observacoes,
    });
    setEditingId(r.id);
    setOpen(true);
  }

  function handleDelete(id: string) {
    deleteRegistro(id);
    toast.success("Registro removido");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
          <p className="text-sm text-muted-foreground">
            {registros.length} registro(s)
          </p>
        </div>

        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(emptyForm); setEditingId(null); } }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus size={16} />
              Novo Registro
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg w-full max-h-[90vh] overflow-y-auto rounded-2xl p-4 sm:p-6 text-sm">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar" : "Novo"} Registro Financeiro</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-1.5">
                <Label>Diarista *</Label>
                <Select value={form.diaristaId} onValueChange={handleDiaristaSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um diarista" />
                  </SelectTrigger>
                  <SelectContent>
                    {diaristas.length === 0 ? (
                      <SelectItem value="none" disabled>
                        Nenhum diarista cadastrado
                      </SelectItem>
                    ) : (
                      diaristas.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.nome}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>Loja *</Label>
                  <Input
                    value={form.loja}
                    onChange={(e) => setForm({ ...form, loja: e.target.value })}
                    placeholder="Nome do supermercado"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Data *</Label>
                  <Input
                    type="date"
                    value={form.data}
                    onChange={(e) => setForm({ ...form, data: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>Horário Entrada</Label>
                  <Input
                    type="time"
                    value={form.horarioEntrada}
                    onChange={(e) => setForm({ ...form, horarioEntrada: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Horário Saída</Label>
                  <Input
                    type="time"
                    value={form.horarioSaida}
                    onChange={(e) => setForm({ ...form, horarioSaida: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label>Setor</Label>
                <Input
                  value={form.setor}
                  onChange={(e) => setForm({ ...form, setor: e.target.value })}
                  placeholder="Ex: Padaria, Frios, Caixa..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>Valor da Diária (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.valorDiaria || ""}
                    onChange={(e) => setForm({ ...form, valorDiaria: parseFloat(e.target.value) || 0 })}
                    placeholder="0,00"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Passagem (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.passagem || ""}
                    onChange={(e) => setForm({ ...form, passagem: parseFloat(e.target.value) || 0 })}
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>Adiantamento (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.adiantamento || ""}
                    onChange={(e) => setForm({ ...form, adiantamento: parseFloat(e.target.value) || 0 })}
                    placeholder="0,00"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Outros custos (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.custosAdicionais || ""}
                    onChange={(e) => setForm({ ...form, custosAdicionais: parseFloat(e.target.value) || 0 })}
                    placeholder="0,00"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 select-none cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={form.pago}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      pago: e.target.checked,
                      pagoEm: e.target.checked ? new Date().toISOString() : null,
                    })
                  }
                  className="h-4 w-4 rounded accent-success"
                />
                <span>Marcar como <strong className="text-success">pago</strong></span>
                {form.pago && form.pagoEm && (
                  <span className="text-xs text-muted-foreground ml-1">
                    em {new Date(form.pagoEm).toLocaleString("pt-BR")}
                  </span>
                )}
              </label>

              <div className="grid gap-1.5">
                <Label>Observações</Label>
                <Textarea
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  placeholder="Observações adicionais..."
                  rows={3}
                />
              </div>

              <Button onClick={handleSave} className="w-full mt-2">
                {editingId ? "Salvar Alterações" : "Registrar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Faturamento previsto (em tempo real, baseado nas demandas) */}
      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Financeiro por rede</h2>
            <p className="text-xs text-muted-foreground">
              Empresa de um lado, diaristas do outro.
            </p>
          </div>
          <div className="w-full sm:w-56">
            <Select value={redeFilter} onValueChange={setRedeFilter}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Filtrar por rede" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as redes</SelectItem>
                {redes.map((rede) => (
                  <SelectItem key={rede} value={rede}>
                    {rede}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
          <section className="rounded-xl border border-border/60 bg-card/70 p-4 space-y-3 overflow-hidden">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Empresa</h3>
              <p className="text-xs text-muted-foreground">
                Valores calculados pelo recebido cadastrado em cada rede.
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 auto-rows-fr">
              <KpiCard
                title="Confirmada"
                value={forecast.confirmado}
                icon={CheckCircle2}
                tone="text-success"
              />
              <KpiCard
                title="Aguardando"
                value={forecast.aguardando}
                icon={Clock}
                tone="text-warning"
              />
              <KpiCard
                title="Perdidas"
                value={forecast.perdido}
                icon={XCircle}
                tone="text-destructive"
              />
              <KpiCard
                title="Previsão de faturamento"
                value={forecast.faturamentoPrevisto}
                tone="text-primary"
                border="border-primary/25"
              />
              <KpiCard
                title="Faturamento previsto hoje"
                value={forecast.hoje}
                tone="text-primary"
                border="border-primary/25"
              />
              <KpiCard
                title="Previsão de lucro"
                value={forecast.lucroPrevisto}
                tone={forecast.lucroPrevisto < 0 ? "text-destructive" : "text-success"}
                border="border-success/25"
              />
              <KpiCard
                title="Lucro médio por diária"
                value={forecast.lucroMedioDiaria}
                tone={forecast.lucroMedioDiaria < 0 ? "text-destructive" : "text-success"}
                border="border-success/25"
              />
            </div>
          </section>

          <section className="rounded-xl border border-border/60 bg-card/70 p-4 space-y-3 overflow-hidden">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Diaristas</h3>
              <p className="text-xs text-muted-foreground">
                Valores calculados pelo que será pago nas diárias.
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 auto-rows-fr">
              <KpiCard
                title="Confirmada"
                value={forecast.diaristasConfirmado}
                icon={CheckCircle2}
                tone="text-success"
              />
              <KpiCard
                title="Aguardando"
                value={forecast.diaristasAguardando}
                icon={Clock}
                tone="text-warning"
              />
              <KpiCard
                title="Perdidas"
                value={forecast.diaristasPerdido}
                icon={XCircle}
                tone="text-destructive"
              />
              <KpiCard
                title="Previsão de pagamento"
                value={forecast.pagamentoPrevisto}
                tone="text-warning"
                border="border-warning/25"
              />
              <KpiCard
                title="Previsão de hoje"
                value={forecast.diaristasHoje}
                tone="text-primary"
                border="border-primary/20"
              />
              <KpiCard
                title="Adiantamento passagem"
                value={totalPassagens}
                icon={DollarSign}
                tone="text-secondary"
              />
              <KpiCard
                title="Adiantamento diárias"
                value={totalAdiantamentos}
                icon={DollarSign}
                tone="text-warning"
              />
            </div>
          </section>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por diarista, loja ou setor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Lista (cards no mobile, tabela em telas maiores) */}
      <div className="glass border-soft rounded-xl hover-lift overflow-hidden">
        {loading ? (
          <div className="p-2 space-y-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} cols={5} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm animate-fade-in">
            Nenhum registro encontrado.
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-border">
              {filtered.map((r) => {
                const total = (r.valorDiaria || 0) + (r.passagem || 0) + (r.adiantamento || 0) + (r.custosAdicionais || 0);
                return (
                  <div key={r.id} className="p-4 space-y-2 animate-in-up">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-card-foreground text-base truncate">{r.diaristaNome}</p>
                        <p className="text-sm text-muted-foreground truncate">{r.loja}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-card-foreground whitespace-nowrap">
                          R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                        <Badge variant={r.pago ? "success" : "warning"} className="mt-1">
                          {r.pago ? "Pago" : "A pagar"}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {r.data && <span>{r.data}</span>}
                      {r.setor && <span>{r.setor}</span>}
                      {r.passagem > 0 && <span className="text-secondary">Passagem R$ {r.passagem.toFixed(2)}</span>}
                      {r.adiantamento > 0 && <span className="text-warning">Adiant. R$ {r.adiantamento.toFixed(2)}</span>}
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <Button
                        size="sm"
                        variant={r.pago ? "outline" : "success"}
                        onClick={() => togglePago(r)}
                      >
                        <CheckCircle2 size={14} />
                        {r.pago ? "Desfazer" : "Marcar pago"}
                      </Button>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEdit(r)}
                          className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          aria-label="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">Diarista</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Loja</th>
                    <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Data</th>
                    <th className="text-right p-3 font-medium text-muted-foreground hidden md:table-cell">Passagem</th>
                    <th className="text-right p-3 font-medium text-muted-foreground hidden md:table-cell">Adiant.</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Total</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const total = (r.valorDiaria || 0) + (r.passagem || 0) + (r.adiantamento || 0) + (r.custosAdicionais || 0);
                    return (
                      <tr key={r.id} className="border-b border-border last:border-0 hover:bg-primary/5 transition-colors">
                        <td className="p-3 font-medium text-card-foreground">{r.diaristaNome}</td>
                        <td className="p-3 text-card-foreground">{r.loja}</td>
                        <td className="p-3 text-muted-foreground hidden md:table-cell">{r.data}</td>
                        <td className="p-3 text-right text-secondary hidden md:table-cell">
                          {r.passagem > 0 ? `R$ ${r.passagem.toFixed(2)}` : "-"}
                        </td>
                        <td className="p-3 text-right text-warning hidden md:table-cell">
                          {r.adiantamento > 0 ? `R$ ${r.adiantamento.toFixed(2)}` : "-"}
                        </td>
                        <td className="p-3 text-right font-semibold text-card-foreground">
                          R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant={r.pago ? "success" : "warning"}>
                            {r.pago ? "Pago" : "A pagar"}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant={r.pago ? "outline" : "success"}
                              onClick={() => togglePago(r)}
                              title={r.pago ? "Desfazer pagamento" : "Marcar como pago"}
                            >
                              <CheckCircle2 size={14} />
                              <span className="hidden lg:inline">{r.pago ? "Desfazer" : "Pagar"}</span>
                            </Button>
                            <button
                              onClick={() => handleEdit(r)}
                              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              aria-label="Editar"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => handleDelete(r.id)}
                              className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              aria-label="Excluir"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

    </div>
  );
}
