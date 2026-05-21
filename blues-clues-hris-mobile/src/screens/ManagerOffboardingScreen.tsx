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

type CaseSummary = {
  offboarding_case_id: string;
  employee_name?: string;
  employee_email?: string;
  offboarding_type?: string;
  reason?: string;
  last_working_day?: string;
  status: string;
};

type Employee = { user_id: string; name?: string; email?: string };

const OFFBOARDING_TYPES = ["Termination", "End of Contract"];
const REASONS: Record<string, string[]> = {
  Termination:       ["Performance Issues", "Policy Violation", "Redundancy", "Restructuring", "Other"],
  "End of Contract": ["Contract Expired", "Project Completed", "Fixed-Term End", "Other"],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusTone(status: string) {
  if (status === "Submitted")            return { bg: "#FFFBEB", border: "#FDE68A", text: "#B45309", label: "Review Required" };
  if (status === "Manager_Acknowledged") return { bg: "#F0FDF4", border: "#BBF7D0", text: "#15803D", label: "Acknowledged" };
  if (status === "HR_Accepted")          return { bg: "#EFF6FF", border: "#BFDBFE", text: "#1D4ED8", label: "HR In Progress" };
  if (status === "Completed")            return { bg: "#F0FDF4", border: "#BBF7D0", text: "#15803D", label: "Completed" };
  return { bg: "#FEF2F2", border: "#FECACA", text: "#B91C1C", label: "Rejected" };
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function ManagerOffboardingScreen({ route, navigation }: any) {
  const session: UserSession = route.params?.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Initiate form
  const [initiateOpen, setInitiateOpen] = useState(false);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [empSearch, setEmpSearch] = useState("");
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [offboardingType, setOffboardingType] = useState("Termination");
  const [selectedReason, setSelectedReason] = useState("");
  const [lastWorkingDay, setLastWorkingDay] = useState("");
  const [details, setDetails] = useState("");
  const [initiating, setInitiating] = useState(false);

  // Acknowledge
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  // Knowledge transfer
  const [ktOpen, setKtOpen] = useState(false);
  const [ktCaseId, setKtCaseId] = useState<string | null>(null);
  const [ktNotes, setKtNotes] = useState("");
  const [ktSaving, setKtSaving] = useState(false);

  function load() {
    setLoading(true);
    authFetch(`${API_BASE_URL}/offboarding/manager/cases`)
      .then(r => r.json())
      .then((data: CaseSummary[]) => setCases(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    authFetch(`${API_BASE_URL}/users?role=employee`)
      .then(r => r.json())
      .then((data: Employee[]) => setAllEmployees(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  async function initiateOffboarding() {
    if (!selectedEmp) { Alert.alert("Validation", "Select an employee."); return; }
    if (!selectedReason) { Alert.alert("Validation", "Select a reason."); return; }
    if (!lastWorkingDay) { Alert.alert("Validation", "Enter the last working day."); return; }
    setInitiating(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/offboarding/employee/cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_user_id: selectedEmp.user_id,
          offboarding_type: offboardingType,
          reason: selectedReason,
          last_working_day: lastWorkingDay,
          details,
        }),
      });
      if (!res.ok) throw new Error();
      Alert.alert("Initiated", "Offboarding case has been submitted for HR review.");
      setInitiateOpen(false);
      setSelectedEmp(null); setEmpSearch(""); setSelectedReason(""); setLastWorkingDay(""); setDetails("");
      load();
    } catch {
      Alert.alert("Error", "Failed to initiate offboarding.");
    } finally {
      setInitiating(false);
    }
  }

  async function acknowledge(caseId: string) {
    setAcknowledging(caseId);
    try {
      const res = await authFetch(`${API_BASE_URL}/offboarding/manager/cases/${caseId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Manager_Acknowledged" }),
      });
      if (!res.ok) throw new Error();
      setCases(prev => prev.map(c => c.offboarding_case_id === caseId ? { ...c, status: "Manager_Acknowledged" } : c));
    } catch {
      Alert.alert("Error", "Failed to acknowledge case.");
    } finally {
      setAcknowledging(null);
    }
  }

  async function saveKT() {
    if (!ktCaseId || !ktNotes.trim()) return;
    setKtSaving(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/offboarding/manager/cases/${ktCaseId}/knowledge-transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: ktNotes }),
      });
      if (!res.ok) throw new Error();
      Alert.alert("Saved", "Knowledge transfer notes saved.");
      setKtOpen(false); setKtNotes("");
    } catch {
      Alert.alert("Error", "Failed to save knowledge transfer.");
    } finally {
      setKtSaving(false);
    }
  }

  const filteredCases = cases.filter(c => {
    const name = c.employee_name ?? "";
    const matchSearch = search.trim() === "" || name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const filteredEmployees = allEmployees.filter(e =>
    empSearch.trim() === "" || (e.name ?? "").toLowerCase().includes(empSearch.toLowerCase())
  );

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}><ActivityIndicator size="large" color="#1E40AF" /><Text style={s.loadingText}>Loading offboarding cases...</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.inner}>
        {!isMobile && (
          <Sidebar role="manager" userName={session?.name ?? ""} email={session?.email ?? ""} activeScreen="Offboarding" navigation={navigation} />
        )}

        <View style={s.main}>
          <ScrollView
            style={s.scroll}
            contentContainerStyle={[s.scrollContent, isMobile && { paddingBottom: BOTTOM_TAB_HEIGHT + 8 }]}
            showsVerticalScrollIndicator={false}
          >
            <GradientHero>
              <Text style={s.heroEyebrow}>Manager Portal</Text>
              <Text style={s.heroTitle}>Offboarding</Text>
              <Text style={s.heroSub}>Initiate and manage offboarding cases for your direct reports.</Text>
              <View style={s.heroStats}>
                <View style={s.heroStat}><Text style={s.heroStatLabel}>TOTAL</Text><Text style={s.heroStatValue}>{cases.length}</Text></View>
                <View style={s.heroStat}><Text style={s.heroStatLabel}>PENDING</Text><Text style={s.heroStatValue}>{cases.filter(c => c.status === "Submitted").length}</Text></View>
                <View style={s.heroStat}><Text style={s.heroStatLabel}>COMPLETED</Text><Text style={s.heroStatValue}>{cases.filter(c => c.status === "Completed").length}</Text></View>
              </View>
            </GradientHero>

            {/* Actions */}
            <Pressable style={s.primaryBtn} onPress={() => setInitiateOpen(true)}>
              <Ionicons name="add-circle-outline" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={s.primaryBtnText}>Initiate Offboarding</Text>
            </Pressable>

            {/* Search */}
            <View style={s.searchRow}>
              <Ionicons name="search-outline" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput style={s.searchInput} value={search} onChangeText={setSearch} placeholder="Search by employee name..." placeholderTextColor="#94A3B8" />
            </View>

            {/* Cases */}
            {filteredCases.length === 0 ? (
              <View style={s.emptyBox}><Text style={s.emptyText}>No offboarding cases found.</Text></View>
            ) : (
              filteredCases.map(c => {
                const tone = statusTone(c.status);
                return (
                  <View key={c.offboarding_case_id} style={s.caseCard}>
                    <View style={s.caseTop}>
                      <Text style={s.caseName}>{c.employee_name ?? c.employee_email ?? "Unknown"}</Text>
                      <View style={[s.statusPill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                        <Text style={[s.statusText, { color: tone.text }]}>{tone.label}</Text>
                      </View>
                    </View>
                    <Text style={s.caseMeta}>{c.offboarding_type ?? "—"} · {c.reason ?? "—"}</Text>
                    <Text style={s.caseMeta}>Last Day: {formatDate(c.last_working_day)}</Text>
                    <View style={s.caseActions}>
                      {c.status === "Submitted" && (
                        <Pressable style={s.ackBtn} onPress={() => acknowledge(c.offboarding_case_id)} disabled={acknowledging === c.offboarding_case_id}>
                          {acknowledging === c.offboarding_case_id
                            ? <ActivityIndicator size="small" color="#FFFFFF" />
                            : <Text style={s.ackBtnText}>Acknowledge</Text>}
                        </Pressable>
                      )}
                      <Pressable style={s.ktBtn} onPress={() => { setKtCaseId(c.offboarding_case_id); setKtOpen(true); }}>
                        <Ionicons name="document-text-outline" size={13} color="#1E40AF" style={{ marginRight: 4 }} />
                        <Text style={s.ktBtnText}>Knowledge Transfer</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {isMobile && (
            <BottomTabBar role="manager" activeScreen="Offboarding" navigation={navigation} session={session} />
          )}
        </View>
      </View>

      {/* Initiate Form Modal */}
      <Modal visible={initiateOpen} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}>
            <View style={s.modalSheet}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Initiate Offboarding</Text>
                <Pressable onPress={() => setInitiateOpen(false)}><Ionicons name="close" size={20} color="#64748B" /></Pressable>
              </View>

              <Text style={s.fieldLabel}>EMPLOYEE *</Text>
              <TextInput style={s.input} value={empSearch} onChangeText={setEmpSearch} placeholder="Search employee name..." placeholderTextColor="#94A3B8" />
              {empSearch.trim().length > 0 && filteredEmployees.slice(0, 5).map(e => (
                <Pressable key={e.user_id} style={[s.empRow, selectedEmp?.user_id === e.user_id && s.empRowActive]} onPress={() => { setSelectedEmp(e); setEmpSearch(e.name ?? e.email ?? ""); }}>
                  <Text style={s.empName}>{e.name ?? e.email}</Text>
                </Pressable>
              ))}
              {selectedEmp && <Text style={s.selectedEmpText}>Selected: {selectedEmp.name ?? selectedEmp.email}</Text>}

              <Text style={s.fieldLabel}>OFFBOARDING TYPE</Text>
              <View style={s.typeRow}>
                {OFFBOARDING_TYPES.map(t => (
                  <Pressable key={t} style={[s.typeChip, offboardingType === t && s.typeChipActive]} onPress={() => { setOffboardingType(t); setSelectedReason(""); }}>
                    <Text style={[s.typeChipText, offboardingType === t && s.typeChipTextActive]}>{t}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={s.fieldLabel}>REASON *</Text>
              <View style={s.reasonGrid}>
                {(REASONS[offboardingType] ?? []).map(r => (
                  <Pressable key={r} style={[s.reasonChip, selectedReason === r && s.reasonChipActive]} onPress={() => setSelectedReason(r)}>
                    <Text style={[s.reasonChipText, selectedReason === r && s.reasonChipTextActive]}>{r}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={s.fieldLabel}>LAST WORKING DAY (YYYY-MM-DD) *</Text>
              <TextInput style={s.input} value={lastWorkingDay} onChangeText={setLastWorkingDay} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" />

              <Text style={s.fieldLabel}>DETAILS</Text>
              <TextInput style={[s.input, s.inputMulti]} value={details} onChangeText={setDetails} placeholder="Additional context or details..." placeholderTextColor="#94A3B8" multiline numberOfLines={3} />

              <View style={s.modalBtnRow}>
                <Pressable style={[s.btn, s.btnOutline]} onPress={() => setInitiateOpen(false)} disabled={initiating}>
                  <Text style={s.btnOutlineText}>Cancel</Text>
                </Pressable>
                <Pressable style={[s.btn, s.btnPrimary]} onPress={initiateOffboarding} disabled={initiating}>
                  {initiating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnPrimaryText}>Submit</Text>}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Knowledge Transfer Modal */}
      <Modal visible={ktOpen} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Knowledge Transfer Notes</Text>
              <Pressable onPress={() => setKtOpen(false)}><Ionicons name="close" size={20} color="#64748B" /></Pressable>
            </View>
            <TextInput
              style={[s.input, s.inputMulti]}
              value={ktNotes}
              onChangeText={setKtNotes}
              placeholder="Describe ongoing projects, access credentials, contacts, etc."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={6}
            />
            <View style={s.modalBtnRow}>
              <Pressable style={[s.btn, s.btnOutline]} onPress={() => setKtOpen(false)} disabled={ktSaving}>
                <Text style={s.btnOutlineText}>Cancel</Text>
              </Pressable>
              <Pressable style={[s.btn, s.btnPrimary]} onPress={saveKT} disabled={ktSaving || !ktNotes.trim()}>
                {ktSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnPrimaryText}>Save</Text>}
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
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, color: "#64748B", fontSize: 14 },

  heroEyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 1.8, color: "rgba(255,255,255,0.6)", marginBottom: 4, textTransform: "uppercase" },
  heroTitle: { fontSize: 22, fontWeight: "800", color: "#FFFFFF", marginBottom: 4 },
  heroSub: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginBottom: 10 },
  heroStats: { flexDirection: "row", gap: 16, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, padding: 12 },
  heroStat: { flex: 1, alignItems: "center" },
  heroStatLabel: { fontSize: 8, fontWeight: "700", color: "rgba(255,255,255,0.6)", letterSpacing: 1.5, textTransform: "uppercase" },
  heroStatValue: { fontSize: 22, fontWeight: "800", color: "#FFFFFF", marginTop: 4 },

  primaryBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#1E40AF", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, alignSelf: "flex-start" },
  primaryBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },

  searchRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 10, borderWidth: 1, borderColor: "#E2E8F0", paddingHorizontal: 12, paddingVertical: 9 },
  searchInput: { flex: 1, fontSize: 14, color: "#0F172A" },

  emptyBox: { backgroundColor: "#F1F5F9", borderRadius: 12, padding: 24, alignItems: "center" },
  emptyText: { fontSize: 13, color: "#64748B" },

  caseCard: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#E2E8F0", gap: 6 },
  caseTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  caseName: { fontSize: 14, fontWeight: "700", color: "#0F172A", flex: 1, marginRight: 8 },
  caseMeta: { fontSize: 12, color: "#64748B" },
  statusPill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: "700" },
  caseActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  ackBtn: { backgroundColor: "#1E40AF", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  ackBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  ktBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#EFF6FF", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: "#BFDBFE" },
  ktBtnText: { color: "#1E40AF", fontSize: 12, fontWeight: "600" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 10, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalTitle: { fontSize: 17, fontWeight: "800", color: "#0F172A" },
  fieldLabel: { fontSize: 10, fontWeight: "700", color: "#94A3B8", letterSpacing: 1.2, textTransform: "uppercase" },
  input: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#0F172A" },
  inputMulti: { minHeight: 80, textAlignVertical: "top" },
  empRow: { backgroundColor: "#F8FAFC", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "#E2E8F0" },
  empRowActive: { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" },
  empName: { fontSize: 13, color: "#0F172A" },
  selectedEmpText: { fontSize: 12, color: "#1E40AF", fontWeight: "600" },
  typeRow: { flexDirection: "row", gap: 8 },
  typeChip: { flex: 1, borderRadius: 8, paddingVertical: 8, alignItems: "center", borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" },
  typeChipActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  typeChipText: { fontSize: 12, color: "#64748B", fontWeight: "600" },
  typeChipTextActive: { color: "#FFFFFF" },
  reasonGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reasonChip: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" },
  reasonChipActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  reasonChipText: { fontSize: 12, color: "#64748B", fontWeight: "600" },
  reasonChipTextActive: { color: "#FFFFFF" },
  modalBtnRow: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 10, paddingVertical: 11 },
  btnPrimary: { backgroundColor: "#1E40AF" },
  btnPrimaryText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  btnOutline: { borderWidth: 1, borderColor: "#CBD5E1" },
  btnOutlineText: { color: "#475569", fontWeight: "600", fontSize: 14 },
});
