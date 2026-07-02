import { useEffect, useMemo, useState } from "react";
import { useLiveData } from "@/lib/sync";
import { getSetoresCustom, saveSetorCustom } from "@/lib/storage";
import {
  useLojas,
  useSetorValores,
  useRedeValores,
  upsertLoja,
  deleteLoja,
  upsertSetorValor,
  deleteSetorValor,
  upsertRedeValor,
  deleteRedeValor,
  type Loja,
} from "@/hooks/useConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_COPY_TEMPLATES,
  getCopyTemplates,
  saveCopyTemplates,
  type CopyTemplates,
} from "@/lib/copyTemplates";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Store,
  Tag,
  Network,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Copy,
  X,
  FileText,
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

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie lojas, setores e valores do sistema
        </p>
      </div>

      <Tabs defaultValue="lojas" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 sm:w-auto sm:inline-flex">
          <TabsTrigger value="lojas" className="gap-1.5">
            <Store size={14} /> Lojas
          </TabsTrigger>
          <TabsTrigger value="setores" className="gap-1.5">
            <Tag size={14} /> Setores
          </TabsTrigger>
          <TabsTrigger value="redes" className="gap-1.5">
            <Network size={14} /> Redes
          </TabsTrigger>
          <TabsTrigger value="textos" className="gap-1.5">
            <FileText size={14} /> Textos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lojas"><LojasTab /></TabsContent>
        <TabsContent value="setores"><SetoresTab /></TabsContent>
        <TabsContent value="redes"><RedesTab /></TabsContent>
        <TabsContent value="textos"><TextosTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ============================ LOJAS ============================ */
function LojasTab() {
  const { rows: lojas, loading } = useLojas();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Loja | null>(null);
  const [form, setForm] = useState({
    nome: "",
    rede: "",
    endereco: "",
    bairro: "",
    cidade: "Fortaleza",
    uf: "CE",
  });

  function openNew() {
    setEditing(null);
    setForm({ nome: "", rede: "", endereco: "", bairro: "", cidade: "Fortaleza", uf: "CE" });
    setOpen(true);
  }

  function openEdit(l: Loja) {
    setEditing(l);
    setForm({
      nome: l.nome,
      rede: l.rede,
      endereco: l.endereco,
      bairro: l.bairro,
      cidade: l.cidade,
      uf: l.uf,
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.nome.trim()) {
      toast.error("Informe o nome da loja");
      return;
    }
    const payload = { ...form, ...(editing ? { id: editing.id } : {}) };
    const { error } = await upsertLoja(payload);
    if (error) {
      toast.error("Erro ao salvar loja");
      return;
    }
    toast.success(editing ? "Loja atualizada" : "Loja cadastrada");
    setOpen(false);
  }

  async function handleDelete(l: Loja) {
    if (!confirm(`Excluir "${l.nome}"?`)) return;
    const { error } = await deleteLoja(l.id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    toast.success("Loja excluída");
  }

  async function handleCopyLoja(l: Loja) {
    const endereco = [l.endereco, l.bairro, l.cidade && `${l.cidade}/${l.uf}`]
      .filter(Boolean)
      .join(" - ");
    const texto = [l.nome, endereco].filter(Boolean).join("\n");

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
      toast.success("Loja e endereço copiados");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  const grouped = useMemo(() => {
    const by: Record<string, Loja[]> = {};
    for (const l of lojas) {
      const k = l.rede || "Outras";
      (by[k] ||= []).push(l);
    }
    return Object.entries(by).sort(([a], [b]) => a.localeCompare(b));
  }, [lojas]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {lojas.length} loja(s) cadastrada(s)
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew} className="gap-1.5">
              <Plus size={14} /> Nova loja
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar loja" : "Nova loja"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2 text-sm">
              <div className="grid gap-1.5">
                <Label>Nome *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Hipermarket - Vila União"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Rede</Label>
                  <Input
                    value={form.rede}
                    onChange={(e) => setForm({ ...form, rede: e.target.value })}
                    placeholder="Ex: Hipermarket"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Bairro</Label>
                  <Input
                    value={form.bairro}
                    onChange={(e) => setForm({ ...form, bairro: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Endereço</Label>
                <Input
                  value={form.endereco}
                  onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                  placeholder="Rua, número"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-1.5 col-span-2">
                  <Label>Cidade</Label>
                  <Input
                    value={form.cidade}
                    onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>UF</Label>
                  <Input
                    maxLength={2}
                    value={form.uf}
                    onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : lojas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nenhuma loja cadastrada.
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([rede, items]) => (
            <div key={rede} className="rounded-xl border border-border/60 bg-card overflow-hidden">
              <div className="px-3 py-2 bg-muted/40 border-b border-border/60 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {rede}
                </span>
                <span className="text-[11px] text-muted-foreground">{items.length}</span>
              </div>
              <ul className="divide-y divide-border/50">
                {items.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-start gap-2 px-3 py-2.5 hover:bg-muted/30 transition-colors"
                  >
                    <Store size={14} className="text-primary mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{l.nome}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                        <MapPin size={11} className="shrink-0" />
                        {[l.endereco, l.bairro, l.cidade && `${l.cidade}/${l.uf}`]
                          .filter(Boolean)
                          .join(" - ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleCopyLoja(l)}
                        title="Copiar loja e endereço"
                        aria-label="Copiar loja e endereço"
                      >
                        <Copy size={13} />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(l)}>
                        <Pencil size={13} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(l)}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================ SETORES ============================ */
function SetoresTab() {
  const setoresExtra = useLiveData(getSetoresCustom, ["setores_custom"]);
  const { rows: valores, loading } = useSetorValores();
  const [novoSetor, setNovoSetor] = useState("");
  const setores = useMemo(
    () => Array.from(new Set([...SETORES_PADRAO, ...setoresExtra])).sort(),
    [setoresExtra],
  );

  function getValor(setor: string) {
    return valores.find((v) => v.setor === setor);
  }

  async function handleSaveValor(setor: string, vmin: number, vmax: number) {
    const existing = getValor(setor);
    const { error } = await upsertSetorValor({
      ...(existing?.id ? { id: existing.id } : {}),
      setor,
      valor_min: vmin || 0,
      valor_max: vmax || 0,
    });
    if (error) {
      toast.error("Erro ao salvar valor");
      return;
    }
    toast.success(`Valor de "${setor}" atualizado`);
  }

  function handleAddSetor() {
    const v = novoSetor.trim();
    if (!v) return;
    saveSetorCustom(v);
    setNovoSetor("");
    toast.success(`Setor "${v}" adicionado`);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-card p-3 flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="Novo setor (ex: Padeiro)"
          value={novoSetor}
          onChange={(e) => setNovoSetor(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddSetor()}
          className="h-9"
        />
        <Button size="sm" onClick={handleAddSetor} className="gap-1.5 shrink-0">
          <Plus size={14} /> Adicionar setor
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="grid grid-cols-[1fr_110px_110px_auto] gap-2 px-3 py-2 bg-muted/40 border-b border-border/60 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Setor</span>
            <span className="text-right">Mínima</span>
            <span className="text-right">Máxima</span>
            <span className="w-8" />
          </div>
          <ul className="divide-y divide-border/50">
            {setores.map((s) => (
              <SetorRow
                key={s}
                setor={s}
                valor={getValor(s)}
                onSave={handleSaveValor}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SetorRow({
  setor,
  valor,
  onSave,
}: {
  setor: string;
  valor?: { id: string; valor_min: number; valor_max: number };
  onSave: (setor: string, vmin: number, vmax: number) => void;
}) {
  const [vmin, setVmin] = useState(valor?.valor_min ?? 0);
  const [vmax, setVmax] = useState(valor?.valor_max ?? 0);

  // sync from realtime/local storage
  useEffect(() => {
    setVmin(valor?.valor_min ?? 0);
    setVmax(valor?.valor_max ?? 0);
  }, [valor?.valor_min, valor?.valor_max]);

  const dirty =
    (valor?.valor_min ?? 0) !== vmin || (valor?.valor_max ?? 0) !== vmax;

  return (
    <li className="grid grid-cols-[1fr_110px_110px_auto] gap-2 items-center px-3 py-2 hover:bg-muted/20 transition-colors">
      <span className="text-sm text-foreground truncate">{setor}</span>
      <Input
        type="number"
        step="0.01"
        min="0"
        className="h-8 text-right"
        value={vmin || ""}
        onChange={(e) => setVmin(parseFloat(e.target.value) || 0)}
        placeholder="0,00"
      />
      <Input
        type="number"
        step="0.01"
        min="0"
        className="h-8 text-right"
        value={vmax || ""}
        onChange={(e) => setVmax(parseFloat(e.target.value) || 0)}
        placeholder="0,00"
      />
      <Button
        size="sm"
        variant={dirty ? "default" : "ghost"}
        className="h-8 px-2 text-xs"
        disabled={!dirty}
        onClick={() => onSave(setor, vmin, vmax)}
      >
        Salvar
      </Button>
    </li>
  );
}

/* ============================ TEXTOS ============================ */
function TextosTab() {
  const [form, setForm] = useState<CopyTemplates>(getCopyTemplates);

  function updateField(key: keyof CopyTemplates, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    saveCopyTemplates(form);
    toast.success("Textos de cópia salvos");
  }

  function handleReset() {
    setForm(DEFAULT_COPY_TEMPLATES);
    saveCopyTemplates(DEFAULT_COPY_TEMPLATES);
    toast.success("Textos restaurados");
  }

  const gruposPlaceholders = [
    {
      title: "Demandas e gerente",
      items: [
        "[Rede]",
        "[Loja]",
        "[Setor]",
        "[Dia]",
        "[Data]",
        "[Horario]",
        "[Entrada]",
        "[Saida]",
        "[Codigo]",
        "[Valor]",
        "[Endereco]",
        "[Diaristas]",
        "[VagasLivres]",
        "[TotalVagas]",
      ],
    },
    {
      title: "Diarista",
      items: [
        "[Diarista]",
        "[Telefone]",
        "[CPF]",
        "[Bairro]",
        "[Rede]",
        "[Loja]",
        "[RedeLoja]",
        "[Local]",
        "[Setor]",
        "[Data]",
        "[Horario]",
        "[Setores]",
        "[TotalDiarias]",
        "[DiariaTexto]",
        "[Agenda]",
        "[Diarias]",
        "[EscalaDiarista]",
        "[FaltaTexto]",
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-card p-3">
        <p className="text-sm font-semibold text-foreground">Placeholders disponíveis</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Use os códigos abaixo entre colchetes. O sistema troca automaticamente pelas informações reais.
        </p>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {gruposPlaceholders.map((grupo) => (
            <div key={grupo.title} className="rounded-lg border border-border/60 p-2">
              <p className="mb-2 text-xs font-semibold text-foreground">{grupo.title}</p>
              <div className="flex flex-wrap gap-1.5">
                {grupo.items.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                    onClick={() => navigator.clipboard?.writeText(p)}
                    title="Copiar placeholder"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TemplateBox
          title="Escala fechada para gerente"
          description="Texto usado no botão Copiar escala gerente da aba Demandas."
          value={form.escalaGerente}
          onChange={(value) => updateField("escalaGerente", value)}
        />
        <TemplateBox
          title="Demandas disponíveis"
          description="Texto usado no botão Copiar vagas disponíveis da aba Demandas."
          value={form.vagasDisponiveis}
          onChange={(value) => updateField("vagasDisponiveis", value)}
        />
        <TemplateBox
          title="Confirmação da escala do diarista"
          description="Texto usado no botão copiar dentro do card do diarista."
          value={form.escalaDiarista}
          onChange={(value) => updateField("escalaDiarista", value)}
        />
        <TemplateBox
          title="Texto explicativo sobre falta"
          description="Esse texto entra onde você colocar o placeholder [FaltaTexto]."
          value={form.textoFalta}
          onChange={(value) => updateField("textoFalta", value)}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={handleReset}>
          Restaurar padrão
        </Button>
        <Button onClick={handleSave}>Salvar textos</Button>
      </div>
    </div>
  );
}

function TemplateBox({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3">
      <Label className="text-sm font-semibold">{title}</Label>
      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      <Textarea
        className="mt-2 min-h-40 font-mono text-xs"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/* ============================ REDES ============================ */
function RedesTab() {
  const { rows, loading } = useRedeValores();
  const [novaRede, setNovaRede] = useState("");
  const [novoValor, setNovoValor] = useState(0);

  async function handleAdd() {
    const r = novaRede.trim();
    if (!r) return;
    const { error } = await upsertRedeValor({ rede: r, valor_recebido: novoValor || 0 });
    if (error) {
      toast.error("Erro ao adicionar rede");
      return;
    }
    setNovaRede("");
    setNovoValor(0);
    toast.success(`Rede "${r}" adicionada`);
  }

  async function handleSave(id: string, rede: string, valor: number) {
    const { error } = await upsertRedeValor({ id, rede, valor_recebido: valor || 0 });
    if (error) {
      toast.error("Erro ao salvar");
      return;
    }
    toast.success(`Valor de "${rede}" atualizado`);
  }

  async function handleDel(id: string, nome: string) {
    if (!confirm(`Excluir rede "${nome}"?`)) return;
    const { error } = await deleteRedeValor(id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    toast.success("Rede excluída");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-card p-3 grid grid-cols-1 sm:grid-cols-[1fr_140px_auto] gap-2">
        <Input
          placeholder="Nova rede (ex: Pão de Açúcar)"
          value={novaRede}
          onChange={(e) => setNovaRede(e.target.value)}
          className="h-9"
        />
        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder="Valor recebido"
          value={novoValor || ""}
          onChange={(e) => setNovoValor(parseFloat(e.target.value) || 0)}
          className="h-9 text-right"
        />
        <Button size="sm" onClick={handleAdd} className="gap-1.5 shrink-0">
          <Plus size={14} /> Adicionar
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nenhuma rede cadastrada.
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="grid grid-cols-[1fr_160px_auto] gap-2 px-3 py-2 bg-muted/40 border-b border-border/60 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Rede</span>
            <span className="text-right">Valor recebido por diária</span>
            <span className="w-16" />
          </div>
          <ul className="divide-y divide-border/50">
            {rows
              .sort((a, b) => a.rede.localeCompare(b.rede))
              .map((r) => (
                <RedeRow
                  key={r.id}
                  row={r}
                  onSave={handleSave}
                  onDelete={handleDel}
                />
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RedeRow({
  row,
  onSave,
  onDelete,
}: {
  row: { id: string; rede: string; valor_recebido: number };
  onSave: (id: string, rede: string, valor: number) => void;
  onDelete: (id: string, rede: string) => void;
}) {
  const [valor, setValor] = useState(row.valor_recebido);
  useMemo(() => setValor(row.valor_recebido), [row.valor_recebido]);
  const dirty = row.valor_recebido !== valor;

  return (
    <li className="grid grid-cols-[1fr_160px_auto] gap-2 items-center px-3 py-2 hover:bg-muted/20 transition-colors">
      <div className="flex items-center gap-2 min-w-0">
        <Network size={14} className="text-primary shrink-0" />
        <span className="text-sm font-medium text-foreground truncate">{row.rede}</span>
        <span className="text-[11px] text-muted-foreground ml-auto sm:hidden">
          {fmt(row.valor_recebido)}
        </span>
      </div>
      <Input
        type="number"
        step="0.01"
        min="0"
        className="h-8 text-right"
        value={valor || ""}
        onChange={(e) => setValor(parseFloat(e.target.value) || 0)}
      />
      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="sm"
          variant={dirty ? "default" : "ghost"}
          className="h-8 px-2 text-xs"
          disabled={!dirty}
          onClick={() => onSave(row.id, row.rede, valor)}
        >
          Salvar
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={() => onDelete(row.id, row.rede)}
        >
          <X size={14} />
        </Button>
      </div>
    </li>
  );
}
