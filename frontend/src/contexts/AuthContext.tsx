import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { identity } from "../api/client";

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isAdmin: boolean;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getToken(): string | null {
  return localStorage.getItem("token");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUserState(null);
      setLoading(false);
      return;
    }
    try {
      const me = await identity.me();
      setUserState({ id: me.id, email: me.email, roles: me.roles ?? [] });
    } catch {
      setUserState(null);
      localStorage.removeItem("token");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onUnauthorized = () => setUserState(null);
    window.addEventListener("auth:unauthorized", onUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", onUnauthorized);
  }, []);

  const setUser = useCallback((u: AuthUser | null) => {
    setUserState(u);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setUserState(null);
  }, []);

  const isAdmin = (user?.roles ?? []).includes("admin");

  return (
    <AuthContext.Provider
      value={{ user, loading, isAdmin, setUser, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
