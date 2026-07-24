import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

export default function Auth() {
  const navigate = useNavigate();
  const { session, loading: authLoading, signInLocal } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && session) navigate("/", { replace: true });
  }, [authLoading, session, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (signInLocal(email, password)) {
          toast.warning("Acesso local liberado. Esse modo nao sincroniza com outros dispositivos.");
          navigate("/", { replace: true });
          return;
        }
        throw error;
      }
      toast.success("Bem-vindo de volta!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao autenticar";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-muted/35 p-4">
      <div className="surface-panel w-full max-w-md p-6 sm:p-8 animate-in-up">
        <div className="flex items-center gap-3 mb-2">
          <div className="aurora-icon gradient-primary flex h-10 w-10 items-center justify-center text-primary-foreground shadow-sm">
            <Sparkles size={20} />
          </div>
          <h1 className="text-xl font-extrabold text-foreground">
            <span className="text-gradient">Direct</span> Promoções
          </h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Entre com uma conta convidada pelo administrador
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="animate-spin mr-2" size={16} />}
            Entrar
          </Button>
        </form>
      </div>
    </div>
  );
}
