// src/lib/authApi.ts
import { API_BASE_URL } from "./api";
import {
  getAccessToken,
  getRefreshToken,
  writeAccessToken,
  clearAuthStorage,
} from "./authStorage";

let refreshPromise: Promise<any> | null = null;

export async function loginApi(body: {
  identifier: string;
  password: string;
  rememberMe: boolean;
}) {
  const res = await fetch(`${API_BASE_URL}/login`, { //api base url basically ung url sa api.ts 
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(data?.message || "Login failed");

  return data as { access_token: string; refresh_token: string };
}

export async function refreshApi() {
  const refresh_token = getRefreshToken();
  if (!refresh_token) throw new Error("No refresh token");

  const res = await fetch(`${API_BASE_URL}/refresh`, {//call refresh sa auth.service.ts
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Refresh failed");

  if (!data?.access_token) throw new Error("Missing access_token");
  writeAccessToken(data.access_token);

  return data as { access_token: string };
}

export async function logoutApi() {
  const refresh_token = getRefreshToken();

  // best-effort logout
  if (refresh_token) {
    await fetch(`${API_BASE_URL}/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token }),
    }).catch(() => {});
  }

  clearAuthStorage();
}

export async function authFetch(input: RequestInfo, init: RequestInit = {}) {
  const access = getAccessToken();

  // 1) try request with access token
  const first = await fetch(input, {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
    },
  });

  // if not unauthorized, return
  if (first.status !== 401) return first;

  // 2) try refresh then retry (shared promise prevents concurrent refresh race)
  try {
    if (!refreshPromise) {
      refreshPromise = refreshApi().finally(() => { refreshPromise = null; });
    }
    const { access_token } = await refreshPromise;

    const second = await fetch(input, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${access_token}`,
      },
    });

    return second;
  } catch {
    // refresh failed: clear and return original 401
    clearAuthStorage();
    return first;
  }
}