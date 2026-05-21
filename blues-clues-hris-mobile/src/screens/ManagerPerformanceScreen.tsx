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

type TeamStatus = "On Track" | "Exceeding" | "At Risk" | "PIP" | "Pending Review";
type BSCCategory = "FINANCIAL" | "CUSTOMER" | "INTERNAL" | "LEARNING";

type TeamMember = {
  id: string;
  name: string;
  position?: string;
  status?: string;
  avg_progress?: number;
  goals_count?: number;
};

type TeamEval = {
  perf_eval_id?: string;
  id?: string;
  user_id?: string;
  employee_id?: string;
  scale_rating?: number;
  perf_comments?: string;
  recommendations?: { promotion: boolean; bonus: boolean; merit: boolean };
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_TONES: Record<string, { bg: string; border: string; text: string }> = {
  "On Track":      { bg: "#EFF6FF", border: "#BFDBFE", text: "#1D4ED8" },
  "Exceeding":     { bg: "#F0FDF4", border: "#BBF7D0", text: "#15803D" },
  "At Risk":       { bg: "#FFFBEB", border: "#FDE68A", text: "#B45309" },
  "PIP":           { bg: "#FEF2F2", border: "#FECACA", text: "#B91C1C" },
  "Pending Review":{ bg: "#F1F5F9", border: "#E2E8F0", text: "#64748B" },
};

function mapStatus(raw: string): TeamStatus {
  if (raw === "ON_TRACK" || raw === "In Progress") return "On Track";
  if (raw === "EXCEEDING")  return "Exceeding";
  if (raw === "AT_RISK")    return "At Risk";
  if (raw === "PIP")        return "PIP";
  return "Pending Review";
}

function StatusPill({ status }: { status: string }) {
  const tone = STATUS_TONES[status] ?? STATUS_TONES["Pending Review"];
  return (
    <View style={[p.pill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <Text style={[p.pillText, { color: tone.text }]}>{status}</Text>
    </View>
  );
}

const BSC_CATS: BSCCategory[] = ["FINANCIAL", "CUSTOMER", "INTERNAL", "LEARNING"];
const FILTER_OPTIONS = ["All", "On Track", "At Risk", "In PIP", "Pending"];
const RATING_LABELS = ["Below Exp.", "Below Exp.", "Meets Exp.", "Above Avg.", "Excellent"];

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function ManagerPerformanceScreen({ route, navigation }: any) {
  const session: UserSession = route.params?.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [teamEvals, setTeamEvals] = useState<TeamEval[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [ratingLabels, setRatingLabels] = useState<string[]>(RATING_LABELS);
  const [filter, setFilter] = useState("All");

  // Review modal
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [memberGoals, setMemberGoals] = useState<any[]>([]);
  const [memberSA, setMemberSA] = useState<any | null>(null);
  const [rating, setRating] = useState(4);
  const [comments, setComments] = useState("");
  const [recommendations, setRecommendations] = useState({ promotion: false, bonus: false, merit: false });
  const [existingEvalId, setExistingEvalId] = useState<string | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);

  // Assign goal modal
  const [goalOpen, setGoalOpen] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [goalForm, setGoalForm] = useState({ title: "", category: "FINANCIAL" as BSCCategory, kpi: "", target: "", deadline: "" });
  const [assigningGoal, setAssigningGoal] = useState(false);

  useEffect(() => {
    authFetch(`${API_BASE_URL}/performance/settings/labels`).then(r => r.json()).then(d => {
      if (Array.isArray(d) && d.length === 5) setRatingLabels(d);
    }).catch(() => {});

    Promise.all([
      authFetch(`${API_BASE_URL}/performance/manager/dashboard`).then(r => r.json()),
      authFetch(`${API_BASE_URL}/performance/manager/team`).then(r => r.json()),
      authFetch(`${API_BASE_URL}/performance/evaluations/team`).then(r => r.json()),
    ])
      .then(([dash, teamData, evalsData]) => {
        setDashboard(dash);
        const members = Array.isArray(teamData) ? teamData : [];
        setTeam(members);
        if (members.length > 0) setSelectedEmpId(members[0].id);
        setTeamEvals(Array.isArray(evalsData) ? evalsData : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function openReview(member: TeamMember) {
    setSelectedMember(member);
    setMemberGoals([]);
    setMemberSA(null);
    setRating(4);
    setComments("");
    setRecommendations({ promotion: false, bonus: false, merit: false });
    setExistingEvalId(null);

    const existing = teamEvals.find(e => e.user_id === member.id || e.employee_id === member.id);
    if (existing) {
      setExistingEvalId(existing.perf_eval_id ?? existing.id ?? null);
      setRating(existing.scale_rating ?? 4);
      setComments(existing.perf_comments ?? "");
      if (existing.recommendations) setRecommendations(existing.recommendations);
    }

    try {
      const res = await authFetch(`${API_BASE_URL}/performance/goals/team`);
      const allGoals = await res.json();
      if (Array.isArray(allGoals)) setMemberGoals(allGoals.filter((g: any) => g.user_id === member.id));
    } catch {}

    try {
      const saRes = await authFetch(`${API_BASE_URL}/performance/self-assessment/user/${member.id}`);
      const saData = await saRes.json();
      if (saData && !saData.message) setMemberSA(saData);
    } catch {}

    setReviewOpen(true);
  }

  async function submitReview() {
    if (!selectedMember) return;
    setSubmittingReview(true);
    try {
      const endpoint = existingEvalId
        ? `${API_BASE_URL}/performance/evaluations/${existingEvalId}`
        : `${API_BASE_URL}/performance/evaluations`;
      const method = existingEvalId ? "PATCH" : "POST";
      const res = await authFetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: selectedMember.id, scale_rating: rating, perf_comments: comments, recommendations }),
      });
      if (!res.ok) throw new Error();
      setReviewOpen(false);
      Alert.alert("Saved", "Evaluation saved successfully.");
    } catch {
      Alert.alert("Error", "Failed to save evaluation.");
    } finally {
      setSubmittingReview(false);
    }
  }

  async function assignGoal() {
    if (!goalForm.title.trim() || !selectedEmpId) { Alert.alert("Validation", "Select an employee and enter a goal title."); return; }
    setAssigningGoal(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/performance/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...goalForm, assigned_to: selectedEmpId, deadline: goalForm.deadline || null }),
      });
      if (!res.ok) throw new Error();
      setGoalOpen(false);
      setGoalForm({ title: "", category: "FINANCIAL", kpi: "", target: "", deadline: "" });
      Alert.alert("Assigned", "Goal assigned to employee.");
    } catch {
      Alert.alert("Error", "Failed to assign goal.");
    } finally {
      setAssigningGoal(false);
    }
  }

  const filteredTeam = team.filter(m => {
    const status = mapStatus(m.status ?? "");
    if (filter === "All") return true;
    if (filter === "On Track") return status === "On Track";
    if (filter === "At Risk")  return status === "At Risk";
    if (filter === "In PIP")   return status === "PIP";
    if (filter === "Pending")  return status === "Pending Review";
    return true;
  });

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}><ActivityIndicator size="large" color="#1E40AF" /><Text style={s.loadingText}>Loading team data...</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.inner}>
        {!isMobile && (
          <Sidebar role="manager" userName={session?.name ?? ""} email={session?.email ?? ""} activeScreen="Performance" navigation={navigation} />
        )}

        <View style={s.main}>
          <ScrollView
            style={s.scroll}
            contentContainerStyle={[s.scrollContent, isMobile && { paddingBottom: BOTTOM_TAB_HEIGHT + 8 }]}
            showsVerticalScrollIndicator={false}
          >
            <GradientHero>
              <Text style={s.heroEyebrow}>Manager Portal</Text>
              <Text style={s.heroTitle}>Team Performance</Text>
              <Text style={s.heroSub}>Review, rate, and develop your direct reports.</Text>
              {dashboard && (
                <View style={s.heroStats}>
                  <View style={s.heroStat}><Text style={s.heroStatLabel}>TEAM SIZE</Text><Text style={s.heroStatValue}>{team.length}</Text></View>
                  <View style={s.heroStat}><Text style={s.heroStatLabel}>ON TRACK</Text><Text style={s.heroStatValue}>{team.filter(m => mapStatus(m.status ?? "") === "On Track").length}</Text></View>
                  <View style={s.heroStat}><Text style={s.heroStatLabel}>AT RISK</Text><Text style={s.heroStatValue}>{team.filter(m => mapStatus(m.status ?? "") === "At Risk").length}</Text></View>
                </View>
              )}
            </GradientHero>

            {/* Action buttons */}
            <View style={s.actionRow}>
              <Pressable style={s.primaryBtn} onPress={() => setGoalOpen(true)}>
                <Ionicons name="add-circle-outline" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={s.primaryBtnText}>Assign Goal</Text>
              </Pressable>
            </View>

            {/* Filter chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow}>
              {FILTER_OPTIONS.map(f => (
                <Pressable key={f} style={[s.filterChip, filter === f && s.filterChipActive]} onPress={() => setFilter(f)}>
                  <Text style={[s.filterText, filter === f && s.filterTextActive]}>{f}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Team list */}
            {filteredTeam.length === 0 ? (
              <View style={s.emptyBox}><Text style={s.emptyText}>No team members match this filter.</Text></View>
            ) : (
              filteredTeam.map(member => {
                const mappedStatus = mapStatus(member.status ?? "");
                return (
                  <View key={member.id} style={s.memberCard}>
                    <View style={s.memberTop}>
                      <View style={s.memberAvatar}><Text style={s.memberAvatarText}>{(member.name ?? "?").charAt(0).toUpperCase()}</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.memberName}>{member.name}</Text>
                        {!!member.position && <Text style={s.memberPos}>{member.position}</Text>}
                      </View>
                      <StatusPill status={mappedStatus} />
                    </View>
                    {member.avg_progress != null && (
                      <View style={s.progressRow}>
                        <View style={s.progressBg}><View style={[s.progressFill, { width: `${member.avg_progress}%` as any }]} /></View>
                        <Text style={s.progressPct}>{member.avg_progress}%</Text>
                      </View>
                    )}
                    <View style={s.memberActions}>
                      <Pressable style={s.reviewBtn} onPress={() => openReview(member)}>
                        <Ionicons name="star-outline" size={13} color="#1E40AF" style={{ marginRight: 4 }} />
                        <Text style={s.reviewBtnText}>Review</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {isMobile && (
            <BottomTabBar role="manager" activeScreen="Performance" navigation={navigation} session={session} />
          )}
        </View>
      </View>

      {/* Review Modal */}
      <Modal visible={reviewOpen} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}>
            <View style={s.modalSheet}>
              <View style={s.modalHeaderRow}>
                <Text style={s.modalTitle}>{selectedMember?.name ?? "Review"}</Text>
                <Pressable onPress={() => setReviewOpen(false)}><Ionicons name="close" size={20} color="#64748B" /></Pressable>
              </View>
              {!!selectedMember?.position && <Text style={s.modalSub}>{selectedMember.position}</Text>}

              {/* Goals */}
              {memberGoals.length > 0 && (
                <View style={s.goalsList}>
                  <Text style={s.fieldLabel}>GOALS ({memberGoals.length})</Text>
                  {memberGoals.map((g: any) => (
                    <View key={g.id} style={s.goalRow}>
                      <Ionicons name={g.status === "Achieved" ? "checkmark-circle" : "radio-button-off"} size={14} color={g.status === "Achieved" ? "#15803D" : "#94A3B8"} style={{ marginRight: 6, marginTop: 2 }} />
                      <Text style={s.goalTitle}>{g.title}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Self-assessment */}
              {memberSA && (
                <View style={s.saBox}>
                  <Text style={s.fieldLabel}>SELF-ASSESSMENT</Text>
                  <Text style={s.saMeta}>Status: {memberSA.status}</Text>
                  {memberSA.overall_self_rating != null && <Text style={s.saMeta}>Self-rating: {memberSA.overall_self_rating}</Text>}
                </View>
              )}

              {/* Rating */}
              <Text style={s.fieldLabel}>MANAGER RATING (1-5)</Text>
              <View style={s.ratingRow}>
                {[1, 2, 3, 4, 5].map(n => (
                  <Pressable key={n} style={[s.ratingBtn, rating === n && s.ratingBtnActive]} onPress={() => setRating(n)}>
                    <Text style={[s.ratingBtnText, rating === n && s.ratingBtnTextActive]}>{n}</Text>
                  </Pressable>
                ))}
              </View>
              {!!ratingLabels[rating - 1] && <Text style={s.ratingLabel}>{ratingLabels[rating - 1]}</Text>}

              {/* Comments */}
              <Text style={s.fieldLabel}>COMMENTS</Text>
              <TextInput style={[s.input, s.inputMulti]} value={comments} onChangeText={setComments} placeholder="Performance comments..." placeholderTextColor="#94A3B8" multiline numberOfLines={3} />

              {/* Recommendations */}
              <Text style={s.fieldLabel}>RECOMMENDATIONS</Text>
              <View style={s.recRow}>
                {(Object.keys(recommendations) as Array<keyof typeof recommendations>).map(key => (
                  <Pressable key={key} style={[s.recChip, recommendations[key] && s.recChipActive]} onPress={() => setRecommendations(r => ({ ...r, [key]: !r[key] }))}>
                    <Text style={[s.recChipText, recommendations[key] && s.recChipTextActive]}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={s.modalBtnRow}>
                <Pressable style={[s.btn, s.btnOutline]} onPress={() => setReviewOpen(false)} disabled={submittingReview}>
                  <Text style={s.btnOutlineText}>Cancel</Text>
                </Pressable>
                <Pressable style={[s.btn, s.btnPrimary]} onPress={submitReview} disabled={submittingReview}>
                  {submittingReview ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnPrimaryText}>Save Evaluation</Text>}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Assign Goal Modal */}
      <Modal visible={goalOpen} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeaderRow}>
              <Text style={s.modalTitle}>Assign Goal</Text>
              <Pressable onPress={() => setGoalOpen(false)}><Ionicons name="close" size={20} color="#64748B" /></Pressable>
            </View>

            <Text style={s.fieldLabel}>EMPLOYEE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.empChipRow}>
              {team.map(m => (
                <Pressable key={m.id} style={[s.empChip, selectedEmpId === m.id && s.empChipActive]} onPress={() => setSelectedEmpId(m.id)}>
                  <Text style={[s.empChipText, selectedEmpId === m.id && s.empChipTextActive]}>{m.name}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={s.fieldLabel}>GOAL TITLE *</Text>
            <TextInput style={s.input} value={goalForm.title} onChangeText={v => setGoalForm(f => ({ ...f, title: v }))} placeholder="e.g. Improve customer satisfaction score" placeholderTextColor="#94A3B8" />

            <Text style={s.fieldLabel}>BSC CATEGORY</Text>
            <View style={s.catRow}>
              {BSC_CATS.map(cat => (
                <Pressable key={cat} style={[s.catChip, goalForm.category === cat && s.catChipActive]} onPress={() => setGoalForm(f => ({ ...f, category: cat }))}>
                  <Text style={[s.catChipText, goalForm.category === cat && s.catChipTextActive]}>{cat}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={s.fieldLabel}>KPI / DESCRIPTION</Text>
            <TextInput style={s.input} value={goalForm.kpi} onChangeText={v => setGoalForm(f => ({ ...f, kpi: v }))} placeholder="Key performance indicator" placeholderTextColor="#94A3B8" />

            <Text style={s.fieldLabel}>TARGET</Text>
            <TextInput style={s.input} value={goalForm.target} onChangeText={v => setGoalForm(f => ({ ...f, target: v }))} placeholder="e.g. 90% satisfaction rating" placeholderTextColor="#94A3B8" />

            <Text style={s.fieldLabel}>DEADLINE (YYYY-MM-DD)</Text>
            <TextInput style={s.input} value={goalForm.deadline} onChangeText={v => setGoalForm(f => ({ ...f, deadline: v }))} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" />

            <View style={s.modalBtnRow}>
              <Pressable style={[s.btn, s.btnOutline]} onPress={() => setGoalOpen(false)} disabled={assigningGoal}>
                <Text style={s.btnOutlineText}>Cancel</Text>
              </Pressable>
              <Pressable style={[s.btn, s.btnPrimary]} onPress={assignGoal} disabled={assigningGoal}>
                {assigningGoal ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnPrimaryText}>Assign Goal</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const p = StyleSheet.create({
  pill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  pillText: { fontSize: 10, fontWeight: "700" },
});

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

  actionRow: { flexDirection: "row", gap: 10 },
  primaryBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#1E40AF", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  primaryBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },

  filterRow: { flexDirection: "row" },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, marginRight: 8, borderRadius: 20, backgroundColor: "#F1F5F9" },
  filterChipActive: { backgroundColor: "#1E40AF" },
  filterText: { fontSize: 13, color: "#64748B", fontWeight: "600" },
  filterTextActive: { color: "#FFFFFF" },

  memberCard: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#E2E8F0", gap: 10 },
  memberTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  memberAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#1E3A8A", alignItems: "center", justifyContent: "center" },
  memberAvatarText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  memberName: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  memberPos: { fontSize: 12, color: "#64748B", marginTop: 1 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  progressBg: { flex: 1, height: 6, backgroundColor: "#E2E8F0", borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, backgroundColor: "#1E40AF", borderRadius: 3 },
  progressPct: { fontSize: 12, fontWeight: "600", color: "#0F172A", minWidth: 32, textAlign: "right" },
  memberActions: { flexDirection: "row", gap: 8 },
  reviewBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#EFF6FF", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: "#BFDBFE" },
  reviewBtnText: { color: "#1E40AF", fontSize: 13, fontWeight: "600" },

  emptyBox: { backgroundColor: "#F1F5F9", borderRadius: 12, padding: 24, alignItems: "center" },
  emptyText: { fontSize: 13, color: "#64748B" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 10, maxHeight: "92%" },
  modalHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalTitle: { fontSize: 17, fontWeight: "800", color: "#0F172A" },
  modalSub: { fontSize: 13, color: "#64748B", marginTop: -6 },

  goalsList: { gap: 6 },
  goalRow: { flexDirection: "row", alignItems: "flex-start" },
  goalTitle: { fontSize: 13, color: "#0F172A", flex: 1 },

  saBox: { backgroundColor: "#F8FAFC", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: "#E2E8F0", gap: 4 },
  saMeta: { fontSize: 12, color: "#64748B" },

  fieldLabel: { fontSize: 10, fontWeight: "700", color: "#94A3B8", letterSpacing: 1.2, textTransform: "uppercase" },

  ratingRow: { flexDirection: "row", gap: 10 },
  ratingBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: "center", backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0" },
  ratingBtnActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  ratingBtnText: { fontSize: 16, fontWeight: "700", color: "#64748B" },
  ratingBtnTextActive: { color: "#FFFFFF" },
  ratingLabel: { fontSize: 12, color: "#94A3B8", textAlign: "center" },

  input: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#0F172A" },
  inputMulti: { minHeight: 72, textAlignVertical: "top" },

  recRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  recChip: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" },
  recChipActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  recChipText: { fontSize: 12, color: "#64748B", fontWeight: "600" },
  recChipTextActive: { color: "#FFFFFF" },

  empChipRow: { flexDirection: "row" },
  empChip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8, backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0" },
  empChipActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  empChipText: { fontSize: 13, color: "#64748B", fontWeight: "600" },
  empChipTextActive: { color: "#FFFFFF" },

  catRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  catChip: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" },
  catChipActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  catChipText: { fontSize: 11, color: "#64748B", fontWeight: "700" },
  catChipTextActive: { color: "#FFFFFF" },

  modalBtnRow: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 10, paddingVertical: 11 },
  btnPrimary: { backgroundColor: "#1E40AF" },
  btnPrimaryText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  btnOutline: { borderWidth: 1, borderColor: "#CBD5E1" },
  btnOutlineText: { color: "#475569", fontWeight: "600", fontSize: 14 },
});
