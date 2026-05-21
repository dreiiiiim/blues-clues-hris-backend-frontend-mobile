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

const OFFBOARDING_REASONS = [
  "Resignation",
  "End of Contract",
  "Retirement",
  "Redundancy",
  "Medical",
  "Other",
];

type OffboardingCase = {
  case_id?: string;
  id?: string;
  offboarding_type?: string;
  reason?: string;
  status?: string;
  last_working_day?: string;
  created_at?: string;
};

type ChecklistItem = {
  item_id?: string;
  id?: string;
  item_name?: string;
  title?: string;
  category?: string;
  status?: string;
  notes?: string;
};

function formatDate(val?: string | null): string {
  if (!val) return "—";
  const d = new Date(val);
  return isNaN(d.getTime()) ? val : d.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

function statusTone(status?: string): { bg: string; border: string; text: string } {
  const s = (status ?? "").toLowerCase();
  if (s.includes("approved") || s.includes("complete") || s.includes("clear")) return { bg: "#ECFDF3", border: "#BBF7D0", text: "#166534" };
  if (s.includes("rejected")) return { bg: "#FEF2F2", border: "#FECACA", text: "#991B1B" };
  return { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E" };
}

const STATUS_STEPS = [
  { key: "submitted", label: "Submitted", icon: "send-outline" as const },
  { key: "manager", label: "Manager Review", icon: "person-outline" as const },
  { key: "hr", label: "HR Processing", icon: "people-outline" as const },
  { key: "complete", label: "Completed", icon: "checkmark-circle-outline" as const },
];

function getStepIndex(status?: string): number {
  const s = (status ?? "").toLowerCase();
  if (s.includes("complete") || s.includes("approved")) return 3;
  if (s.includes("hr") || s.includes("processing")) return 2;
  if (s.includes("manager") || s.includes("review")) return 1;
  return 0;
}

export function EmployeeOffboardingScreen({ route, navigation }: any) {
  const session: UserSession = route.params.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [cases, setCases] = useState<OffboardingCase[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Resignation form
  const [offboardingType, setOffboardingType] = useState(OFFBOARDING_REASONS[0]);
  const [lastWorkingDay, setLastWorkingDay] = useState("");
  const [reason, setReason] = useState("");
  const [typePickerOpen, setTypePickerOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const casesRes = await authFetch(`${API_BASE_URL}/offboarding/employee/cases/my`).catch(() => null);
      if (casesRes?.ok) {
        const data = await casesRes.json().catch(() => []);
        const casesList = Array.isArray(data) ? data : [];
        setCases(casesList);

        // Load checklist for first case
        const firstCase = casesList[0];
        const caseId = firstCase?.case_id ?? firstCase?.id;
        if (caseId) {
          const clRes = await authFetch(`${API_BASE_URL}/offboarding/employee/cases/${caseId}/checklist`).catch(() => null);
          if (clRes?.ok) {
            const clData = await clRes.json().catch(() => []);
            setChecklist(Array.isArray(clData) ? clData : []);
          }
        }
      }
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
    setOffboardingType(OFFBOARDING_REASONS[0]);
    setLastWorkingDay("");
    setReason("");
    setTypePickerOpen(false);
  }

  async function handleSubmit() {
    if (!lastWorkingDay) {
      Alert.alert("Validation", "Please enter your last working day (YYYY-MM-DD).");
      return;
    }
    setSubmitting(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/offboarding/employee/cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offboarding_type: offboardingType,
          last_working_day: lastWorkingDay,
          reason: reason.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        Alert.alert("Error", (data as any)?.message || "Failed to submit offboarding request.");
        return;
      }
      Alert.alert("Submitted", "Your offboarding request has been submitted. HR will review it shortly.");
      resetForm();
      setModalOpen(false);
      void loadData();
    } catch {
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const activeCase = cases[0] ?? null;
  const caseStatus = activeCase?.status ?? "";
  const stepIndex = getStepIndex(caseStatus);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.rootRow}>
        {!isMobile && (
          <Sidebar
            role="employee"
            userName={session.name}
            email={session.email}
            activeScreen="Offboarding"
            navigation={navigation}
          />
        )}
        <View style={styles.mainCol}>
          <ScrollView
            contentContainerStyle={[styles.content, isMobile && { paddingBottom: BOTTOM_TAB_HEIGHT + 8 }]}
            showsVerticalScrollIndicator={false}
          >
            <GradientHero style={{ marginBottom: 0 }}>
              <Text style={styles.heroEyebrow}>Staff Portal</Text>
              <Text style={styles.heroTitle}>My Offboarding</Text>
              <Text style={styles.heroSub}>
                {activeCase
                  ? `Case submitted on ${formatDate(activeCase.created_at)}.`
                  : "Manage your offboarding process and clearance here."}
              </Text>
            </GradientHero>

            {/* Submit Resignation button (only if no active case) */}
            {!loading && cases.length === 0 && (
              <Pressable style={styles.submitBtn} onPress={() => setModalOpen(true)}>
                <Ionicons name="send-outline" size={16} color="#FFFFFF" />
                <Text style={styles.submitBtnText}>Submit Resignation / Offboarding</Text>
              </Pressable>
            )}

            {loading ? (
              <ActivityIndicator style={{ marginTop: 24 }} color={Colors.primary} />
            ) : (
              <>
                {/* Active case status */}
                {activeCase && (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Offboarding Status</Text>

                    {/* Progress Steps */}
                    <View style={styles.stepsRow}>
                      {STATUS_STEPS.map((step, i) => {
                        const done = i <= stepIndex;
                        return (
                          <View key={step.key} style={styles.stepItem}>
                            <View style={[styles.stepCircle, done && styles.stepCircleDone]}>
                              <Ionicons
                                name={step.icon}
                                size={16}
                                color={done ? "#FFFFFF" : "#94A3B8"}
                              />
                            </View>
                            {i < STATUS_STEPS.length - 1 && (
                              <View style={[styles.stepLine, done && i < stepIndex && styles.stepLineDone]} />
                            )}
                            <Text style={[styles.stepLabel, done && styles.stepLabelDone]} numberOfLines={2}>
                              {step.label}
                            </Text>
                          </View>
                        );
                      })}
                    </View>

                    {/* Case details */}
                    <View style={styles.detailsGrid}>
                      <DetailRow label="Type" value={activeCase.offboarding_type ?? "—"} />
                      <DetailRow label="Last Working Day" value={formatDate(activeCase.last_working_day)} />
                      <DetailRow label="Status" value={activeCase.status ?? "Submitted"} />
                      {!!activeCase.reason && <DetailRow label="Reason" value={activeCase.reason} last />}
                    </View>
                  </View>
                )}

                {/* Checklist */}
                {checklist.length > 0 && (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Offboarding Checklist</Text>
                    {checklist.map((item, i) => {
                      const tone = statusTone(item.status);
                      return (
                        <View key={item.item_id ?? item.id ?? i} style={styles.checkRow}>
                          <View style={styles.checkLeft}>
                            <Text style={styles.checkName}>{item.item_name ?? item.title ?? "Item"}</Text>
                            {!!item.category && (
                              <Text style={styles.checkCat}>{item.category}</Text>
                            )}
                            {!!item.notes && (
                              <Text style={styles.checkNotes}>{item.notes}</Text>
                            )}
                          </View>
                          <View style={[styles.statusBadge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                            <Text style={[styles.statusText, { color: tone.text }]}>
                              {(item.status ?? "Pending").charAt(0).toUpperCase() +
                                (item.status ?? "Pending").slice(1).toLowerCase()}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* No case state */}
                {cases.length === 0 && (
                  <View style={styles.emptyCard}>
                    <Ionicons name="document-outline" size={40} color="#CBD5E1" />
                    <Text style={styles.emptyTitle}>No Offboarding Case</Text>
                    <Text style={styles.emptySub}>
                      Submit a resignation or offboarding request using the button above.
                      Your HR team will guide you through the clearance process.
                    </Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {isMobile && (
            <BottomTabBar role="employee" activeScreen="Offboarding" navigation={navigation} session={session} />
          )}
        </View>
      </View>

      {/* ── Resignation Modal ──────────────────────────────────────── */}
      <Modal
        visible={modalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => { resetForm(); setModalOpen(false); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Submit Offboarding Request</Text>
              <Pressable onPress={() => { resetForm(); setModalOpen(false); }}>
                <Ionicons name="close" size={22} color="#334155" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {/* Type */}
              <Text style={styles.fieldLabel}>Offboarding Type</Text>
              <Pressable style={styles.pickerBtn} onPress={() => setTypePickerOpen(!typePickerOpen)}>
                <Text style={styles.pickerBtnText}>{offboardingType}</Text>
                <Ionicons name={typePickerOpen ? "chevron-up" : "chevron-down"} size={16} color="#64748B" />
              </Pressable>
              {typePickerOpen && (
                <View style={styles.pickerDropdown}>
                  {OFFBOARDING_REASONS.map((r) => (
                    <Pressable
                      key={r}
                      style={[styles.pickerOption, r === offboardingType && styles.pickerOptionActive]}
                      onPress={() => { setOffboardingType(r); setTypePickerOpen(false); }}
                    >
                      <Text style={[styles.pickerOptionText, r === offboardingType && styles.pickerOptionTextActive]}>
                        {r}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Last Working Day */}
              <Text style={styles.fieldLabel}>Last Working Day</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94A3B8"
                value={lastWorkingDay}
                onChangeText={setLastWorkingDay}
                keyboardType="numeric"
                maxLength={10}
              />

              {/* Reason */}
              <Text style={styles.fieldLabel}>Reason / Resignation Letter (optional)</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Describe your reason for leaving..."
                placeholderTextColor="#94A3B8"
                value={reason}
                onChangeText={setReason}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={1000}
              />

              <View style={styles.warningBox}>
                <Ionicons name="information-circle-outline" size={16} color="#D97706" />
                <Text style={styles.warningText}>
                  Once submitted, your manager and HR will be notified to begin the offboarding process.
                </Text>
              </View>

              <Pressable
                style={[styles.confirmBtn, submitting && styles.confirmBtnDisabled]}
                onPress={() => void handleSubmit()}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="send-outline" size={16} color="#FFFFFF" />
                )}
                <Text style={styles.confirmBtnText}>
                  {submitting ? "Submitting..." : "Submit Request"}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.detailRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  rootRow: { flex: 1, flexDirection: "row" },
  mainCol: { flex: 1 },
  content: { paddingHorizontal: 12, paddingVertical: 12, paddingBottom: 32, gap: 12 },

  heroEyebrow: { color: "rgba(255,255,255,0.78)", fontSize: 10, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  heroTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "800", marginTop: 4 },
  heroSub: { color: "rgba(255,255,255,0.86)", fontSize: 12, lineHeight: 18, marginTop: 6 },

  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 20,
  },
  submitBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },

  card: {
    backgroundColor: Colors.bgCard, borderRadius: 16, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 14,
  },
  cardTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: "800", marginBottom: 16 },

  // Status steps
  stepsRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 16 },
  stepItem: { flex: 1, alignItems: "center", position: "relative" },
  stepCircle: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC", alignItems: "center", justifyContent: "center", marginBottom: 6,
  },
  stepCircleDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  stepLine: {
    position: "absolute", top: 18, left: "50%", right: "-50%",
    height: 2, backgroundColor: "#E2E8F0",
  },
  stepLineDone: { backgroundColor: Colors.primary },
  stepLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: "700", textAlign: "center", textTransform: "uppercase" },
  stepLabelDone: { color: Colors.primary },

  // Details
  detailsGrid: { borderTopWidth: 1, borderTopColor: Colors.bgSubtle ?? "#F1F5F9" },
  detailRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.bgSubtle ?? "#F1F5F9" },
  detailLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  detailValue: { color: Colors.textPrimary, fontSize: 14, fontWeight: "600", marginTop: 2 },

  // Checklist
  checkRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.bgSubtle ?? "#F1F5F9" },
  checkLeft: { flex: 1, paddingRight: 10 },
  checkName: { color: Colors.textPrimary, fontSize: 13, fontWeight: "700" },
  checkCat: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  checkNotes: { color: Colors.textMuted, fontSize: 11, marginTop: 3, fontStyle: "italic" },
  statusBadge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },

  // Empty state
  emptyCard: {
    backgroundColor: Colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
    padding: 32, alignItems: "center", gap: 8,
  },
  emptyTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: "800" },
  emptySub: { color: Colors.textMuted, fontSize: 13, textAlign: "center", lineHeight: 20 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "92%" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  modalTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: "800" },

  fieldLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.textPrimary },
  textarea: { minHeight: 100 },
  pickerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  pickerBtnText: { color: Colors.textPrimary, fontSize: 14, fontWeight: "600" },
  pickerDropdown: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: Colors.border, borderRadius: 12, marginTop: 4, overflow: "hidden" },
  pickerOption: { paddingHorizontal: 14, paddingVertical: 12 },
  pickerOptionActive: { backgroundColor: Colors.primaryLight ?? "#EFF6FF" },
  pickerOptionText: { color: Colors.textSecondary, fontSize: 14, fontWeight: "500" },
  pickerOptionTextActive: { color: Colors.primary, fontWeight: "700" },

  warningBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#FFFBEB", borderWidth: 1, borderColor: "#FDE68A", borderRadius: 10, padding: 12, marginTop: 12 },
  warningText: { flex: 1, color: "#92400E", fontSize: 12, lineHeight: 18 },

  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, marginTop: 16, marginBottom: 8 },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});
