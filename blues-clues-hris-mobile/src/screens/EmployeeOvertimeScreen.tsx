import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
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

type OTType = "NORMAL" | "REST_DAY" | "HOLIDAY";

const OT_TYPES: { value: OTType; label: string; desc: string }[] = [
  { value: "NORMAL", label: "Normal OT", desc: "Overtime on a scheduled workday" },
  { value: "REST_DAY", label: "Rest Day", desc: "Overtime on your rest day" },
  { value: "HOLIDAY", label: "Holiday", desc: "Overtime on a holiday" },
];

type OTRequest = {
  ot_id: string;
  ot_type: OTType;
  ot_date: string;
  start_time: string;
  end_time: string;
  planned_hours?: number;
  reason?: string | null;
  log_status: string;
  review_reason?: string | null;
  created_at: string;
};

function formatDate(val?: string | null): string {
  if (!val) return "—";
  const d = new Date(val);
  return isNaN(d.getTime())
    ? val
    : d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

function calcHours(start: string, end: string): number | null {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if (isNaN(sh) || isNaN(eh)) return null;
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return diff > 0 ? diff / 60 : null;
}

function statusTone(status: string): { bg: string; border: string; text: string } {
  const s = (status ?? "").toUpperCase();
  if (s === "APPROVED") return { bg: "#ECFDF3", border: "#BBF7D0", text: "#166534" };
  if (s === "DENIED" || s === "REJECTED") return { bg: "#FEF2F2", border: "#FECACA", text: "#991B1B" };
  return { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E" };
}

export function EmployeeOvertimeScreen({ route, navigation }: any) {
  const session: UserSession = route.params.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [requests, setRequests] = useState<OTRequest[]>([]);
  const [approvedHours, setApprovedHours] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [otType, setOtType] = useState<OTType>("NORMAL");
  const [otDate, setOtDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [formReason, setFormReason] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [reqRes, sumRes] = await Promise.all([
        authFetch(`${API_BASE_URL}/overtime/requests/me`),
        authFetch(`${API_BASE_URL}/overtime/my-summary`),
      ]);
      const reqData = await reqRes.json().catch(() => []);
      const sumData = await sumRes.json().catch(() => ({}));
      setRequests(Array.isArray(reqData) ? reqData : []);
      setApprovedHours(Number((sumData as any)?.approved_planned_hours ?? 0));
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function resetForm() {
    setOtType("NORMAL");
    setOtDate("");
    setStartTime("");
    setEndTime("");
    setFormReason("");
  }

  async function handleSubmit() {
    if (!otDate) {
      Alert.alert("Validation", "Please enter the overtime date (YYYY-MM-DD).");
      return;
    }
    if (!startTime || !endTime) {
      Alert.alert("Validation", "Please enter start and end time (HH:MM).");
      return;
    }
    const hours = calcHours(startTime, endTime);
    if (!hours) {
      Alert.alert("Validation", "End time must be after start time.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/overtime/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ot_type: otType,
          ot_date: otDate,
          start_time: startTime,
          end_time: endTime,
          latitude: 0,
          longitude: 0,
          reason: formReason.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        Alert.alert("Error", (data as any)?.message || "Failed to submit overtime request.");
        return;
      }
      Alert.alert("Success", "Overtime request submitted successfully.");
      resetForm();
      setModalOpen(false);
      void loadData();
    } catch {
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const pendingCount = requests.filter((r) => (r.log_status ?? "").toUpperCase() === "PENDING").length;
  const approvedCount = requests.filter((r) => (r.log_status ?? "").toUpperCase() === "APPROVED").length;
  const plannedHours = startTime && endTime ? calcHours(startTime, endTime) : null;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.rootRow}>
        {!isMobile && (
          <Sidebar
            role="employee"
            userName={session.name}
            email={session.email}
            activeScreen="Overtime"
            navigation={navigation}
          />
        )}
        <View style={styles.mainCol}>
          {!isMobile && (
            <View style={styles.desktopHeader}>
              <Text style={styles.desktopTitle}>Overtime Requests</Text>
            </View>
          )}

          <ScrollView
            contentContainerStyle={[styles.content, isMobile && { paddingBottom: BOTTOM_TAB_HEIGHT + 8 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={loadData}
                colors={[Colors.primary]}
                tintColor={Colors.primary}
              />
            }
          >
            <GradientHero style={{ marginBottom: 0 }}>
              <Text style={styles.heroEyebrow}>Time & Attendance</Text>
              <Text style={styles.heroTitle}>Overtime Requests</Text>
              <Text style={styles.heroSub}>Submit and track your overtime requests.</Text>
              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatVal}>{approvedHours}h</Text>
                  <Text style={styles.heroStatLabel}>Approved Hours</Text>
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

            {/* This Month Summary */}
            <View style={styles.summaryCard}>
              <View>
                <Text style={styles.summaryLabel}>This Month</Text>
                <Text style={styles.summaryValue}>{approvedHours}h</Text>
                <Text style={styles.summaryHelper}>Approved overtime planned hours</Text>
              </View>
              <Pressable style={styles.fileBtn} onPress={() => setModalOpen(true)}>
                <Ionicons name="add-circle-outline" size={16} color="#FFFFFF" />
                <Text style={styles.fileBtnText}>Request OT</Text>
              </Pressable>
            </View>

            {loading ? (
              <ActivityIndicator style={{ marginTop: 24 }} color={Colors.primary} />
            ) : (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="timer-outline" size={16} color="#0284C7" />
                  <Text style={styles.cardTitle}>My Requests</Text>
                </View>
                {requests.length === 0 ? (
                  <Text style={styles.emptyText}>No overtime requests yet. Use the button above to file a new request.</Text>
                ) : (
                  requests.map((req) => {
                    const tone = statusTone(req.log_status);
                    const typeLabel = OT_TYPES.find((t) => t.value === req.ot_type)?.label ?? req.ot_type;
                    return (
                      <View key={req.ot_id} style={styles.reqRow}>
                        <View style={styles.reqTop}>
                          <View style={styles.reqLeft}>
                            <Ionicons name="calendar-outline" size={13} color="#64748B" />
                            <Text style={styles.reqDate}>{formatDate(req.ot_date)}</Text>
                          </View>
                          <View style={[styles.statusBadge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                            <Text style={[styles.statusText, { color: tone.text }]}>
                              {(req.log_status ?? "Pending").charAt(0) +
                                (req.log_status ?? "Pending").slice(1).toLowerCase()}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.reqMeta}>
                          {req.start_time} – {req.end_time}
                          {req.planned_hours ? ` | ${req.planned_hours}h` : ""}
                          {" | "}{typeLabel}
                        </Text>
                        {req.reason ? <Text style={styles.reqReason}>{req.reason}</Text> : null}
                        {req.review_reason ? (
                          <Text style={styles.reqReviewNote}>HR note: {req.review_reason}</Text>
                        ) : null}
                      </View>
                    );
                  })
                )}
              </View>
            )}
          </ScrollView>
          {isMobile && (
            <BottomTabBar role="employee" activeScreen="Overtime" navigation={navigation} session={session} />
          )}
        </View>
      </View>

      {/* ── File OT Modal ─────────────────────────────────────── */}
      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => { resetForm(); setModalOpen(false); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Overtime Request</Text>
              <Pressable onPress={() => { resetForm(); setModalOpen(false); }}>
                <Ionicons name="close" size={22} color="#334155" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {/* OT Type */}
              <Text style={styles.fieldLabel}>Overtime Type</Text>
              <View style={styles.typeGrid}>
                {OT_TYPES.map((t) => (
                  <Pressable
                    key={t.value}
                    style={[styles.typeBtn, otType === t.value && styles.typeBtnActive]}
                    onPress={() => setOtType(t.value)}
                  >
                    <Text style={[styles.typeBtnLabel, otType === t.value && styles.typeBtnLabelActive]}>
                      {t.label}
                    </Text>
                    <Text style={[styles.typeBtnDesc, otType === t.value && styles.typeBtnDescActive]}>
                      {t.desc}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Date */}
              <Text style={styles.fieldLabel}>Date</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94A3B8"
                value={otDate}
                onChangeText={setOtDate}
                keyboardType="numeric"
                maxLength={10}
              />

              {/* Time Range */}
              <View style={styles.dateRow}>
                <View style={styles.dateField}>
                  <Text style={styles.fieldLabel}>Start Time</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="HH:MM"
                    placeholderTextColor="#94A3B8"
                    value={startTime}
                    onChangeText={setStartTime}
                    keyboardType="numeric"
                    maxLength={5}
                  />
                </View>
                <View style={styles.dateField}>
                  <Text style={styles.fieldLabel}>End Time</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="HH:MM"
                    placeholderTextColor="#94A3B8"
                    value={endTime}
                    onChangeText={setEndTime}
                    keyboardType="numeric"
                    maxLength={5}
                  />
                </View>
              </View>
              {plannedHours ? (
                <Text style={styles.hoursHint}>Planned: {plannedHours.toFixed(1)}h</Text>
              ) : null}

              {/* Reason */}
              <Text style={styles.fieldLabel}>Reason (optional)</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Reason for overtime..."
                placeholderTextColor="#94A3B8"
                value={formReason}
                onChangeText={setFormReason}
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
    paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.bgCard,
  },
  desktopTitle: { fontSize: 22, fontWeight: "800", color: Colors.textPrimary },
  content: { paddingHorizontal: 12, paddingVertical: 12, paddingBottom: 32, gap: 12 },

  heroEyebrow: { color: "rgba(255,255,255,0.78)", fontSize: 10, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  heroTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "800", marginTop: 4 },
  heroSub: { color: "rgba(255,255,255,0.86)", fontSize: 12, lineHeight: 18, marginTop: 6 },
  heroStats: { flexDirection: "row", marginTop: 14, gap: 20 },
  heroStat: { alignItems: "center" },
  heroStatVal: { color: "#FFFFFF", fontSize: 22, fontWeight: "800" },
  heroStatLabel: { color: "rgba(255,255,255,0.78)", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },

  summaryCard: {
    backgroundColor: Colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  summaryLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8 },
  summaryValue: { color: Colors.textPrimary, fontSize: 32, fontWeight: "800", marginTop: 4 },
  summaryHelper: { color: Colors.textMuted, fontSize: 11 },

  fileBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  fileBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },

  card: {
    backgroundColor: Colors.bgCard, borderRadius: 16, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 14,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  cardTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: "800" },
  emptyText: { color: Colors.textMuted, fontSize: 13, paddingVertical: 8 },

  reqRow: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    backgroundColor: "#FFFFFF", padding: 12, marginBottom: 8,
  },
  reqTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  reqLeft: { flexDirection: "row", alignItems: "center", gap: 5 },
  reqDate: { color: Colors.textPrimary, fontSize: 13, fontWeight: "700" },
  reqMeta: { color: Colors.textMuted, fontSize: 11, marginTop: 3 },
  reqReason: { color: Colors.textMuted, fontSize: 11, fontStyle: "italic", marginTop: 3 },
  reqReviewNote: { color: "#DC2626", fontSize: 11, marginTop: 3 },
  statusBadge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: "92%",
  },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  modalTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: "800" },

  typeGrid: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  typeBtn: {
    flex: 1, minWidth: 90, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, padding: 12,
  },
  typeBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight ?? "#EFF6FF" },
  typeBtnLabel: { color: Colors.textPrimary, fontSize: 12, fontWeight: "700" },
  typeBtnLabelActive: { color: Colors.primary },
  typeBtnDesc: { color: Colors.textMuted, fontSize: 10, marginTop: 3 },
  typeBtnDescActive: { color: Colors.primary },
  hoursHint: { color: "#0284C7", fontSize: 12, fontWeight: "700", marginTop: 6 },

  fieldLabel: {
    color: Colors.textMuted, fontSize: 10, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 6, marginTop: 12,
  },
  input: {
    backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.textPrimary,
  },
  textarea: { minHeight: 80 },
  dateRow: { flexDirection: "row", gap: 10 },
  dateField: { flex: 1 },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, marginTop: 16, marginBottom: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});
