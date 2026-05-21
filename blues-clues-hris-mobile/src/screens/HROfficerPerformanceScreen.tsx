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

type TabType = "All" | "Goals" | "Reviews" | "PIPs" | "Bonuses";
type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

type ApprovalItem = {
  id: string;
  type: "Goal" | "Review" | "PIP" | "Bonus" | "Promotion";
  title: string;
  employee: string;
  metadata: string;
  status: "Pending" | "Approved";
};

type Violation = {
  id: string;
  employee: string;
  type: string;
  severity: Severity;
  date: string;
};

type Employee = { user_id: string; first_name?: string; last_name?: string; email?: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SEVERITY_TONES: Record<Severity, { bg: string; border: string; text: string }> = {
  LOW:      { bg: "#F1F5F9", border: "#E2E8F0", text: "#64748B" },
  MEDIUM:   { bg: "#FFFBEB", border: "#FDE68A", text: "#B45309" },
  HIGH:     { bg: "#FEF2F2", border: "#FECACA", text: "#B91C1C" },
  CRITICAL: { bg: "#FEF2F2", border: "#FECACA", text: "#991B1B" },
};

function mapApproval(a: any): ApprovalItem {
  return {
    id: a.id ?? a.perf_goals_id ?? a.perf_eval_id ?? a.perf_pip_id ?? "",
    type: (a.type ?? "Goal") as ApprovalItem["type"],
    title: a.title ?? `${a.type ?? "Goal"} Approval`,
    employee: a.employee ?? a.employee_name ?? "Unknown",
    metadata: a.metadata ?? "",
    status: (a.status === "Approved" || a.status === "APPROVED") ? "Approved" : "Pending",
  };
}

function mapViolation(v: any): Violation {
  return {
    id: v.id ?? v.perf_viol_id ?? String(Math.random()),
    employee: v.employee ?? v.employee_name ?? "Unknown",
    type: v.type ?? v.violation_type ?? "Unknown",
    severity: ((v.severity ?? "MEDIUM").toUpperCase()) as Severity,
    date: v.date ?? (v.occured_at ? new Date(v.occured_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" }) : "—"),
  };
}

const TABS: TabType[] = ["All", "Goals", "Reviews", "PIPs", "Bonuses"];
const VIOLATION_TYPES = ["Attendance", "Conduct", "Performance", "Policy Violation", "Other"];
const VIOLATION_SEVERITY = ["Low", "Medium", "High", "Critical"];

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function HROfficerPerformanceScreen({ route, navigation }: any) {
  const session: UserSession = route.params?.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [loading, setLoading] = useState(true);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("All");
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Review modal
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalItem | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewing, setReviewing] = useState(false);

  // Violation form modal
  const [violationOpen, setViolationOpen] = useState(false);
  const [vForm, setVForm] = useState({ employeeId: "", employeeName: "", type: "Attendance", severity: "Medium", description: "" });
  const [submittingViolation, setSubmittingViolation] = useState(false);

  useEffect(() => {
    Promise.all([
      authFetch(`${API_BASE_URL}/performance/hr/dashboard`).then(r => r.json()),
      authFetch(`${API_BASE_URL}/performance/hr/approvals`).then(r => r.json()),
      authFetch(`${API_BASE_URL}/performance/violations`).then(r => r.json()),
      authFetch(`${API_BASE_URL}/users?role=employee`).then(r => r.json()),
    ])
      .then(([dash, approvalsData, violationsData, empData]) => {
        setDashboard(dash);
        setApprovals(Array.isArray(approvalsData) ? approvalsData.map(mapApproval) : []);
        setViolations(Array.isArray(violationsData) ? violationsData.map(mapViolation) : []);
        setEmployees(Array.isArray(empData) ? empData : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function approveItem(item: ApprovalItem) {
    setApprovingId(item.id);
    try {
      const endpoint = item.type === "Goal"
        ? `${API_BASE_URL}/performance/goals/${item.id}/approve`
        : item.type === "PIP"
        ? `${API_BASE_URL}/performance/pip/${item.id}/approve`
        : `${API_BASE_URL}/performance/evaluations/${item.id}/approve`;
      const res = await authFetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ comment: "" }) });
      if (!res.ok) throw new Error();
      setApprovals(prev => prev.map(a => a.id === item.id ? { ...a, status: "Approved" } : a));
    } catch {
      Alert.alert("Error", "Approval failed.");
    } finally {
      setApprovingId(null);
    }
  }

  async function submitReview() {
    if (!selectedApproval) return;
    setReviewing(true);
    try {
      await approveItem(selectedApproval);
      setReviewOpen(false);
      setReviewComment("");
    } finally {
      setReviewing(false);
    }
  }

  async function submitViolation() {
    if (!vForm.employeeId || !vForm.description.trim()) { Alert.alert("Validation", "Select an employee and describe the violation."); return; }
    setSubmittingViolation(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/performance/violations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: vForm.employeeId,
          violation_type: vForm.type,
          severity: vForm.severity.toUpperCase(),
          description: vForm.description,
        }),
      });
      if (!res.ok) throw new Error();
      const created = await res.json();
      setViolations(prev => [mapViolation(created), ...prev]);
      setViolationOpen(false);
      setVForm({ employeeId: "", employeeName: "", type: "Attendance", severity: "Medium", description: "" });
    } catch {
      Alert.alert("Error", "Failed to record violation.");
    } finally {
      setSubmittingViolation(false);
    }
  }

  const filteredApprovals = approvals.filter(a => {
    if (activeTab === "All") return true;
    if (activeTab === "Goals")   return a.type === "Goal";
    if (activeTab === "Reviews") return a.type === "Review";
    if (activeTab === "PIPs")    return a.type === "PIP";
    if (activeTab === "Bonuses") return a.type === "Bonus" || a.type === "Promotion";
    return true;
  });

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}><ActivityIndicator size="large" color="#1E40AF" /><Text style={s.loadingText}>Loading performance data...</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.inner}>
        {!isMobile && (
          <Sidebar role="hr" userName={session?.name ?? ""} email={session?.email ?? ""} activeScreen="Performance" navigation={navigation} />
        )}

        <View style={s.main}>
          <ScrollView
            style={s.scroll}
            contentContainerStyle={[s.scrollContent, isMobile && { paddingBottom: BOTTOM_TAB_HEIGHT + 8 }]}
            showsVerticalScrollIndicator={false}
          >
            <GradientHero>
              <Text style={s.heroEyebrow}>HR Officer</Text>
              <Text style={s.heroTitle}>Performance</Text>
              <Text style={s.heroSub}>Review and approve performance goals, evaluations, PIPs, and bonuses.</Text>
              {dashboard && (
                <View style={s.heroStats}>
                  <View style={s.heroStat}><Text style={s.heroStatLabel}>PENDING</Text><Text style={s.heroStatValue}>{approvals.filter(a => a.status === "Pending").length}</Text></View>
                  <View style={s.heroStat}><Text style={s.heroStatLabel}>APPROVED</Text><Text style={s.heroStatValue}>{approvals.filter(a => a.status === "Approved").length}</Text></View>
                  <View style={s.heroStat}><Text style={s.heroStatLabel}>VIOLATIONS</Text><Text style={s.heroStatValue}>{violations.length}</Text></View>
                </View>
              )}
            </GradientHero>

            <View style={s.actionRow}>
              <Pressable style={s.dangerBtn} onPress={() => setViolationOpen(true)}>
                <Ionicons name="warning-outline" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={s.dangerBtnText}>Log Violation</Text>
              </Pressable>
            </View>

            {/* Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabRow}>
              {TABS.map(tab => (
                <Pressable key={tab} style={[s.tab, activeTab === tab && s.activeTab]} onPress={() => setActiveTab(tab)}>
                  <Text style={[s.tabText, activeTab === tab && s.activeTabText]}>{tab}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Approval Items */}
            <Text style={s.sectionLabel}>PENDING APPROVALS</Text>
            {filteredApprovals.filter(a => a.status === "Pending").length === 0 ? (
              <View style={s.emptyBox}><Text style={s.emptyText}>No pending approvals in this category.</Text></View>
            ) : (
              filteredApprovals.filter(a => a.status === "Pending").map(item => (
                <View key={item.id} style={s.approvalCard}>
                  <View style={s.approvalTop}>
                    <View style={s.typeTag}><Text style={s.typeTagText}>{item.type}</Text></View>
                    <Text style={s.approvalStatus}>{item.status}</Text>
                  </View>
                  <Text style={s.approvalTitle}>{item.title}</Text>
                  <Text style={s.approvalEmployee}>{item.employee}</Text>
                  {item.metadata ? <Text style={s.approvalMeta}>{item.metadata}</Text> : null}
                  <View style={s.approvalActions}>
                    <Pressable style={s.reviewBtn} onPress={() => { setSelectedApproval(item); setReviewOpen(true); }}>
                      <Text style={s.reviewBtnText}>Review</Text>
                    </Pressable>
                    <Pressable style={s.approveBtn} onPress={() => approveItem(item)} disabled={approvingId === item.id}>
                      {approvingId === item.id ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.approveBtnText}>Approve</Text>}
                    </Pressable>
                  </View>
                </View>
              ))
            )}

            {/* Violations */}
            {violations.length > 0 && (
              <>
                <Text style={[s.sectionLabel, { marginTop: 8 }]}>VIOLATIONS</Text>
                {violations.map(v => {
                  const tone = SEVERITY_TONES[v.severity];
                  return (
                    <View key={v.id} style={s.violationCard}>
                      <View style={s.violationTop}>
                        <Text style={s.violationEmployee}>{v.employee}</Text>
                        <View style={[s.severityPill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                          <Text style={[s.severityText, { color: tone.text }]}>{v.severity}</Text>
                        </View>
                      </View>
                      <Text style={s.violationType}>{v.type}</Text>
                      <Text style={s.violationDate}>{v.date}</Text>
                    </View>
                  );
                })}
              </>
            )}
          </ScrollView>

          {isMobile && (
            <BottomTabBar role="hr" activeScreen="Performance" navigation={navigation} session={session} />
          )}
        </View>
      </View>

      {/* Review Modal */}
      <Modal visible={reviewOpen} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeaderRow}>
              <Text style={s.modalTitle}>{selectedApproval?.type} Review</Text>
              <Pressable onPress={() => setReviewOpen(false)}><Ionicons name="close" size={20} color="#64748B" /></Pressable>
            </View>
            {selectedApproval && (
              <>
                <Text style={s.reviewTitle}>{selectedApproval.title}</Text>
                <Text style={s.reviewEmployee}>{selectedApproval.employee}</Text>
                {selectedApproval.metadata ? <Text style={s.reviewMeta}>{selectedApproval.metadata}</Text> : null}
                <Text style={s.fieldLabel}>REVIEW COMMENT</Text>
                <TextInput style={[s.input, s.inputMulti]} value={reviewComment} onChangeText={setReviewComment} placeholder="Optional comment..." placeholderTextColor="#94A3B8" multiline numberOfLines={3} />
              </>
            )}
            <View style={s.modalBtnRow}>
              <Pressable style={[s.btn, s.btnOutline]} onPress={() => setReviewOpen(false)} disabled={reviewing}><Text style={s.btnOutlineText}>Cancel</Text></Pressable>
              <Pressable style={[s.btn, s.btnPrimary]} onPress={submitReview} disabled={reviewing}>
                {reviewing ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnPrimaryText}>Approve</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Violation Modal */}
      <Modal visible={violationOpen} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <ScrollView contentContainerStyle={{ justifyContent: "flex-end", flexGrow: 1 }}>
            <View style={s.modalSheet}>
              <View style={s.modalHeaderRow}>
                <Text style={s.modalTitle}>Log Violation</Text>
                <Pressable onPress={() => setViolationOpen(false)}><Ionicons name="close" size={20} color="#64748B" /></Pressable>
              </View>

              <Text style={s.fieldLabel}>EMPLOYEE *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: "row" }}>
                {employees.slice(0, 20).map(e => {
                  const name = `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim() || (e.email ?? "Unknown");
                  const isActive = vForm.employeeId === String(e.user_id);
                  return (
                    <Pressable key={String(e.user_id)} style={[s.empChip, isActive && s.empChipActive]} onPress={() => setVForm(f => ({ ...f, employeeId: String(e.user_id), employeeName: name }))}>
                      <Text style={[s.empChipText, isActive && s.empChipTextActive]}>{name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Text style={s.fieldLabel}>VIOLATION TYPE</Text>
              <View style={s.chipGrid}>
                {VIOLATION_TYPES.map(t => (
                  <Pressable key={t} style={[s.chip, vForm.type === t && s.chipActive]} onPress={() => setVForm(f => ({ ...f, type: t }))}>
                    <Text style={[s.chipText, vForm.type === t && s.chipTextActive]}>{t}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={s.fieldLabel}>SEVERITY</Text>
              <View style={s.chipRow}>
                {VIOLATION_SEVERITY.map(sv => (
                  <Pressable key={sv} style={[s.chip, vForm.severity === sv && s.chipActive]} onPress={() => setVForm(f => ({ ...f, severity: sv }))}>
                    <Text style={[s.chipText, vForm.severity === sv && s.chipTextActive]}>{sv}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={s.fieldLabel}>DESCRIPTION *</Text>
              <TextInput style={[s.input, s.inputMulti]} value={vForm.description} onChangeText={v => setVForm(f => ({ ...f, description: v }))} placeholder="Describe the violation in detail..." placeholderTextColor="#94A3B8" multiline numberOfLines={4} />

              <View style={s.modalBtnRow}>
                <Pressable style={[s.btn, s.btnOutline]} onPress={() => setViolationOpen(false)} disabled={submittingViolation}><Text style={s.btnOutlineText}>Cancel</Text></Pressable>
                <Pressable style={[s.btn, s.dangerBtnFull]} onPress={submitViolation} disabled={submittingViolation}>
                  {submittingViolation ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnPrimaryText}>Submit</Text>}
                </Pressable>
              </View>
            </View>
          </ScrollView>
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
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, color: "#64748B", fontSize: 14 },

  heroEyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 1.8, color: "rgba(255,255,255,0.6)", marginBottom: 4, textTransform: "uppercase" },
  heroTitle: { fontSize: 22, fontWeight: "800", color: "#FFFFFF", marginBottom: 4 },
  heroSub: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginBottom: 10 },
  heroStats: { flexDirection: "row", gap: 16, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, padding: 12 },
  heroStat: { flex: 1, alignItems: "center" },
  heroStatLabel: { fontSize: 8, fontWeight: "700", color: "rgba(255,255,255,0.6)", letterSpacing: 1.5, textTransform: "uppercase" },
  heroStatValue: { fontSize: 22, fontWeight: "800", color: "#FFFFFF", marginTop: 4 },

  actionRow: { flexDirection: "row" },
  dangerBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#DC2626", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, alignSelf: "flex-start" },
  dangerBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  dangerBtnFull: { backgroundColor: "#DC2626" },

  tabRow: { flexDirection: "row" },
  tab: { paddingHorizontal: 16, paddingVertical: 8, marginRight: 8, borderRadius: 20, backgroundColor: "#F1F5F9" },
  activeTab: { backgroundColor: "#1E40AF" },
  tabText: { fontSize: 13, color: "#64748B", fontWeight: "600" },
  activeTabText: { color: "#FFFFFF" },

  sectionLabel: { fontSize: 10, fontWeight: "700", color: "#94A3B8", letterSpacing: 1.5, textTransform: "uppercase" },
  emptyBox: { backgroundColor: "#F1F5F9", borderRadius: 12, padding: 20, alignItems: "center" },
  emptyText: { fontSize: 13, color: "#64748B" },

  approvalCard: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#E2E8F0", gap: 6 },
  approvalTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  typeTag: { backgroundColor: "#EFF6FF", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "#BFDBFE" },
  typeTagText: { fontSize: 10, fontWeight: "700", color: "#1E40AF" },
  approvalStatus: { fontSize: 10, fontWeight: "600", color: "#94A3B8" },
  approvalTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  approvalEmployee: { fontSize: 12, color: "#64748B" },
  approvalMeta: { fontSize: 11, color: "#94A3B8" },
  approvalActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  reviewBtn: { backgroundColor: "#F8FAFC", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: "#E2E8F0" },
  reviewBtnText: { color: "#475569", fontSize: 12, fontWeight: "600" },
  approveBtn: { backgroundColor: "#1E40AF", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  approveBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },

  violationCard: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#E2E8F0", gap: 4 },
  violationTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  violationEmployee: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  violationType: { fontSize: 13, color: "#64748B" },
  violationDate: { fontSize: 11, color: "#94A3B8" },
  severityPill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  severityText: { fontSize: 10, fontWeight: "700" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 10, maxHeight: "90%" },
  modalHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalTitle: { fontSize: 17, fontWeight: "800", color: "#0F172A" },
  reviewTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  reviewEmployee: { fontSize: 13, color: "#64748B" },
  reviewMeta: { fontSize: 12, color: "#94A3B8" },
  fieldLabel: { fontSize: 10, fontWeight: "700", color: "#94A3B8", letterSpacing: 1.2, textTransform: "uppercase" },
  input: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#0F172A" },
  inputMulti: { minHeight: 80, textAlignVertical: "top" },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chipRow: { flexDirection: "row", gap: 8 },
  chip: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" },
  chipActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  chipText: { fontSize: 12, color: "#64748B", fontWeight: "600" },
  chipTextActive: { color: "#FFFFFF" },
  empChip: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0" },
  empChipActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  empChipText: { fontSize: 12, color: "#64748B", fontWeight: "600" },
  empChipTextActive: { color: "#FFFFFF" },
  modalBtnRow: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 10, paddingVertical: 11 },
  btnPrimary: { backgroundColor: "#1E40AF" },
  btnPrimaryText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  btnOutline: { borderWidth: 1, borderColor: "#CBD5E1" },
  btnOutlineText: { color: "#475569", fontWeight: "600", fontSize: 14 },
});
