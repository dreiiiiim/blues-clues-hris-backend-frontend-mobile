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
const IS_APPLICANT_KEY = "is_applicant"; // "true" | "false"

// In-memory store for non-persistent (rememberMe: false) sessions.
const memoryStore: {
  accessToken?: string;
  refreshToken?: string;
  isApplicant?: boolean;
} = {};

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
    case "HR Officer":
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

function cookieStr(name: string, value: string): string {
  return `${name}=${value}`;
}

function getRefreshEndpoint(isApplicant: boolean): string {
  return isApplicant
    ? `${API_BASE_URL}/applicants/refresh`
    : `${API_BASE_URL}/refresh`;
}

function getLogoutEndpoint(isApplicant: boolean): string {
  return isApplicant
    ? `${API_BASE_URL}/applicants/logout`
    : `${API_BASE_URL}/logout`;
}

function getCookieName(isApplicant: boolean): string {
  return isApplicant ? "applicant_refresh_token" : "refresh_token";
}

async function getRefreshInfo(): Promise<{
  refreshToken: string | null;
  isApplicant: boolean;
  isPersistent: boolean;
}> {
  const persistedAccess = await AsyncStorage.getItem(ACCESS_KEY);
  const persistedRefresh = await AsyncStorage.getItem(REFRESH_KEY);
  const persistedIsApplicant = await AsyncStorage.getItem(IS_APPLICANT_KEY);

  const isPersistent = !!persistedAccess;
  const refreshToken = persistedRefresh ?? memoryStore.refreshToken ?? null;
  const isApplicant =
    persistedIsApplicant === "true" || (memoryStore.isApplicant ?? false);

  return { refreshToken, isApplicant, isPersistent };
}

// ─── Staff Login ──────────────────────────────────────────────────────────────

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

    const access_token: string = data.access_token;
    const refresh_token: string | undefined = data.refresh_token;

    if (!access_token) {
      return { ok: false as const, error: "Invalid response from server." };
    }

    const payload = parseJwt(access_token);
    if (!payload) return { ok: false as const, error: "Invalid token received." };

    const role = roleNameToKey(payload.role_name);
    if (!role) return { ok: false as const, error: `Unknown role: ${payload.role_name}` };

    const name = [payload.first_name, payload.last_name].filter(Boolean).join(" ") || identifier;

    if (rememberMe) {
      await AsyncStorage.setItem(ACCESS_KEY, access_token);
      if (refresh_token) await AsyncStorage.setItem(REFRESH_KEY, refresh_token);
      await AsyncStorage.setItem(IS_APPLICANT_KEY, "false");
    } else {
      memoryStore.accessToken = access_token;
      memoryStore.refreshToken = refresh_token;
      memoryStore.isApplicant = false;
    }

    return { ok: true as const, user: { role, name, email: payload.email ?? "" } as UserSession };
  } catch {
    return { ok: false as const, error: "Network error. Check your connection." };
  }
}

// ─── Applicant Login ──────────────────────────────────────────────────────────

export async function applicantLogin(
  email: string,
  password: string,
  rememberMe: boolean,
): Promise<{ ok: true; user: UserSession } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/applicants/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { ok: false as const, error: data?.message || "Invalid email or password." };
    }

    const access_token: string = data.access_token;
    const refresh_token: string | undefined = data.refresh_token;

    if (!access_token) {
      return { ok: false as const, error: "Invalid response from server." };
    }

    const payload = parseJwt(access_token);
    if (!payload) return { ok: false as const, error: "Invalid token received." };

    const name =
      [payload.first_name, payload.last_name].filter(Boolean).join(" ") || email;

    if (rememberMe) {
      await AsyncStorage.setItem(ACCESS_KEY, access_token);
      if (refresh_token) await AsyncStorage.setItem(REFRESH_KEY, refresh_token);
      await AsyncStorage.setItem(IS_APPLICANT_KEY, "true");
    } else {
      memoryStore.accessToken = access_token;
      memoryStore.refreshToken = refresh_token;
      memoryStore.isApplicant = true;
    }

    return {
      ok: true as const,
      user: {
        role: "applicant" as UserRole,
        name,
        email: payload.email ?? email,
      } as UserSession,
    };
  } catch {
    return { ok: false as const, error: "Network error. Check your connection." };
  }
}

// Kept for API compatibility with AppNavigator.
export async function saveSession(_session: UserSession, _persist: boolean): Promise<void> {}

// ─── Session Restore ──────────────────────────────────────────────────────────

export async function getSession(): Promise<UserSession | null> {
  try {
    const persistedAccess = await AsyncStorage.getItem(ACCESS_KEY);
    const accessToken = persistedAccess ?? memoryStore.accessToken ?? null;

    if (!accessToken) return null;

    const payload = parseJwt(accessToken);
    if (!payload) return null;

    if (payload.exp && Date.now() / 1000 > payload.exp) {
      const { refreshToken, isApplicant, isPersistent } = await getRefreshInfo();
      if (!refreshToken) return null;

      const res = await fetch(getRefreshEndpoint(isApplicant), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieStr(getCookieName(isApplicant), refreshToken),
        },
      });

      if (!res.ok) {
        await clearSession();
        return null;
      }

      const data = await res.json().catch(() => ({}));
      if (!data?.access_token) return null;

      const newPayload = parseJwt(data.access_token);
      if (!newPayload) return null;

      if (isPersistent) {
        await AsyncStorage.setItem(ACCESS_KEY, data.access_token);
        if (data.refresh_token) await AsyncStorage.setItem(REFRESH_KEY, data.refresh_token);
      } else {
        memoryStore.accessToken = data.access_token;
        if (data.refresh_token) memoryStore.refreshToken = data.refresh_token;
      }

      const role = isApplicant
        ? ("applicant" as UserRole)
        : (roleNameToKey(newPayload.role_name) ?? null);
      if (!role) return null;

      const name = [newPayload.first_name, newPayload.last_name]
        .filter(Boolean)
        .join(" ");
      return { role, name, email: newPayload.email ?? "" };
    }

    const persistedIsApplicant = await AsyncStorage.getItem(IS_APPLICANT_KEY);
    const isApplicant =
      persistedIsApplicant === "true" || (memoryStore.isApplicant ?? false);

    const role = isApplicant
      ? ("applicant" as UserRole)
      : (roleNameToKey(payload.role_name) ?? null);
    if (!role) return null;

    const name = [payload.first_name, payload.last_name].filter(Boolean).join(" ");
    return { role, name, email: payload.email ?? "" };
  } catch {
    return null;
  }
}

// ─── Authenticated Fetch ──────────────────────────────────────────────────────

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
    const { refreshToken, isApplicant } = await getRefreshInfo();

    if (!refreshToken) {
      await clearSession();
      throw new Error("Session expired");
    }

    const refreshRes = await fetch(getRefreshEndpoint(isApplicant), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieStr(getCookieName(isApplicant), refreshToken),
      },
    });

    if (!refreshRes.ok) {
      await clearSession();
      throw new Error("Session expired");
    }

    const data = await refreshRes.json().catch(() => ({}));
    if (!data?.access_token) {
      await clearSession();
      throw new Error("Session expired");
    }

    if (isPersistent) {
      await AsyncStorage.setItem(ACCESS_KEY, data.access_token);
      if (data.refresh_token) await AsyncStorage.setItem(REFRESH_KEY, data.refresh_token);
    } else {
      memoryStore.accessToken = data.access_token;
      if (data.refresh_token) memoryStore.refreshToken = data.refresh_token;
    }

    res = await makeRequest(data.access_token);
  }

  return res;
}

// ─── Applicant Registration ───────────────────────────────────────────────────

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

// ─── Clear Session ────────────────────────────────────────────────────────────

export async function clearSession(): Promise<void> {
  try {
    const { refreshToken, isApplicant } = await getRefreshInfo();
    const persistedAccess = await AsyncStorage.getItem(ACCESS_KEY);
    const accessToken = persistedAccess ?? memoryStore.accessToken;

    if (refreshToken) {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Cookie: cookieStr(getCookieName(isApplicant), refreshToken),
      };
      if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

      await fetch(getLogoutEndpoint(isApplicant), {
        method: "POST",
        headers,
      }).catch(() => {});
    }

    await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY, IS_APPLICANT_KEY]);
    memoryStore.accessToken = undefined;
    memoryStore.refreshToken = undefined;
    memoryStore.isApplicant = undefined;
  } catch {}
}
