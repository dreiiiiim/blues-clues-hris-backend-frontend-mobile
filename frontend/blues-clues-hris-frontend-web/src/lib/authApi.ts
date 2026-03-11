// src/lib/authApi.ts
import { API_BASE_URL } from "./api";
import {
  getAccessToken,
  writeAccessToken,
  clearAuthStorage,
} from "./authStorage";

let refreshPromise: Promise<any> | null = null;

export async function loginApi(body: {
  identifier: string;
  password: string;
  rememberMe: boolean;
}) {
  const res = await fetch(`${API_BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // receive the HttpOnly refresh_token cookie
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(data?.message || "Login failed");

  return data as { access_token: string };
}

// TODO (Sprint 2 - Backend): implement Google OAuth endpoint
// Expected endpoint: POST /api/tribeX/auth/v1/auth/google
//
// Request payload:
// { token: string } — Google ID token from @react-oauth/google credentialResponse.credential
//
// Expected response (same shape as loginApi):
// { access_token: string }
//
// Backend should:
// 1. Verify the Google token via Google's tokeninfo API or googleapis SDK
// 2. Find or create the user record matched by Google email
// 3. Ensure the user has an active staff role (reject applicants)
// 4. Return access_token same as regular login (refresh_token via HttpOnly cookie)
export async function googleLoginApi(googleToken: string) {
  const res = await fetch(`${API_BASE_URL}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ token: googleToken }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Google login failed");
  return data as { access_token: string };
}

export async function refreshApi() {
  const res = await fetch(`${API_BASE_URL}/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // sends the HttpOnly refresh_token cookie automatically
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Refresh failed");

  if (!data?.access_token) throw new Error("Missing access_token");
  writeAccessToken(data.access_token);

  return data as { access_token: string };
}

export async function logoutApi() {
  const access_token = getAccessToken();

  await fetch(`${API_BASE_URL}/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(access_token ? { Authorization: `Bearer ${access_token}` } : {}),
    },
    credentials: "include", // sends the HttpOnly refresh_token cookie for server to blacklist
  }).catch(() => {});

  clearAuthStorage();
}

export async function authFetch(input: RequestInfo, init: RequestInit = {}) {
  const access = getAccessToken();

  // 1) try request with access token
  // credentials: "include" ensures the HttpOnly refresh cookie is forwarded
  const first = await fetch(input, {
    ...init,
    credentials: "include",
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
      credentials: "include",
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${access_token}`,
      },
    });

    return second;
  } catch {
    // refresh failed: session is fully expired — clear storage and send to login
    clearAuthStorage();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return first;
  }
}
