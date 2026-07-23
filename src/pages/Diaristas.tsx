import { useState, useMemo, useEffect } from "react";
import { getDemandas, getDiaristas, saveDiarista, deleteDiarista, updateDiarista, getSetoresCustom, saveSetorCustom, getRegistros } from "@/lib/storage";
import { useLiveData } from "@/lib/sync";
import { SkeletonCard } from "@/components/ui/skeleton";
import { Demanda, Diarista, calcularAvaliacao } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search, Star, FileText, Phone, MapPin, Briefcase, Calendar, MessageCircle, History } from "lucide-react";
import { toast } from "sonner";
import {
  formatarCEP as formatCEP,
  formatarCPF as formatCPF,
  formatarTelefone as formatPhone,
} from "@/lib/diaristaAgent";

function generateId() {
  return crypto.randomUUID();
}

function starsFromValue(v: number, size = 14) {
  return Array.from({ length: 5 }, (_, i) => (
    <Star
      key={i}
      size={size}
      className={i < v ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}
    />
  ));
}

function formatDateBR(dateStr: string) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR");
}

function formatMoney(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function whatsappUrl(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  const normalized = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${normalized}`;
}

function getAlocacoesDemanda(d: Demanda) {
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
          d.status === "concluida"
            ? ("presente" as const)
            : d.status === "falta"
              ? ("falta" as const)
              : ("pendente" as const),
      },
    ];
  }
  return [];
}

function getStatsDiarista(demandas: Demanda[], diaristaId: string) {
  return demandas.reduce(
    (acc, demanda) => {
      for (const alocacao of getAlocacoesDemanda(demanda)) {
        if (alocacao.reposicao?.diaristaId === diaristaId) acc.presencas += 1;
        if (alocacao.diaristaId !== diaristaId) continue;
        if (alocacao.status === "presente") acc.presencas += 1;
        if (alocacao.status === "falta") acc.faltas += 1;
      }
      return acc;
    },
    { presencas: 0, faltas: 0 },
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

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

type FormState = {
  nome: string;
  cpf: string;
  telefone: string;
  estado: string;
  cidade: string;
  bairro: string;
  endereco: string;
  cep: string;
  setorExperiencia: string[];
};

const emptyForm: FormState = {
  nome: "",
  cpf: "",
  telefone: "",
  estado: "",
  cidade: "",
  bairro: "",
  endereco: "",
  cep: "",
  setorExperiencia: [],
};

type HistoricoItem = {
  id: string;
  data: string;
  horario: string;
  loja: string;
  setor: string;
  valor: number;
  origem: "Demanda" | "Financeiro";
  status: "presente" | "faltou" | "financeiro";
};

export default function DiaristaPage() {
  const diaristas = useLiveData(getDiaristas, ["diaristas"]);
  const customSetores = useLiveData(getSetoresCustom, ["setores_custom"]);
  const registros = useLiveData(getRegistros, ["registros_financeiros"]);
  const demandas = useLiveData(getDemandas, ["demandas"]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [novoSetor, setNovoSetor] = useState("");
  const [historyFor, setHistoryFor] = useState<Diarista | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Diarista | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 280);
    return () => clearTimeout(t);
  }, []);

  // re-trigger short skeleton on search to give feedback
  useEffect(() => {
    if (!search) return;
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 180);
    return () => clearTimeout(t);
  }, [search]);

  const todosSetores = useMemo(() => [...SETORES_PADRAO, ...customSetores], [customSetores]);

  const filtered = diaristas.filter(
    (d) =>
      d.nome.toLowerCase().includes(search.toLowerCase()) ||
      d.cpf.includes(search) ||
      d.bairro.toLowerCase().includes(search.toLowerCase()) ||
      (d.cidade || "").toLowerCase().includes(search.toLowerCase()) ||
      (d.estado || "").toLowerCase().includes(search.toLowerCase()) ||
      (d.endereco || "").toLowerCase().includes(search.toLowerCase()) ||
      (d.cep || "").includes(search) ||
      d.setorExperiencia.some((s) => s.toLowerCase().includes(search.toLowerCase()))
  );

  function toggleSetor(setor: string) {
    const existe = form.setorExperiencia.includes(setor);
    const novo = existe
      ? form.setorExperiencia.filter((s) => s !== setor)
      : [...form.setorExperiencia, setor];
    setForm({ ...form, setorExperiencia: novo });
  }

  function handleSave() {
    if (!form.nome || !form.cpf) {
      toast.error("Nome e CPF são obrigatórios");
      return;
    }
    if (form.cpf.replace(/\D/g, "").length !== 11) {
      toast.error("Informe um CPF com 11 números");
      return;
    }
    const cpfDuplicado = diaristas.some(
      (item) =>
        item.id !== editingId &&
        item.cpf.replace(/\D/g, "") === form.cpf.replace(/\D/g, ""),
    );
    if (cpfDuplicado) {
      toast.error("Já existe um diarista cadastrado com este CPF");
      return;
    }

    if (editingId) {
      const existing = diaristas.find((d) => d.id === editingId);
      const updated: Diarista = {
        ...form,
        id: editingId,
        presencas: existing?.presencas ?? 0,
        faltas: existing?.faltas ?? 0,
        createdAt: existing?.createdAt ?? "",
      };
      updateDiarista(updated);
      toast.success("Diarista atualizado");
    } else {
      const novo: Diarista = {
        ...form,
        id: generateId(),
        presencas: 0,
        faltas: 0,
        createdAt: new Date().toISOString(),
      };
      saveDiarista(novo);
      toast.success("Diarista cadastrado");
    }

    setForm(emptyForm);
    setEditingId(null);
    setOpen(false);
  }

  function handleEdit(d: Diarista) {
    setForm({
      nome: d.nome,
      cpf: d.cpf,
      telefone: d.telefone,
      estado: d.estado || "",
      cidade: d.cidade || "",
      bairro: d.bairro,
      endereco: d.endereco || "",
      cep: d.cep || "",
      setorExperiencia: d.setorExperiencia,
    });
    setEditingId(d.id);
    setOpen(true);
  }

  function handleDelete(d: Diarista) {
    deleteDiarista(d.id);
    setDeleteTarget(null);
    toast.success("Diarista removido");
  }

  function getHistorico(diaristaId: string): HistoricoItem[] {
    const feitasPorDemandas = demandas.flatMap((d) =>
      getAlocacoesDemanda(d).flatMap((alocacao) => {
        const items: HistoricoItem[] = [];
        if (
          alocacao.diaristaId === diaristaId &&
          (alocacao.status === "presente" || alocacao.status === "falta")
        ) {
          items.push({
            id: `demanda-${d.id}-${alocacao.id}`,
            data: d.data,
            horario: d.horario,
            loja: d.loja,
            setor: d.setor,
            valor: d.valor || 0,
            origem: "Demanda" as const,
            status: alocacao.status === "falta" ? ("faltou" as const) : ("presente" as const),
          });
        }
        if (alocacao.reposicao?.diaristaId === diaristaId) {
          items.push({
            id: `reposicao-${d.id}-${alocacao.id}`,
            data: d.data,
            horario: d.horario,
            loja: d.loja,
            setor: d.setor,
            valor: d.valor || 0,
            origem: "Demanda" as const,
            status: "presente" as const,
          });
        }
        return items;
      }),
    );
    const feitasPorRegistros = registros
      .filter((r) => r.diaristaId === diaristaId)
      .map((r) => ({
        id: `registro-${r.id}`,
        data: r.data,
        horario: r.horarioEntrada,
        loja: r.loja,
        setor: r.setor,
        valor:
          (r.valorDiaria || 0) +
          (r.passagem || 0) +
          (r.adiantamento || 0) +
          (r.custosAdicionais || 0),
        origem: "Financeiro" as const,
        status: "financeiro" as const,
      }));
    return [...feitasPorDemandas, ...feitasPorRegistros].sort((a, b) =>
      `${b.data}${b.horario}`.localeCompare(`${a.data}${a.horario}`)
    );
  }

  const diariasMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of diaristas) {
      const stats = getStatsDiarista(demandas, d.id);
      const registrosDoDiarista = registros.filter((r) => r.diaristaId === d.id).length;
      map.set(d.id, stats.presencas + stats.faltas + registrosDoDiarista);
    }
    return map;
  }, [diaristas, demandas, registros]);

  const historyItems = historyFor ? getHistorico(historyFor.id) : [];

  return (
    <div className="space-y-6 min-w-0 overflow-x-hidden">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-foreground">Diaristas</h1>
          <p className="text-sm text-muted-foreground">
            {diaristas.length} cadastrado(s)
          </p>
        </div>

        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(emptyForm); setEditingId(null); } }}>
          <DialogTrigger asChild>
            <Button className="w-full justify-center gap-2 sm:w-auto">
              <Plus size={16} />
              Novo Diarista
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl p-4 sm:p-5 text-sm">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar" : "Cadastrar"} Diarista</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-1.5">
                <Label>Nome Completo *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Nome do diarista"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>CPF *</Label>
                  <Input
                    value={form.cpf}
                    onChange={(e) => setForm({ ...form, cpf: formatCPF(e.target.value) })}
                    placeholder="000.000.000-00"
                    maxLength={14}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Telefone</Label>
                  <Input
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: formatPhone(e.target.value) })}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Estado</Label>
                  <Input
                    value={form.estado}
                    onChange={(e) => setForm({ ...form, estado: e.target.value })}
                    placeholder="Ex.: Ceará"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Cidade</Label>
                  <Input
                    value={form.cidade}
                    onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                    placeholder="Ex.: Fortaleza"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Bairro</Label>
                  <Input
                    value={form.bairro}
                    onChange={(e) => setForm({ ...form, bairro: e.target.value })}
                    placeholder="Bairro onde mora"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>CEP</Label>
                  <Input
                    value={form.cep}
                    onChange={(e) => setForm({ ...form, cep: formatCEP(e.target.value) })}
                    placeholder="00000-000"
                    maxLength={9}
                    inputMode="numeric"
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Rua/Nº</Label>
                <Input
                  value={form.endereco}
                  onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                  placeholder="Rua, número e complemento"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Setores que tem experiência</Label>
                <div className="grid grid-cols-2 gap-2 border rounded-lg p-3 bg-muted/20">
                  {todosSetores.map((setor) => (
                    <label
                      key={setor}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={form.setorExperiencia.includes(setor)}
                        onCheckedChange={() => toggleSetor(setor)}
                      />
                      <span className="text-sm">{setor}</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2 items-center">
                  <Input
                    value={novoSetor}
                    onChange={(e) => setNovoSetor(e.target.value)}
                    placeholder="Novo setor..."
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const trimmed = novoSetor.trim();
                        if (!trimmed) return;
                        if (todosSetores.includes(trimmed)) {
                          toast.error("Setor já existe");
                          return;
                        }
                        saveSetorCustom(trimmed);
                        setNovoSetor("");
                        toast.success("Setor adicionado");
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const trimmed = novoSetor.trim();
                      if (!trimmed) return;
                      if (todosSetores.includes(trimmed)) {
                        toast.error("Setor já existe");
                        return;
                      }
                      saveSetorCustom(trimmed);
                      setNovoSetor("");
                      toast.success("Setor adicionado");
                    }}
                  >
                    <Plus size={16} />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                A avaliação - calculada automaticamente com base em presenças e faltas após o cadastro.
              </p>
              <Button onClick={handleSave} className="w-full mt-2">
                {editingId ? "Salvar Alterações" : "Cadastrar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative w-full max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nome, CPF, localização ou setor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass border-soft rounded-xl hover-lift p-8 text-center text-muted-foreground text-sm animate-fade-in">
          Nenhum diarista encontrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {filtered.map((d) => {
            const { presencas, faltas } = getStatsDiarista(demandas, d.id);
            const nota = calcularAvaliacao(presencas, faltas);
            const total = presencas + faltas;
            const diariasCount = diariasMap.get(d.id) || 0;
            const setores = d.setorExperiencia.length > 0 ? d.setorExperiencia : ["Sem setor"];
            const whatsapp = whatsappUrl(d.telefone);
            return (
              <div
                key={d.id}
                className="rounded-xl border border-border/60 bg-card/75 shadow-[0_14px_34px_-26px_hsl(var(--foreground)/0.45)] backdrop-blur overflow-hidden animate-in-up transition-colors hover:border-primary/35"
                style={{ animationDelay: `${Math.min(50, 0)}ms` }}
              >
                <div className="p-4 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold shrink-0">
                      {getInitials(d.nome)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-card-foreground truncate">{d.nome}</h3>
                      <p className="text-xs text-primary font-medium truncate">
                        {diariasCount} diária{diariasCount !== 1 ? "s" : ""} feita{diariasCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {total > 0 ? (
                        <div>
                          <div className="flex justify-end">{starsFromValue(nota, 12)}</div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {presencas} presença{presencas !== 1 ? "s" : ""} - {faltas} falta{faltas !== 1 ? "s" : ""}
                          </p>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">Sem avaliação</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-muted/20 p-3 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0 text-muted-foreground">
                      <Phone size={13} className="text-primary shrink-0" />
                      <span className="truncate">{d.telefone || "Sem telefone"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0 text-muted-foreground">
                      <MapPin size={13} className="text-primary shrink-0" />
                      <span className="truncate" title={[d.bairro, d.cidade, d.estado].filter(Boolean).join(" - ")}>
                        {[d.bairro, d.cidade && `${d.cidade}${d.estado ? `/${d.estado}` : ""}`].filter(Boolean).join(" - ") || "Sem localização"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0 text-muted-foreground">
                      <FileText size={13} className="text-primary shrink-0" />
                      <span className="truncate font-mono">{d.cpf || "Sem CPF"}</span>
                    </div>
                    <div className="col-span-2 flex items-start gap-1.5 min-w-0 text-muted-foreground">
                      <Briefcase size={13} className="text-primary shrink-0" />
                      <span className="leading-snug break-words" title={setores.join(", ")}>
                        {setores.join(", ")}
                      </span>
                    </div>
                    {(d.endereco || d.cep) && (
                      <div className="col-span-2 flex items-start gap-1.5 min-w-0 text-muted-foreground">
                        <MapPin size={13} className="text-primary shrink-0" />
                        <span className="truncate" title={[d.endereco, d.cep].filter(Boolean).join(" - ")}>
                          {[d.endereco, d.cep].filter(Boolean).join(" - ")}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-3">
                    <button
                      onClick={() => setHistoryFor(d)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                    >
                      <History size={14} />
                      Histórico
                    </button>
                    <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleEdit(d)}
                      title="Editar"
                      className="h-9 w-9 inline-flex items-center justify-center rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(d)}
                      title="Remover"
                      className="h-9 w-9 inline-flex items-center justify-center rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                    <a
                      href={whatsapp || undefined}
                      target="_blank"
                      rel="noreferrer"
                      aria-disabled={!whatsapp}
                      title={whatsapp ? "Chamar no WhatsApp" : "Telefone não cadastrado"}
                      className={`h-9 w-9 inline-flex items-center justify-center rounded-lg transition-colors ${
                        whatsapp
                          ? "bg-success/10 text-success hover:bg-success/20"
                          : "bg-muted text-muted-foreground/50 pointer-events-none"
                      }`}
                    >
                      <MessageCircle size={15} />
                    </a>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!historyFor} onOpenChange={(v) => !v && setHistoryFor(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl p-4 sm:p-5 text-sm">
          <DialogHeader>
            <DialogTitle>Histórico de diárias</DialogTitle>
          </DialogHeader>
          {historyFor && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl bg-muted/35 p-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                  {getInitials(historyFor.nome)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-card-foreground truncate">{historyFor.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {historyItems.length} diária{historyItems.length !== 1 ? "s" : ""} encontrada{historyItems.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {historyItems.length === 0 ? (
                <div className="rounded-xl border border-border/60 p-6 text-center text-sm text-muted-foreground">
                  Nenhuma diária concluída ou registro financeiro encontrado para este diarista.
                </div>
              ) : (
                <div className="space-y-2">
                  {historyItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/50 p-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          <Calendar size={15} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-card-foreground truncate">{item.loja || "Sem loja"}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {formatDateBR(item.data)} {item.horario ? `- ${item.horario}` : ""} - {item.setor || "Sem setor"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-card-foreground">{formatMoney(item.valor)}</p>
                        {item.status !== "financeiro" && (
                          <span
                            className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              item.status === "presente"
                                ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300"
                                : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
                            }`}
                          >
                            {item.status === "presente" ? "Presente" : "Faltou"}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover diarista?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Tem certeza que deseja remover ${deleteTarget.nome}? Essa ação não pode ser desfeita.`
                : "Tem certeza que deseja remover este diarista?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
