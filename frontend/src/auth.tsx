import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import React, { createContext, useContext, useEffect, useState } from "react";
import type { Permission } from "./rbac";
import { hasPermission, BusinessEntity } from "./rbac";

const API_BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;
const TOKEN_KEY = "pws_alpha_token";

// SecureStore is unavailable on web; fall back to localStorage
const storage = {
  getItem: async (k: string): Promise<string | null> => {
    if (Platform.OS === "web") return typeof window !== "undefined" ? window.localStorage.getItem(k) : null;
    return SecureStore.getItemAsync(k);
  },
  setItem: async (k: string, v: string) => {
    if (Platform.OS === "web") { if (typeof window !== "undefined") window.localStorage.setItem(k, v); return; }
    return SecureStore.setItemAsync(k, v);
  },
  removeItem: async (k: string) => {
    if (Platform.OS === "web") { if (typeof window !== "undefined") window.localStorage.removeItem(k); return; }
    return SecureStore.deleteItemAsync(k);
  },
};

export const api = axios.create({ baseURL: API_BASE, timeout: 20000 });

api.interceptors.request.use(async (config) => {
  const token = await storage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export type User = {
  id: string;
  email: string;
  name: string;
  role: "super_admin" | "admin" | "principal" | "vice_principal" | "pws_accounts" | "alpha_accounts" | "teacher" | "coach" | "warden" | "staff" | "student" | "player" | "parent";
  role_canonical?: string;
  organization: "PWS" | "ALPHA" | "BOTH";
  department?: string | null;
  is_active?: boolean;
  status?: "active" | "deactivated";
  can_manage?: ("student" | "player" | "teacher" | "coach" | "staff")[];
  coach_permissions?: ("view_players" | "add_players" | "edit_players")[];
  coach_type?: "head" | "assistant" | null;
  role_category?: string;
  assigned_sport?: string | null;
  assigned_centres?: ("Balua" | "Harding Park")[];
  assigned_sports?: ("Cricket" | "Football")[];
  linked_person_ids?: string[];
  permissions?: Record<string, boolean>;
  permissions_rbac?: Partial<Record<Permission, boolean>>;
  effective_permissions?: (Permission | string)[];
};

/** Check RBAC permission for the logged-in user */
export function userHasPermission(
  user: User | null | undefined,
  permission: Permission,
  entity?: BusinessEntity,
): boolean {
  return hasPermission(user, permission, entity);
}

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ must_change_password: boolean; role: string }>;
  loginWithToken: (access_token: string, userData: User) => Promise<void>;
  changePassword: (current_password: string, new_password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({} as AuthCtx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await storage.getItem(TOKEN_KEY);
      if (token) {
        try {
          const { data } = await api.get("/auth/me");
          setUser(data);
        } catch { await storage.removeItem(TOKEN_KEY); }
      }
      setLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post("/auth/login", { email, password });
    await storage.setItem(TOKEN_KEY, data.access_token);
    setUser(data.user);
    return { must_change_password: !!data.must_change_password, role: data.user?.role as string };
  };

  const loginWithToken = async (access_token: string, userData: User) => {
    await storage.setItem(TOKEN_KEY, access_token);
    setUser(userData);
  };

  const changePassword: AuthCtx["changePassword"] = async (current_password, new_password) => {
    await api.post("/auth/password/change", { current_password, new_password });
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {}
  };

  const logout = async () => {
    await storage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  const refresh = async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {}
  };

  return <Ctx.Provider value={{ user, loading, login, loginWithToken, changePassword, logout, refresh }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

export const ROLE_COLORS: Record<string, string> = {
  super_admin: "#7C2D12",
  admin: "#0F172A",
  sports_admin: "#0F172A",
  principal: "#BE185D",
  vice_principal: "#DB2777",
  teacher: "#1E40AF",
  coach: "#EA580C",
  warden: "#7C3AED",
  staff: "#0EA5E9",
  pws_accounts: "#0369A1",
  alpha_accounts: "#0D9488",
  student: "#2563EB",
  player: "#16A34A",
  parent: "#0891B2",
};

export function roleLabel(role: string | undefined | null) {
  return role === "admin" ? "Sports Admin"
       : role === "super_admin" ? "Super Admin"
       : role === "vice_principal" ? "Vice Principal"
       : role ? (role.charAt(0).toUpperCase() + role.slice(1)) : "";
}

export const PRIORITY_COLORS: Record<string, string> = {
  high: "#EF4444",
  medium: "#F59E0B",
  low: "#10B981",
};

export const STATUS_COLORS: Record<string, string> = {
  open: "#64748B",
  assigned: "#64748B",
  in_progress: "#1E40AF",
  blocked: "#EF4444",
  completed: "#10B981",
  cancelled: "#94A3B8",
  delayed: "#EF4444",
  reviewed: "#7C3AED",
};
