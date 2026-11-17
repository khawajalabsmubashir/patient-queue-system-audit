import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { authSnapshot, subscribeAuth, restoreSession, type AuthState } from "@/services/auth";
const Context = createContext<(AuthState & { retry: () => void }) | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribeAuth, authSnapshot, authSnapshot);
  useEffect(() => {
    let lastCheckedAt = 0;
    const restore = () => {
      lastCheckedAt = Date.now();
      void restoreSession();
    };
    const restoreOnFocus = () => {
      if (Date.now() - lastCheckedAt < 60_000) return;
      restore();
    };
    restore();
    window.addEventListener("queuecare:session-expired", restore);
    window.addEventListener("focus", restoreOnFocus);
    return () => {
      window.removeEventListener("queuecare:session-expired", restore);
      window.removeEventListener("focus", restoreOnFocus);
    };
  }, []);
  return (
    <Context.Provider
      value={{
        ...state,
        retry: () => {
          void restoreSession();
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const state = useContext(Context);
  if (!state) throw new Error("AuthProvider is required.");
  return state;
}
