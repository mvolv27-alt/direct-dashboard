import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

type AuditRow = {
  id: number;
  table_name: string;
  record_id: string;
  action: string;
  actor_email: string;
  old_data: Json | null;
  new_data: Json | null;
  created_at: string;
};

const TABLE_LABELS: Record<string, string> = {
  diaristas: "Diarista",
  demandas: "Demanda",
  registros_financeiros: "Financeiro",
  setores_custom: "Setor",
  setor_valores: "Valor de setor",
  lojas: "Loja",
  rede_valores: "Rede",
  copy_templates: "Textos",
};

const ACTION_LABELS: Record<string, string> = {
  created: "Criou",
  updated: "Editou / confirmou",
  deleted: "Excluiu",
};

export default function AuditHistory() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(150);
    if (error) toast.error("Não foi possível carregar o histórico");
    setRows((data as AuditRow[] | null) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const channel = supabase
      .channel(`audit-history:${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "audit_log" }, () => void refresh())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [refresh]);

  return (
    <section className="overflow-hidden rounded-xl border border-border/60 bg-card">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Histórico do sistema</h2>
          <p className="text-xs text-muted-foreground">Criações, edições, confirmações e exclusões.</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => void refresh()} title="Atualizar"><RefreshCw size={15} /></Button>
      </div>
      {loading ? (
        <p className="p-4 text-sm text-muted-foreground">Carregando...</p>
      ) : rows.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma ação registrada após a migração.</p>
      ) : (
        <div className="divide-y divide-border/50">
          {rows.map((row) => (
            <details key={row.id} className="group px-4 py-3">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2">
                <Badge variant={row.action === "deleted" ? "destructive" : "outline"}>{ACTION_LABELS[row.action] || row.action}</Badge>
                <span className="text-sm font-medium text-foreground">{TABLE_LABELS[row.table_name] || row.table_name}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">por {row.actor_email || "Sistema"}</span>
                <time className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString("pt-BR")}</time>
              </summary>
              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                {row.old_data && <pre className="max-h-52 overflow-auto rounded-lg bg-muted p-3 text-[10px] text-muted-foreground">{JSON.stringify(row.old_data, null, 2)}</pre>}
                {row.new_data && <pre className="max-h-52 overflow-auto rounded-lg bg-muted p-3 text-[10px] text-muted-foreground">{JSON.stringify(row.new_data, null, 2)}</pre>}
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
