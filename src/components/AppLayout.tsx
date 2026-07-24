import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import {
  Users,
  DollarSign,
  ClipboardList,
  LogOut,
  Settings,
  Cloud,
  CloudOff,
  RefreshCw,
  LayoutDashboard,
  Bot,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  startSync,
  hasLegacyLocalData,
  migrateLegacyLocalData,
  useSyncStatus,
} from "@/lib/sync";
import { syncCopyTemplatesFromCloud } from "@/lib/copyTemplates";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ThemeToggle from "@/components/ThemeToggle";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { to: "/dashboard", label: "Central", mobileLabel: "Central", icon: LayoutDashboard, tone: "primary" },
  { to: "/agente", label: "Agente", mobileLabel: "Agente", icon: Bot, tone: "secondary" },
  { to: "/demandas", label: "Demandas", mobileLabel: "Demandas", icon: ClipboardList, tone: "primary" },
  { to: "/diaristas", label: "Diaristas", mobileLabel: "Diaristas", icon: Users, tone: "success" },
  { to: "/financeiro", label: "Financeiro", mobileLabel: "Financeiro", icon: DollarSign, tone: "warning" },
  { to: "/configuracoes", label: "Configurações", mobileLabel: "Ajustes", icon: Settings, tone: "accent" },
] as const;

const navToneClasses = {
  primary: "nav-active-primary",
  secondary: "nav-active-secondary",
  success: "nav-active-success",
  warning: "nav-active-warning",
  accent: "nav-active-accent",
} as const;

const navIconClasses = {
  primary: "text-primary",
  secondary: "text-secondary",
  success: "text-success",
  warning: "text-warning",
  accent: "text-accent",
} as const;

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { session, user, isLocalAccess, signOut } = useAuth();
  const syncStatus = useSyncStatus();
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const mustSetPassword = !!user && "user_metadata" in user && !!user.user_metadata?.must_set_password;

  useEffect(() => {
    if (!session || isLocalAccess) return;
    if (!user?.id) return;
    void startSync(user.id).catch((error: unknown) => {
      const description =
        error instanceof Error ? error.message : "Verifique a conexão com o Supabase.";
      toast.error("Não foi possível sincronizar os dados", { description });
    });
    void syncCopyTemplatesFromCloud();
    if (hasLegacyLocalData()) {
      migrateLegacyLocalData()
        .then((res) => {
          const total = res.diaristas + res.demandas + res.registros + res.setores;
          if (total > 0) {
            toast.success(`${total} registro(s) locais enviados para a nuvem`, {
              description: `${res.diaristas} diarista(s) - ${res.demandas} demanda(s) - ${res.registros} financeiro(s)`,
            });
          }
        })
        .catch(() => {
          /* silent: outbox handles retries */
        });
    }
  }, [session, user?.id, isLocalAccess]);

  async function handleLogout() {
    await signOut();
    toast.success("Sessão encerrada");
  }

  async function saveFirstPassword() {
    if (newPassword.length < 8) {
      toast.error("A senha precisa ter pelo menos 8 caracteres");
      return;
    }
    setSavingPassword(true);
    const metadata = user && "user_metadata" in user ? user.user_metadata : {};
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      data: { ...metadata, must_set_password: false },
    });
    setSavingPassword(false);
    if (error) {
      toast.error("Não foi possível definir a senha", { description: error.message });
      return;
    }
    toast.success("Senha definida com sucesso");
    window.location.reload();
  }

  const compact = true;
  const sidebarW = "lg:w-[72px]";

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex min-h-dvh w-full">
        <Dialog open={mustSetPassword}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Defina sua senha</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">Este é seu primeiro acesso. Crie uma senha para entrar novamente depois.</p>
            <div className="grid gap-1.5">
              <Label htmlFor="first-password">Nova senha</Label>
              <Input id="first-password" type="password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
            </div>
            <Button onClick={() => void saveFirstPassword()} disabled={savingPassword}>
              {savingPassword ? "Salvando..." : "Salvar senha e continuar"}
            </Button>
          </DialogContent>
        </Dialog>
        <aside
          className={`fixed left-0 top-0 z-50 my-3 ml-3 hidden h-fit max-h-[calc(100dvh-1.5rem)] flex-col overflow-visible rounded-[20px] gradient-sidebar lg:sticky lg:top-3 lg:flex ${sidebarW}`}
        >
          {!compact && (
            <div className="border-b border-sidebar-border flex items-center justify-between px-6 py-5">
              <div>
                <h1 className="text-xl font-bold text-sidebar-foreground tracking-tight whitespace-nowrap">
                  <span className="text-sidebar-primary">Direct</span> Promoções
                </h1>
                <p className="text-xs text-sidebar-muted mt-1">Gestão de Diaristas - Fortaleza/CE</p>
              </div>
            </div>
          )}

          <nav className={`${compact ? "p-2.5" : "p-3"} space-y-1.5`} aria-label="Navegacao principal">
            {navItems.map((item) => {
              const active = location.pathname === item.to;
              const baseClasses = active
                ? navToneClasses[item.tone]
                : `text-sidebar-foreground hover:bg-sidebar-accent/75 hover:text-sidebar-accent-foreground ${navIconClasses[item.tone]}`;
              const collapsedClasses = compact
                ? "justify-center px-2 py-3"
                : "justify-start gap-3 px-4 py-2.5";

              const linkBody = (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`group relative flex min-h-11 items-center overflow-hidden rounded-xl text-sm font-bold transition-all duration-200 press-down ${collapsedClasses} ${baseClasses}`}
                  >
                  <item.icon size={18} />
                  {!compact && <span className="whitespace-nowrap">{item.label}</span>}
                </Link>
              );

              if (compact) {
                return (
                  <Tooltip key={item.to}>
                    <TooltipTrigger asChild>{linkBody}</TooltipTrigger>
                    <TooltipContent side="right" sideOffset={14} className="glass-strong z-[100] border-white/15 font-bold">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              }
              return linkBody;
            })}
          </nav>

          <SyncIndicator status={syncStatus} compact />

          {session && (
            <div className={`space-y-1.5 border-t border-sidebar-border/70 ${compact ? "px-2.5 py-2.5" : "p-4"}`}>
              {!compact && (
                <p className="text-[11px] text-sidebar-muted truncate" title={user?.email ?? ""}>
                  {user?.email}
                </p>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    aria-label="Sair da conta"
                    title="Sair"
                    className={`rounded-xl border border-white/10 bg-card/35 text-sidebar-foreground hover:bg-destructive/12 hover:text-destructive ${compact ? "w-full justify-center px-2" : "w-full justify-start"}`}
                  >
                    <LogOut size={14} />
                    {!compact && <span>Sair</span>}
                  </Button>
                </TooltipTrigger>
                {compact && (
                  <TooltipContent side="right" sideOffset={14} className="glass-strong z-[100] border-white/15 font-bold">
                    Sair
                  </TooltipContent>
                )}
              </Tooltip>
              <div className={compact ? "flex justify-center" : "flex justify-start"}>
                <ThemeToggle />
              </div>
            </div>
          )}
        </aside>

        <main className="min-h-dvh w-full min-w-0 flex-1 lg:pl-2">
          <div className="mobile-app-header gradient-sidebar fixed inset-x-0 top-0 z-40 rounded-b-[20px] border-x-0 border-t-0 px-4 pb-2.5 pt-2.5 shadow-sm lg:hidden">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-extrabold leading-tight text-foreground">
                  <span className="text-gradient">Direct</span> Promoções
                </p>
                <p className="truncate text-[11px] text-muted-foreground">Gestão de diaristas</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <SyncIndicator status={syncStatus} compact />
                <ThemeToggle />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  aria-label="Sair da conta"
                  title="Sair"
                  className="h-9 w-9 rounded-xl border border-white/15 bg-card/45 text-foreground hover:border-destructive/35 hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut size={16} />
                </Button>
              </div>
            </div>
          </div>
          <div className="app-content mx-auto w-full max-w-[1720px] overflow-auto p-3 pt-20 sm:p-6 sm:pt-6 lg:px-8 safe-bottom animate-fade-in">{children}</div>
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-50 rounded-t-[22px] border border-b-0 border-white/45 bg-background/76 px-2 pb-[max(0.45rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-14px_40px_hsl(var(--foreground)/0.10)] backdrop-blur-2xl dark:border-white/10 lg:hidden" aria-label="Navegacao mobile">
          <div className="grid grid-cols-6 gap-0.5">
            {navItems.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-2 text-[9px] font-bold transition-all duration-200 ${
                    active
                      ? navToneClasses[item.tone]
                      : `text-muted-foreground hover:bg-card/60 hover:text-foreground ${navIconClasses[item.tone]}`
                  }`}
                >
                  <item.icon size={18} />
                  <span className="max-w-full truncate">{item.mobileLabel}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </TooltipProvider>
  );
}

function SyncIndicator({
  status,
  compact,
}: {
  status: ReturnType<typeof useSyncStatus>;
  compact?: boolean;
}) {
  const label = !status.online
    ? "Offline"
    : status.pending > 0
      ? `${status.pending} envio(s) pendente(s)`
      : status.syncing
        ? "Sincronizando"
        : "Sincronizado";
  const Icon = !status.online ? CloudOff : status.syncing || status.pending > 0 ? RefreshCw : Cloud;
  const color = !status.online
    ? "text-destructive"
    : status.pending > 0
      ? "text-amber-500"
      : "text-emerald-500";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          role="status"
          aria-label={label}
          className={`flex items-center gap-2 ${compact ? "justify-center px-2 py-2" : "px-3 py-2"}`}
        >
          <Icon size={15} className={`${color} ${status.syncing ? "animate-spin" : ""}`} />
          {!compact && <span className="text-xs text-muted-foreground">{label}</span>}
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>{label}</TooltipContent>
    </Tooltip>
  );
}
