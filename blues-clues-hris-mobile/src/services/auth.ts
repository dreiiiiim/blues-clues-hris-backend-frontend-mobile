import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../lib/api";

export type UserRole = "hr" | "manager" | "employee" | "applicant" | "system_admin" | "admin";

export interface UserSession {
  email: string;
  name: string;
  role: UserRole;
  userId: string;
  activePortal?: string;
  availablePortals?: string[];
  roleSwitchOptions?: RoleSwitchOption[];
}

export type RoleSwitchOption = {
  role_id: string;
  role_name: string;
  portal_key: string;
};

export type LoginResponse = {
  ok: true;
  user: UserSession;
  role_switch_options?: RoleSwitchOption[];
  available_portals?: string[];
  requires_portal_selection?: boolean;
} | {
  ok: false;
  error: string;
};

const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";
const IS_APPLICANT_KEY = "is_applicant"; // "true" | "false"
const SESSION_KEY = "session_payload";

// In-memory store for non-persistent (rememberMe: false) sessions.
const memoryStore: {
  accessToken?: string;
  refreshToken?: string;
  isApplicant?: boolean;
  session?: UserSession;
} = {};

function parseJwt(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replaceAll("-", "+").replaceAll("_", "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + (c.codePointAt(0) ?? 0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function roleNameToKey(roleName?: string): UserRole | null {
  if (!roleName) return null;
  const r = roleName.toLowerCase();

  if (r.includes("system admin") || r === "admin") {
    return roleName === "Admin" ? "admin" : "system_admin";
  }
  if (r.includes("hr") || r === "recruiter" || r === "interviewer") return "hr";
  if (r.includes("manager") || r === "group head") return "manager";
  if (r.includes("employee")) return "employee";
  if (r === "applicant") return "applicant";

  return null;
}

function cookieStr(name: string, value: string): string {
  return `${name}=${value}`;
}

function serializeSession(session: UserSession): string {
  return JSON.stringify(session);
}

function parseSession(value: string | null): UserSession | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<UserSession>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      email: String(parsed.email ?? ""),
      name: String(parsed.name ?? ""),
      role: parsed.role as UserRole,
      userId: String(parsed.userId ?? ""),
      activePortal: typeof parsed.activePortal === "string" ? parsed.activePortal : undefined,
      availablePortals: Array.isArray(parsed.availablePortals) ? parsed.availablePortals.filter((p): p is string => typeof p === "string") : undefined,
      roleSwitchOptions: Array.isArray(parsed.roleSwitchOptions)
        ? parsed.roleSwitchOptions.filter(
            (opt): opt is RoleSwitchOption =>
              !!opt &&
              typeof opt === "object" &&
              typeof opt.role_id === "string" &&
              typeof opt.role_name === "string" &&
              typeof opt.portal_key === "string",
          )
        : undefined,
    };
  } catch {
    return null;
  }
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

function readRefreshTokenFromSetCookie(
  response: Response,
  isApplicant: boolean,
): string | undefined {
  const cookieHeader =
    response.headers.get("set-cookie") ?? response.headers.get("Set-Cookie");
  if (!cookieHeader) return undefined;

  const cookieName = getCookieName(isApplicant);
  const match = cookieHeader.match(new RegExp(`${cookieName}=([^;]+)`));
  return match?.[1];
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password, rememberMe }),
        signal: controller.signal,
      });
    } catch (e: any) {
      if (e?.name === "AbortError") {
        return { ok: false as const, error: "Request timed out. The server may be starting up — please try again." };
      }
      throw e;
    } finally {
      clearTimeout(timeout);
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { ok: false as const, error: data?.message || "Invalid credentials." };
    }

    const access_token: string = data.access_token;
    const refresh_token: string | undefined =
      data.refresh_token ?? readRefreshTokenFromSetCookie(res, false);

    if (!access_token) {
      return { ok: false as const, error: "Invalid response from server." };
    }

    const payload = parseJwt(access_token);
    if (!payload) return { ok: false as const, error: "Invalid token received." };

    const role = roleNameToKey(String(payload.role_name ?? ""));
    if (!role) return { ok: false as const, error: `Unknown role: ${String(payload.role_name ?? "")}` };

    const name = [payload.first_name, payload.last_name].filter(Boolean).join(" ") || identifier;
    const userId = String(payload.sub_userid ?? payload.user_id ?? payload.id ?? "");

    if (rememberMe) {
      await AsyncStorage.setItem(ACCESS_KEY, access_token);
      if (refresh_token) await AsyncStorage.setItem(REFRESH_KEY, refresh_token);
      await AsyncStorage.setItem(IS_APPLICANT_KEY, "false");
    } else {
      memoryStore.accessToken = access_token;
      memoryStore.refreshToken = refresh_token;
      memoryStore.isApplicant = false;
    }

    const payloadAvailablePortals = Array.isArray(payload.available_portals)
      ? (payload.available_portals as string[])
      : undefined;
    const payloadRoleSwitchOptions = Array.isArray(payload.role_switch_options)
      ? (payload.role_switch_options as RoleSwitchOption[])
      : undefined;
    const responseAvailablePortals = Array.isArray(data.available_portals)
      ? (data.available_portals as string[])
      : undefined;
    const responseRoleSwitchOptions = Array.isArray(data.role_switch_options)
      ? (data.role_switch_options as RoleSwitchOption[])
      : undefined;
    const role_switch_options = payloadRoleSwitchOptions ?? responseRoleSwitchOptions;
    const available_portals = payloadAvailablePortals ?? responseAvailablePortals;
    const requiresPortalSelection =
      (available_portals?.length ?? 0) > 1 ||
      payload.requires_portal_selection === true ||
      data.requires_portal_selection === true;
    const session: UserSession = {
      role,
      name,
      email: String(payload.email ?? ""),
      userId,
      activePortal: typeof payload.active_portal === "string" ? payload.active_portal : undefined,
      availablePortals: available_portals,
      roleSwitchOptions: role_switch_options,
    };

    await saveSession(session, rememberMe);

    return {
      ok: true as const,
      user: session,
      role_switch_options,
      available_portals,
      requires_portal_selection: requiresPortalSelection,
    };
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/applicants/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
        signal: controller.signal,
      });
    } catch (e: any) {
      if (e?.name === "AbortError") {
        return { ok: false as const, error: "Request timed out. The server may be starting up — please try again." };
      }
      throw e;
    } finally {
      clearTimeout(timeout);
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { ok: false as const, error: data?.message || "Invalid email or password." };
    }

    const access_token: string = data.access_token;
    const refresh_token: string | undefined =
      data.refresh_token ?? readRefreshTokenFromSetCookie(res, true);

    if (!access_token) {
      return { ok: false as const, error: "Invalid response from server." };
    }

    const payload = parseJwt(access_token);
    if (!payload) return { ok: false as const, error: "Invalid token received." };

    const name =
      [payload.first_name, payload.last_name].filter(Boolean).map(String).join(" ") || email;

    if (rememberMe) {
      await AsyncStorage.setItem(ACCESS_KEY, access_token);
      if (refresh_token) await AsyncStorage.setItem(REFRESH_KEY, refresh_token);
      await AsyncStorage.setItem(IS_APPLICANT_KEY, "true");
    } else {
      memoryStore.accessToken = access_token;
      memoryStore.refreshToken = refresh_token;
      memoryStore.isApplicant = true;
    }

    await saveSession({
      role: "applicant" as UserRole,
      name,
      email: String(payload.email ?? email),
      userId: String(payload.sub_userid ?? payload.applicant_id ?? payload.user_id ?? payload.id ?? ""),
    }, rememberMe);

    return {
      ok: true as const,
      user: {
        role: "applicant" as UserRole,
        name,
        email: payload.email ?? email,
        userId: String(payload.sub_userid ?? payload.applicant_id ?? payload.user_id ?? payload.id ?? ""),
      } as UserSession,
    };
  } catch {
    return { ok: false as const, error: "Network error. Check your connection." };
  }
}

// Kept for API compatibility with AppNavigator.
export async function saveSession(session: UserSession, persist: boolean): Promise<void> {
  const normalized: UserSession = {
    email: session.email ?? "",
    name: session.name ?? "",
    role: session.role,
    userId: session.userId ?? "",
    activePortal: session.activePortal,
    availablePortals: Array.isArray(session.availablePortals) ? session.availablePortals : undefined,
    roleSwitchOptions: Array.isArray(session.roleSwitchOptions) ? session.roleSwitchOptions : undefined,
  };

  if (persist) {
    await AsyncStorage.setItem(SESSION_KEY, serializeSession(normalized));
  } else {
    memoryStore.session = normalized;
  }
}

// ─── Session Restore ──────────────────────────────────────────────────────────

async function storeTokensPersistent(accessToken: string, refreshToken?: string): Promise<void> {
  await AsyncStorage.setItem(ACCESS_KEY, accessToken);
  if (refreshToken) await AsyncStorage.setItem(REFRESH_KEY, refreshToken);
}

function storeTokensInMemory(accessToken: string, refreshToken?: string): void {
  memoryStore.accessToken = accessToken;
  if (refreshToken) memoryStore.refreshToken = refreshToken;
}

async function storeTokens(isPersistent: boolean, accessToken: string, refreshToken?: string): Promise<void> {
  if (isPersistent) {
    await storeTokensPersistent(accessToken, refreshToken);
  } else {
    storeTokensInMemory(accessToken, refreshToken);
  }
}

async function refreshExpiredSession(payload: Record<string, unknown>): Promise<UserSession | null> {
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

  await storeTokens(
    isPersistent,
    data.access_token,
    data.refresh_token ?? readRefreshTokenFromSetCookie(res, isApplicant),
  );

  const role = isApplicant
    ? ("applicant" as UserRole)
    : (roleNameToKey(String(newPayload.role_name ?? "")) ?? null);
  if (!role) return null;

  const name = [newPayload.first_name, newPayload.last_name].filter(Boolean).join(" ");
  const userId = String(newPayload.sub_userid ?? newPayload.applicant_id ?? newPayload.user_id ?? newPayload.id ?? "");
  const storedSession = parseSession(await AsyncStorage.getItem(SESSION_KEY)) ?? memoryStore.session ?? null;
  return {
    role,
    name: storedSession?.name ?? name,
    email: String(newPayload.email ?? storedSession?.email ?? ""),
    userId,
    activePortal: storedSession?.activePortal,
    availablePortals: storedSession?.availablePortals,
    roleSwitchOptions: storedSession?.roleSwitchOptions,
  };
}

export async function getSession(): Promise<UserSession | null> {
  try {
    const persistedAccess = await AsyncStorage.getItem(ACCESS_KEY);
    const accessToken = persistedAccess ?? memoryStore.accessToken ?? null;
    const storedSession = parseSession(await AsyncStorage.getItem(SESSION_KEY)) ?? memoryStore.session ?? null;

    if (!accessToken) return null;

    const payload = parseJwt(accessToken);
    if (!payload) return null;

    if (payload.exp && Date.now() / 1000 > Number(payload.exp)) {
      return refreshExpiredSession(payload);
    }

    const persistedIsApplicant = await AsyncStorage.getItem(IS_APPLICANT_KEY);
    const isApplicant =
      persistedIsApplicant === "true" || (memoryStore.isApplicant ?? false);

    const role = isApplicant
      ? ("applicant" as UserRole)
      : (roleNameToKey(String(payload.role_name ?? "")) ?? null);
    if (!role) return null;

    const name = storedSession?.name || [payload.first_name, payload.last_name].filter(Boolean).join(" ");
    const userId = String(payload.sub_userid ?? payload.applicant_id ?? payload.user_id ?? payload.id ?? "");
    return {
      role,
      name,
      email: String(payload.email ?? storedSession?.email ?? ""),
      userId,
      activePortal: storedSession?.activePortal,
      availablePortals: storedSession?.availablePortals,
      roleSwitchOptions: storedSession?.roleSwitchOptions,
    };
  } catch {
    return null;
  }
}

// ─── Authenticated Fetch ──────────────────────────────────────────────────────

function buildAuthRequest(url: string, options: RequestInit, token: string): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${token}`,
    },
  });
}

async function refreshAndRetry(url: string, options: RequestInit, isPersistent: boolean): Promise<Response> {
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

  await storeTokens(
    isPersistent,
    data.access_token,
    data.refresh_token ?? readRefreshTokenFromSetCookie(refreshRes, isApplicant),
  );

  return buildAuthRequest(url, options, data.access_token);
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const persistedAccess = await AsyncStorage.getItem(ACCESS_KEY);
  const isPersistent = !!persistedAccess;
  const accessToken = persistedAccess ?? memoryStore.accessToken ?? null;

  if (!accessToken) throw new Error("Not authenticated");

  const res = await buildAuthRequest(url, options, accessToken);

  if (res.status === 401) {
    return refreshAndRetry(url, options, isPersistent);
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

export async function resendApplicantVerification(
  email: string,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/applicants/resend-verification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data?.message || "Could not resend verification email." };
    }
    return {
      ok: true,
      message: data?.message || "A new verification email has been sent. Please check your inbox.",
    };
  } catch {
    return { ok: false, error: "Network error. Check your connection." };
  }
}

export async function verifyApplicantEmail(
  token: string,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/applicants/verify-email?token=${encodeURIComponent(token)}`,
      { method: "GET" },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data?.message || "Invalid or expired verification link." };
    }
    return {
      ok: true,
      message: data?.message || "Your email has been verified. You can now sign in.",
    };
  } catch {
    return { ok: false, error: "Network error. Check your connection." };
  }
}

export async function requestPasswordReset(
  email: string,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data?.message || "Could not send reset instructions." };
    }
    return {
      ok: true,
      message: data?.message || "If an account exists, reset instructions have been sent.",
    };
  } catch {
    return { ok: false, error: "Network error. Check your connection." };
  }
}

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
    memoryStore.session = undefined;
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch {}
}
