import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading, signOut } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const location = useLocation();

  if (loading || (session && profileLoading)) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  if (profile && !profile.active) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div className="max-w-sm space-y-3">
          <h1 className="text-xl font-semibold text-foreground">Acesso bloqueado</h1>
          <p className="text-sm text-muted-foreground">Procure o administrador do sistema para reativar sua conta.</p>
          <Button variant="outline" onClick={() => void signOut()}>Sair da conta</Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
