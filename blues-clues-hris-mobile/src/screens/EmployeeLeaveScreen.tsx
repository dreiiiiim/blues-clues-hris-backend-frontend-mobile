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

const LEAVE_TYPES = [
  "Sick Leave",
  "Vacation Leave",
  "Personal Leave",
  "Emergency Leave",
  "Maternity Leave",
  "Paternity Leave",
];

type LeaveBalance = {
  leave_type: string;
  type?: string;
  allocated_days?: number;
  total_days?: number;
  used_days?: number;
  remaining?: number;
  year?: number;
};

type LeaveRequest = {
  request_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason?: string;
  status: string;
  notes?: string;
  manager_remark?: string;
  created_at: string;
};

function formatDate(val?: string | null): string {
  if (!val) return "—";
  const d = new Date(val);
  return isNaN(d.getTime())
    ? val
    : d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

function statusTone(status: string): { bg: string; border: string; text: string } {
  const s = status.toLowerCase();
  if (s === "approved") return { bg: "#ECFDF3", border: "#BBF7D0", text: "#166534" };
  if (s === "rejected" || s === "denied") return { bg: "#FEF2F2", border: "#FECACA", text: "#991B1B" };
  return { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E" };
}

export function EmployeeLeaveScreen({ route, navigation }: any) {
  const session: UserSession = route.params.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [leaveType, setLeaveType] = useState(LEAVE_TYPES[0]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [typePickerOpen, setTypePickerOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [balRes, reqRes] = await Promise.all([
        authFetch(`${API_BASE_URL}/leave/balances`),
        authFetch(`${API_BASE_URL}/leave/requests/me`),
      ]);
      const balData = await balRes.json().catch(() => []);
      const reqData = await reqRes.json().catch(() => []);
      setBalances(Array.isArray(balData) ? balData : []);
      setRequests(Array.isArray(reqData) ? reqData : []);
    } catch {
      // silently fail; empty state shown
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function resetForm() {
    setLeaveType(LEAVE_TYPES[0]);
    setStartDate("");
    setEndDate("");
    setReason("");
    setTypePickerOpen(false);
  }

  async function handleSubmit() {
    if (!startDate || !endDate) {
      Alert.alert("Validation", "Please enter start and end dates (YYYY-MM-DD).");
      return;
    }
    if (endDate < startDate) {
      Alert.alert("Validation", "End date cannot be before start date.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/leave/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          reason: reason.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        Alert.alert("Error", (data as any)?.message || "Failed to file leave request.");
        return;
      }
      Alert.alert("Success", "Leave request submitted successfully.");
      resetForm();
      setModalOpen(false);
      void loadData();
    } catch {
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const pendingCount = requests.filter((r) => r.status?.toLowerCase() === "pending").length;
  const approvedCount = requests.filter((r) => r.status?.toLowerCase() === "approved").length;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.rootRow}>
        {!isMobile && (
          <Sidebar
            role="employee"
            userName={session.name}
            email={session.email}
            activeScreen="Leave"
            navigation={navigation}
          />
        )}
        <View style={styles.mainCol}>
          {!isMobile && (
            <View style={styles.desktopHeader}>
              <Text style={styles.desktopTitle}>Leave Management</Text>
            </View>
          )}

          <ScrollView contentContainerStyle={[styles.content, isMobile && { paddingBottom: BOTTOM_TAB_HEIGHT + 8 }]} showsVerticalScrollIndicator={false}>
            <GradientHero style={{ marginBottom: 0 }}>
              <Text style={styles.heroEyebrow}>Time Off</Text>
              <Text style={styles.heroTitle}>Leave</Text>
              <Text style={styles.heroSub}>Manage your leave balances and requests.</Text>
              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatVal}>{requests.length}</Text>
                  <Text style={styles.heroStatLabel}>Total Requests</Text>
                </View>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatVal}>{pendingCount}</Text>
                  <Text style={styles.heroStatLabel}>Pending</Text>
                </View>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatVal}>{approvedCount}</Text>
                  <Text style={styles.heroStatLabel}>Approved</Text>
                </View>
              </View>
            </GradientHero>

            {/* File Leave Button */}
            <Pressable style={styles.fileBtn} onPress={() => setModalOpen(true)}>
              <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.fileBtnText}>File a Leave Request</Text>
            </Pressable>

            {loading ? (
              <ActivityIndicator style={{ marginTop: 24 }} color={Colors.primary} />
            ) : (
              <>
                {/* Leave Balances */}
                {balances.length > 0 && (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Leave Balances</Text>
                    <View style={styles.balanceGrid}>
                      {balances.map((b, i) => {
                        const type = b.leave_type ?? b.type ?? "Leave";
                        const total = b.allocated_days ?? b.total_days ?? 0;
                        const used = b.used_days ?? 0;
                        const remaining = b.remaining ?? (total - used);
                        return (
                          <View key={i} style={styles.balanceCard}>
                            <Text style={styles.balanceType} numberOfLines={2}>{type}</Text>
                            <Text style={styles.balanceRemaining}>{remaining}</Text>
                            <Text style={styles.balanceSub}>remaining</Text>
                            <Text style={styles.balanceUsed}>{used} / {total} used</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Leave Requests */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>My Leave Requests</Text>
                  {requests.length === 0 ? (
                    <Text style={styles.emptyText}>No leave requests yet. File your first request above.</Text>
                  ) : (
                    requests.map((req) => {
                      const tone = statusTone(req.status ?? "pending");
                      return (
                        <View key={req.request_id} style={styles.reqRow}>
                          <View style={styles.reqLeft}>
                            <Text style={styles.reqType}>{req.leave_type}</Text>
                            <Text style={styles.reqDates}>
                              {formatDate(req.start_date)} → {formatDate(req.end_date)}
                            </Text>
                            {req.reason ? (
                              <Text style={styles.reqReason} numberOfLines={2}>{req.reason}</Text>
                            ) : null}
                            {(req.notes ?? req.manager_remark) ? (
                              <Text style={styles.reqNote}>
                                HR note: {req.notes ?? req.manager_remark}
                              </Text>
                            ) : null}
                          </View>
                          <View style={[styles.statusBadge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                            <Text style={[styles.statusText, { color: tone.text }]}>
                              {(req.status ?? "Pending").charAt(0).toUpperCase() +
                                (req.status ?? "Pending").slice(1).toLowerCase()}
                            </Text>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              </>
            )}
          </ScrollView>

          {isMobile && (
            <BottomTabBar role="employee" activeScreen="Leave" navigation={navigation} session={session} />
          )}
        </View>
      </View>

      {/* ── File Leave Modal ─────────────────────────────────────── */}
      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => { resetForm(); setModalOpen(false); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Leave Request</Text>
              <Pressable onPress={() => { resetForm(); setModalOpen(false); }}>
                <Ionicons name="close" size={22} color="#334155" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {/* Leave Type */}
              <Text style={styles.fieldLabel}>Leave Type</Text>
              <Pressable style={styles.pickerBtn} onPress={() => setTypePickerOpen(!typePickerOpen)}>
                <Text style={styles.pickerBtnText}>{leaveType}</Text>
                <Ionicons name={typePickerOpen ? "chevron-up" : "chevron-down"} size={16} color="#64748B" />
              </Pressable>
              {typePickerOpen && (
                <View style={styles.pickerDropdown}>
                  {LEAVE_TYPES.map((lt) => (
                    <Pressable
                      key={lt}
                      style={[styles.pickerOption, lt === leaveType && styles.pickerOptionActive]}
                      onPress={() => { setLeaveType(lt); setTypePickerOpen(false); }}
                    >
                      <Text style={[styles.pickerOptionText, lt === leaveType && styles.pickerOptionTextActive]}>
                        {lt}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Date Range */}
              <View style={styles.dateRow}>
                <View style={styles.dateField}>
                  <Text style={styles.fieldLabel}>Start Date</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8"
                    value={startDate}
                    onChangeText={setStartDate}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>
                <View style={styles.dateField}>
                  <Text style={styles.fieldLabel}>End Date</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8"
                    value={endDate}
                    onChangeText={setEndDate}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>
              </View>

              {/* Reason */}
              <Text style={styles.fieldLabel}>Reason (optional)</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Reason for leave..."
                placeholderTextColor="#94A3B8"
                value={reason}
                onChangeText={setReason}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={500}
              />

              <Pressable
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={() => void handleSubmit()}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="send-outline" size={16} color="#FFFFFF" />
                )}
                <Text style={styles.submitBtnText}>{submitting ? "Submitting..." : "Submit Request"}</Text>
              </Pressable>
            </ScrollView>
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
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  desktopTitle: { fontSize: 22, fontWeight: "800", color: Colors.textPrimary },
  content: { paddingHorizontal: 12, paddingVertical: 12, paddingBottom: 32, gap: 12 },

  // Hero
  heroEyebrow: { color: "rgba(255,255,255,0.78)", fontSize: 10, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  heroTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "800", marginTop: 4 },
  heroSub: { color: "rgba(255,255,255,0.86)", fontSize: 12, lineHeight: 18, marginTop: 6 },
  heroStats: { flexDirection: "row", marginTop: 14, gap: 16 },
  heroStat: { alignItems: "center" },
  heroStatVal: { color: "#FFFFFF", fontSize: 22, fontWeight: "800" },
  heroStatLabel: { color: "rgba(255,255,255,0.78)", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },

  // File button
  fileBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 20,
  },
  fileBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },

  // Card
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  cardTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: "800", marginBottom: 12 },

  // Balance grid
  balanceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  balanceCard: {
    flex: 1,
    minWidth: 130,
    backgroundColor: "#F8FAFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primaryBorder ?? "#BFDBFE",
    padding: 12,
  },
  balanceType: { color: Colors.primary, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  balanceRemaining: { color: Colors.textPrimary, fontSize: 28, fontWeight: "800", marginTop: 4 },
  balanceSub: { color: Colors.textMuted, fontSize: 10, fontWeight: "600" },
  balanceUsed: { color: Colors.textMuted, fontSize: 10, marginTop: 6 },

  // Request rows
  reqRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: Colors.bgSubtle ?? "#F1F5F9",
  },
  reqLeft: { flex: 1, paddingRight: 10 },
  reqType: { color: Colors.textPrimary, fontSize: 13, fontWeight: "700" },
  reqDates: { color: Colors.textSecondary ?? "#475569", fontSize: 12, marginTop: 2 },
  reqReason: { color: Colors.textMuted, fontSize: 11, marginTop: 3, fontStyle: "italic" },
  reqNote: { color: "#DC2626", fontSize: 11, marginTop: 3 },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  statusText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },

  emptyText: { color: Colors.textMuted, fontSize: 13, textAlign: "center", paddingVertical: 16 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "90%",
  },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  modalTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: "800" },

  // Form
  fieldLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  textarea: { minHeight: 80 },
  pickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerBtnText: { color: Colors.textPrimary, fontSize: 14, fontWeight: "600" },
  pickerDropdown: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    marginTop: 4,
    overflow: "hidden",
  },
  pickerOption: { paddingHorizontal: 14, paddingVertical: 12 },
  pickerOptionActive: { backgroundColor: Colors.primaryLight ?? "#EFF6FF" },
  pickerOptionText: { color: Colors.textSecondary ?? "#475569", fontSize: 14, fontWeight: "500" },
  pickerOptionTextActive: { color: Colors.primary, fontWeight: "700" },
  dateRow: { flexDirection: "row", gap: 10 },
  dateField: { flex: 1 },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 16,
    marginBottom: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});
