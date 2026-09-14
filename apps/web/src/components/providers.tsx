"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
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
  location: { lat: 12.9352, lng: 77.6245, name: "Koramangala, Bengaluru" },
  setLocation: () => {},
});
export const useLocation = () => useContext(LocationContext);
function Session({ children }: { children: ReactNode }) {
  const cache = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: ["me"],
    queryFn: () => api<PublicUser>("/users/me"),
    retry: false,
    staleTime: 5 * 60000,
  });
  const [toast, setToast] = useState("");
  const [location, setLocation] = useState({
    lat: 12.9352,
    lng: 77.6245,
    name: "Koramangala, Bengaluru",
  });
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
          cache.clear();
          cache.setQueryData(["me"], result.user);
        },
        logout: async () => {
          await api("/auth/logout", { method: "POST" });
          setAccessToken();
          cache.clear();
          cache.setQueryData(["me"], null);
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
