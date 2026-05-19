"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Building2,
  LayoutDashboard,
  Loader2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { getAccessToken, getUserInfo, parseJwt, saveUserInfo } from "@/lib/authStorage";
import { portalToPath, roleToPath } from "@/lib/roleMap";
import { switchRoleApi } from "@/lib/authApi";

type SwitchOption = {
  role_id: string;
  role_name: string;
  portal_key: string;
};

type PortalMeta = {
  portal_key: string;
  label: string;
  icon: React.ElementType;
};

const PORTAL_META: PortalMeta[] = [
  { portal_key: "employee",     label: "Employee",     icon: Users },
  { portal_key: "hr",           label: "HR Officer",   icon: ShieldCheck },
  { portal_key: "manager",      label: "Manager",      icon: Briefcase },
  { portal_key: "admin",        label: "Admin",        icon: Building2 },
  { portal_key: "system-admin", label: "System Admin", icon: LayoutDashboard },
];

const PRIMARY   = "#2563EB";
const PRIMARY_LT = "#EFF6FF";
const PRIMARY_BD = "#BFDBFE";
const BG_APP    = "#EEF2F8";

function PortalCard({
  meta,
  isActive,
  isBusy,
  anyBusy,
  onSelect,
}: {
  readonly meta: PortalMeta;
  readonly isActive: boolean;
  readonly isBusy: boolean;
  readonly anyBusy: boolean;
  readonly onSelect: (key: string) => void;
}) {
  const Icon = meta.icon;

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        disabled={anyBusy}
        onClick={() => onSelect(meta.portal_key)}
        style={{
          width: "100%",
          aspectRatio: "1 / 1",
          borderRadius: 20,
          border: isActive ? `2px solid ${PRIMARY}` : "2px solid #D1D5DB",
          backgroundColor: isActive ? PRIMARY_LT : "#FFFFFF",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          cursor: anyBusy ? "not-allowed" : "pointer",
          transition: "border-color 0.15s, background-color 0.15s, box-shadow 0.15s",
          boxShadow: isActive
            ? `0 0 0 4px ${PRIMARY_BD}, 0 4px 16px -4px ${PRIMARY}33`
            : "0 2px 8px -2px rgba(0,0,0,0.08)",
          padding: 24,
        }}
      >
        {isBusy ? (
          <Loader2 size={52} color={PRIMARY} className="animate-spin" />
        ) : (
          <Icon
            size={52}
            color={isActive ? PRIMARY : "#9CA3AF"}
            strokeWidth={1.5}
          />
        )}
        <span
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: isActive ? PRIMARY : "#6B7280",
          }}
        >
          {meta.label}
        </span>
      </button>

      {/* Radio dot */}
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          border: isActive ? `4px solid ${PRIMARY}` : "2px solid #D1D5DB",
          backgroundColor: isActive ? "#FFFFFF" : "transparent",
          transition: "border 0.15s",
        }}
      />
    </div>
  );
}

export default function PortalSelectPage() {
  const router = useRouter();
  const [busyRoleId, setBusyRoleId] = useState<string | null>(null);
  const [error, setError] = useState("");
  // Keep initials in state so it's only set on the client (avoids hydration mismatch)
  const [initials, setInitials] = useState("—");
  const [firstName, setFirstName] = useState("");

  const portalData = useMemo(() => {
    if (typeof window === "undefined") {
      return { payload: null, user: null, availablePortals: [], switchOptions: [], activePortal: "" };
    }
    const token = getAccessToken();
    const payload = token ? parseJwt(token) : null;
    const user = getUserInfo();
    return {
      payload,
      user,
      availablePortals: Array.isArray(payload?.available_portals)
        ? (payload.available_portals as string[])
        : [],
      switchOptions: Array.isArray(payload?.role_switch_options)
        ? (payload.role_switch_options as SwitchOption[])
        : [],
      activePortal: String(payload?.active_portal ?? user?.active_portal ?? "").trim(),
    };
  }, []);

  // Populate client-only fields after mount to avoid hydration mismatch
  useEffect(() => {
    const name = portalData.user?.name ?? portalData.user?.email ?? "";
    setFirstName(name.split(" ")[0] || name.split("@")[0] || "there");
    setInitials(
      (name || "U")
        .split(" ")
        .filter(Boolean)
        .map((w: string) => w.charAt(0))
        .join("")
        .toUpperCase()
        .slice(0, 2),
    );
  }, [portalData.user]);

  useEffect(() => {
    if (!portalData.payload) {
      router.replace("/login");
      return;
    }
    if (portalData.availablePortals.length <= 1) {
      const fallbackPath =
        portalToPath(portalData.activePortal) || roleToPath(portalData.payload.role_name);
      router.replace(fallbackPath);
    }
  }, [portalData, router]);

  const handleChoosePortal = async (portalKey: string) => {
    try {
      setError("");
      const targetOption = portalData.switchOptions.find((o) => o.portal_key === portalKey);
      if (!targetOption) throw new Error("No role is mapped to the selected portal.");

      setBusyRoleId(targetOption.role_id);
      const switched = await switchRoleApi({ role_id: targetOption.role_id });
      const payload = parseJwt(switched.access_token);
      if (!payload) throw new Error("Invalid token after switching role.");

      const rolePath = roleToPath(payload.role_name);
      const role = rolePath.replaceAll("/", "");
      const existingUser = getUserInfo();

      saveUserInfo({
        name: existingUser?.name ?? "",
        email: existingUser?.email ?? "",
        role,
        role_name: String(payload.role_name ?? ""),
        active_portal: payload.active_portal,
        available_portals: Array.isArray(payload.available_portals)
          ? payload.available_portals
          : [],
        role_switch_options: Array.isArray(payload.role_switch_options)
          ? payload.role_switch_options
          : [],
        user_id: payload.sub_userid,
      });

      router.replace(portalToPath(payload.active_portal) || rolePath);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to switch portal. Please try again.");
    } finally {
      setBusyRoleId(null);
    }
  };

  const visiblePortals = PORTAL_META.filter((m) =>
    portalData.availablePortals.includes(m.portal_key),
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: BG_APP,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px",
      }}
    >
      {/* Brand + greeting */}
      <div style={{ marginBottom: 36, textAlign: "center" }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            backgroundColor: PRIMARY,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 14px",
            color: "#fff",
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: 1,
          }}
          suppressHydrationWarning
        >
          {initials}
        </div>
        <p style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 600, marginBottom: 4 }}>
          Blue's Clues HRIS
        </p>
        <h1
          style={{ fontSize: 26, fontWeight: 800, color: "#111827", margin: 0 }}
          suppressHydrationWarning
        >
          {firstName ? `Welcome, ${firstName}` : "Welcome"}
        </h1>
        <p style={{ fontSize: 13, color: "#6B7280", marginTop: 6 }}>
          {visiblePortals.length === 1 ? "Entering your portal…" : "Choose a portal to continue"}
        </p>
      </div>

      {/* Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${Math.min(visiblePortals.length, 2)}, minmax(140px, 200px))`,
          gap: 20,
          width: "100%",
          maxWidth: 460,
          justifyContent: "center",
        }}
      >
        {visiblePortals.map((meta) => {
          const option = portalData.switchOptions.find((o) => o.portal_key === meta.portal_key);
          return (
            <PortalCard
              key={meta.portal_key}
              meta={meta}
              isActive={portalData.activePortal === meta.portal_key}
              isBusy={busyRoleId === option?.role_id}
              anyBusy={!!busyRoleId}
              onSelect={handleChoosePortal}
            />
          );
        })}
      </div>

      {error ? (
        <div
          style={{
            marginTop: 20,
            padding: "10px 16px",
            borderRadius: 12,
            backgroundColor: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#DC2626",
            fontSize: 13,
            maxWidth: 460,
            width: "100%",
            textAlign: "center",
          }}
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
