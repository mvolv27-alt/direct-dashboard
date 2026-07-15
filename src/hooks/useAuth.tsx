import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { setActiveUserScope } from "@/lib/userScope";

const LOCAL_ACCESS_KEY = "direct.local.access";
const LOCAL_ACCESS_ENABLED =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_LOCAL_ACCESS === "true";
const LOCAL_ACCESS_EMAIL = import.meta.env.VITE_LOCAL_ACCESS_EMAIL ?? "";
const LOCAL_ACCESS_PASSWORD = import.meta.env.VITE_LOCAL_ACCESS_PASSWORD ?? "";

type LocalSession = {
  isLocalAccess: true;
  user: {
    id: string;
    email: string;
  };
};

type AppSession = Session | LocalSession;
type AppUser = User | LocalSession["user"];

type AuthCtx = {
  user: AppUser | null;
  session: AppSession | null;
  loading: boolean;
  isLocalAccess: boolean;
  signInLocal: (email: string, password: string) => boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  loading: true,
  isLocalAccess: false,
  signInLocal: () => false,
  signOut: async () => {},
});

function createLocalSession(): LocalSession {
  return {
    isLocalAccess: true,
    user: {
      id: "local-mvolv27",
      email: LOCAL_ACCESS_EMAIL || "local@direct.invalid",
    },
  };
}

function isLocalSession(session: AppSession | null): session is LocalSession {
  return !!session && "isLocalAccess" in session;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AppSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setActiveUserScope(s?.user.id, s?.user.email);
      if (s) {
        localStorage.removeItem(LOCAL_ACCESS_KEY);
      } else if (LOCAL_ACCESS_ENABLED && localStorage.getItem(LOCAL_ACCESS_KEY) === "true") {
        const localSession = createLocalSession();
        setActiveUserScope(localSession.user.id, localSession.user.email);
        setSession(localSession);
        setLoading(false);
        return;
      }
      setSession(s);
      setLoading(false);
    });
    if (!LOCAL_ACCESS_ENABLED) {
      localStorage.removeItem(LOCAL_ACCESS_KEY);
    }
    supabase.auth.getSession().then(({ data }) => {
      setActiveUserScope(data.session?.user.id, data.session?.user.email);
      if (data.session) {
        localStorage.removeItem(LOCAL_ACCESS_KEY);
        setSession(data.session);
      } else if (LOCAL_ACCESS_ENABLED && localStorage.getItem(LOCAL_ACCESS_KEY) === "true") {
        const localSession = createLocalSession();
        setActiveUserScope(localSession.user.id, localSession.user.email);
        setSession(localSession);
      } else {
        setSession(null);
      }
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  function signInLocal(email: string, password: string) {
    if (!LOCAL_ACCESS_ENABLED || !LOCAL_ACCESS_EMAIL || !LOCAL_ACCESS_PASSWORD) return false;
    const isAllowed =
      email.trim().toLowerCase() === LOCAL_ACCESS_EMAIL &&
      password === LOCAL_ACCESS_PASSWORD;
    if (!isAllowed) return false;
    localStorage.setItem(LOCAL_ACCESS_KEY, "true");
    const localSession = createLocalSession();
    setActiveUserScope(localSession.user.id, localSession.user.email);
    setSession(localSession);
    return true;
  }

  async function signOut() {
    localStorage.removeItem(LOCAL_ACCESS_KEY);
    setActiveUserScope(null);
    setSession(null);
    await supabase.auth.signOut();
  }

  return (
    <Ctx.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        isLocalAccess: isLocalSession(session),
        signInLocal,
        signOut,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
