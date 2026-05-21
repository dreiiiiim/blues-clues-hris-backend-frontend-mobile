/**
 * HROfficerPayslipsScreen — mirrors web behavior where /hr/payslips redirects
 * to /employee/payslips (the HR officer views their own payslips as an employee would).
 */
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

type PayslipPeriod = { cutoff_start_date: string; cutoff_end_date: string; payout_date?: string | null };
type Payslip = {
  payslip_id: string; payslip_code?: string | null; status: string;
  basic_pay_earned: number; total_allowances: number; gross_pay: number;
  tax_deduction: number; statutory_deductions: number; total_deductions: number;
  net_pay: number; created_at: string; period?: PayslipPeriod | null; breakdown?: any;
};

function toPHP(n: number | string) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(Number(n));
}
function formatPeriod(p: Payslip) {
  if (p.period) {
    const s = new Date(p.period.cutoff_start_date).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
    const e = new Date(p.period.cutoff_end_date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
    return `${s} – ${e}`;
  }
  return new Date(p.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function PayslipModal({ payslip, onClose }: { payslip: Payslip; onClose: () => void }) {
  return (
    <Modal visible animationType="slide">
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
        <View style={d.header}><Text style={d.headerTitle}>Payslip Receipt</Text><Pressable onPress={onClose}><Ionicons name="close" size={22} color="#475569" /></Pressable></View>
        <ScrollView contentContainerStyle={d.content}>
          <View style={d.periodBox}>
            <Text style={d.periodText}>Pay Period: <Text style={d.bold}>{formatPeriod(payslip)}</Text></Text>
            <Text style={d.periodText}>Slip ID: <Text style={d.bold}>{payslip.payslip_code ?? payslip.payslip_id}</Text></Text>
          </View>
          <View style={d.section}>
            <Text style={d.sectionLabel}>EARNINGS</Text>
            <View style={d.row}><Text style={d.key}>Basic Pay</Text><Text style={d.val}>{toPHP(payslip.basic_pay_earned)}</Text></View>
            {Number(payslip.total_allowances) > 0 && <View style={d.row}><Text style={[d.key, d.muted]}>Allowances</Text><Text style={[d.val, d.muted]}>{toPHP(payslip.total_allowances)}</Text></View>}
            <View style={[d.row, d.divider]}><Text style={d.boldKey}>Gross Pay</Text><Text style={d.boldVal}>{toPHP(payslip.gross_pay)}</Text></View>
          </View>
          <View style={d.section}>
            <Text style={d.sectionLabel}>DEDUCTIONS</Text>
            <View style={d.row}><Text style={[d.key, d.muted]}>Income Tax</Text><Text style={[d.val, d.muted]}>{toPHP(payslip.tax_deduction)}</Text></View>
            <View style={d.row}><Text style={[d.key, d.muted]}>Statutory</Text><Text style={[d.val, d.muted]}>{toPHP(payslip.statutory_deductions)}</Text></View>
            <View style={[d.row, d.divider]}><Text style={d.deductKey}>Total Deductions</Text><Text style={d.deductVal}>{toPHP(payslip.total_deductions)}</Text></View>
          </View>
          <View style={d.netBox}><Text style={d.netLabel}>Net Pay</Text><Text style={d.netValue}>{toPHP(payslip.net_pay)}</Text></View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function AuthModal({ onCancel, onVerified }: { onCancel: () => void; onVerified: () => void }) {
  const [password, setPassword] = useState("");
  const [secure, setSecure] = useState(true);
  const [verifying, setVerifying] = useState(false);
  async function verify() {
    if (!password.trim()) return;
    setVerifying(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/auth/verify-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      if (!res.ok) throw new Error();
      onVerified();
    } catch { Alert.alert("Error", "Password verification failed."); }
    finally { setVerifying(false); }
  }
  return (
    <Modal visible transparent animationType="fade">
      <View style={d.authOverlay}>
        <View style={d.authSheet}>
          <Text style={d.authTitle}>Unlock Payslip</Text>
          <Text style={d.authDesc}>Enter your account password to view payslip details.</Text>
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
            <Pressable style={[d.btn, d.btnOutline]} onPress={onCancel}><Text style={d.btnOutlineText}>Cancel</Text></Pressable>
            <Pressable style={[d.btn, d.btnPrimary]} onPress={verify} disabled={verifying}>
              {verifying ? <ActivityIndicator size="small" color="#fff" /> : <Text style={d.btnPrimaryText}>Verify</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function HROfficerPayslipsScreen({ route, navigation }: any) {
  const session: UserSession = route.params?.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [openPayslip, setOpenPayslip] = useState<Payslip | null>(null);
  const currentYear = new Date().getFullYear();
  const totalNet = useMemo(() => payslips.reduce((sum, p) => {
    const ref = p.period?.payout_date ?? p.created_at;
    return ref && new Date(ref).getFullYear() === currentYear ? sum + Number(p.net_pay) : sum;
  }, 0), [payslips, currentYear]);

  useEffect(() => {
    authFetch(`${API_BASE_URL}/cnb/me/payslips`).then(r => r.json()).then((data: Payslip[]) => setPayslips(Array.isArray(data) ? data : [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <SafeAreaView style={s.container}><View style={s.centered}><ActivityIndicator size="large" color="#1E40AF" /><Text style={s.loadingText}>Loading payslips...</Text></View></SafeAreaView>
  );

  return (
    <SafeAreaView style={s.container}>
      <View style={s.inner}>
        {!isMobile && <Sidebar role="hr" userName={session?.name ?? ""} email={session?.email ?? ""} activeScreen="Payslips" navigation={navigation} />}
        <View style={s.main}>
          <ScrollView style={s.scroll} contentContainerStyle={[s.scrollContent, isMobile && { paddingBottom: BOTTOM_TAB_HEIGHT + 8 }]} showsVerticalScrollIndicator={false}>
            <GradientHero>
              <Text style={s.heroEyebrow}>HR Officer</Text>
              <Text style={s.heroTitle}>Payslips & Compensation</Text>
              <Text style={s.heroSub}>Review your released payroll records.</Text>
              <View style={s.heroStats}>
                <View style={s.heroStat}><Text style={s.heroStatLabel}>RECORDS</Text><Text style={s.heroStatValue}>{payslips.length}</Text></View>
                <View style={s.heroStat}><Text style={s.heroStatLabel}>NET {currentYear}</Text><Text style={s.heroStatValueSm}>{toPHP(totalNet)}</Text></View>
              </View>
            </GradientHero>

            {[
              { label: "Payslips", value: String(payslips.length), hint: "Released payroll receipts on file." },
              { label: `Total net pay (${currentYear})`, value: toPHP(totalNet), hint: "Combined take-home pay this year." },
              { label: "Status", value: payslips.length > 0 ? "Ready" : "Empty", hint: payslips.length > 0 ? "Generated from payroll engine." : "No payroll records yet." },
            ].map(stat => (
              <View key={stat.label} style={s.statCard}><Text style={s.statLabel}>{stat.label}</Text><Text style={s.statValue}>{stat.value}</Text><Text style={s.statHint}>{stat.hint}</Text></View>
            ))}

            {payslips.length === 0 ? (
              <View style={s.emptyBox}><Text style={s.emptyText}>No payslips yet. Your HR team will generate payslips after running the payroll cutoff.</Text></View>
            ) : (
              payslips.map(p => (
                <View key={p.payslip_id} style={s.payslipCard}>
                  <Text style={s.payslipPeriod}>{formatPeriod(p)}</Text>
                  <Text style={s.payslipMeta}>Generated: {new Date(p.created_at).toLocaleDateString()} · {p.status}</Text>
                  <View style={s.payslipFooter}>
                    <View style={s.netPill}><Text style={s.netPillText}>Net {toPHP(p.net_pay)}</Text></View>
                    <Pressable style={s.viewBtn} onPress={() => { setPendingId(p.payslip_id); setAuthOpen(true); }}>
                      <Ionicons name="eye-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={s.viewBtnText}>View Receipt</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
          {isMobile && <BottomTabBar role="hr" activeScreen="Payslips" navigation={navigation} session={session} />}
        </View>
      </View>
      {authOpen && <AuthModal onCancel={() => { setAuthOpen(false); setPendingId(null); }} onVerified={() => { setAuthOpen(false); if (pendingId) { setOpenPayslip(payslips.find(p => p.payslip_id === pendingId) ?? null); setPendingId(null); } }} />}
      {openPayslip && <PayslipModal payslip={openPayslip} onClose={() => setOpenPayslip(null)} />}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  inner: { flex: 1, flexDirection: "row" },
  main: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 14 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, color: "#64748B", fontSize: 14 },
  heroEyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 1.8, color: "rgba(255,255,255,0.6)", marginBottom: 4, textTransform: "uppercase" },
  heroTitle: { fontSize: 22, fontWeight: "800", color: "#FFFFFF", marginBottom: 4 },
  heroSub: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginBottom: 12 },
  heroStats: { flexDirection: "row", gap: 16, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, padding: 12 },
  heroStat: { flex: 1 },
  heroStatLabel: { fontSize: 9, fontWeight: "700", color: "rgba(255,255,255,0.6)", letterSpacing: 1.5, textTransform: "uppercase" },
  heroStatValue: { fontSize: 24, fontWeight: "800", color: "#FFFFFF", marginTop: 6 },
  heroStatValueSm: { fontSize: 16, fontWeight: "800", color: "#FFFFFF", marginTop: 6 },
  statCard: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#E2E8F0" },
  statLabel: { fontSize: 12, color: "#64748B", fontWeight: "600" },
  statValue: { fontSize: 20, fontWeight: "800", color: "#0F172A", marginTop: 4 },
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
});

const d = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  content: { padding: 16, gap: 16 },
  periodBox: { backgroundColor: "#F1F5F9", borderRadius: 10, padding: 12, gap: 4 },
  periodText: { fontSize: 12, color: "#64748B" },
  bold: { color: "#0F172A", fontWeight: "600" },
  section: { gap: 8 },
  sectionLabel: { fontSize: 10, fontWeight: "700", color: "#94A3B8", letterSpacing: 1.5 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  key: { fontSize: 14, color: "#0F172A", flex: 1 },
  val: { fontSize: 14, color: "#0F172A", fontWeight: "500" },
  muted: { color: "#64748B" },
  divider: { borderTopWidth: 1, borderTopColor: "#E2E8F0", paddingTop: 8, marginTop: 4 },
  boldKey: { fontSize: 14, fontWeight: "700", color: "#0F172A", flex: 1 },
  boldVal: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
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
  authBtnRow: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 10, paddingVertical: 11 },
  btnPrimary: { backgroundColor: "#1E40AF" },
  btnPrimaryText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  btnOutline: { borderWidth: 1, borderColor: "#CBD5E1" },
  btnOutlineText: { color: "#475569", fontWeight: "600", fontSize: 14 },
});
