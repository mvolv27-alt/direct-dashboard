import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "admin" | "supervisor";

export type CurrentProfile = {
  id: string;
  nome: string | null;
  email: string;
  role: UserRole;
  active: boolean;
};

const ADMIN_EMAIL = "mvolv27@gmail.com";

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<CurrentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("id,nome,email,role,active")
      .eq("id", user.id)
      .maybeSingle();
    setProfile((data as CurrentProfile | null) || null);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void refresh();
    if (!user?.id) return;
    // React can remount this hook before Supabase has finished removing the
    // previous channel. A unique name prevents callbacks being added to an
    // already subscribed channel.
    const channelName = `profile:${user.id}:${crypto.randomUUID()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh, user?.id]);

  const isAdmin =
    profile?.role === "admin" || user?.email?.toLowerCase() === ADMIN_EMAIL;

  return { profile, loading, isAdmin, refresh };
}
