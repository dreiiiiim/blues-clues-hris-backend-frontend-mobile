import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Sidebar } from "../components/Sidebar";
import { BottomTabBar, BOTTOM_TAB_HEIGHT } from "../components/BottomTabBar";
import { GradientHero } from "../components/GradientHero";
import { authFetch, type UserSession } from "../services/auth";
import { API_BASE_URL } from "../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type PermissionKey = "read" | "create" | "update" | "delete";

type LifecycleModule = {
  module_id: string;
  module_name: string;
  roles: Record<string, Record<PermissionKey, boolean>>;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MODULE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  recruitment:   "person-add-outline",
  onboarding:    "people-outline",
  compensation:  "cash-outline",
  performance:   "trending-up-outline",
  offboarding:   "log-out-outline",
  timekeeping:   "time-outline",
};

const PERMISSION_LABELS: Array<{ key: PermissionKey; label: string; short: string }> = [
  { key: "read",   label: "Read",   short: "R" },
  { key: "create", label: "Create", short: "C" },
  { key: "update", label: "Update", short: "U" },
  { key: "delete", label: "Delete", short: "D" },
];

const ROLE_LABELS: Record<string, string> = {
  hr:           "HR Officer",
  manager:      "Manager",
  employee:     "Employee",
  system_admin: "System Admin",
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function SystemAdminSettingsScreen({ route, navigation }: any) {
  const session: UserSession = route.params?.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<LifecycleModule[]>([]);
  const [draft, setDraft] = useState<LifecycleModule[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  useEffect(() => {
    authFetch(`${API_BASE_URL}/users/hr-lifecycle/permissions`)
      .then(r => r.json())
      .then((data: LifecycleModule[]) => {
        if (Array.isArray(data)) {
          setModules(data);
          setDraft(JSON.parse(JSON.stringify(data)));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function togglePermission(moduleId: string, role: string, perm: PermissionKey, value: boolean) {
    setDraft(prev => prev.map(m => {
      if (m.module_id !== moduleId) return m;
      const updatedRoles = {
        ...m.roles,
        [role]: { ...m.roles[role], [perm]: value },
      };
      return { ...m, roles: updatedRoles };
    }));
  }

  async function savePermissions() {
    setSaving(true);
    try {
      const payload = draft.map(m => ({ module_id: m.module_id, roles: m.roles }));
      const res = await authFetch(`${API_BASE_URL}/users/hr-lifecycle/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      setModules(JSON.parse(JSON.stringify(draft)));
      setEditing(false);
    } catch {
      Alert.alert("Error", "Failed to save permissions.");
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setDraft(JSON.parse(JSON.stringify(modules)));
    setEditing(false);
  }

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}><ActivityIndicator size="large" color="#1E40AF" /><Text style={s.loadingText}>Loading settings...</Text></View>
      </SafeAreaView>
    );
  }

  const displayData = editing ? draft : modules;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.inner}>
        {!isMobile && (
          <Sidebar role="system_admin" userName={session?.name ?? ""} email={session?.email ?? ""} activeScreen="Settings" navigation={navigation} />
        )}

        <View style={s.main}>
          <ScrollView
            style={s.scroll}
            contentContainerStyle={[s.scrollContent, isMobile && { paddingBottom: BOTTOM_TAB_HEIGHT + 8 }]}
            showsVerticalScrollIndicator={false}
          >
            <GradientHero>
              <Text style={s.heroEyebrow}>System Admin</Text>
              <Text style={s.heroTitle}>Settings</Text>
              <Text style={s.heroSub}>Configure HR lifecycle module permissions per role.</Text>
            </GradientHero>

            {/* Edit/Save controls */}
            <View style={s.controlRow}>
              {editing ? (
                <View style={s.btnRow}>
                  <Pressable style={[s.btn, s.btnPrimary]} onPress={savePermissions} disabled={saving}>
                    {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnPrimaryText}>Save Changes</Text>}
                  </Pressable>
                  <Pressable style={[s.btn, s.btnOutline]} onPress={cancelEdit} disabled={saving}>
                    <Text style={s.btnOutlineText}>Discard</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable style={[s.btn, s.btnOutline]} onPress={() => setEditing(true)}>
                  <Ionicons name="pencil-outline" size={13} color="#475569" style={{ marginRight: 6 }} />
                  <Text style={s.btnOutlineText}>Edit Permissions</Text>
                </Pressable>
              )}
            </View>

            {displayData.length === 0 ? (
              <View style={s.emptyBox}><Text style={s.emptyText}>No lifecycle modules found.</Text></View>
            ) : (
              displayData.map(module => {
                const icon = MODULE_ICONS[module.module_id] ?? "settings-outline";
                const isExpanded = expandedModule === module.module_id;
                const roles = Object.keys(module.roles ?? {});

                return (
                  <View key={module.module_id} style={s.moduleCard}>
                    {/* Module Header */}
                    <Pressable style={s.moduleHeader} onPress={() => setExpandedModule(isExpanded ? null : module.module_id)}>
                      <View style={s.moduleIconWrap}>
                        <Ionicons name={icon} size={20} color="#1E40AF" />
                      </View>
                      <Text style={s.moduleName}>{module.module_name ?? module.module_id.replace(/_/g, " ")}</Text>
                      <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color="#94A3B8" />
                    </Pressable>

                    {/* Expanded — permissions per role */}
                    {isExpanded && roles.map(role => {
                      const perms = module.roles[role] ?? {};
                      return (
                        <View key={role} style={s.roleBlock}>
                          <Text style={s.roleLabel}>{ROLE_LABELS[role] ?? role}</Text>
                          <View style={s.permRow}>
                            {PERMISSION_LABELS.map(({ key, short }) => {
                              const value = !!(perms[key]);
                              return (
                                <View key={key} style={s.permCell}>
                                  <Text style={s.permShort}>{short}</Text>
                                  {editing ? (
                                    <Switch
                                      value={value}
                                      onValueChange={v => togglePermission(module.module_id, role, key, v)}
                                      trackColor={{ true: "#1E40AF", false: "#E2E8F0" }}
                                      style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}
                                    />
                                  ) : (
                                    <View style={[s.permDot, value && s.permDotOn]} />
                                  )}
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })
            )}
          </ScrollView>

          {isMobile && (
            <BottomTabBar role="system_admin" activeScreen="Settings" navigation={navigation} session={session} />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  inner: { flex: 1, flexDirection: "row" },
  main: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, color: "#64748B", fontSize: 14 },

  heroEyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 1.8, color: "rgba(255,255,255,0.6)", marginBottom: 4, textTransform: "uppercase" },
  heroTitle: { fontSize: 22, fontWeight: "800", color: "#FFFFFF", marginBottom: 4 },
  heroSub: { fontSize: 12, color: "rgba(255,255,255,0.75)" },

  controlRow: { flexDirection: "row" },
  btnRow: { flexDirection: "row", gap: 10 },
  btn: { flexDirection: "row", alignItems: "center", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, justifyContent: "center" },
  btnPrimary: { backgroundColor: "#1E40AF" },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  btnOutline: { borderWidth: 1, borderColor: "#CBD5E1" },
  btnOutlineText: { color: "#475569", fontSize: 13, fontWeight: "600" },

  emptyBox: { backgroundColor: "#F1F5F9", borderRadius: 12, padding: 24, alignItems: "center" },
  emptyText: { fontSize: 13, color: "#64748B" },

  moduleCard: { backgroundColor: "#FFFFFF", borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "#E2E8F0" },
  moduleHeader: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  moduleIconWrap: { width: 38, height: 38, borderRadius: 10, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" },
  moduleName: { flex: 1, fontSize: 14, fontWeight: "700", color: "#0F172A", textTransform: "capitalize" },

  roleBlock: { paddingHorizontal: 14, paddingBottom: 12, borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingTop: 10, gap: 6 },
  roleLabel: { fontSize: 11, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.8 },
  permRow: { flexDirection: "row", gap: 12 },
  permCell: { alignItems: "center", gap: 4 },
  permShort: { fontSize: 9, fontWeight: "700", color: "#94A3B8", textTransform: "uppercase" },
  permDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: "#E2E8F0", borderWidth: 1, borderColor: "#CBD5E1" },
  permDotOn: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
});
