import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { lazy, Suspense } from "react";
import AppLayout from "@/components/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AuthProvider } from "@/hooks/useAuth";

const Diaristas = lazy(() => import("@/pages/Diaristas"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Financeiro = lazy(() => import("@/pages/Financeiro"));
const Demandas = lazy(() => import("@/pages/Demandas"));
const Auth = lazy(() => import("@/pages/Auth"));
const Configuracoes = lazy(() => import("@/pages/Configuracoes"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const Protected = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppLayout>{children}</AppLayout>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange={false}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Suspense fallback={<div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">Carregando...</div>}>
            <HashRouter>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
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
