import React, { useEffect, useMemo, useState } from "react";
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

type PayslipPeriod = {
  cutoff_start_date: string;
  cutoff_end_date: string;
  payout_date?: string | null;
};

type PayslipBreakdown = {
  sss?: number | null;
  philhealth?: number | null;
  pagibig?: number | null;
  benefits?: Array<{ name?: string; type?: string; amount: number }>;
  payFrequency?: string | null;
};

type PayslipEmployee = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  employee_id?: string | null;
};

type Payslip = {
  payslip_id: string;
  payslip_code?: string | null;
  status: string;
  basic_pay_earned: number;
  total_allowances: number;
  gross_pay: number;
  tax_deduction: number;
  statutory_deductions: number;
  total_deductions: number;
  net_pay: number;
  created_at: string;
  period?: PayslipPeriod | null;
  breakdown?: PayslipBreakdown | null;
  employee?: PayslipEmployee | null;
};

type CompensationPackage = {
  salary?: { basic_salary: number; pay_frequency: string; effective_date: string } | null;
  benefits?: Array<{ mapping_id: string; benefit_name?: string; benefit_type?: string; amount: number }>;
  statutory?: { tin_number?: string; sss_number?: string; philhealth_number?: string; pagibig_number?: string };
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toPHP(n: number | string): string {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(Number(n));
}

function maskId(v?: string | null): string {
  if (!v) return "Not set";
  const plain = v.replace(/\s+/g, "");
  return "****" + plain.slice(-4);
}

function formatPeriod(p: Payslip): string {
  if (p.period) {
    const s = new Date(p.period.cutoff_start_date).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
    const e = new Date(p.period.cutoff_end_date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
    return `${s} – ${e}`;
  }
  return new Date(p.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Payslip Detail Modal ─────────────────────────────────────────────────────

function PayslipDetailModal({ payslip, onClose }: { payslip: Payslip; onClose: () => void }) {
  const bd = payslip.breakdown as PayslipBreakdown | null;
  return (
    <Modal visible animationType="slide">
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
        <View style={d.header}>
          <Text style={d.headerTitle}>Payslip Receipt</Text>
          <Pressable onPress={onClose} style={d.closeBtn}>
            <Ionicons name="close" size={22} color="#475569" />
          </Pressable>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={d.content}>
          {/* Period info */}
          <View style={d.periodBox}>
            <Text style={d.periodText}>Pay Period: <Text style={d.periodValue}>{formatPeriod(payslip)}</Text></Text>
            <Text style={d.periodText}>Slip ID: <Text style={d.periodValue}>{payslip.payslip_code ?? payslip.payslip_id}</Text></Text>
            {payslip.period?.payout_date && (
              <Text style={d.periodText}>Payout: <Text style={d.periodValue}>{new Date(payslip.period.payout_date!).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</Text></Text>
            )}
          </View>

          {/* Earnings */}
          <View style={d.section}>
            <Text style={d.sectionLabel}>EARNINGS</Text>
            <View style={d.lineRow}><Text style={d.lineKey}>Basic Pay</Text><Text style={d.lineVal}>{toPHP(payslip.basic_pay_earned)}</Text></View>
            {bd?.benefits?.map((b, i) => (
              <View key={i} style={d.lineRow}><Text style={[d.lineKey, d.muted]}>{b.name ?? b.type ?? "Benefit"}</Text><Text style={[d.lineVal, d.muted]}>{toPHP(b.amount)}</Text></View>
            ))}
            {!bd?.benefits?.length && Number(payslip.total_allowances) > 0 && (
              <View style={d.lineRow}><Text style={[d.lineKey, d.muted]}>Total Allowances</Text><Text style={[d.lineVal, d.muted]}>{toPHP(payslip.total_allowances)}</Text></View>
            )}
            <View style={[d.lineRow, d.totalRow]}><Text style={d.totalKey}>Gross Pay</Text><Text style={d.totalVal}>{toPHP(payslip.gross_pay)}</Text></View>
          </View>

          {/* Deductions */}
          <View style={d.section}>
            <Text style={d.sectionLabel}>DEDUCTIONS</Text>
            <View style={d.lineRow}><Text style={[d.lineKey, d.muted]}>Income Tax (Withheld)</Text><Text style={[d.lineVal, d.muted]}>{toPHP(payslip.tax_deduction)}</Text></View>
            {bd?.sss != null ? (
              <>
                <View style={d.lineRow}><Text style={[d.lineKey, d.muted]}>SSS (Employee Share)</Text><Text style={[d.lineVal, d.muted]}>{toPHP(bd.sss ?? 0)}</Text></View>
                <View style={d.lineRow}><Text style={[d.lineKey, d.muted]}>PhilHealth (Employee Share)</Text><Text style={[d.lineVal, d.muted]}>{toPHP(bd.philhealth ?? 0)}</Text></View>
                <View style={d.lineRow}><Text style={[d.lineKey, d.muted]}>Pag-IBIG</Text><Text style={[d.lineVal, d.muted]}>{toPHP(bd.pagibig ?? 0)}</Text></View>
              </>
            ) : (
              <View style={d.lineRow}><Text style={[d.lineKey, d.muted]}>Statutory Deductions (SSS / PhilHealth / Pag-IBIG)</Text><Text style={[d.lineVal, d.muted]}>{toPHP(payslip.statutory_deductions)}</Text></View>
            )}
            <View style={[d.lineRow, d.totalRow]}><Text style={d.deductKey}>Total Deductions</Text><Text style={d.deductVal}>{toPHP(payslip.total_deductions)}</Text></View>
          </View>

          {/* Net pay */}
          <View style={d.netBox}>
            <Text style={d.netLabel}>Net Pay</Text>
            <Text style={d.netValue}>{toPHP(payslip.net_pay)}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Secondary Auth Modal ─────────────────────────────────────────────────────

function AuthModal({ title, description, onCancel, onVerified }: {
  title: string; description: string; onCancel: () => void; onVerified: () => void;
}) {
  const [password, setPassword] = useState("");
  const [secure, setSecure] = useState(true);
  const [verifying, setVerifying] = useState(false);

  async function verify() {
    if (!password.trim()) { Alert.alert("Validation", "Enter your password."); return; }
    setVerifying(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/auth/verify-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error();
      onVerified();
    } catch {
      Alert.alert("Error", "Password verification failed.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade">
      <View style={d.authOverlay}>
        <View style={d.authSheet}>
          <Text style={d.authTitle}>{title}</Text>
          <Text style={d.authDesc}>{description}</Text>
          <View style={d.passContainer}>
            <TextInput
              style={d.passInput}
              value={password}
              onChangeText={setPassword}
              placeholder="Your account password"
              placeholderTextColor="#94A3B8"
              secureTextEntry={secure}
              autoFocus
            />
            <Pressable style={d.eyeBtn} onPress={() => setSecure(!secure)}>
              <Ionicons name={secure ? "eye-off-outline" : "eye-outline"} size={20} color="#64748B" />
            </Pressable>
          </View>
          <View style={d.authBtnRow}>
            <Pressable style={[d.btn, d.btnOutline]} onPress={onCancel}>
              <Text style={d.btnOutlineText}>Cancel</Text>
            </Pressable>
            <Pressable style={[d.btn, d.btnPrimary]} onPress={verify} disabled={verifying}>
              {verifying ? <ActivityIndicator size="small" color="#fff" /> : <Text style={d.btnPrimaryText}>Verify</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function EmployeePayslipsScreen({ route, navigation }: any) {
  const session: UserSession = route.params?.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"payslips" | "my-package">("payslips");

  const [authOpen, setAuthOpen] = useState(false);
  const [authPurpose, setAuthPurpose] = useState<"receipt" | "package">("receipt");
  const [pendingPayslipId, setPendingPayslipId] = useState<string | null>(null);
  const [openPayslip, setOpenPayslip] = useState<Payslip | null>(null);

  const [packageUnlocked, setPackageUnlocked] = useState(false);
  const [myPackage, setMyPackage] = useState<CompensationPackage | null>(null);
  const [packageLoading, setPackageLoading] = useState(false);

  useEffect(() => {
    authFetch(`${API_BASE_URL}/cnb/me/payslips`)
      .then(r => r.json())
      .then((data: Payslip[]) => setPayslips(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab !== "my-package" || !packageUnlocked || myPackage || packageLoading) return;
    setPackageLoading(true);
    authFetch(`${API_BASE_URL}/cnb/me/compensation`)
      .then(r => r.json())
      .then((data: CompensationPackage) => setMyPackage(data))
      .catch(() => {})
      .finally(() => setPackageLoading(false));
  }, [activeTab, packageUnlocked, myPackage, packageLoading]);

  const currentYear = new Date().getFullYear();
  const totalNetThisYear = useMemo(() => payslips.reduce((sum, p) => {
    const ref = p.period?.payout_date ?? p.created_at;
    if (!ref) return sum;
    return new Date(ref).getFullYear() === currentYear ? sum + Number(p.net_pay) : sum;
  }, 0), [payslips, currentYear]);

  function openReceipt(payslipId: string) {
    setPendingPayslipId(payslipId);
    setAuthPurpose("receipt");
    setAuthOpen(true);
  }

  function onVerified() {
    setAuthOpen(false);
    if (authPurpose === "receipt" && pendingPayslipId) {
      const found = payslips.find(p => p.payslip_id === pendingPayslipId) ?? null;
      setOpenPayslip(found);
      setPendingPayslipId(null);
    } else if (authPurpose === "package") {
      setPackageUnlocked(true);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}>
          <ActivityIndicator size="large" color="#1E40AF" />
          <Text style={s.loadingText}>Loading payslips...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.inner}>
        {!isMobile && (
          <Sidebar role="employee" userName={session?.name ?? ""} email={session?.email ?? ""} activeScreen="Payslips" navigation={navigation} />
        )}

        <View style={s.main}>
          <ScrollView
            style={s.scroll}
            contentContainerStyle={[s.scrollContent, isMobile && { paddingBottom: BOTTOM_TAB_HEIGHT + 8 }]}
            showsVerticalScrollIndicator={false}
          >
            <GradientHero>
              <Text style={s.heroEyebrow}>Employee Self-Service</Text>
              <Text style={s.heroTitle}>Payslips & Compensation</Text>
              <Text style={s.heroSub}>Review released payroll records, then unlock your compensation package only when you need to inspect salary, benefits, or statutory details.</Text>
              <View style={s.heroStats}>
                <View style={s.heroStatBox}>
                  <Text style={s.heroStatLabel}>RECORDS</Text>
                  <Text style={s.heroStatValue}>{payslips.length}</Text>
                </View>
                <View style={s.heroStatBox}>
                  <Text style={s.heroStatLabel}>NET TOTAL {currentYear}</Text>
                  <Text style={s.heroStatValueSm}>{toPHP(totalNetThisYear)}</Text>
                </View>
              </View>
            </GradientHero>

            {/* Tabs */}
            <View style={s.tabRow}>
              {(["payslips", "my-package"] as const).map(tab => (
                <Pressable key={tab} style={[s.tab, activeTab === tab && s.activeTab]} onPress={() => setActiveTab(tab)}>
                  <Text style={[s.tabText, activeTab === tab && s.activeTabText]}>
                    {tab === "payslips" ? "Payslips" : "My Package"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* ── Payslips Tab ─────────────────────────────────────────────── */}
            {activeTab === "payslips" && (
              <>
                {/* Summary stats */}
                <View style={s.statsGrid}>
                  <View style={s.statCard}>
                    <Text style={s.statLabel}>Payslips</Text>
                    <Text style={s.statValue}>{payslips.length}</Text>
                    <Text style={s.statHint}>Released payroll receipts on file.</Text>
                  </View>
                  <View style={s.statCard}>
                    <Text style={s.statLabel}>Total Net Pay ({currentYear})</Text>
                    <Text style={s.statValue}>{toPHP(totalNetThisYear)}</Text>
                    <Text style={s.statHint}>Combined take-home pay this year.</Text>
                  </View>
                  <View style={s.statCard}>
                    <Text style={s.statLabel}>Status</Text>
                    <Text style={s.statValue}>{payslips.length > 0 ? "Ready" : "Empty"}</Text>
                    <Text style={s.statHint}>{payslips.length > 0 ? "Generated from payroll engine." : "No payroll records yet."}</Text>
                  </View>
                </View>

                {payslips.length === 0 ? (
                  <View style={s.emptyBox}>
                    <Text style={s.emptyText}>No payslips yet. Your HR team will generate payslips after running the payroll cutoff.</Text>
                  </View>
                ) : (
                  payslips.map(p => (
                    <View key={p.payslip_id} style={s.payslipCard}>
                      <Text style={s.payslipPeriod}>{formatPeriod(p)}</Text>
                      <Text style={s.payslipMeta}>
                        Generated: {new Date(p.created_at).toLocaleDateString()} · {p.status}
                      </Text>
                      <View style={s.payslipFooter}>
                        <View style={s.netPill}><Text style={s.netPillText}>Net {toPHP(p.net_pay)}</Text></View>
                        <Pressable style={s.viewBtn} onPress={() => openReceipt(p.payslip_id)}>
                          <Ionicons name="eye-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                          <Text style={s.viewBtnText}>View Receipt</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))
                )}
              </>
            )}

            {/* ── My Package Tab ───────────────────────────────────────────── */}
            {activeTab === "my-package" && (
              !packageUnlocked ? (
                <View style={s.lockCard}>
                  <Ionicons name="lock-closed-outline" size={32} color="#64748B" style={{ marginBottom: 10 }} />
                  <Text style={s.lockTitle}>My Package</Text>
                  <Text style={s.lockDesc}>Verify your identity to view your salary, benefits, and statutory IDs.</Text>
                  <Pressable style={s.unlockBtn} onPress={() => { setAuthPurpose("package"); setAuthOpen(true); }}>
                    <Text style={s.unlockBtnText}>Unlock My Package</Text>
                  </Pressable>
                </View>
              ) : packageLoading ? (
                <View style={s.centered}><ActivityIndicator color="#1E40AF" /></View>
              ) : (
                <>
                  {/* Salary */}
                  <View style={s.pkgCard}>
                    <Text style={s.pkgTitle}>Salary</Text>
                    {myPackage?.salary ? (
                      <View style={s.pkgGrid}>
                        {[
                          { label: "Basic Salary", value: toPHP(myPackage.salary.basic_salary) },
                          { label: "Pay Frequency", value: myPackage.salary.pay_frequency },
                          { label: "Effective Date", value: new Date(myPackage.salary.effective_date).toLocaleDateString() },
                        ].map(item => (
                          <View key={item.label} style={s.pkgItem}>
                            <Text style={s.pkgItemLabel}>{item.label}</Text>
                            <Text style={s.pkgItemValue}>{item.value}</Text>
                          </View>
                        ))}
                      </View>
                    ) : <Text style={s.pkgEmpty}>Your salary record has not been set up yet. Contact HR.</Text>}
                  </View>

                  {/* Benefits */}
                  <View style={s.pkgCard}>
                    <Text style={s.pkgTitle}>Benefits</Text>
                    {myPackage?.benefits?.length ? (
                      myPackage.benefits.map(b => (
                        <View key={b.mapping_id} style={s.benefitRow}>
                          <Text style={s.benefitName}>{b.benefit_name ?? "Unknown Benefit"}</Text>
                          <Text style={s.benefitMeta}>{b.benefit_type ?? "N/A"} · {toPHP(b.amount)}</Text>
                        </View>
                      ))
                    ) : <Text style={s.pkgEmpty}>No assigned benefits.</Text>}
                  </View>

                  {/* Statutory IDs */}
                  <View style={s.pkgCard}>
                    <Text style={s.pkgTitle}>Statutory IDs</Text>
                    <View style={s.pkgGrid}>
                      {[
                        { label: "TIN", value: maskId(myPackage?.statutory?.tin_number) },
                        { label: "SSS", value: maskId(myPackage?.statutory?.sss_number) },
                        { label: "PhilHealth", value: maskId(myPackage?.statutory?.philhealth_number) },
                        { label: "Pag-IBIG", value: maskId(myPackage?.statutory?.pagibig_number) },
                      ].map(item => (
                        <View key={item.label} style={s.pkgItem}>
                          <Text style={s.pkgItemLabel}>{item.label}</Text>
                          <Text style={s.pkgItemValue}>{item.value}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </>
              )
            )}
          </ScrollView>

          {isMobile && (
            <BottomTabBar role="employee" activeScreen="Payslips" navigation={navigation} session={session} />
          )}
        </View>
      </View>

      {authOpen && (
        <AuthModal
          title={authPurpose === "package" ? "Unlock Compensation Package" : "Unlock Payslip"}
          description="Enter your account password to proceed."
          onCancel={() => { setAuthOpen(false); setPendingPayslipId(null); }}
          onVerified={onVerified}
        />
      )}

      {openPayslip && (
        <PayslipDetailModal payslip={openPayslip} onClose={() => setOpenPayslip(null)} />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  inner: { flex: 1, flexDirection: "row" },
  main: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 14 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 32 },
  loadingText: { marginTop: 12, color: "#64748B", fontSize: 14 },

  heroEyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 1.8, color: "rgba(255,255,255,0.6)", marginBottom: 4, textTransform: "uppercase" },
  heroTitle: { fontSize: 22, fontWeight: "800", color: "#FFFFFF", marginBottom: 4 },
  heroSub: { fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 17, marginBottom: 12 },
  heroStats: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 14, padding: 14, gap: 16 },
  heroStatBox: { flex: 1 },
  heroStatLabel: { fontSize: 9, fontWeight: "700", color: "rgba(255,255,255,0.6)", letterSpacing: 1.5, textTransform: "uppercase" },
  heroStatValue: { fontSize: 24, fontWeight: "800", color: "#FFFFFF", marginTop: 6 },
  heroStatValueSm: { fontSize: 17, fontWeight: "800", color: "#FFFFFF", marginTop: 6 },

  tabRow: { flexDirection: "row", backgroundColor: "#F1F5F9", borderRadius: 14, padding: 4, gap: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  activeTab: { backgroundColor: "#FFFFFF" },
  tabText: { fontSize: 13, color: "#64748B", fontWeight: "600" },
  activeTabText: { color: "#0F172A" },

  statsGrid: { gap: 10 },
  statCard: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#E2E8F0" },
  statLabel: { fontSize: 12, color: "#64748B", fontWeight: "600" },
  statValue: { fontSize: 22, fontWeight: "800", color: "#0F172A", marginTop: 4 },
  statHint: { fontSize: 11, color: "#94A3B8", marginTop: 4 },

  emptyBox: { backgroundColor: "#F1F5F9", borderRadius: 12, padding: 24, alignItems: "center" },
  emptyText: { fontSize: 13, color: "#64748B", textAlign: "center", lineHeight: 18 },

  payslipCard: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#E2E8F0", gap: 6 },
  payslipPeriod: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  payslipMeta: { fontSize: 12, color: "#64748B" },
  payslipFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  netPill: { backgroundColor: "#ECFDF5", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: "#A7F3D0" },
  netPillText: { fontSize: 13, fontWeight: "700", color: "#065F46" },
  viewBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#1E40AF", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  viewBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },

  lockCard: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 24, borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center", gap: 8 },
  lockTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  lockDesc: { fontSize: 13, color: "#64748B", textAlign: "center", lineHeight: 18 },
  unlockBtn: { backgroundColor: "#1E40AF", borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10, marginTop: 8 },
  unlockBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },

  pkgCard: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#E2E8F0", gap: 10 },
  pkgTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  pkgGrid: { gap: 8 },
  pkgItem: { backgroundColor: "#F8FAFC", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#E2E8F0" },
  pkgItemLabel: { fontSize: 11, color: "#64748B" },
  pkgItemValue: { fontSize: 15, fontWeight: "700", color: "#0F172A", marginTop: 4 },
  pkgEmpty: { fontSize: 13, color: "#94A3B8" },
  benefitRow: { backgroundColor: "#F8FAFC", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#E2E8F0" },
  benefitName: { fontSize: 14, fontWeight: "600", color: "#0F172A" },
  benefitMeta: { fontSize: 12, color: "#64748B", marginTop: 2 },
});

const d = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  closeBtn: { padding: 4 },
  content: { padding: 16, gap: 16 },
  periodBox: { backgroundColor: "#F1F5F9", borderRadius: 10, padding: 12, gap: 4 },
  periodText: { fontSize: 12, color: "#64748B" },
  periodValue: { color: "#0F172A", fontWeight: "600" },
  section: { gap: 8 },
  sectionLabel: { fontSize: 10, fontWeight: "700", color: "#94A3B8", letterSpacing: 1.5 },
  lineRow: { flexDirection: "row", justifyContent: "space-between" },
  lineKey: { fontSize: 14, color: "#0F172A", flex: 1 },
  lineVal: { fontSize: 14, color: "#0F172A", fontWeight: "500" },
  muted: { color: "#64748B" },
  totalRow: { borderTopWidth: 1, borderTopColor: "#E2E8F0", paddingTop: 8, marginTop: 4 },
  totalKey: { fontSize: 14, fontWeight: "700", color: "#0F172A", flex: 1 },
  totalVal: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  deductKey: { fontSize: 14, fontWeight: "700", color: "#B91C1C", flex: 1 },
  deductVal: { fontSize: 14, fontWeight: "700", color: "#B91C1C" },
  netBox: { backgroundColor: "#F0FDF4", borderRadius: 10, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: "#BBF7D0" },
  netLabel: { fontSize: 16, fontWeight: "800", color: "#14532D" },
  netValue: { fontSize: 18, fontWeight: "800", color: "#14532D" },
  authOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 },
  authSheet: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 24, gap: 12 },
  authTitle: { fontSize: 17, fontWeight: "800", color: "#0F172A" },
  authDesc: { fontSize: 13, color: "#64748B" },
  passContainer: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 12, backgroundColor: "#FFFFFF" },
  passInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: "#0F172A" },
  eyeBtn: { paddingLeft: 8 },
  authBtnRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  btn: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 10, paddingVertical: 11 },
  btnPrimary: { backgroundColor: "#1E40AF" },
  btnPrimaryText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  btnOutline: { borderWidth: 1, borderColor: "#CBD5E1" },
  btnOutlineText: { color: "#475569", fontWeight: "600", fontSize: 14 },
});
