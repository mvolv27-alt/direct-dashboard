import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Users,
  DollarSign,
  ClipboardList,
  LogOut,
  Settings,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  startSync,
  hasLegacyLocalData,
  migrateLegacyLocalData,
} from "@/lib/sync";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ThemeToggle from "@/components/ThemeToggle";

const navItems = [
  { to: "/demandas", label: "Demandas", icon: ClipboardList },
  { to: "/diaristas", label: "Diaristas", icon: Users },
  { to: "/financeiro", label: "Financeiro", icon: DollarSign },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { session, user, isLocalAccess, signOut } = useAuth();

  useEffect(() => {
    if (!session || isLocalAccess) return;
    startSync();
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
  }, [session, isLocalAccess]);

  async function handleLogout() {
    await signOut();
    toast.success("Sessão encerrada");
  }

  const compact = true;
  const sidebarW = "lg:w-16";

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex min-h-dvh w-full">
        <aside
          className={`fixed top-0 left-0 lg:sticky lg:top-3 z-50 hidden h-fit max-h-[calc(100dvh-1.5rem)] my-3 ml-3 gradient-sidebar flex-col rounded-2xl border border-sidebar-border shadow-xl overflow-visible transition-all duration-300 ease-in-out lg:flex ${sidebarW}`}
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

          <nav className={`${compact ? "p-2" : "p-3"} space-y-1.5`}>
            {navItems.map((item) => {
              const active = location.pathname === item.to;
              const baseClasses = active
                ? "gradient-primary text-primary-foreground shadow-[0_4px_18px_-4px_hsl(var(--primary)/0.55)]"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";
              const collapsedClasses = compact
                ? "justify-center px-2 py-2.5"
                : "justify-start gap-3 px-4 py-2.5";

              const linkBody = (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center rounded-lg text-sm font-medium transition-all duration-200 press-down ${collapsedClasses} ${baseClasses}`}
                  >
                  <item.icon size={18} />
                  {!compact && <span className="whitespace-nowrap">{item.label}</span>}
                </Link>
              );

              if (compact) {
                return (
                  <Tooltip key={item.to}>
                    <TooltipTrigger asChild>{linkBody}</TooltipTrigger>
                    <TooltipContent side="right" sideOffset={12} className="z-[100] font-medium">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              }
              return linkBody;
            })}
          </nav>

          {session && (
            <div className={`border-t border-sidebar-border space-y-2 ${compact ? "px-2 py-3" : "p-4"}`}>
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
                    className={`text-sidebar-foreground hover:bg-sidebar-accent ${compact ? "w-full justify-center px-2" : "w-full justify-start"}`}
                  >
                    <LogOut size={14} />
                    {!compact && <span>Sair</span>}
                  </Button>
                </TooltipTrigger>
                {compact && (
                  <TooltipContent side="right" sideOffset={12} className="z-[100] font-medium">
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

        <main className="flex-1 min-h-dvh w-full min-w-0 lg:pl-0">
          <div className="fixed inset-x-0 top-0 z-40 border-b border-border/60 bg-background/88 px-3 py-2 backdrop-blur-xl lg:hidden safe-top">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight text-foreground">
                  <span className="text-primary">Direct</span> Promoções
                </p>
                <p className="truncate text-[11px] text-muted-foreground">Gestão de diaristas</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <ThemeToggle />
              </div>
            </div>
          </div>
          <div className="app-content p-3 pt-20 sm:p-6 sm:pt-6 lg:pl-7 lg:pr-6 overflow-auto safe-bottom animate-fade-in">{children}</div>
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/92 px-2 pb-[max(0.45rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl lg:hidden">
          <div className="grid grid-cols-4 gap-1">
            {navItems.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-semibold transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground shadow-[0_8px_20px_-12px_hsl(var(--primary)/0.8)]"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <item.icon size={18} />
                  <span className="max-w-full truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </TooltipProvider>
  );
}
