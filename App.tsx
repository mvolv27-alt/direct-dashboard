import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import AppLayout from "@/components/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AuthProvider } from "@/hooks/useAuth";
import Diaristas from "@/pages/Diaristas";
import Financeiro from "@/pages/Financeiro";
import Demandas from "@/pages/Demandas";
import Auth from "@/pages/Auth";
import Configuracoes from "@/pages/Configuracoes";
import NotFound from "./pages/NotFound";

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
          <HashRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<Navigate to="/demandas" replace />} />
              <Route path="/demandas" element={<Protected><Demandas /></Protected>} />
              <Route path="/diaristas" element={<Protected><Diaristas /></Protected>} />
              <Route path="/financeiro" element={<Protected><Financeiro /></Protected>} />
              <Route path="/configuracoes" element={<Protected><Configuracoes /></Protected>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </HashRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
