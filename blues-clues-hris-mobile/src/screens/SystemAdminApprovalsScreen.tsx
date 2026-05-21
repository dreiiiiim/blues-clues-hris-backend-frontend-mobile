import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
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

type LeaveRequest = {
  request_id: string;
  employee_name?: string;
  employee?: { first_name?: string | null; last_name?: string | null; email?: string | null } | null;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
  reason?: string;
};

type DocumentApproval = {
  id: string;
  employee_name?: string;
  document_type: string;
  file_name?: string;
  status: string;
  uploaded_at?: string;
  user?: { first_name?: string | null; last_name?: string | null; email?: string | null } | null;
  user_profile?: { first_name?: string | null; last_name?: string | null; email?: string | null } | null;
  file_url?: string;
};

type ChangeRequest = {
  change_request_id?: string;
  request_id?: string;
  id?: string;
  employee_name?: string;
  field_type: string;
  requested_value?: string;
  reason?: string;
  status: string;
  created_at?: string;
  user?: { first_name?: string | null; last_name?: string | null; email?: string | null } | null;
  user_profile?: { first_name?: string | null; last_name?: string | null; email?: string | null } | null;
};

type TabType = "leave" | "documents" | "profile-changes";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveEmployeeName(item: {
  employee_name?: string;
  employee?: { first_name?: string | null; last_name?: string | null; email?: string | null } | null;
  user?: { first_name?: string | null; last_name?: string | null; email?: string | null } | null;
  user_profile?: { first_name?: string | null; last_name?: string | null; email?: string | null } | null;
}): string {
  if (item.employee_name) return item.employee_name;
  const nested = item.employee ?? item.user ?? item.user_profile;
  if (nested) {
    const name = [nested.first_name, nested.last_name].filter(Boolean).join(" ");
    if (name.trim()) return name.trim();
    if (nested.email) return nested.email;
  }
  return "Employee";
}

function statusTone(status: string) {
  const s = status.toLowerCase();
  if (s.includes("approved") || s.includes("accept"))   return { bg: "#F0FDF4", border: "#BBF7D0", text: "#15803D" };
  if (s.includes("rejected") || s.includes("denied"))   return { bg: "#FEF2F2", border: "#FECACA", text: "#B91C1C" };
  return { bg: "#FFFBEB", border: "#FDE68A", text: "#B45309" };
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function SystemAdminApprovalsScreen({ route, navigation }: any) {
  const session: UserSession = route.params?.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [activeTab, setActiveTab] = useState<TabType>("documents");
  const [loading, setLoading] = useState(true);

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [docApprovals, setDocApprovals] = useState<DocumentApproval[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);

  // Reject modal
  const [rejectModal, setRejectModal] = useState<{ type: TabType; id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actioning, setActioning] = useState<string | null>(null);

  async function handleViewDocument(url?: string) {
    if (!url) {
      Alert.alert("No File Available", "This document has no uploaded file URL.");
      return;
    }
    const supported = await Linking.canOpenURL(url).catch(() => false);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Error", "Your device is unable to open this link.");
    }
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([
      authFetch(`${API_BASE_URL}/leave/requests?status=Pending`).then(r => r.json()).catch(() => []),
      authFetch(`${API_BASE_URL}/users/documents/pending`).then(r => r.json()).catch(() => []),
      authFetch(`${API_BASE_URL}/users/change-requests?status=pending`).then(r => r.json()).catch(() => []),
    ]).then(([leave, docs, changes]) => {
      setLeaveRequests(Array.isArray(leave) ? leave : []);
      setDocApprovals(Array.isArray(docs) ? docs : []);
      setChangeRequests(Array.isArray(changes) ? changes : []);
    }).finally(() => setLoading(false));
  }, []);

  async function approveLeave(id: string) {
    setActioning(id);
    try {
      const res = await authFetch(`${API_BASE_URL}/leave/requests/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "Approved" }) });
      if (!res.ok) throw new Error();
      setLeaveRequests(prev => prev.map(r => r.request_id === id ? { ...r, status: "Approved" } : r));
    } catch { Alert.alert("Error", "Action failed."); }
    finally { setActioning(null); }
  }

  async function approveDocument(id: string) {
    setActioning(id);
    try {
      const res = await authFetch(`${API_BASE_URL}/users/documents/${id}/approve`, { method: "PATCH" });
      if (!res.ok) throw new Error();
      setDocApprovals(prev => prev.map(d => d.id === id ? { ...d, status: "approved" } : d));
    } catch { Alert.alert("Error", "Action failed."); }
    finally { setActioning(null); }
  }

  async function approveChange(id: string) {
    setActioning(id);
    try {
      const res = await authFetch(`${API_BASE_URL}/users/change-requests/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "approved" }) });
      if (!res.ok) throw new Error();
      setChangeRequests(prev => prev.map(r => r.change_request_id === id ? { ...r, status: "approved" } : r));
    } catch { Alert.alert("Error", "Action failed."); }
    finally { setActioning(null); }
  }

  async function submitReject() {
    if (!rejectModal) return;
    const { type, id } = rejectModal;
    setActioning(id);
    try {
      let endpoint = "";
      let body: object = { status: "rejected", reason: rejectReason };
      if (type === "leave")           endpoint = `${API_BASE_URL}/leave/requests/${id}`;
      else if (type === "documents")  { endpoint = `${API_BASE_URL}/users/documents/${id}/reject`; body = { rejection_reason: rejectReason }; }
      else                            endpoint = `${API_BASE_URL}/users/change-requests/${id}`;

      const res = await authFetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error();
      if (type === "leave")           setLeaveRequests(prev => prev.map(r => r.request_id === id ? { ...r, status: "Rejected" } : r));
      else if (type === "documents")  setDocApprovals(prev => prev.map(d => d.id === id ? { ...d, status: "rejected" } : d));
      else                            setChangeRequests(prev => prev.map(r => r.change_request_id === id ? { ...r, status: "rejected" } : r));
      setRejectModal(null);
      setRejectReason("");
    } catch { Alert.alert("Error", "Rejection failed."); }
    finally { setActioning(null); }
  }

  const TABS: Array<{ key: TabType; label: string }> = [
    { key: "leave",          label: "Leave" },
    { key: "documents",      label: "Documents" },
    { key: "profile-changes", label: "Profile Changes" },
  ];

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}><ActivityIndicator size="large" color="#1E40AF" /><Text style={s.loadingText}>Loading approvals...</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.inner}>
        {!isMobile && (
          <Sidebar role="system_admin" userName={session?.name ?? ""} email={session?.email ?? ""} activeScreen="Approvals" navigation={navigation} />
        )}

        <View style={s.main}>
          <ScrollView
            style={s.scroll}
            contentContainerStyle={[s.scrollContent, isMobile && { paddingBottom: BOTTOM_TAB_HEIGHT + 8 }]}
            showsVerticalScrollIndicator={false}
          >
            <GradientHero>
              <Text style={s.heroEyebrow}>System Admin</Text>
              <Text style={s.heroTitle}>Approvals</Text>
              <Text style={s.heroSub}>Review and action pending employee document submissions and profile change requests.</Text>
              <View style={s.heroStats}>
                <View style={s.heroStat}><Text style={s.heroStatLabel}>LEAVE</Text><Text style={s.heroStatValue}>{leaveRequests.filter(r => r.status === "Pending" || r.status === "pending").length}</Text></View>
                <View style={s.heroStat}><Text style={s.heroStatLabel}>DOCS</Text><Text style={s.heroStatValue}>{docApprovals.filter(d => d.status === "pending").length}</Text></View>
                <View style={s.heroStat}><Text style={s.heroStatLabel}>CHANGES</Text><Text style={s.heroStatValue}>{changeRequests.filter(r => r.status === "pending").length}</Text></View>
              </View>
            </GradientHero>

            {/* Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabRow}>
              {TABS.map(tab => (
                <Pressable key={tab.key} style={[s.tab, activeTab === tab.key && s.activeTab]} onPress={() => setActiveTab(tab.key)}>
                  <Text style={[s.tabText, activeTab === tab.key && s.activeTabText]}>{tab.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* ── Leave ──────────────────────────────────────────────────────── */}
            {activeTab === "leave" && (
              leaveRequests.length === 0 ? (
                <View style={s.emptyBox}><Text style={s.emptyText}>No leave requests.</Text></View>
              ) : (
                leaveRequests.map(r => {
                  const tone = statusTone(r.status);
                  return (
                    <View key={r.request_id} style={s.card}>
                      <View style={s.cardTop}>
                        <Text style={s.cardName}>{resolveEmployeeName(r)}</Text>
                        <View style={[s.pill, { backgroundColor: tone.bg, borderColor: tone.border }]}><Text style={[s.pillText, { color: tone.text }]}>{r.status}</Text></View>
                      </View>
                      <Text style={s.cardMeta}>{r.leave_type} · {formatDate(r.start_date)} – {formatDate(r.end_date)}</Text>
                      {!!r.reason && <Text style={s.cardReason}>{r.reason}</Text>}
                      {(r.status === "Pending" || r.status === "pending") && (
                        <View style={s.actionRow}>
                          <Pressable style={s.approveBtn} onPress={() => approveLeave(r.request_id)} disabled={actioning === r.request_id}>
                            {actioning === r.request_id ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                            <Text style={s.approveBtnText}>Approve</Text>
                          </Pressable>
                          <Pressable style={s.rejectBtn} onPress={() => setRejectModal({ type: "leave", id: r.request_id })}>
                            <Ionicons name="close" size={14} color="#DC2626" />
                            <Text style={s.rejectBtnText}>Reject</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  );
                })
              )
            )}

            {/* ── Documents ─────────────────────────────────────────────────── */}
            {activeTab === "documents" && (
              docApprovals.length === 0 ? (
                <View style={s.emptyBox}><Text style={s.emptyText}>No pending document approvals.</Text></View>
              ) : (
                docApprovals.map(d => {
                  const tone = statusTone(d.status);
                  return (
                    <View key={d.id} style={s.card}>
                      <View style={s.cardTop}>
                        <Text style={[s.cardName, { flex: 1, marginRight: 8 }]}>{resolveEmployeeName(d)}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          {d.file_url ? (
                            <Pressable
                              style={s.viewDocBtn}
                              onPress={() => handleViewDocument(d.file_url)}
                            >
                              <Ionicons name="document-text-outline" size={13} color="#1E40AF" />
                              <Text style={s.viewDocBtnText}>View</Text>
                            </Pressable>
                          ) : null}
                          <View style={[s.pill, { backgroundColor: tone.bg, borderColor: tone.border }]}><Text style={[s.pillText, { color: tone.text }]}>{d.status}</Text></View>
                        </View>
                      </View>
                      <Text style={s.cardMeta}>{d.document_type.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</Text>
                      {!!d.file_name && <Text style={s.cardReason}>{d.file_name}</Text>}
                      <Text style={s.cardMeta}>Uploaded: {formatDate(d.uploaded_at)}</Text>
                      {d.status === "pending" && (
                        <View style={s.actionRow}>
                          <Pressable style={s.approveBtn} onPress={() => approveDocument(d.id)} disabled={actioning === d.id}>
                            {actioning === d.id ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                            <Text style={s.approveBtnText}>Approve</Text>
                          </Pressable>
                          <Pressable style={s.rejectBtn} onPress={() => setRejectModal({ type: "documents", id: d.id })}>
                            <Ionicons name="close" size={14} color="#DC2626" />
                            <Text style={s.rejectBtnText}>Reject</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  );
                })
              )
            )}

            {/* ── Profile Changes ────────────────────────────────────────────── */}
            {activeTab === "profile-changes" && (
              changeRequests.length === 0 ? (
                <View style={s.emptyBox}><Text style={s.emptyText}>No pending profile change requests.</Text></View>
              ) : (
                changeRequests.map((r, idx) => {
                  const tone = statusTone(r.status);
                  const crId = r.change_request_id ?? r.request_id ?? r.id ?? String(idx);
                  return (
                    <View key={crId} style={s.card}>
                      <View style={s.cardTop}>
                        <Text style={s.cardName}>{resolveEmployeeName(r)}</Text>
                        <View style={[s.pill, { backgroundColor: tone.bg, borderColor: tone.border }]}><Text style={[s.pillText, { color: tone.text }]}>{r.status}</Text></View>
                      </View>
                      <Text style={s.cardMeta}>{(r.field_type ?? "").replace(/_/g, " ")} change request</Text>
                      {r.requested_value ? <Text style={s.cardReason}>New value: {r.requested_value}</Text> : null}
                      {r.reason ? <Text style={s.cardReason}>Reason: {r.reason}</Text> : null}
                      <Text style={s.cardMeta}>Submitted: {formatDate(r.created_at)}</Text>
                      {r.status === "pending" && (
                        <View style={s.actionRow}>
                          <Pressable style={s.approveBtn} onPress={() => approveChange(crId)} disabled={actioning === crId}>
                            {actioning === crId ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                            <Text style={s.approveBtnText}>Approve</Text>
                          </Pressable>
                          <Pressable style={s.rejectBtn} onPress={() => setRejectModal({ type: "profile-changes", id: crId })}>
                            <Ionicons name="close" size={14} color="#DC2626" />
                            <Text style={s.rejectBtnText}>Reject</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  );
                })
              )
            )}
          </ScrollView>

          {isMobile && (
            <BottomTabBar role="system_admin" activeScreen="Approvals" navigation={navigation} session={session} />
          )}
        </View>
      </View>

      {/* Reject Modal */}
      <Modal visible={!!rejectModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>Reject Request</Text>
            <Text style={s.modalDesc}>Provide a reason for rejection (shown to the employee).</Text>
            <TextInput style={[s.input, s.inputMulti]} value={rejectReason} onChangeText={setRejectReason} placeholder="Reason for rejection..." placeholderTextColor="#94A3B8" multiline numberOfLines={3} />
            <View style={s.modalBtnRow}>
              <Pressable style={[s.btn, s.btnOutline]} onPress={() => { setRejectModal(null); setRejectReason(""); }}><Text style={s.btnOutlineText}>Cancel</Text></Pressable>
              <Pressable style={[s.btn, s.btnDanger]} onPress={submitReject} disabled={!!actioning}>
                {actioning ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnPrimaryText}>Reject</Text>}
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

  tabRow: { flexDirection: "row" },
  tab: { paddingHorizontal: 16, paddingVertical: 8, marginRight: 8, borderRadius: 20, backgroundColor: "#F1F5F9" },
  activeTab: { backgroundColor: "#1E40AF" },
  tabText: { fontSize: 13, color: "#64748B", fontWeight: "600" },
  activeTabText: { color: "#FFFFFF" },

  emptyBox: { backgroundColor: "#F1F5F9", borderRadius: 12, padding: 24, alignItems: "center" },
  emptyText: { fontSize: 13, color: "#64748B" },

  card: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#E2E8F0", gap: 6 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardName: { fontSize: 14, fontWeight: "700", color: "#0F172A", flex: 1, marginRight: 8 },
  cardMeta: { fontSize: 12, color: "#64748B" },
  cardReason: { fontSize: 12, color: "#475569", fontStyle: "italic" },
  pill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  pillText: { fontSize: 10, fontWeight: "700" },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  approveBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: "#1E40AF", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  approveBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  rejectBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: "#FEF2F2", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: "#FECACA" },
  rejectBtnText: { color: "#B91C1C", fontSize: 12, fontWeight: "700" },
  viewDocBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 5,
  },
  viewDocBtnText: { color: "#1E40AF", fontSize: 10, fontWeight: "700" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 10 },
  modalTitle: { fontSize: 17, fontWeight: "800", color: "#0F172A" },
  modalDesc: { fontSize: 13, color: "#64748B" },
  input: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#0F172A" },
  inputMulti: { minHeight: 80, textAlignVertical: "top" },
  modalBtnRow: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 10, paddingVertical: 11 },
  btnPrimary: { backgroundColor: "#1E40AF" },
  btnDanger: { backgroundColor: "#DC2626" },
  btnPrimaryText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  btnOutline: { borderWidth: 1, borderColor: "#CBD5E1" },
  btnOutlineText: { color: "#475569", fontWeight: "600", fontSize: 14 },
});
