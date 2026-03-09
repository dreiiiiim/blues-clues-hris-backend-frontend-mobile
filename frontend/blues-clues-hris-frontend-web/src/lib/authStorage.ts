// src/lib/authStorage.ts
export const USER_KEY = "user_info";

export interface StoredUser {
  name: string;
  email: string;
  role: string;
}

// Access token lives ONLY in memory — never written to sessionStorage or localStorage.
// It is re-fetched via the HttpOnly refresh_token cookie whenever the page reloads.
let _accessToken: string | null = null;
let _rememberMe = false; // track preference for user_info persistence

export function setTokens(params: { access_token: string; rememberMe: boolean }) {
  _accessToken = params.access_token;
  _rememberMe = params.rememberMe;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

export function writeAccessToken(access_token: string) {
  _accessToken = access_token;
}

export function clearAuthStorage() {
  _accessToken = null;
  _rememberMe = false;
  if (typeof window === "undefined") return;
  // Clean up any legacy tokens that may have been stored in old versions
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem("access_token");
  sessionStorage.removeItem("refresh_token");
  sessionStorage.removeItem(USER_KEY);
}

export function saveUserInfo(info: StoredUser) {
  if (typeof window === "undefined") return;
  const storage = _rememberMe ? localStorage : sessionStorage;
  storage.setItem(USER_KEY, JSON.stringify(info));
}

export function getUserInfo(): StoredUser | null {
  if (typeof window === "undefined") return null;
  const data = sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data) as StoredUser;
  } catch {
    return null;
  }
}

export function parseJwt(token: string) {
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
