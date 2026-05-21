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
  TextInput,
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

type Cycle = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "GOAL_SETTING" | "MID_YEAR" | "YEAR_END" | "COMPLETED";
};

type BonusRule = {
  id: string;
  ratingMin: number;
  ratingMax: number;
  bonusPct: number;
  meritPct: number;
  promotionEligible: boolean;
};

type ViolationRule = {
  id: string;
  condition: string;
  action: string;
};

type PerfSettings = {
  cycle_enabled?: boolean;
  self_proposed_goals?: boolean;
  auto_bonuses?: boolean;
  rating_labels?: string[];
  goal_setting_start?: string;
  goal_setting_end?: string;
  mid_year_start?: string;
  mid_year_end?: string;
  year_end_start?: string;
  year_end_end?: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_TONES: Record<Cycle["status"], { bg: string; border: string; text: string }> = {
  GOAL_SETTING: { bg: "#EFF6FF", border: "#BFDBFE", text: "#1D4ED8" },
  MID_YEAR:     { bg: "#FFFBEB", border: "#FDE68A", text: "#B45309" },
  YEAR_END:     { bg: "#F5F3FF", border: "#DDD6FE", text: "#7C3AED" },
  COMPLETED:    { bg: "#F0FDF4", border: "#BBF7D0", text: "#15803D" },
};

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function SystemAdminPerformanceSettingsScreen({ route, navigation }: any) {
  const session: UserSession = route.params?.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"general" | "cycles" | "rules">("general");

  // General settings
  const [settings, setSettings] = useState<PerfSettings>({});
  const [ratingLabels, setRatingLabels] = useState(["Below Exp.", "Below Exp.", "Meets Exp.", "Above Avg.", "Excellent"]);
  const [editingLabels, setEditingLabels] = useState(false);
  const [labelDraft, setLabelDraft] = useState<string[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);

  // Cycles
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [newCycleOpen, setNewCycleOpen] = useState(false);
  const [cycleName, setCycleName] = useState("");
  const [cycleStart, setCycleStart] = useState("");
  const [cycleEnd, setCycleEnd] = useState("");
  const [addingCycle, setAddingCycle] = useState(false);
  const [deletingCycle, setDeletingCycle] = useState<string | null>(null);

  // Bonus rules
  const [bonusRules, setBonusRules] = useState<BonusRule[]>([]);
  const [violationRules, setViolationRules] = useState<ViolationRule[]>([]);

  useEffect(() => {
    authFetch(`${API_BASE_URL}/performance/settings/full`).then(r => r.json()).then(d => {
      if (d && !d.message) {
        setSettings(d);
        if (Array.isArray(d.rating_labels) && d.rating_labels.length === 5) setRatingLabels(d.rating_labels);
      }
    }).catch(() => {});

    authFetch(`${API_BASE_URL}/performance/cycles`).then(r => r.json()).then((d: Cycle[]) => {
      if (Array.isArray(d)) setCycles(d);
    }).catch(() => {});

    authFetch(`${API_BASE_URL}/performance/bonus-rules`).then(r => r.json()).then((d: BonusRule[]) => {
      if (Array.isArray(d)) setBonusRules(d);
    }).catch(() => {});

    authFetch(`${API_BASE_URL}/performance/violation-rules`).then(r => r.json()).then((d: ViolationRule[]) => {
      if (Array.isArray(d)) setViolationRules(d);
    }).catch(() => {})
    .finally(() => setLoading(false));
  }, []);

  async function saveSettings() {
    setSavingSettings(true);
    try {
      const payload = { ...settings, rating_labels: ratingLabels };
      const res = await authFetch(`${API_BASE_URL}/performance/settings/full`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      setEditingLabels(false);
    } catch { Alert.alert("Error", "Failed to save settings."); }
    finally { setSavingSettings(false); }
  }

  async function addCycle() {
    if (!cycleName.trim() || !cycleStart || !cycleEnd) { Alert.alert("Validation", "Name and dates required."); return; }
    setAddingCycle(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/performance/cycles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cycleName, startDate: cycleStart, endDate: cycleEnd, status: "GOAL_SETTING" }),
      });
      if (!res.ok) throw new Error();
      const created: Cycle = await res.json();
      setCycles(prev => [...prev, created]);
      setNewCycleOpen(false); setCycleName(""); setCycleStart(""); setCycleEnd("");
    } catch { Alert.alert("Error", "Failed to add cycle."); }
    finally { setAddingCycle(false); }
  }

  async function deleteCycle(id: string) {
    Alert.alert("Delete Cycle", "Delete this review cycle?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        setDeletingCycle(id);
        try {
          await authFetch(`${API_BASE_URL}/performance/cycles/${id}`, { method: "DELETE" });
          setCycles(prev => prev.filter(c => c.id !== id));
        } catch { Alert.alert("Error", "Delete failed."); }
        finally { setDeletingCycle(null); }
      }},
    ]);
  }

  const TABS = [
    { key: "general" as const, label: "General" },
    { key: "cycles" as const, label: "Cycles" },
    { key: "rules" as const, label: "Rules" },
  ];

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}><ActivityIndicator size="large" color="#1E40AF" /><Text style={s.loadingText}>Loading settings...</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.inner}>
        {!isMobile && (
          <Sidebar role="system_admin" userName={session?.name ?? ""} email={session?.email ?? ""} activeScreen="PerformanceSettings" navigation={navigation} />
        )}

        <View style={s.main}>
          <ScrollView
            style={s.scroll}
            contentContainerStyle={[s.scrollContent, isMobile && { paddingBottom: BOTTOM_TAB_HEIGHT + 8 }]}
            showsVerticalScrollIndicator={false}
          >
            <GradientHero>
              <Text style={s.heroEyebrow}>System Admin</Text>
              <Text style={s.heroTitle}>Performance Settings</Text>
              <Text style={s.heroSub}>Configure performance review cycles, rating labels, and automation rules.</Text>
            </GradientHero>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabRow}>
              {TABS.map(tab => (
                <Pressable key={tab.key} style={[s.tab, activeTab === tab.key && s.activeTab]} onPress={() => setActiveTab(tab.key)}>
                  <Text style={[s.tabText, activeTab === tab.key && s.activeTabText]}>{tab.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* ── General ────────────────────────────────────────────────────── */}
            {activeTab === "general" && (
              <View style={{ gap: 12 }}>
                <View style={s.card}>
                  <Text style={s.cardTitle}>Toggles</Text>
                  {[
                    { label: "Performance Cycles Enabled", key: "cycle_enabled" as const },
                    { label: "Employees Can Propose Goals", key: "self_proposed_goals" as const },
                    { label: "Auto-process Bonuses", key: "auto_bonuses" as const },
                  ].map(item => (
                    <View key={item.key} style={s.toggleRow}>
                      <Text style={s.toggleLabel}>{item.label}</Text>
                      <Switch
                        value={!!(settings[item.key])}
                        onValueChange={v => setSettings(prev => ({ ...prev, [item.key]: v }))}
                        trackColor={{ true: "#1E40AF", false: "#E2E8F0" }}
                      />
                    </View>
                  ))}
                </View>

                <View style={s.card}>
                  <View style={s.cardHeader}>
                    <Text style={s.cardTitle}>Rating Labels (1–5)</Text>
                    {editingLabels ? (
                      <View style={s.btnRow}>
                        <Pressable style={[s.btn, s.btnPrimary]} onPress={saveSettings} disabled={savingSettings}>
                          {savingSettings ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnPrimaryText}>Save</Text>}
                        </Pressable>
                        <Pressable style={[s.btn, s.btnOutline]} onPress={() => setEditingLabels(false)}>
                          <Text style={s.btnOutlineText}>Cancel</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable style={[s.btn, s.btnOutline]} onPress={() => { setLabelDraft([...ratingLabels]); setEditingLabels(true); }}>
                        <Ionicons name="pencil-outline" size={12} color="#475569" style={{ marginRight: 3 }} />
                        <Text style={s.btnOutlineText}>Edit</Text>
                      </Pressable>
                    )}
                  </View>
                  {ratingLabels.map((label, idx) => (
                    <View key={idx} style={s.labelRow}>
                      <View style={s.ratingCircle}><Text style={s.ratingCircleText}>{idx + 1}</Text></View>
                      {editingLabels ? (
                        <TextInput style={[s.input, { flex: 1 }]} value={editingLabels ? labelDraft[idx] ?? label : label} onChangeText={v => setLabelDraft(prev => prev.map((l, i) => i === idx ? v : l))} />
                      ) : (
                        <Text style={s.labelText}>{label}</Text>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ── Cycles ─────────────────────────────────────────────────────── */}
            {activeTab === "cycles" && (
              <View style={{ gap: 12 }}>
                <Pressable style={s.addBtn} onPress={() => setNewCycleOpen(v => !v)}>
                  <Ionicons name={newCycleOpen ? "chevron-up" : "add-circle-outline"} size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={s.addBtnText}>{newCycleOpen ? "Cancel" : "Add Review Cycle"}</Text>
                </Pressable>

                {newCycleOpen && (
                  <View style={s.card}>
                    <Text style={s.fieldLabel}>NAME *</Text>
                    <TextInput style={s.input} value={cycleName} onChangeText={setCycleName} placeholder="e.g. FY2025 Performance Review" placeholderTextColor="#94A3B8" />
                    <Text style={s.fieldLabel}>START DATE (YYYY-MM-DD)</Text>
                    <TextInput style={s.input} value={cycleStart} onChangeText={setCycleStart} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" />
                    <Text style={s.fieldLabel}>END DATE (YYYY-MM-DD)</Text>
                    <TextInput style={s.input} value={cycleEnd} onChangeText={setCycleEnd} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" />
                    <Pressable style={[s.btn, s.btnPrimary, { alignSelf: "flex-end" }]} onPress={addCycle} disabled={addingCycle}>
                      {addingCycle ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnPrimaryText}>Add Cycle</Text>}
                    </Pressable>
                  </View>
                )}

                {cycles.length === 0 ? (
                  <View style={s.emptyBox}><Text style={s.emptyText}>No review cycles configured.</Text></View>
                ) : (
                  cycles.map(c => {
                    const tone = STATUS_TONES[c.status];
                    return (
                      <View key={c.id} style={s.cycleCard}>
                        <View style={s.cycleTop}>
                          <Text style={s.cycleName}>{c.name}</Text>
                          <View style={s.cycleActions}>
                            <View style={[s.statusPill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                              <Text style={[s.statusText, { color: tone.text }]}>{c.status.replace(/_/g, " ")}</Text>
                            </View>
                            <Pressable onPress={() => deleteCycle(c.id)} disabled={deletingCycle === c.id}>
                              {deletingCycle === c.id ? <ActivityIndicator size="small" color="#B91C1C" /> : <Ionicons name="trash-outline" size={15} color="#B91C1C" />}
                            </Pressable>
                          </View>
                        </View>
                        <Text style={s.cycleDates}>{formatDate(c.startDate)} – {formatDate(c.endDate)}</Text>
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {/* ── Rules ──────────────────────────────────────────────────────── */}
            {activeTab === "rules" && (
              <View style={{ gap: 12 }}>
                <Text style={s.sectionLabel}>BONUS RULES</Text>
                {bonusRules.length === 0 ? (
                  <View style={s.emptyBox}><Text style={s.emptyText}>No bonus rules configured.</Text></View>
                ) : (
                  bonusRules.map(r => (
                    <View key={r.id} style={s.ruleCard}>
                      <Text style={s.ruleTitle}>Rating {r.ratingMin}–{r.ratingMax}</Text>
                      <Text style={s.ruleMeta}>Bonus: {r.bonusPct}% · Merit: {r.meritPct}%</Text>
                      {r.promotionEligible && <Text style={s.promoTag}>Promotion Eligible</Text>}
                    </View>
                  ))
                )}

                <Text style={[s.sectionLabel, { marginTop: 8 }]}>VIOLATION RULES</Text>
                {violationRules.length === 0 ? (
                  <View style={s.emptyBox}><Text style={s.emptyText}>No violation rules configured.</Text></View>
                ) : (
                  violationRules.map(r => (
                    <View key={r.id} style={s.ruleCard}>
                      <Text style={s.ruleTitle}>{r.condition}</Text>
                      <Text style={s.ruleMeta}>Action: {r.action}</Text>
                    </View>
                  ))
                )}
              </View>
            )}
          </ScrollView>

          {isMobile && (
            <BottomTabBar role="system_admin" activeScreen="PerformanceSettings" navigation={navigation} session={session} />
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

  tabRow: { flexDirection: "row" },
  tab: { paddingHorizontal: 16, paddingVertical: 8, marginRight: 8, borderRadius: 20, backgroundColor: "#F1F5F9" },
  activeTab: { backgroundColor: "#1E40AF" },
  tabText: { fontSize: 13, color: "#64748B", fontWeight: "600" },
  activeTabText: { color: "#FFFFFF" },

  card: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#E2E8F0", gap: 10 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  btnRow: { flexDirection: "row", gap: 8 },
  btn: { flexDirection: "row", alignItems: "center", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, justifyContent: "center" },
  btnPrimary: { backgroundColor: "#1E40AF" },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
  btnOutline: { borderWidth: 1, borderColor: "#CBD5E1" },
  btnOutlineText: { color: "#475569", fontSize: 12, fontWeight: "600" },

  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  toggleLabel: { fontSize: 14, color: "#0F172A", flex: 1, marginRight: 8 },

  labelRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  ratingCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#1E40AF", alignItems: "center", justifyContent: "center" },
  ratingCircleText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  labelText: { fontSize: 14, color: "#0F172A", flex: 1 },

  fieldLabel: { fontSize: 10, fontWeight: "700", color: "#94A3B8", letterSpacing: 1.2, textTransform: "uppercase" },
  input: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#0F172A" },

  addBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#1E40AF", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, alignSelf: "flex-start" },
  addBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },

  emptyBox: { backgroundColor: "#F1F5F9", borderRadius: 12, padding: 24, alignItems: "center" },
  emptyText: { fontSize: 13, color: "#64748B" },

  cycleCard: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#E2E8F0", gap: 4 },
  cycleTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cycleName: { fontSize: 14, fontWeight: "700", color: "#0F172A", flex: 1, marginRight: 8 },
  cycleActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  cycleDates: { fontSize: 12, color: "#64748B" },
  statusPill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: "700" },

  sectionLabel: { fontSize: 10, fontWeight: "700", color: "#94A3B8", letterSpacing: 1.5, textTransform: "uppercase" },
  ruleCard: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#E2E8F0", gap: 4 },
  ruleTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  ruleMeta: { fontSize: 12, color: "#64748B" },
  promoTag: { fontSize: 11, color: "#1D4ED8", fontWeight: "600" },
});
