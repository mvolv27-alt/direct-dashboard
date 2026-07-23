import { useMemo, useState } from "react";
import { Bot, CalendarDays, Check, CheckCircle2, ChevronsUpDown, ClipboardPaste, LoaderCircle, MapPin, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  getDiaristas,
  getSetoresCustom,
  saveDemanda,
  saveDiarista,
  saveSetorCustom,
  updateDiarista,
} from "@/lib/storage";
import { useLiveData } from "@/lib/sync";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  useLojas,
  useRedeValores,
  useSetorValores,
  upsertLoja,
  upsertRedeValor,
  upsertSetorValor,
} from "@/hooks/useConfig";
import type { Demanda, Diarista } from "@/types";
import { buscarEnderecoLoja, type SugestaoEndereco } from "@/lib/addressLookup";
import {
  analisarCadastroDiarista,
  type CadastroDiaristaPlano,
  detectarTipoTextoAgente,
  formatarCEP,
  formatarCPF,
  formatarTelefone,
} from "@/lib/diaristaAgent";
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
  const diaristas = useLiveData(getDiaristas, ["diaristas"]);
  const setoresCustom = useLiveData(getSetoresCustom, ["setores_custom"]);
  const { rows: lojas } = useLojas();
  const { rows: setores } = useSetorValores();
  const { rows: redes } = useRedeValores();
  const [texto, setTexto] = useState("");
  const [plano, setPlano] = useState<AgenteSolicitacaoPlano | null>(null);
  const [cadastroDiarista, setCadastroDiarista] = useState<CadastroDiaristaPlano | null>(null);
  const [datasDigitadas, setDatasDigitadas] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [buscandoEndereco, setBuscandoEndereco] = useState(false);
  const [mapaUrl, setMapaUrl] = useState("");

  const datasRevisadas = useMemo(
    () => parseDatasDigitadas(datasDigitadas),
    [datasDigitadas],
  );
  const setoresDisponiveis = useMemo(
    () =>
      Array.from(
        new Map(
          [...setores.map((item) => item.setor), ...setoresCustom]
            .filter(Boolean)
            .map((setor) => [normalizarBusca(setor), setor]),
        ).values(),
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [setores, setoresCustom],
  );

  function aplicarEndereco(sugestao: SugestaoEndereco) {
    setPlano((prev) =>
      prev
        ? {
            ...prev,
            campos: {
              ...prev.campos,
              endereco: sugestao.endereco,
              bairro: sugestao.bairro || prev.campos.bairro,
              cidade: sugestao.cidade || prev.campos.cidade,
              uf: sugestao.uf || prev.campos.uf,
            },
          }
        : prev,
    );
    setMapaUrl(sugestao.mapaUrl);
  }

  async function procurarEndereco(campos: AgenteSolicitacaoPlano["campos"]) {
    setBuscandoEndereco(true);
    try {
      const sugestao = await buscarEnderecoLoja({
        rede: campos.rede,
        loja: campos.loja,
        bairro: campos.bairro,
        cidade: campos.cidade,
        uf: campos.uf,
      });
      if (!sugestao) {
        toast.info("Endereço não localizado no mapa", {
          description: "Revise o nome da unidade ou preencha o endereço manualmente.",
        });
        return;
      }
      aplicarEndereco(sugestao);
      toast.success("Endereço sugerido pelo mapa");
    } catch (error) {
      toast.error("Não foi possível consultar o mapa", {
        description: error instanceof Error ? error.message : "Preencha o endereço manualmente.",
      });
    } finally {
      setBuscandoEndereco(false);
    }
  }

  async function analisar() {
    if (!texto.trim()) {
      toast.error("Cole a solicitação antes de analisar");
      return;
    }
    setAnalisando(true);
    setMapaUrl("");
    if (detectarTipoTextoAgente(texto) === "diarista") {
      const resultado = analisarCadastroDiarista(texto, diaristas);
      setCadastroDiarista(resultado);
      setPlano(null);
      setDatasDigitadas("");
      setAnalisando(false);
      toast.success(resultado.existente ? "Diarista encontrado na base" : "Cadastro de diarista analisado");
      return;
    }
    setCadastroDiarista(null);
    const resultado = analisarSolicitacao(texto, { lojas, setores, redes });
    setPlano(resultado);
    setDatasDigitadas(resultado.campos.datas.map(formatDate).join(", "));
    toast.success("Solicitação analisada");
    if (!resultado.encontrados.loja && resultado.campos.loja) {
      await procurarEndereco(resultado.campos);
    }
    setAnalisando(false);
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

  function updateRede(valor: string) {
    const encontrada = redes.find(
      (rede) => normalizarBusca(rede.rede) === normalizarBusca(valor),
    );
    setPlano((prev) =>
      prev
        ? {
            ...prev,
            campos: {
              ...prev.campos,
              rede: encontrada?.rede || valor,
              valorRecebidoRede: encontrada?.valor_recebido || (prev.encontrados.rede ? 0 : prev.campos.valorRecebidoRede),
            },
            encontrados: {
              ...prev.encontrados,
              rede: Boolean(encontrada),
            },
          }
        : prev,
    );
  }

  function updateCadastroDiarista<K extends keyof CadastroDiaristaPlano["campos"]>(
    campo: K,
    valor: CadastroDiaristaPlano["campos"][K],
  ) {
    setCadastroDiarista((prev) =>
      prev
        ? {
            ...prev,
            campos: { ...prev.campos, [campo]: valor },
          }
        : prev,
    );
  }

  function confirmarCadastroDiarista() {
    if (!cadastroDiarista) return;
    const c = cadastroDiarista.campos;
    if (!c.nome.trim()) {
      toast.error("Informe o nome completo");
      return;
    }
    if (c.cpf.replace(/\D/g, "").length !== 11) {
      toast.error("Informe um CPF com 11 números");
      return;
    }

    const base: Pick<
      Diarista,
      "nome" | "cpf" | "telefone" | "estado" | "cidade" | "bairro" | "endereco" | "cep" | "setorExperiencia"
    > = {
      nome: c.nome.trim(),
      cpf: formatarCPF(c.cpf),
      telefone: formatarTelefone(c.telefone),
      estado: c.estado.trim(),
      cidade: c.cidade.trim(),
      bairro: c.bairro.trim(),
      endereco: c.endereco.trim(),
      cep: formatarCEP(c.cep),
      setorExperiencia: c.setores,
    };

    if (cadastroDiarista.existente) {
      updateDiarista({
        ...cadastroDiarista.existente,
        ...base,
      });
      toast.success("Cadastro do diarista atualizado");
    } else {
      saveDiarista({
        ...base,
        id: uid(),
        presencas: 0,
        faltas: 0,
        createdAt: new Date().toISOString(),
      });
      toast.success("Diarista cadastrado pelo agente");
    }
    setCadastroDiarista(null);
    setTexto("");
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
      setCadastroDiarista(null);
      setTexto("");
      setDatasDigitadas("");
      setMapaUrl("");
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
            Cole uma demanda ou os dados de um diarista, revise e confirme o cadastro.
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
          <Button type="button" className="mt-4 w-full" onClick={() => void analisar()} disabled={analisando}>
            {analisando ? <LoaderCircle className="animate-spin" size={16} /> : <Wand2 size={16} />}
            {analisando ? "Analisando..." : "Analisar solicitação"}
          </Button>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          {cadastroDiarista ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-semibold text-card-foreground">
                    {cadastroDiarista.existente ? "Atualizar cadastro do diarista" : "Confirmar cadastro do diarista"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Complete agora o que tiver disponível; os demais dados podem ser preenchidos depois.
                  </p>
                </div>
                <Badge variant={cadastroDiarista.existente ? "secondary" : "outline"}>
                  {cadastroDiarista.existente ? "CPF já cadastrado" : "Novo diarista"}
                </Badge>
              </div>

              {cadastroDiarista.avisos.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                  {cadastroDiarista.avisos.map((aviso) => <p key={aviso}>{aviso}</p>)}
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <Field className="md:col-span-2" label="Nome completo *" value={cadastroDiarista.campos.nome} onChange={(v) => updateCadastroDiarista("nome", v)} />
                <Field label="CPF *" value={cadastroDiarista.campos.cpf} onChange={(v) => updateCadastroDiarista("cpf", formatarCPF(v))} />
                <Field label="Telefone/WhatsApp" value={cadastroDiarista.campos.telefone} onChange={(v) => updateCadastroDiarista("telefone", formatarTelefone(v))} />
                <Field label="Estado" value={cadastroDiarista.campos.estado} onChange={(v) => updateCadastroDiarista("estado", v)} />
                <Field label="Cidade" value={cadastroDiarista.campos.cidade} onChange={(v) => updateCadastroDiarista("cidade", v)} />
                <Field label="Bairro" value={cadastroDiarista.campos.bairro} onChange={(v) => updateCadastroDiarista("bairro", v)} />
                <Field label="CEP" value={cadastroDiarista.campos.cep} onChange={(v) => updateCadastroDiarista("cep", formatarCEP(v))} />
                <Field className="md:col-span-2" label="Rua/Nº" value={cadastroDiarista.campos.endereco} onChange={(v) => updateCadastroDiarista("endereco", v)} />
                <SetorMultiSelect
                  className="md:col-span-2"
                  options={setoresDisponiveis}
                  value={cadastroDiarista.campos.setores}
                  onChange={(value) => updateCadastroDiarista("setores", value)}
                />
              </div>

              <Button type="button" className="w-full" onClick={confirmarCadastroDiarista}>
                <CheckCircle2 size={16} />
                {cadastroDiarista.existente ? "Atualizar cadastro" : "Confirmar e cadastrar diarista"}
              </Button>
            </div>
          ) : !plano ? (
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
                <Field label="Rede" value={plano.campos.rede} onChange={updateRede} />
                <Field label="Loja" value={plano.campos.loja} onChange={(v) => updateCampo("loja", v)} />
                <Field label="Bairro" value={plano.campos.bairro} onChange={(v) => updateCampo("bairro", v)} />
                <Field label="Responsável" value={plano.campos.responsavel} onChange={(v) => updateCampo("responsavel", v)} />
                <div className="space-y-1.5 md:col-span-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Endereço</Label>
                    {!plano.encontrados.loja && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 px-2 text-xs"
                        disabled={buscandoEndereco}
                        onClick={() => void procurarEndereco(plano.campos)}
                      >
                        {buscandoEndereco ? <LoaderCircle className="animate-spin" size={13} /> : <MapPin size={13} />}
                        {buscandoEndereco ? "Buscando..." : "Buscar no mapa"}
                      </Button>
                    )}
                  </div>
                  <Input value={plano.campos.endereco} onChange={(event) => updateCampo("endereco", event.target.value)} />
                  {mapaUrl && (
                    <a
                      href={mapaUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <MapPin size={12} />
                      Conferir no mapa · © OpenStreetMap
                    </a>
                  )}
                </div>
                <Field label="Setor/Função" value={plano.campos.setor} onChange={(v) => updateCampo("setor", v)} />
                <NumberField label="Valor da diária" value={plano.campos.valorDiaria} onChange={(v) => updateCampo("valorDiaria", v)} />
                <NumberField
                  label="Valor recebido da rede"
                  value={plano.campos.valorRecebidoRede}
                  onChange={(v) => updateCampo("valorRecebidoRede", v)}
                  disabled={plano.encontrados.rede}
                  hint={plano.encontrados.rede ? "Puxado das configurações da rede." : undefined}
                />
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
  disabled,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type="number"
        min={0}
        step="0.01"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
      />
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SetorMultiSelect({
  options,
  value,
  onChange,
  className,
}: {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  function toggle(option: string) {
    const normalized = normalizarBusca(option);
    const selected = value.some((item) => normalizarBusca(item) === normalized);
    onChange(
      selected
        ? value.filter((item) => normalizarBusca(item) !== normalized)
        : [...value, option],
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>Setores de experiência</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="min-h-10 w-full justify-between gap-2 whitespace-normal px-3 py-2 text-left font-normal"
          >
            <span className={cn("line-clamp-2", value.length === 0 && "text-muted-foreground")}>
              {value.length > 0 ? value.join(", ") : "Selecione um ou mais setores"}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          collisionPadding={12}
          className="w-[var(--radix-popover-trigger-width)] p-0"
        >
          <Command>
            <CommandInput placeholder="Buscar setor..." />
            <CommandList className="max-h-64">
              <CommandEmpty>Nenhum setor encontrado.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const selected = value.some(
                    (item) => normalizarBusca(item) === normalizarBusca(option),
                  );
                  return (
                    <CommandItem key={option} value={option} onSelect={() => toggle(option)}>
                      <Check className={cn("mr-2 h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                      <span>{option}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <p className="text-xs text-muted-foreground">
        {value.length} setor(es) selecionado(s).
      </p>
    </div>
  );
}
