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
      await AsyncStorage.setItem(`${ACCESS_KEY}_temp`, access_token);
      await AsyncStorage.setItem(`${REFRESH_KEY}_temp`, refresh_token);
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
    const isPersistent = !!(await AsyncStorage.getItem(ACCESS_KEY));
    const accessToken =
      (await AsyncStorage.getItem(ACCESS_KEY)) ??
      (await AsyncStorage.getItem(`${ACCESS_KEY}_temp`));

    if (!accessToken) return null;

    const payload = parseJwt(accessToken);
    if (!payload) return null;

    if (payload.exp && Date.now() / 1000 > payload.exp) {
      const refreshToken =
        (await AsyncStorage.getItem(REFRESH_KEY)) ??
        (await AsyncStorage.getItem(`${REFRESH_KEY}_temp`));

      if (!refreshToken) return null;

      const res = await fetch(`${API_BASE_URL}/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) { await clearSession(); return null; }

      const data = await res.json().catch(() => ({}));
      if (!data?.access_token) return null;

      const slot = isPersistent ? ACCESS_KEY : `${ACCESS_KEY}_temp`;
      await AsyncStorage.setItem(slot, data.access_token);

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

export async function clearSession(): Promise<void> {
  try {
    const refreshToken =
      (await AsyncStorage.getItem(REFRESH_KEY)) ??
      (await AsyncStorage.getItem(`${REFRESH_KEY}_temp`));

    if (refreshToken) {
      await fetch(`${API_BASE_URL}/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }).catch(() => {});
    }

    await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY, `${ACCESS_KEY}_temp`, `${REFRESH_KEY}_temp`]);
  } catch {}
}
