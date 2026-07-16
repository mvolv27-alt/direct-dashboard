import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { MailPlus, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";

type TeamProfile = {
  id: string;
  nome: string | null;
  email: string;
  role: "admin" | "supervisor";
  active: boolean;
  created_at: string;
};

type Invite = {
  id: string;
  email: string;
  role: string;
  status: string;
  invited_at: string;
};

export default function TeamAdmin() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<TeamProfile[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "supervisor" });

  const refresh = useCallback(async () => {
    setLoading(true);
    const [profilesResult, invitesResult] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: true }),
      supabase.from("supervisor_invites").select("*").order("invited_at", { ascending: false }),
    ]);
    if (profilesResult.error || invitesResult.error) {
      const databaseError = profilesResult.error || invitesResult.error;
      const missingMigration =
        databaseError?.code === "42P01" ||
        databaseError?.message?.includes("supervisor_invites");
      toast.error("Não foi possível carregar a equipe", {
        description: missingMigration
          ? "A tabela de equipe ainda não existe. Execute a migração de administração no Supabase."
          : databaseError?.message || "Verifique a conexão e as permissões do Supabase.",
      });
    }
    setProfiles((profilesResult.data as TeamProfile[] | null) || []);
    setInvites((invitesResult.data as Invite[] | null) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function invite() {
    if (!form.email.trim() || !form.email.includes("@")) {
      toast.error("Informe um e-mail válido");
      return;
    }
    setSending(true);
    const { data, error } = await supabase.functions.invoke("invite-supervisor", {
      body: {
        email: form.email.trim().toLowerCase(),
        name: form.name.trim(),
        role: form.role,
        redirectTo: `${window.location.origin}${window.location.pathname}`,
      },
    });
    setSending(false);
    if (error || data?.error) {
      toast.error("Não foi possível enviar o convite", {
        description: data?.error || error?.message || "Verifique a Edge Function no Supabase.",
      });
      return;
    }
    toast.success("Convite enviado", { description: form.email.trim().toLowerCase() });
    setForm({ name: "", email: "", role: "supervisor" });
    await refresh();
  }

  async function updateProfile(id: string, values: Partial<Pick<TeamProfile, "role" | "active">>) {
    const { error } = await supabase.from("profiles").update(values).eq("id", id);
    if (error) {
      toast.error("Não foi possível atualizar o supervisor");
      return;
    }
    toast.success("Perfil atualizado");
    await refresh();
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border/60 bg-card p-4">
        <div className="mb-4 flex items-center gap-2">
          <MailPlus size={18} className="text-primary" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">Convidar supervisor</h2>
            <p className="text-xs text-muted-foreground">O acesso será criado pelo convite enviado por e-mail.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_170px_auto] md:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="invite-name">Nome</Label>
            <Input id="invite-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome do supervisor" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="invite-email">E-mail</Label>
            <Input id="invite-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="supervisor@email.com" />
          </div>
          <div className="grid gap-1.5">
            <Label>Perfil</Label>
            <Select value={form.role} onValueChange={(role) => setForm({ ...form, role })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="supervisor">Supervisor</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={invite} disabled={sending} className="gap-2">
            <MailPlus size={15} /> {sending ? "Enviando..." : "Enviar convite"}
          </Button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border/60 bg-card">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Equipe cadastrada</h2>
            <p className="text-xs text-muted-foreground">{profiles.length} usuário(s)</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => void refresh()} title="Atualizar"><RefreshCw size={15} /></Button>
        </div>
        {loading ? (
          <p className="p-4 text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="divide-y divide-border/50">
            {profiles.map((profile) => {
              const isSelf = profile.id === user?.id;
              return (
                <div key={profile.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_170px_auto] sm:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                      {profile.role === "admin" ? <ShieldCheck size={17} /> : <UserRound size={17} />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{profile.nome || profile.email}</p>
                      <p className="truncate text-xs text-muted-foreground">{profile.email}</p>
                    </div>
                  </div>
                  <Select
                    value={profile.role}
                    disabled={isSelf}
                    onValueChange={(role) => void updateProfile(profile.id, { role: role as TeamProfile["role"] })}
                  >
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <Badge variant={profile.active ? "default" : "secondary"}>{profile.active ? "Ativo" : "Bloqueado"}</Badge>
                    <Switch checked={profile.active} disabled={isSelf} onCheckedChange={(active) => void updateProfile(profile.id, { active })} aria-label="Ativar ou bloquear acesso" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {invites.some((inviteRow) => inviteRow.status !== "accepted") && (
        <section className="rounded-xl border border-border/60 bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Convites</h2>
          <div className="mt-3 space-y-2">
            {invites.filter((row) => row.status !== "accepted").map((row) => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs">
                <span className="text-foreground">{row.email}</span>
                <Badge variant="outline">{row.status === "pending" ? "Pendente" : "Falhou"}</Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
