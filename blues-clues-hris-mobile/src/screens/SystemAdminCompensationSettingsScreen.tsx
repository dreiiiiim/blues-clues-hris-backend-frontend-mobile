import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
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

type StatutoryRate = { employee_rate: number; employer_rate: number; min: number; max: number };
type StatutoryConfig = {
  sss: StatutoryRate;
  philhealth: StatutoryRate;
  pagibig: StatutoryRate;
  notes: string;
};

type TaxBracket = {
  bracket_id: string;
  effective_year: number;
  min_salary: number;
  max_salary: number | null;
  base_tax_amount: number;
  excess_percentage: number;
};

type PayrollConfig = {
  pay_frequency?: string;
  cutoff_day_1?: number;
  cutoff_day_2?: number;
  payout_day_1?: number;
  payout_day_2?: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toPHP(n: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(n);
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function SystemAdminCompensationSettingsScreen({ route, navigation }: any) {
  const session: UserSession = route.params?.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"statutory" | "brackets" | "payroll">("statutory");

  // Statutory
  const [statutory, setStatutory] = useState<StatutoryConfig | null>(null);
  const [statutoryDraft, setStatutoryDraft] = useState<StatutoryConfig | null>(null);
  const [editingStatutory, setEditingStatutory] = useState(false);
  const [savingStatutory, setSavingStatutory] = useState(false);

  // Tax brackets
  const [brackets, setBrackets] = useState<TaxBracket[]>([]);
  const [newBracket, setNewBracket] = useState({ effective_year: String(new Date().getFullYear()), min_salary: "", max_salary: "", base_tax_amount: "", excess_percentage: "" });
  const [addingBracket, setAddingBracket] = useState(false);
  const [showBracketForm, setShowBracketForm] = useState(false);

  // Payroll config
  const [payrollConfig, setPayrollConfig] = useState<PayrollConfig | null>(null);
  const [payrollDraft, setPayrollDraft] = useState<PayrollConfig | null>(null);
  const [editingPayroll, setEditingPayroll] = useState(false);
  const [savingPayroll, setSavingPayroll] = useState(false);

  useEffect(() => {
    Promise.all([
      authFetch(`${API_BASE_URL}/cnb/statutory-deduction-config`).then(r => r.json()).catch(() => null),
      authFetch(`${API_BASE_URL}/cnb/tax-brackets`).then(r => r.json()).catch(() => []),
      authFetch(`${API_BASE_URL}/users/tenant-config`).then(r => r.json()).catch(() => null),
    ]).then(([stat, brk, pc]) => {
      if (stat) { setStatutory(stat); setStatutoryDraft(JSON.parse(JSON.stringify(stat))); }
      if (Array.isArray(brk)) setBrackets(brk);
      if (pc) { setPayrollConfig(pc); setPayrollDraft({ ...pc }); }
    }).finally(() => setLoading(false));
  }, []);

  async function saveStatutory() {
    if (!statutoryDraft) return;
    setSavingStatutory(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/cnb/statutory-deduction-config`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(statutoryDraft) });
      if (!res.ok) throw new Error();
      setStatutory(statutoryDraft);
      setEditingStatutory(false);
    } catch { Alert.alert("Error", "Failed to save statutory config."); }
    finally { setSavingStatutory(false); }
  }

  async function addBracket() {
    if (!newBracket.min_salary || !newBracket.base_tax_amount || !newBracket.excess_percentage) {
      Alert.alert("Validation", "Fill in min salary, base tax, and excess %.");
      return;
    }
    setAddingBracket(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/cnb/tax-brackets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          effective_year: parseInt(newBracket.effective_year, 10),
          min_salary: parseFloat(newBracket.min_salary),
          max_salary: newBracket.max_salary ? parseFloat(newBracket.max_salary) : null,
          base_tax_amount: parseFloat(newBracket.base_tax_amount),
          excess_percentage: parseFloat(newBracket.excess_percentage),
        }),
      });
      if (!res.ok) throw new Error();
      const created: TaxBracket = await res.json();
      setBrackets(prev => [...prev, created]);
      setShowBracketForm(false);
      setNewBracket({ effective_year: String(new Date().getFullYear()), min_salary: "", max_salary: "", base_tax_amount: "", excess_percentage: "" });
    } catch { Alert.alert("Error", "Failed to add tax bracket."); }
    finally { setAddingBracket(false); }
  }

  async function deleteBracket(id: string) {
    Alert.alert("Delete Bracket", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await authFetch(`${API_BASE_URL}/cnb/tax-brackets/${id}`, { method: "DELETE" });
          setBrackets(prev => prev.filter(b => b.bracket_id !== id));
        } catch { Alert.alert("Error", "Delete failed."); }
      }},
    ]);
  }

  async function savePayroll() {
    if (!payrollDraft) return;
    setSavingPayroll(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/users/tenant-config`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payrollDraft) });
      if (!res.ok) throw new Error();
      setPayrollConfig(payrollDraft);
      setEditingPayroll(false);
    } catch { Alert.alert("Error", "Failed to save payroll config."); }
    finally { setSavingPayroll(false); }
  }

  const TABS = [
    { key: "statutory" as const, label: "Statutory" },
    { key: "brackets" as const, label: "Tax Brackets" },
    { key: "payroll" as const, label: "Payroll Config" },
  ];

  function StatutoryRow({ name, field, draft, onUpdate }: {
    name: string;
    field: keyof StatutoryConfig;
    draft: StatutoryConfig | null;
    onUpdate: (field: keyof StatutoryConfig, sub: keyof StatutoryRate, val: string) => void;
  }) {
    if (!draft || field === "notes") return null;
    const rate = draft[field] as StatutoryRate;
    return (
      <View style={s.statBlock}>
        <Text style={s.statTitle}>{name}</Text>
        {(["employee_rate", "employer_rate"] as const).map(sub => (
          <View key={sub} style={s.statRow}>
            <Text style={s.statLabel}>{sub === "employee_rate" ? "Employee Rate (%)" : "Employer Rate (%)"}</Text>
            {editingStatutory ? (
              <TextInput style={[s.input, { width: 80 }]} value={String(rate[sub])} onChangeText={v => onUpdate(field, sub, v)} keyboardType="numeric" />
            ) : (
              <Text style={s.statValue}>{rate[sub]}%</Text>
            )}
          </View>
        ))}
      </View>
    );
  }

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
          <Sidebar role="system_admin" userName={session?.name ?? ""} email={session?.email ?? ""} activeScreen="CompensationSettings" navigation={navigation} />
        )}

        <View style={s.main}>
          <ScrollView
            style={s.scroll}
            contentContainerStyle={[s.scrollContent, isMobile && { paddingBottom: BOTTOM_TAB_HEIGHT + 8 }]}
            showsVerticalScrollIndicator={false}
          >
            <GradientHero>
              <Text style={s.heroEyebrow}>System Admin</Text>
              <Text style={s.heroTitle}>Compensation Settings</Text>
              <Text style={s.heroSub}>Configure statutory deduction rates, tax brackets, and payroll schedules.</Text>
            </GradientHero>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabRow}>
              {TABS.map(tab => (
                <Pressable key={tab.key} style={[s.tab, activeTab === tab.key && s.activeTab]} onPress={() => setActiveTab(tab.key)}>
                  <Text style={[s.tabText, activeTab === tab.key && s.activeTabText]}>{tab.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* ── Statutory ─────────────────────────────────────────────────── */}
            {activeTab === "statutory" && (
              <View style={s.card}>
                <View style={s.cardHeader}>
                  <Text style={s.cardTitle}>Statutory Deduction Rates</Text>
                  {editingStatutory ? (
                    <View style={s.btnRow}>
                      <Pressable style={[s.btn, s.btnPrimary]} onPress={saveStatutory} disabled={savingStatutory}>
                        {savingStatutory ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnPrimaryText}>Save</Text>}
                      </Pressable>
                      <Pressable style={[s.btn, s.btnOutline]} onPress={() => { setStatutoryDraft(statutory ? JSON.parse(JSON.stringify(statutory)) : null); setEditingStatutory(false); }}>
                        <Text style={s.btnOutlineText}>Cancel</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable style={[s.btn, s.btnOutline]} onPress={() => setEditingStatutory(true)}>
                      <Ionicons name="pencil-outline" size={12} color="#475569" style={{ marginRight: 3 }} />
                      <Text style={s.btnOutlineText}>Edit</Text>
                    </Pressable>
                  )}
                </View>

                {!statutory ? (
                  <Text style={s.emptyText}>No statutory config found.</Text>
                ) : (
                  <>
                    {(["sss", "philhealth", "pagibig"] as const).map(field => (
                      <View key={field} style={s.statBlock}>
                        <Text style={s.statTitle}>{field.toUpperCase()}</Text>
                        {(["employee_rate", "employer_rate"] as const).map(sub => (
                          <View key={sub} style={s.statRow}>
                            <Text style={s.statLabel}>{sub === "employee_rate" ? "Employee Rate (%)" : "Employer Rate (%)"}</Text>
                            {editingStatutory && statutoryDraft ? (
                              <TextInput
                                style={[s.input, { width: 80, textAlign: "right" }]}
                                value={String((statutoryDraft[field] as StatutoryRate)[sub])}
                                onChangeText={v => setStatutoryDraft(prev => prev ? {
                                  ...prev,
                                  [field]: { ...(prev[field] as StatutoryRate), [sub]: parseFloat(v) || 0 },
                                } : prev)}
                                keyboardType="numeric"
                              />
                            ) : (
                              <Text style={s.statValue}>{(statutory[field] as StatutoryRate)[sub]}%</Text>
                            )}
                          </View>
                        ))}
                      </View>
                    ))}
                  </>
                )}
              </View>
            )}

            {/* ── Tax Brackets ──────────────────────────────────────────────── */}
            {activeTab === "brackets" && (
              <>
                <Pressable style={s.addBtn} onPress={() => setShowBracketForm(v => !v)}>
                  <Ionicons name={showBracketForm ? "chevron-up" : "add-circle-outline"} size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={s.addBtnText}>{showBracketForm ? "Cancel" : "Add Tax Bracket"}</Text>
                </Pressable>

                {showBracketForm && (
                  <View style={s.card}>
                    <Text style={s.cardTitle}>New Tax Bracket</Text>
                    {[
                      { label: "Effective Year", key: "effective_year", hint: "e.g. 2025" },
                      { label: "Min Salary (₱)", key: "min_salary", hint: "e.g. 20833" },
                      { label: "Max Salary (₱) — blank = no cap", key: "max_salary", hint: "" },
                      { label: "Base Tax Amount (₱)", key: "base_tax_amount", hint: "" },
                      { label: "Excess Percentage (%)", key: "excess_percentage", hint: "e.g. 20" },
                    ].map(field => (
                      <View key={field.key} style={{ gap: 4 }}>
                        <Text style={s.fieldLabel}>{field.label.toUpperCase()}</Text>
                        <TextInput
                          style={s.input}
                          value={(newBracket as any)[field.key]}
                          onChangeText={v => setNewBracket(f => ({ ...f, [field.key]: v }))}
                          keyboardType="numeric"
                          placeholder={field.hint}
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                    ))}
                    <Pressable style={[s.btn, s.btnPrimary, { alignSelf: "flex-end" }]} onPress={addBracket} disabled={addingBracket}>
                      {addingBracket ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnPrimaryText}>Add Bracket</Text>}
                    </Pressable>
                  </View>
                )}

                {brackets.length === 0 ? (
                  <View style={s.emptyBox}><Text style={s.emptyText}>No tax brackets configured.</Text></View>
                ) : (
                  brackets.map(b => (
                    <View key={b.bracket_id} style={s.bracketCard}>
                      <View style={s.bracketTop}>
                        <Text style={s.bracketYear}>{b.effective_year}</Text>
                        <Pressable onPress={() => deleteBracket(b.bracket_id)}>
                          <Ionicons name="trash-outline" size={16} color="#B91C1C" />
                        </Pressable>
                      </View>
                      <Text style={s.bracketRange}>{toPHP(b.min_salary)} – {b.max_salary ? toPHP(b.max_salary) : "No cap"}</Text>
                      <Text style={s.bracketDetail}>Base: {toPHP(b.base_tax_amount)} + {b.excess_percentage}% of excess</Text>
                    </View>
                  ))
                )}
              </>
            )}

            {/* ── Payroll Config ────────────────────────────────────────────── */}
            {activeTab === "payroll" && (
              <View style={s.card}>
                <View style={s.cardHeader}>
                  <Text style={s.cardTitle}>Payroll Schedule</Text>
                  {editingPayroll ? (
                    <View style={s.btnRow}>
                      <Pressable style={[s.btn, s.btnPrimary]} onPress={savePayroll} disabled={savingPayroll}>
                        {savingPayroll ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnPrimaryText}>Save</Text>}
                      </Pressable>
                      <Pressable style={[s.btn, s.btnOutline]} onPress={() => { setPayrollDraft(payrollConfig ? { ...payrollConfig } : null); setEditingPayroll(false); }}>
                        <Text style={s.btnOutlineText}>Cancel</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable style={[s.btn, s.btnOutline]} onPress={() => setEditingPayroll(true)}>
                      <Ionicons name="pencil-outline" size={12} color="#475569" style={{ marginRight: 3 }} />
                      <Text style={s.btnOutlineText}>Edit</Text>
                    </Pressable>
                  )}
                </View>

                {!payrollConfig ? (
                  <Text style={s.emptyText}>No payroll config found.</Text>
                ) : (
                  [
                    { label: "Pay Frequency", key: "pay_frequency" as const },
                    { label: "Cutoff Day 1", key: "cutoff_day_1" as const },
                    { label: "Cutoff Day 2", key: "cutoff_day_2" as const },
                    { label: "Payout Day 1", key: "payout_day_1" as const },
                    { label: "Payout Day 2", key: "payout_day_2" as const },
                  ].map(f => (
                    <View key={f.key} style={s.statRow}>
                      <Text style={s.statLabel}>{f.label}</Text>
                      {editingPayroll && payrollDraft ? (
                        <TextInput
                          style={[s.input, { width: 100, textAlign: "right" }]}
                          value={String(payrollDraft[f.key] ?? "")}
                          onChangeText={v => setPayrollDraft(prev => prev ? { ...prev, [f.key]: f.key === "pay_frequency" ? v : parseInt(v, 10) || 0 } : prev)}
                          keyboardType={f.key === "pay_frequency" ? "default" : "numeric"}
                        />
                      ) : (
                        <Text style={s.statValue}>{payrollConfig[f.key] ?? "—"}</Text>
                      )}
                    </View>
                  ))
                )}
              </View>
            )}
          </ScrollView>

          {isMobile && (
            <BottomTabBar role="system_admin" activeScreen="CompensationSettings" navigation={navigation} session={session} />
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

  card: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#E2E8F0", gap: 12 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  btnRow: { flexDirection: "row", gap: 8 },
  btn: { flexDirection: "row", alignItems: "center", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, justifyContent: "center" },
  btnPrimary: { backgroundColor: "#1E40AF" },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
  btnOutline: { borderWidth: 1, borderColor: "#CBD5E1" },
  btnOutlineText: { color: "#475569", fontSize: 12, fontWeight: "600" },

  statBlock: { gap: 6 },
  statTitle: { fontSize: 12, fontWeight: "700", color: "#1E40AF", textTransform: "uppercase" },
  statRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statLabel: { fontSize: 13, color: "#64748B", flex: 1 },
  statValue: { fontSize: 14, fontWeight: "600", color: "#0F172A" },

  fieldLabel: { fontSize: 10, fontWeight: "700", color: "#94A3B8", letterSpacing: 1.2, textTransform: "uppercase" },
  input: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, fontSize: 14, color: "#0F172A", backgroundColor: "#FFFFFF" },

  addBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#1E40AF", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, alignSelf: "flex-start" },
  addBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },

  emptyBox: { backgroundColor: "#F1F5F9", borderRadius: 12, padding: 24, alignItems: "center" },
  emptyText: { fontSize: 13, color: "#64748B" },

  bracketCard: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#E2E8F0", gap: 4 },
  bracketTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bracketYear: { fontSize: 13, fontWeight: "700", color: "#1E40AF" },
  bracketRange: { fontSize: 13, color: "#0F172A" },
  bracketDetail: { fontSize: 12, color: "#64748B" },
});
