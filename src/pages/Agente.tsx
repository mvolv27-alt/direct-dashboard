import { useMemo, useState } from "react";
import { Bot, CalendarDays, CheckCircle2, ClipboardPaste, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { saveDemanda, saveSetorCustom } from "@/lib/storage";
import {
  useLojas,
  useRedeValores,
  useSetorValores,
  upsertLoja,
  upsertRedeValor,
  upsertSetorValor,
} from "@/hooks/useConfig";
import type { Demanda } from "@/types";
import {
  analisarSolicitacao,
  codigoDemanda,
  type AgenteSolicitacaoPlano,
  normalizarBusca,
  uid,
} from "@/lib/solicitacaoAgent";

const exemplo = `*NOVA SOLICITAÇÃO*

Loja: super do povo passare
Função: fflv
Horário: 10:00 as 18:20
Data de inicio : 23/07 quinta a segunda
Quantidade de dias 5
observação: 2 balconista fflv`;

function formatDate(data: string) {
  if (!data) return "";
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

function parseDatasDigitadas(valor: string) {
  return valor
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(item)) return item;
      const match = item.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
      if (!match) return "";
      const ano = match[3]
        ? match[3].length === 2
          ? `20${match[3]}`
          : match[3]
        : String(new Date().getFullYear());
      const mes = Number(match[2]);
      const dia = Number(match[1]);
      const data = new Date(Number(ano), mes - 1, dia);
      if (
        data.getFullYear() !== Number(ano) ||
        data.getMonth() !== mes - 1 ||
        data.getDate() !== dia
      ) {
        return "";
      }
      return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    })
    .filter(Boolean);
}

function horarioValido(valor: string) {
  const match = valor.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return false;
  const hora = Number(match[1]);
  const minuto = Number(match[2]);
  return hora >= 0 && hora <= 23 && minuto >= 0 && minuto <= 59;
}

export default function AgentePage() {
  const { rows: lojas } = useLojas();
  const { rows: setores } = useSetorValores();
  const { rows: redes } = useRedeValores();
  const [texto, setTexto] = useState(exemplo);
  const [plano, setPlano] = useState<AgenteSolicitacaoPlano | null>(null);
  const [datasDigitadas, setDatasDigitadas] = useState("");
  const [salvando, setSalvando] = useState(false);

  const datasRevisadas = useMemo(
    () => parseDatasDigitadas(datasDigitadas),
    [datasDigitadas],
  );

  function analisar() {
    if (!texto.trim()) {
      toast.error("Cole a solicitação antes de analisar");
      return;
    }
    const resultado = analisarSolicitacao(texto, { lojas, setores, redes });
    setPlano(resultado);
    setDatasDigitadas(resultado.campos.datas.map(formatDate).join(", "));
    toast.success("Solicitação analisada");
  }

  function updateCampo<K extends keyof AgenteSolicitacaoPlano["campos"]>(
    campo: K,
    valor: AgenteSolicitacaoPlano["campos"][K],
  ) {
    setPlano((prev) =>
      prev
        ? {
            ...prev,
            campos: {
              ...prev.campos,
              [campo]: valor,
            },
          }
        : prev,
    );
  }

  function validarAntesDeSalvar() {
    if (!plano) return ["Analise uma solicitação primeiro."];
    const erros: string[] = [];
    const c = plano.campos;
    if (!c.rede.trim()) erros.push("Rede é obrigatória.");
    if (!c.loja.trim()) erros.push("Loja é obrigatória.");
    if (!c.setor.trim()) erros.push("Setor é obrigatório.");
    if (!horarioValido(c.entrada) || !horarioValido(c.saida)) {
      erros.push("Informe entrada e saída válidas no formato HH:MM.");
    }
    if (datasRevisadas.length === 0) erros.push("Informe pelo menos uma data válida.");
    if (c.vagas < 1) erros.push("Informe pelo menos 1 vaga.");
    if (c.valorDiaria <= 0) erros.push("Informe o valor da diária.");
    if (c.valorRecebidoRede <= 0) erros.push("Informe o valor recebido da rede.");
    const lojaExiste = lojas.some(
      (loja) =>
        normalizarBusca(loja.nome) === normalizarBusca(c.loja) &&
        normalizarBusca(loja.rede) === normalizarBusca(c.rede),
    );
    if (!lojaExiste && !c.endereco.trim()) erros.push("Informe o endereço da nova loja.");
    if (!lojaExiste && !c.responsavel.trim()) erros.push("Informe o responsável da nova loja.");
    return erros;
  }

  async function confirmarCadastro() {
    if (!plano) return;
    const erros = validarAntesDeSalvar();
    if (erros.length > 0) {
      toast.error("Revise as informações antes de cadastrar", {
        description: erros[0],
      });
      return;
    }

    setSalvando(true);
    const c = plano.campos;
    const lojaExiste = lojas.some(
      (loja) =>
        normalizarBusca(loja.nome) === normalizarBusca(c.loja) &&
        normalizarBusca(loja.rede) === normalizarBusca(c.rede),
    );
    const setorExiste = setores.some((setor) => normalizarBusca(setor.setor) === normalizarBusca(c.setor));
    const redeExiste = redes.some((rede) => normalizarBusca(rede.rede) === normalizarBusca(c.rede));

    try {
      if (!lojaExiste) {
        const { error } = await upsertLoja({
          nome: c.loja.trim(),
          rede: c.rede.trim(),
          endereco: c.endereco.trim(),
          responsavel: c.responsavel.trim(),
          bairro: c.bairro.trim(),
          cidade: c.cidade.trim() || "Fortaleza",
          uf: c.uf.trim() || "CE",
          ativo: true,
        });
        if (error) throw error;
      }

      if (!setorExiste) {
        saveSetorCustom(c.setor.trim());
        const { error } = await upsertSetorValor({
          setor: c.setor.trim(),
          valor_min: c.valorDiaria,
          valor_max: c.valorDiaria,
        });
        if (error) throw error;
      }

      if (!redeExiste) {
        const { error } = await upsertRedeValor({
          rede: c.rede.trim(),
          valor_recebido: c.valorRecebidoRede,
        });
        if (error) throw error;
      }

      datasRevisadas.forEach((data) => {
        const demanda: Demanda = {
          id: uid(),
          codigo: codigoDemanda(),
          data,
          horario: c.entrada.trim(),
          horarioSaida: c.saida.trim(),
          rede: c.rede.trim(),
          loja: c.loja.trim(),
          setor: c.setor.trim(),
          valor: c.valorDiaria,
          tarefasTotal: Math.max(1, Math.floor(c.vagas)),
          tarefasConcluidas: 0,
          status: "pendente",
          alocacoes: [],
          observacoes: c.observacao.trim(),
          createdAt: new Date().toISOString(),
        };
        saveDemanda(demanda);
      });

      toast.success(`${datasRevisadas.length} demanda(s) cadastrada(s) pelo agente`);
      setPlano(null);
      setTexto("");
      setDatasDigitadas("");
    } catch (error) {
      toast.error("Não foi possível cadastrar", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 pb-24 lg:pb-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Bot size={14} />
            Agente de cadastro
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Agente de Solicitações</h1>
          <p className="text-sm text-muted-foreground">
            Cole a mensagem recebida, revise os campos e confirme para cadastrar.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => setTexto(exemplo)}>
          <ClipboardPaste size={16} />
          Usar exemplo
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-card-foreground">Mensagem recebida</h2>
              <p className="text-xs text-muted-foreground">Pode vir do WhatsApp, e-mail ou texto copiado.</p>
            </div>
            <Wand2 className="text-primary" size={18} />
          </div>
          <Textarea
            value={texto}
            onChange={(event) => setTexto(event.target.value)}
            className="min-h-[220px] resize-y font-mono text-sm leading-relaxed sm:min-h-[360px]"
            placeholder="Cole a solicitação aqui..."
          />
          <Button type="button" className="mt-4 w-full" onClick={analisar}>
            <Wand2 size={16} />
            Analisar solicitação
          </Button>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          {!plano ? (
            <div className="grid min-h-[470px] place-items-center rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
              <div>
                <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Bot size={24} />
                </div>
                <h2 className="font-semibold text-card-foreground">Aguardando análise</h2>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Depois de analisar, o agente mostra o que entendeu e deixa você completar o que faltar.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-semibold text-card-foreground">Confirmar antes de cadastrar</h2>
                  <p className="text-xs text-muted-foreground">Revise e edite qualquer campo abaixo.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={plano.encontrados.rede ? "secondary" : "outline"}>
                    {plano.encontrados.rede ? "Rede encontrada" : "Rede nova"}
                  </Badge>
                  <Badge variant={plano.encontrados.loja ? "secondary" : "outline"}>
                    {plano.encontrados.loja ? "Loja encontrada" : "Loja nova"}
                  </Badge>
                  <Badge variant={plano.encontrados.setor ? "secondary" : "outline"}>
                    {plano.encontrados.setor ? "Setor encontrado" : "Setor novo"}
                  </Badge>
                </div>
              </div>

              {plano.avisos.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                  {plano.avisos.map((aviso) => (
                    <p key={aviso}>{aviso}</p>
                  ))}
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Rede" value={plano.campos.rede} onChange={(v) => updateCampo("rede", v)} />
                <Field label="Loja" value={plano.campos.loja} onChange={(v) => updateCampo("loja", v)} />
                <Field label="Bairro" value={plano.campos.bairro} onChange={(v) => updateCampo("bairro", v)} />
                <Field label="Responsável" value={plano.campos.responsavel} onChange={(v) => updateCampo("responsavel", v)} />
                <Field className="md:col-span-2" label="Endereço" value={plano.campos.endereco} onChange={(v) => updateCampo("endereco", v)} />
                <Field label="Setor/Função" value={plano.campos.setor} onChange={(v) => updateCampo("setor", v)} />
                <NumberField label="Valor da diária" value={plano.campos.valorDiaria} onChange={(v) => updateCampo("valorDiaria", v)} />
                <NumberField label="Valor recebido da rede" value={plano.campos.valorRecebidoRede} onChange={(v) => updateCampo("valorRecebidoRede", v)} />
                <Field label="Entrada" value={plano.campos.entrada} onChange={(v) => updateCampo("entrada", v)} />
                <Field label="Saída" value={plano.campos.saida} onChange={(v) => updateCampo("saida", v)} />
                <NumberField label="Vagas por dia" value={plano.campos.vagas} onChange={(v) => updateCampo("vagas", v)} />
                <Field label="Cidade" value={plano.campos.cidade} onChange={(v) => updateCampo("cidade", v)} />
              </div>

              <div className="space-y-1.5">
                <Label>Datas</Label>
                <Textarea
                  value={datasDigitadas}
                  onChange={(event) => setDatasDigitadas(event.target.value)}
                  className="min-h-[78px]"
                  placeholder="23/07/2026, 24/07/2026..."
                />
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays size={13} />
                  {datasRevisadas.length} demanda(s) e {datasRevisadas.length * Math.max(1, Math.floor(plano.campos.vagas))} diária(s) serão criadas.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Observação</Label>
                <Textarea
                  value={plano.campos.observacao}
                  onChange={(event) => updateCampo("observacao", event.target.value)}
                  className="min-h-[72px]"
                />
              </div>

              <Button type="button" className="w-full" onClick={() => void confirmarCadastro()} disabled={salvando}>
                <CheckCircle2 size={16} />
                {salvando ? "Cadastrando..." : "Confirmar e cadastrar no sistema"}
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
      />
    </div>
  );
}
