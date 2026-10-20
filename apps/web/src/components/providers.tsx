"use client";
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api, setAccessToken } from "@/lib/api";
import type { PublicUser } from "../../../../packages/shared/src";
const AuthContext = createContext<{
  user: PublicUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
});
export const useAuth = () => useContext(AuthContext);
const ToastContext = createContext<(message: string) => void>(() => {});
export const useToast = () => useContext(ToastContext);
const LocationContext = createContext<{
  location: { lat: number; lng: number; name: string };
  setLocation: (v: { lat: number; lng: number; name: string }) => void;
}>({
  location: { lat: 13.0418, lng: 80.2341, name: "T. Nagar, Chennai" },
  setLocation: () => {},
});
export const useLocation = () => useContext(LocationContext);
function Session({ children }: { children: ReactNode }) {
  const cache = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await api<PublicUser>("/users/me");
      } catch {
        return null;
      }
    },
    retry: false,
    staleTime: 5 * 60000,
  });
  const [toast, setToast] = useState("");
  const [location, setLocationState] = useState({
    lat: 13.0418,
    lng: 80.2341,
    name: "T. Nagar, Chennai",
  });
  const setLocation = (v: { lat: number; lng: number; name: string }) => {
    setLocationState(v);
    try {
      localStorage.setItem("aroundly_location", JSON.stringify(v));
    } catch {
      // Ignore localStorage write errors
    }
  };
  useEffect(() => {
    try {
      const saved = localStorage.getItem("aroundly_location");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.lat === "number" && typeof parsed.lng === "number" && parsed.name) {
          setLocationState(parsed);
        }
      }
    } catch {
      // Ignore localStorage read or JSON parse errors
    }
  }, []);
  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 4500);
  };
  return (
    <AuthContext.Provider
      value={{
        user: data || null,
        loading: isPending,
        login: async (email, password) => {
          const result = await api<{ user: PublicUser; accessToken: string }>(
            "/auth/login",
            { method: "POST", body: { email, password } },
          );
          setAccessToken(result.accessToken);
          await cache.cancelQueries();
          cache.setQueryData(["me"], result.user);
          await cache.resetQueries({
            predicate: (query) => query.queryKey[0] !== "me",
          });
        },
        logout: async () => {
          try {
            await api("/auth/logout", { method: "POST" });
          } catch {
            // Ensure local logout completes even if network is unreachable
          }
          setAccessToken();
          await cache.cancelQueries();
          cache.setQueryData(["me"], null);
          cache.removeQueries({
            predicate: (query) => query.queryKey[0] !== "me",
          });
        },
      }}
    >
      <LocationContext.Provider value={{ location, setLocation }}>
        <ToastContext.Provider value={showToast}>
          {children}
          {toast && (
            <div className="toast" role="status">
              {toast}
            </div>
          )}
        </ToastContext.Provider>
      </LocationContext.Provider>
    </AuthContext.Provider>
  );
}
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <Session>{children}</Session>
    </QueryClientProvider>
  );
}
