import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { lazy, Suspense } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AuthProvider } from "@/hooks/useAuth";

const Diaristas = lazy(() => import("@/pages/Diaristas"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Financeiro = lazy(() => import("@/pages/Financeiro"));
const Demandas = lazy(() => import("@/pages/Demandas"));
const Agente = lazy(() => import("@/pages/Agente"));
const Auth = lazy(() => import("@/pages/Auth"));
const Configuracoes = lazy(() => import("@/pages/Configuracoes"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const Protected = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppLayout>{children}</AppLayout>
  </ProtectedRoute>
);

const AppLoading = () => (
  <div className="grid min-h-dvh place-items-center px-4">
    <div className="glass-strong flex min-w-[240px] items-center gap-3 rounded-2xl p-4 text-foreground animate-in-up">
      <div className="aurora-icon gradient-primary grid h-11 w-11 shrink-0 place-items-center text-primary-foreground">
        <Sparkles size={18} />
      </div>
      <div className="min-w-0">
        <p className="font-bold">Preparando sua operação</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <LoaderCircle className="animate-spin text-primary" size={13} />
          Carregando dados sincronizados
        </p>
      </div>
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange={false}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Suspense fallback={<AppLoading />}>
            <HashRouter>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
                <Route path="/agente" element={<Protected><Agente /></Protected>} />
                <Route path="/demandas" element={<Protected><Demandas /></Protected>} />
                <Route path="/diaristas" element={<Protected><Diaristas /></Protected>} />
                <Route path="/financeiro" element={<Protected><Financeiro /></Protected>} />
                <Route path="/configuracoes" element={<Protected><Configuracoes /></Protected>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </HashRouter>
          </Suspense>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
