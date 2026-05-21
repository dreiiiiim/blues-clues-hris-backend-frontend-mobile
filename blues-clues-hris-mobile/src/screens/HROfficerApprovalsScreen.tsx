import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
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
import { Colors } from "../constants/colors";
import { authFetch, type UserSession } from "../services/auth";
import { API_BASE_URL } from "../lib/api";

type Tab = "Leave" | "Documents" | "Overtime" | "Profile Changes";
const TABS: Tab[] = ["Leave", "Documents", "Overtime", "Profile Changes"];

type LeaveItem = {
  request_id: string;
  employee_name?: string;
  user_id?: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason?: string | null;
  status: string;
  employee?: { first_name?: string | null; last_name?: string | null; email?: string | null } | null;
};

type DocItem = {
  document_id?: string;
  doc_id?: string;
  id?: string;
  document_type?: string;
  file_name?: string;
  employee_name?: string;
  user_id?: string;
  uploaded_at?: string;
  created_at?: string;
  status?: string;
  user?: { first_name?: string | null; last_name?: string | null; email?: string | null } | null;
  user_profile?: { first_name?: string | null; last_name?: string | null; email?: string | null } | null;
};

type OTItem = {
  ot_id: string;
  employee_name?: string;
  user_id?: string;
  employee_id?: string;
  ot_type: string;
  ot_date: string;
  start_time: string;
  end_time: string;
  planned_hours?: number;
  reason?: string | null;
  log_status: string;
  employee?: { first_name?: string | null; last_name?: string | null } | null;
};

type ChangeRequestItem = {
  request_id?: string;
  change_request_id?: string;
  id?: string;
  field_type?: string;
  reason?: string;
  status?: string;
  employee_name?: string;
  user_id?: string;
  created_at?: string;
  user?: { first_name?: string | null; last_name?: string | null; email?: string | null } | null;
};

function employeeName(item: { employee_name?: string; user_id?: string; employee_id?: string; change_request_id?: string; employee?: { first_name?: string | null; last_name?: string | null; email?: string | null } | null; user?: { first_name?: string | null; last_name?: string | null; email?: string | null } | null; user_profile?: { first_name?: string | null; last_name?: string | null; email?: string | null } | null }): string {
  if (item.employee_name) return item.employee_name;
  const nested = item.employee ?? item.user ?? item.user_profile;
  if (nested) {
    const name = [nested.first_name, nested.last_name].filter(Boolean).join(" ");
    if (name.trim()) return name.trim();
    if (nested.email) return nested.email;
  }
  return item.user_id ?? item.employee_id ?? "Employee";
}

function formatDate(val?: string | null): string {
  if (!val) return "—";
  const d = new Date(val);
  return isNaN(d.getTime()) ? val : d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

function statusTone(status?: string) {
  const s = (status ?? "").toLowerCase();
  if (s === "approved") return { bg: "#ECFDF3", border: "#BBF7D0", text: "#166534" };
  if (s === "rejected" || s === "denied") return { bg: "#FEF2F2", border: "#FECACA", text: "#991B1B" };
  return { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E" };
}

function getId(item: DocItem): string {
  return item.document_id ?? item.doc_id ?? item.id ?? "";
}

export function HROfficerApprovalsScreen({ route, navigation }: any) {
  const session: UserSession = route.params.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [activeTab, setActiveTab] = useState<Tab>("Leave");
  const [leaveItems, setLeaveItems] = useState<LeaveItem[]>([]);
  const [docItems, setDocItems] = useState<DocItem[]>([]);
  const [otItems, setOtItems] = useState<OTItem[]>([]);
  const [changeItems, setChangeItems] = useState<ChangeRequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Rejection modal
  const [rejectModal, setRejectModal] = useState<{ type: Tab; id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadLeave = useCallback(async () => {
    const res = await authFetch(`${API_BASE_URL}/leave/requests?status=Pending`).catch(() => null);
    if (!res) return;
    const data = await res.json().catch(() => []);
    setLeaveItems(Array.isArray(data) ? data : []);
  }, []);

  const loadDocs = useCallback(async () => {
    const res = await authFetch(`${API_BASE_URL}/users/documents/pending`).catch(() => null);
    if (!res) return;
    const data = await res.json().catch(() => []);
    setDocItems(Array.isArray(data) ? data : []);
  }, []);

  const loadOT = useCallback(async () => {
    const res = await authFetch(`${API_BASE_URL}/overtime/requests?status=PENDING`).catch(() => null);
    if (!res) return;
    const data = await res.json().catch(() => []);
    setOtItems(Array.isArray(data) ? data : []);
  }, []);

  const loadChangeRequests = useCallback(async () => {
    const res = await authFetch(`${API_BASE_URL}/users/change-requests?status=pending`).catch(() => null);
    if (!res) return;
    const data = await res.json().catch(() => []);
    setChangeItems(Array.isArray(data) ? data : []);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadLeave(), loadDocs(), loadOT(), loadChangeRequests()]);
    setLoading(false);
  }, [loadLeave, loadDocs, loadOT, loadChangeRequests]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function approveLeave(id: string) {
    setActionLoading(id);
    try {
      const res = await authFetch(`${API_BASE_URL}/leave/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Approved" }),
      });
      if (!res.ok) throw new Error();
      Alert.alert("Success", "Leave request approved.");
      void loadLeave();
    } catch {
      Alert.alert("Error", "Failed to approve leave request.");
    } finally {
      setActionLoading(null);
    }
  }

  async function rejectLeave(id: string, rejection_reason: string) {
    setActionLoading(id);
    try {
      const res = await authFetch(`${API_BASE_URL}/leave/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Rejected", rejection_reason }),
      });
      if (!res.ok) throw new Error();
      Alert.alert("Success", "Leave request rejected.");
      void loadLeave();
    } catch {
      Alert.alert("Error", "Failed to reject leave request.");
    } finally {
      setActionLoading(null);
    }
  }

  async function approveDoc(id: string) {
    setActionLoading(id);
    try {
      const res = await authFetch(`${API_BASE_URL}/users/documents/${id}/approve`, { method: "PATCH" });
      if (!res.ok) throw new Error();
      Alert.alert("Success", "Document approved.");
      void loadDocs();
    } catch {
      Alert.alert("Error", "Failed to approve document.");
    } finally {
      setActionLoading(null);
    }
  }

  async function rejectDoc(id: string, hr_notes: string) {
    setActionLoading(id);
    try {
      const res = await authFetch(`${API_BASE_URL}/users/documents/${id}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hr_notes }),
      });
      if (!res.ok) throw new Error();
      Alert.alert("Success", "Document rejected.");
      void loadDocs();
    } catch {
      Alert.alert("Error", "Failed to reject document.");
    } finally {
      setActionLoading(null);
    }
  }

  async function reviewOT(id: string, action: "approve" | "deny", review_reason?: string) {
    setActionLoading(id);
    try {
      const res = await authFetch(`${API_BASE_URL}/overtime/requests/${id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, review_reason: review_reason ?? null }),
      });
      if (!res.ok) throw new Error();
      Alert.alert("Success", `Overtime request ${action === "approve" ? "approved" : "denied"}.`);
      void loadOT();
    } catch {
      Alert.alert("Error", "Failed to update overtime request.");
    } finally {
      setActionLoading(null);
    }
  }

  async function approveChangeRequest(id: string) {
    setActionLoading(id);
    try {
      const res = await authFetch(`${API_BASE_URL}/users/change-requests/${id}/approve`, { method: "PATCH" });
      if (!res.ok) throw new Error();
      Alert.alert("Success", "Change request approved.");
      void loadChangeRequests();
    } catch {
      Alert.alert("Error", "Failed to approve change request.");
    } finally {
      setActionLoading(null);
    }
  }

  async function rejectChangeRequest(id: string, reason: string) {
    setActionLoading(id);
    try {
      const res = await authFetch(`${API_BASE_URL}/users/change-requests/${id}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review_reason: reason }),
      });
      if (!res.ok) throw new Error();
      Alert.alert("Success", "Change request rejected.");
      void loadChangeRequests();
    } catch {
      Alert.alert("Error", "Failed to reject change request.");
    } finally {
      setActionLoading(null);
    }
  }

  function openRejectModal(type: Tab, id: string) {
    setRejectReason("");
    setRejectModal({ type, id });
  }

  async function confirmReject() {
    if (!rejectModal) return;
    const { type, id } = rejectModal;
    setRejectModal(null);
    if (type === "Leave") await rejectLeave(id, rejectReason);
    else if (type === "Documents") await rejectDoc(id, rejectReason);
    else if (type === "Overtime") await reviewOT(id, "deny", rejectReason);
    else if (type === "Profile Changes") await rejectChangeRequest(id, rejectReason);
  }

  const totalPending =
    leaveItems.length + docItems.length + otItems.length + changeItems.length;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.rootRow}>
        {!isMobile && (
          <Sidebar
            role="hr"
            userName={session.name}
            email={session.email}
            activeScreen="Approvals"
            navigation={navigation}
          />
        )}
        <View style={styles.mainCol}>
          {!isMobile && (
            <View style={styles.desktopHeader}>
              <Text style={styles.desktopTitle}>HR Approval Queue</Text>
            </View>
          )}

          <ScrollView contentContainerStyle={[styles.content, isMobile && { paddingBottom: BOTTOM_TAB_HEIGHT + 8 }]} showsVerticalScrollIndicator={false}>
            <GradientHero style={{ marginBottom: 0 }}>
              <Text style={styles.heroEyebrow}>HR Operations</Text>
              <Text style={styles.heroTitle}>Approval Queue</Text>
              <Text style={styles.heroSub}>Review and action pending requests across all modules.</Text>
              <View style={styles.heroStats}>
                <View style={styles.heroStat}><Text style={styles.heroStatVal}>{leaveItems.length}</Text><Text style={styles.heroStatLabel}>Leave</Text></View>
                <View style={styles.heroStat}><Text style={styles.heroStatVal}>{docItems.length}</Text><Text style={styles.heroStatLabel}>Documents</Text></View>
                <View style={styles.heroStat}><Text style={styles.heroStatVal}>{otItems.length}</Text><Text style={styles.heroStatLabel}>Overtime</Text></View>
                <View style={styles.heroStat}><Text style={styles.heroStatVal}>{changeItems.length}</Text><Text style={styles.heroStatLabel}>Profile</Text></View>
              </View>
            </GradientHero>

            {totalPending === 0 && !loading && (
              <View style={styles.allClearCard}>
                <Ionicons name="checkmark-circle-outline" size={32} color="#16A34A" />
                <Text style={styles.allClearTitle}>All Clear!</Text>
                <Text style={styles.allClearSub}>No pending approvals at this time.</Text>
              </View>
            )}

            {/* Tab Bar */}
            <View style={styles.tabBar}>
              {TABS.map((tab) => {
                const count = tab === "Leave" ? leaveItems.length : tab === "Documents" ? docItems.length : tab === "Overtime" ? otItems.length : changeItems.length;
                return (
                  <Pressable
                    key={tab}
                    style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
                    onPress={() => setActiveTab(tab)}
                  >
                    <Text style={[styles.tabBtnText, activeTab === tab && styles.tabBtnTextActive]} numberOfLines={1}>
                      {tab}
                    </Text>
                    {count > 0 && (
                      <View style={[styles.tabBadge, activeTab === tab && styles.tabBadgeActive]}>
                        <Text style={[styles.tabBadgeText, activeTab === tab && styles.tabBadgeTextActive]}>{count}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {loading ? (
              <ActivityIndicator style={{ marginTop: 24 }} color={Colors.primary} />
            ) : (
              <View style={styles.card}>
                {/* LEAVE TAB */}
                {activeTab === "Leave" && (
                  leaveItems.length === 0 ? (
                    <Text style={styles.emptyText}>No pending leave requests.</Text>
                  ) : (
                    leaveItems.map((item) => (
                      <View key={item.request_id} style={styles.itemRow}>
                        <View style={styles.itemInfo}>
                          <Text style={styles.itemTitle}>{employeeName(item)}</Text>
                          <Text style={styles.itemSub}>{item.leave_type} · {formatDate(item.start_date)} → {formatDate(item.end_date)}</Text>
                          {item.reason ? <Text style={styles.itemReason}>{item.reason}</Text> : null}
                        </View>
                        <View style={styles.actionBtns}>
                          <Pressable
                            style={styles.approveBtn}
                            onPress={() => void approveLeave(item.request_id)}
                            disabled={actionLoading === item.request_id}
                          >
                            {actionLoading === item.request_id
                              ? <ActivityIndicator size="small" color="#FFFFFF" />
                              : <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                            <Text style={styles.approveBtnText}>Approve</Text>
                          </Pressable>
                          <Pressable
                            style={styles.rejectBtn}
                            onPress={() => openRejectModal("Leave", item.request_id)}
                          >
                            <Ionicons name="close" size={14} color="#DC2626" />
                            <Text style={styles.rejectBtnText}>Reject</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))
                  )
                )}

                {/* DOCUMENTS TAB */}
                {activeTab === "Documents" && (
                  docItems.length === 0 ? (
                    <Text style={styles.emptyText}>No pending document submissions.</Text>
                  ) : (
                    docItems.map((item) => {
                      const id = getId(item);
                      return (
                        <View key={id} style={styles.itemRow}>
                          <View style={styles.itemInfo}>
                            <Text style={styles.itemTitle}>{employeeName(item)}</Text>
                            <Text style={styles.itemSub}>{item.document_type ?? item.file_name ?? "Document"}</Text>
                            <Text style={styles.itemDate}>Uploaded: {formatDate(item.uploaded_at ?? item.created_at)}</Text>
                          </View>
                          <View style={styles.actionBtns}>
                            <Pressable
                              style={styles.approveBtn}
                              onPress={() => void approveDoc(id)}
                              disabled={actionLoading === id}
                            >
                              {actionLoading === id
                                ? <ActivityIndicator size="small" color="#FFFFFF" />
                                : <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                              <Text style={styles.approveBtnText}>Approve</Text>
                            </Pressable>
                            <Pressable
                              style={styles.rejectBtn}
                              onPress={() => openRejectModal("Documents", id)}
                            >
                              <Ionicons name="close" size={14} color="#DC2626" />
                              <Text style={styles.rejectBtnText}>Reject</Text>
                            </Pressable>
                          </View>
                        </View>
                      );
                    })
                  )
                )}

                {/* OVERTIME TAB */}
                {activeTab === "Overtime" && (
                  otItems.length === 0 ? (
                    <Text style={styles.emptyText}>No pending overtime requests.</Text>
                  ) : (
                    otItems.map((item) => (
                      <View key={item.ot_id} style={styles.itemRow}>
                        <View style={styles.itemInfo}>
                          <Text style={styles.itemTitle}>{employeeName(item)}</Text>
                          <Text style={styles.itemSub}>
                            {item.ot_type?.replace("_", " ")} · {formatDate(item.ot_date)}
                          </Text>
                          <Text style={styles.itemDate}>
                            {item.start_time} – {item.end_time}{item.planned_hours ? ` (${item.planned_hours}h)` : ""}
                          </Text>
                          {item.reason ? <Text style={styles.itemReason}>{item.reason}</Text> : null}
                        </View>
                        <View style={styles.actionBtns}>
                          <Pressable
                            style={styles.approveBtn}
                            onPress={() => void reviewOT(item.ot_id, "approve")}
                            disabled={actionLoading === item.ot_id}
                          >
                            {actionLoading === item.ot_id
                              ? <ActivityIndicator size="small" color="#FFFFFF" />
                              : <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                            <Text style={styles.approveBtnText}>Approve</Text>
                          </Pressable>
                          <Pressable
                            style={styles.rejectBtn}
                            onPress={() => openRejectModal("Overtime", item.ot_id)}
                          >
                            <Ionicons name="close" size={14} color="#DC2626" />
                            <Text style={styles.rejectBtnText}>Deny</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))
                  )
                )}

                {/* PROFILE CHANGES TAB */}
                {activeTab === "Profile Changes" && (
                  changeItems.length === 0 ? (
                    <Text style={styles.emptyText}>No pending profile change requests.</Text>
                  ) : (
                    changeItems.map((item) => {
                      const id = item.change_request_id ?? item.request_id ?? item.id ?? "";
                      return (
                        <View key={id} style={styles.itemRow}>
                          <View style={styles.itemInfo}>
                            <Text style={styles.itemTitle}>{employeeName(item)}</Text>
                            <Text style={styles.itemSub}>{item.field_type ?? "Profile change"}</Text>
                            {item.reason ? <Text style={styles.itemReason}>{item.reason}</Text> : null}
                            <Text style={styles.itemDate}>Submitted: {formatDate(item.created_at)}</Text>
                          </View>
                          <View style={styles.actionBtns}>
                            <Pressable
                              style={styles.approveBtn}
                              onPress={() => void approveChangeRequest(id)}
                              disabled={actionLoading === id}
                            >
                              {actionLoading === id
                                ? <ActivityIndicator size="small" color="#FFFFFF" />
                                : <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                              <Text style={styles.approveBtnText}>Approve</Text>
                            </Pressable>
                            <Pressable
                              style={styles.rejectBtn}
                              onPress={() => openRejectModal("Profile Changes", id)}
                            >
                              <Ionicons name="close" size={14} color="#DC2626" />
                              <Text style={styles.rejectBtnText}>Reject</Text>
                            </Pressable>
                          </View>
                        </View>
                      );
                    })
                  )
                )}
              </View>
            )}
          </ScrollView>

          {isMobile && (
            <BottomTabBar role="hr" activeScreen="Approvals" navigation={navigation} session={session} />
          )}
        </View>
      </View>

      {/* Reject Reason Modal */}
      <Modal visible={!!rejectModal} transparent animationType="fade" onRequestClose={() => setRejectModal(null)}>
        <View style={styles.rejectOverlay}>
          <View style={styles.rejectCard}>
            <Text style={styles.rejectTitle}>Rejection Reason</Text>
            <Text style={styles.rejectSub}>Provide a reason for this rejection (optional).</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Enter reason..."
              placeholderTextColor="#94A3B8"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <View style={styles.rejectActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setRejectModal(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.confirmRejectBtn} onPress={() => void confirmReject()}>
                <Text style={styles.confirmRejectBtnText}>Confirm Rejection</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  rootRow: { flex: 1, flexDirection: "row" },
  mainCol: { flex: 1 },
  desktopHeader: {
    paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.bgCard,
  },
  desktopTitle: { fontSize: 22, fontWeight: "800", color: Colors.textPrimary },
  content: { paddingHorizontal: 12, paddingVertical: 12, paddingBottom: 32, gap: 12 },

  heroEyebrow: { color: "rgba(255,255,255,0.78)", fontSize: 10, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  heroTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "800", marginTop: 4 },
  heroSub: { color: "rgba(255,255,255,0.86)", fontSize: 12, lineHeight: 18, marginTop: 6 },
  heroStats: { flexDirection: "row", marginTop: 14, gap: 16 },
  heroStat: { alignItems: "center" },
  heroStatVal: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  heroStatLabel: { color: "rgba(255,255,255,0.78)", fontSize: 9, fontWeight: "700", textTransform: "uppercase" },

  allClearCard: {
    backgroundColor: Colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: "#BBF7D0",
    padding: 24, alignItems: "center", gap: 8,
  },
  allClearTitle: { color: "#166534", fontSize: 17, fontWeight: "800" },
  allClearSub: { color: Colors.textMuted, fontSize: 13 },

  tabBar: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  tabBtn: {
    flex: 1, minWidth: 70, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 9,
    backgroundColor: Colors.bgCard,
  },
  tabBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight ?? "#EFF6FF" },
  tabBtnText: { color: Colors.textMuted, fontSize: 11, fontWeight: "700" },
  tabBtnTextActive: { color: Colors.primary },
  tabBadge: {
    backgroundColor: "#E2E8F0", borderRadius: 999,
    minWidth: 18, alignItems: "center", paddingHorizontal: 5, paddingVertical: 1,
  },
  tabBadgeActive: { backgroundColor: Colors.primary },
  tabBadgeText: { color: "#64748B", fontSize: 9, fontWeight: "800" },
  tabBadgeTextActive: { color: "#FFFFFF" },

  card: {
    backgroundColor: Colors.bgCard, borderRadius: 16, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 14,
  },
  emptyText: { color: Colors.textMuted, fontSize: 13, paddingVertical: 16, textAlign: "center" },

  itemRow: {
    borderTopWidth: 1, borderTopColor: Colors.bgSubtle ?? "#F1F5F9",
    paddingTop: 12, paddingBottom: 12, gap: 10,
  },
  itemInfo: { gap: 3 },
  itemTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: "700" },
  itemSub: { color: Colors.textMuted, fontSize: 12 },
  itemDate: { color: Colors.textMuted, fontSize: 11 },
  itemReason: { color: Colors.textMuted, fontSize: 11, fontStyle: "italic" },

  actionBtns: { flexDirection: "row", gap: 8 },
  approveBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    backgroundColor: "#16A34A", borderRadius: 10, paddingVertical: 9,
  },
  approveBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  rejectBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    borderWidth: 1, borderColor: "#FECACA", backgroundColor: "#FEF2F2", borderRadius: 10, paddingVertical: 9,
  },
  rejectBtnText: { color: "#DC2626", fontSize: 12, fontWeight: "700" },

  // Reject Modal
  rejectOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  rejectCard: {
    width: "100%", maxWidth: 380, backgroundColor: "#FFFFFF", borderRadius: 20, padding: 22,
  },
  rejectTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: "800", marginBottom: 4 },
  rejectSub: { color: Colors.textMuted, fontSize: 13, marginBottom: 12 },
  input: {
    backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.textPrimary,
  },
  textarea: { minHeight: 80 },
  rejectActions: { flexDirection: "row", gap: 10, marginTop: 14, justifyContent: "flex-end" },
  cancelBtn: { backgroundColor: "#F1F5F9", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  cancelBtnText: { color: Colors.textPrimary, fontWeight: "700", fontSize: 13 },
  confirmRejectBtn: { backgroundColor: "#DC2626", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  confirmRejectBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
});
