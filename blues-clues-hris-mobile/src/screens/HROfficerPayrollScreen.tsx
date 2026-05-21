import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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

type PayrollPeriod = {
  period_id: string;
  cutoff_start_date: string;
  cutoff_end_date: string;
  payout_date: string;
  status?: string;
  total_gross?: number;
  total_net?: number;
  employee_count?: number;
};

type ComputedPayslip = {
  payslip_id: string;
  employee_name?: string;
  gross_pay: number;
  total_deductions: number;
  net_pay: number;
  status?: string;
};

type SalaryBaseline = {
  user_id: string;
  employee_name?: string;
  basic_salary: number;
  pay_frequency?: string;
  effective_date?: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toPHP(n?: number | null) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(Number(n ?? 0));
}
function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function HROfficerPayrollScreen({ route, navigation }: any) {
  const session: UserSession = route.params?.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [baselines, setBaselines] = useState<SalaryBaseline[]>([]);
  const [activeTab, setActiveTab] = useState<"runs" | "employees" | "baselines">("runs");

  // Period detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<PayrollPeriod | null>(null);
  const [periodPayslips, setPeriodPayslips] = useState<ComputedPayslip[]>([]);
  const [loadingPayslips, setLoadingPayslips] = useState(false);

  // Run payroll modal
  const [runOpen, setRunOpen] = useState(false);
  const [runForm, setRunForm] = useState({ cutoff_start: "", cutoff_end: "", payout: "" });
  const [running, setRunning] = useState(false);

  useEffect(() => {
    Promise.all([
      authFetch(`${API_BASE_URL}/cnb/payroll/periods`).then(r => r.json()),
      authFetch(`${API_BASE_URL}/cnb/salary-baselines`).then(r => r.json()),
    ])
      .then(([periodsData, baselinesData]) => {
        setPeriods(Array.isArray(periodsData) ? periodsData : []);
        setBaselines(Array.isArray(baselinesData) ? baselinesData : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function openPeriod(period: PayrollPeriod) {
    setSelectedPeriod(period);
    setDetailOpen(true);
    setPeriodPayslips([]);
    setLoadingPayslips(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/cnb/payroll/periods/${period.period_id}/payslips`);
      const data: ComputedPayslip[] = await res.json();
      setPeriodPayslips(Array.isArray(data) ? data : []);
    } catch {}
    finally { setLoadingPayslips(false); }
  }

  async function runPayroll() {
    if (!runForm.cutoff_start || !runForm.cutoff_end || !runForm.payout) {
      Alert.alert("Validation", "All date fields are required.");
      return;
    }
    setRunning(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/cnb/payroll/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cutoff_start_date: runForm.cutoff_start, cutoff_end_date: runForm.cutoff_end, payout_date: runForm.payout }),
      });
      if (!res.ok) throw new Error();
      const result = await res.json();
      Alert.alert("Payroll Run Complete", `Generated ${result.count ?? "?"} payslips.`);
      setRunOpen(false);
      setRunForm({ cutoff_start: "", cutoff_end: "", payout: "" });
      // Refresh periods
      authFetch(`${API_BASE_URL}/cnb/payroll/periods`).then(r => r.json()).then(d => { if (Array.isArray(d)) setPeriods(d); }).catch(() => {});
    } catch {
      Alert.alert("Error", "Payroll run failed.");
    } finally {
      setRunning(false);
    }
  }

  const TABS: Array<{ key: "runs" | "employees" | "baselines"; label: string }> = [
    { key: "runs", label: "Payroll Runs" },
    { key: "employees", label: "Employees" },
    { key: "baselines", label: "Salary Baselines" },
  ];

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}><ActivityIndicator size="large" color="#1E40AF" /><Text style={s.loadingText}>Loading payroll data...</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.inner}>
        {!isMobile && (
          <Sidebar role="hr" userName={session?.name ?? ""} email={session?.email ?? ""} activeScreen="Payroll" navigation={navigation} />
        )}

        <View style={s.main}>
          <ScrollView
            style={s.scroll}
            contentContainerStyle={[s.scrollContent, isMobile && { paddingBottom: BOTTOM_TAB_HEIGHT + 8 }]}
            showsVerticalScrollIndicator={false}
          >
            <GradientHero>
              <Text style={s.heroEyebrow}>HR Officer</Text>
              <Text style={s.heroTitle}>Payroll</Text>
              <Text style={s.heroSub}>Run payroll cutoffs, manage salary baselines, and review generated payslips.</Text>
              <View style={s.heroStats}>
                <View style={s.heroStat}><Text style={s.heroStatLabel}>RUNS</Text><Text style={s.heroStatValue}>{periods.length}</Text></View>
                <View style={s.heroStat}><Text style={s.heroStatLabel}>EMPLOYEES</Text><Text style={s.heroStatValue}>{baselines.length}</Text></View>
              </View>
            </GradientHero>

            {/* Action */}
            <Pressable style={s.runBtn} onPress={() => setRunOpen(true)}>
              <Ionicons name="play-circle-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={s.runBtnText}>Run Payroll Cutoff</Text>
            </Pressable>

            {/* Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabRow}>
              {TABS.map(tab => (
                <Pressable key={tab.key} style={[s.tab, activeTab === tab.key && s.activeTab]} onPress={() => setActiveTab(tab.key)}>
                  <Text style={[s.tabText, activeTab === tab.key && s.activeTabText]}>{tab.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* ── Payroll Runs ──────────────────────────────────────────────── */}
            {activeTab === "runs" && (
              periods.length === 0 ? (
                <View style={s.emptyBox}><Text style={s.emptyText}>No payroll runs yet. Run your first cutoff above.</Text></View>
              ) : (
                periods.map(p => (
                  <View key={p.period_id} style={s.periodCard}>
                    <View style={s.periodTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.periodRange}>{formatDate(p.cutoff_start_date)} – {formatDate(p.cutoff_end_date)}</Text>
                        <Text style={s.periodMeta}>Payout: {formatDate(p.payout_date)}</Text>
                      </View>
                      {!!p.status && <View style={s.statusPill}><Text style={s.statusText}>{p.status}</Text></View>}
                    </View>
                    {(p.total_gross != null || p.employee_count != null) && (
                      <View style={s.periodStatsRow}>
                        {p.employee_count != null && <Text style={s.periodStat}>{p.employee_count} employees</Text>}
                        {p.total_gross != null && <Text style={s.periodStat}>Gross: {toPHP(p.total_gross)}</Text>}
                        {p.total_net != null && <Text style={s.periodStat}>Net: {toPHP(p.total_net)}</Text>}
                      </View>
                    )}
                    <Pressable style={s.detailBtn} onPress={() => openPeriod(p)}>
                      <Ionicons name="list-outline" size={13} color="#1E40AF" style={{ marginRight: 4 }} />
                      <Text style={s.detailBtnText}>View Payslips</Text>
                    </Pressable>
                  </View>
                ))
              )
            )}

            {/* ── Employees/Baselines ───────────────────────────────────────── */}
            {(activeTab === "employees" || activeTab === "baselines") && (
              baselines.length === 0 ? (
                <View style={s.emptyBox}><Text style={s.emptyText}>No salary baselines set up yet.</Text></View>
              ) : (
                baselines.map(b => (
                  <View key={b.user_id} style={s.baselineCard}>
                    <Text style={s.baselineName}>{b.employee_name ?? `Employee ${b.user_id}`}</Text>
                    <View style={s.baselineRow}>
                      <Text style={s.baselineLabel}>Basic Salary</Text>
                      <Text style={s.baselineValue}>{toPHP(b.basic_salary)}</Text>
                    </View>
                    {!!b.pay_frequency && (
                      <View style={s.baselineRow}>
                        <Text style={s.baselineLabel}>Frequency</Text>
                        <Text style={s.baselineValue}>{b.pay_frequency}</Text>
                      </View>
                    )}
                    {!!b.effective_date && (
                      <View style={s.baselineRow}>
                        <Text style={s.baselineLabel}>Effective</Text>
                        <Text style={s.baselineValue}>{formatDate(b.effective_date)}</Text>
                      </View>
                    )}
                  </View>
                ))
              )
            )}
          </ScrollView>

          {isMobile && (
            <BottomTabBar role="hr" activeScreen="Payroll" navigation={navigation} session={session} />
          )}
        </View>
      </View>

      {/* Period Detail Modal */}
      <Modal visible={detailOpen} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
          <View style={s.modalHeaderBar}>
            <Text style={s.modalHeaderTitle}>Payslips for Period</Text>
            <Pressable onPress={() => setDetailOpen(false)}><Ionicons name="close" size={22} color="#475569" /></Pressable>
          </View>
          {selectedPeriod && (
            <Text style={s.detailSubtitle}>{formatDate(selectedPeriod.cutoff_start_date)} – {formatDate(selectedPeriod.cutoff_end_date)}</Text>
          )}
          <ScrollView contentContainerStyle={s.detailContent}>
            {loadingPayslips ? (
              <View style={s.centered}><ActivityIndicator color="#1E40AF" /></View>
            ) : periodPayslips.length === 0 ? (
              <View style={s.emptyBox}><Text style={s.emptyText}>No payslips generated for this period.</Text></View>
            ) : (
              periodPayslips.map(ps => (
                <View key={ps.payslip_id} style={s.psRow}>
                  <Text style={s.psName}>{ps.employee_name ?? "Employee"}</Text>
                  <View style={s.psAmounts}>
                    <Text style={s.psMeta}>Gross: {toPHP(ps.gross_pay)}</Text>
                    <Text style={s.psMeta}>Deductions: {toPHP(ps.total_deductions)}</Text>
                    <Text style={s.psNet}>Net: {toPHP(ps.net_pay)}</Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Run Payroll Modal */}
      <Modal visible={runOpen} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeaderRow}>
              <Text style={s.modalTitle}>Run Payroll Cutoff</Text>
              <Pressable onPress={() => setRunOpen(false)}><Ionicons name="close" size={20} color="#64748B" /></Pressable>
            </View>
            <Text style={s.fieldLabel}>CUTOFF START DATE (YYYY-MM-DD)</Text>
            <TextInput style={s.input} value={runForm.cutoff_start} onChangeText={v => setRunForm(f => ({ ...f, cutoff_start: v }))} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" />
            <Text style={s.fieldLabel}>CUTOFF END DATE (YYYY-MM-DD)</Text>
            <TextInput style={s.input} value={runForm.cutoff_end} onChangeText={v => setRunForm(f => ({ ...f, cutoff_end: v }))} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" />
            <Text style={s.fieldLabel}>PAYOUT DATE (YYYY-MM-DD)</Text>
            <TextInput style={s.input} value={runForm.payout} onChangeText={v => setRunForm(f => ({ ...f, payout: v }))} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" />
            <View style={s.modalBtnRow}>
              <Pressable style={[s.btn, s.btnOutline]} onPress={() => setRunOpen(false)} disabled={running}><Text style={s.btnOutlineText}>Cancel</Text></Pressable>
              <Pressable style={[s.btn, s.btnPrimary]} onPress={runPayroll} disabled={running}>
                {running ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnPrimaryText}>Run Payroll</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  inner: { flex: 1, flexDirection: "row" },
  main: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  loadingText: { marginTop: 12, color: "#64748B", fontSize: 14 },

  heroEyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 1.8, color: "rgba(255,255,255,0.6)", marginBottom: 4, textTransform: "uppercase" },
  heroTitle: { fontSize: 22, fontWeight: "800", color: "#FFFFFF", marginBottom: 4 },
  heroSub: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginBottom: 10 },
  heroStats: { flexDirection: "row", gap: 16, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, padding: 12 },
  heroStat: { flex: 1, alignItems: "center" },
  heroStatLabel: { fontSize: 8, fontWeight: "700", color: "rgba(255,255,255,0.6)", letterSpacing: 1.5, textTransform: "uppercase" },
  heroStatValue: { fontSize: 22, fontWeight: "800", color: "#FFFFFF", marginTop: 4 },

  runBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#1E40AF", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, alignSelf: "flex-start" },
  runBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },

  tabRow: { flexDirection: "row" },
  tab: { paddingHorizontal: 16, paddingVertical: 8, marginRight: 8, borderRadius: 20, backgroundColor: "#F1F5F9" },
  activeTab: { backgroundColor: "#1E40AF" },
  tabText: { fontSize: 13, color: "#64748B", fontWeight: "600" },
  activeTabText: { color: "#FFFFFF" },

  emptyBox: { backgroundColor: "#F1F5F9", borderRadius: 12, padding: 24, alignItems: "center" },
  emptyText: { fontSize: 13, color: "#64748B", textAlign: "center" },

  periodCard: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#E2E8F0", gap: 8 },
  periodTop: { flexDirection: "row", alignItems: "flex-start" },
  periodRange: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  periodMeta: { fontSize: 12, color: "#64748B" },
  statusPill: { backgroundColor: "#EFF6FF", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "#BFDBFE" },
  statusText: { fontSize: 10, fontWeight: "700", color: "#1D4ED8" },
  periodStatsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  periodStat: { fontSize: 12, color: "#64748B" },
  detailBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#EFF6FF", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: "#BFDBFE", alignSelf: "flex-start" },
  detailBtnText: { color: "#1E40AF", fontSize: 12, fontWeight: "600" },

  baselineCard: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#E2E8F0", gap: 6 },
  baselineName: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  baselineRow: { flexDirection: "row", justifyContent: "space-between" },
  baselineLabel: { fontSize: 12, color: "#94A3B8" },
  baselineValue: { fontSize: 13, fontWeight: "600", color: "#0F172A" },

  modalHeaderBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  modalHeaderTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  detailSubtitle: { fontSize: 13, color: "#64748B", paddingHorizontal: 16, paddingTop: 8 },
  detailContent: { padding: 16, gap: 10 },
  psRow: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#E2E8F0", gap: 6 },
  psName: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  psAmounts: { gap: 2 },
  psMeta: { fontSize: 12, color: "#64748B" },
  psNet: { fontSize: 13, fontWeight: "700", color: "#15803D" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 10 },
  modalHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalTitle: { fontSize: 17, fontWeight: "800", color: "#0F172A" },
  fieldLabel: { fontSize: 10, fontWeight: "700", color: "#94A3B8", letterSpacing: 1.2, textTransform: "uppercase" },
  input: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#0F172A" },
  modalBtnRow: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 10, paddingVertical: 11 },
  btnPrimary: { backgroundColor: "#1E40AF" },
  btnPrimaryText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  btnOutline: { borderWidth: 1, borderColor: "#CBD5E1" },
  btnOutlineText: { color: "#475569", fontWeight: "600", fontSize: 14 },
});
