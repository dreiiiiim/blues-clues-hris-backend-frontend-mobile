import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../lib/api";

export type UserRole = "hr" | "manager" | "employee" | "applicant" | "system_admin" | "admin";

export interface UserSession {
  email: string;
  name: string;
  role: UserRole;
}

const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";

// In-memory store for non-persistent (rememberMe: false) sessions.
// These are cleared when the JS runtime is torn down (app process killed).
const memoryStore: { accessToken?: string; refreshToken?: string } = {};

function parseJwt(token: string): any | null {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function roleNameToKey(roleName?: string): UserRole | null {
  switch (roleName) {
    case "HR Manager":
    case "HR Recruiter":
    case "HR Interviewer":
      return "hr";
    case "Active Employee":
      return "employee";
    case "Applicant":
      return "applicant";
    case "System Admin":
      return "system_admin";
    case "Admin":
      return "admin";
    default:
      if (roleName?.toLowerCase().includes("manager")) return "manager";
      return null;
  }
}

export async function login(identifier: string, password: string, rememberMe: boolean) {
  try {
    const res = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password, rememberMe }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { ok: false as const, error: data?.message || "Invalid credentials." };
    }

    const { access_token, refresh_token } = data as { access_token: string; refresh_token: string };

    const payload = parseJwt(access_token);
    if (!payload) return { ok: false as const, error: "Invalid token received." };

    const role = roleNameToKey(payload.role_name);
    if (!role) return { ok: false as const, error: `Unknown role: ${payload.role_name}` };

    const name = [payload.first_name, payload.last_name].filter(Boolean).join(" ") || identifier;

    if (rememberMe) {
      await AsyncStorage.setItem(ACCESS_KEY, access_token);
      await AsyncStorage.setItem(REFRESH_KEY, refresh_token);
    } else {
      // Use in-memory store — not persisted across app process restarts
      memoryStore.accessToken = access_token;
      memoryStore.refreshToken = refresh_token;
    }

    return { ok: true as const, user: { role, name, email: payload.email ?? "" } as UserSession };
  } catch {
    return { ok: false as const, error: "Network error. Check your connection." };
  }
}

// Tokens are already saved in login(); this is kept for API compatibility with AppNavigator.
export async function saveSession(_session: UserSession, _persist: boolean): Promise<void> {}

export async function getSession(): Promise<UserSession | null> {
  try {
    const persistedAccess = await AsyncStorage.getItem(ACCESS_KEY);
    const isPersistent = !!persistedAccess;
    const accessToken = persistedAccess ?? memoryStore.accessToken ?? null;

    if (!accessToken) return null;

    const payload = parseJwt(accessToken);
    if (!payload) return null;

    if (payload.exp && Date.now() / 1000 > payload.exp) {
      const persistedRefresh = await AsyncStorage.getItem(REFRESH_KEY);
      const refreshToken = persistedRefresh ?? memoryStore.refreshToken ?? null;

      if (!refreshToken) return null;

      const res = await fetch(`${API_BASE_URL}/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) { await clearSession(); return null; }

      const data = await res.json().catch(() => ({}));
      if (!data?.access_token) return null;

      if (isPersistent) {
        await AsyncStorage.setItem(ACCESS_KEY, data.access_token);
      } else {
        memoryStore.accessToken = data.access_token;
      }

      const newPayload = parseJwt(data.access_token);
      if (!newPayload) return null;

      const role = roleNameToKey(newPayload.role_name);
      if (!role) return null;

      const name = [newPayload.first_name, newPayload.last_name].filter(Boolean).join(" ");
      return { role, name, email: "" };
    }

    const role = roleNameToKey(payload.role_name);
    if (!role) return null;

    const name = [payload.first_name, payload.last_name].filter(Boolean).join(" ");
    return { role, name, email: "" };
  } catch {
    return null;
  }
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const persistedAccess = await AsyncStorage.getItem(ACCESS_KEY);
  const isPersistent = !!persistedAccess;
  let accessToken = persistedAccess ?? memoryStore.accessToken ?? null;

  if (!accessToken) throw new Error("Not authenticated");

  const makeRequest = (token: string) =>
    fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string> | undefined),
        Authorization: `Bearer ${token}`,
      },
    });

  let res = await makeRequest(accessToken);

  if (res.status === 401) {
    const persistedRefresh = await AsyncStorage.getItem(REFRESH_KEY);
    const refreshToken = persistedRefresh ?? memoryStore.refreshToken ?? null;

    if (!refreshToken) { await clearSession(); throw new Error("Session expired"); }

    const refreshRes = await fetch(`${API_BASE_URL}/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!refreshRes.ok) { await clearSession(); throw new Error("Session expired"); }

    const data = await refreshRes.json().catch(() => ({}));
    if (!data?.access_token) { await clearSession(); throw new Error("Session expired"); }

    if (isPersistent) {
      await AsyncStorage.setItem(ACCESS_KEY, data.access_token);
    } else {
      memoryStore.accessToken = data.access_token;
    }

    res = await makeRequest(data.access_token);
  }

  return res;
}

export async function applicantRegister(
  fullName: string,
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parts = fullName.trim().split(/\s+/);
    const firstName = parts[0] ?? "";
    const lastName = parts.slice(1).join(" ");
    const res = await fetch(`${API_BASE_URL}/applicants/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ first_name: firstName, last_name: lastName, email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data?.message || "Registration failed." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error. Check your connection." };
  }
}

export async function clearSession(): Promise<void> {
  try {
    const persistedRefresh = await AsyncStorage.getItem(REFRESH_KEY);
    const refreshToken = persistedRefresh ?? memoryStore.refreshToken ?? null;

    if (refreshToken) {
      await fetch(`${API_BASE_URL}/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }).catch(() => {});
    }

    await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY]);
    memoryStore.accessToken = undefined;
    memoryStore.refreshToken = undefined;
  } catch {}
}
