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

type BSCCategory = "FINANCIAL" | "CUSTOMER" | "INTERNAL" | "LEARNING";

type Goal = {
  id: string;
  category: BSCCategory;
  title: string;
  desc?: string;
  progress: number;
  status: string;
  statusColor?: string;
  isPending?: boolean;
};

type Evaluation = {
  evaluation_id?: string;
  review_period?: string;
  rating_status?: string;
  final_rating?: number | null;
  manager_rating?: number | null;
  hr_rating?: number | null;
  employee_acknowledged_at?: string | null;
  completed_at?: string | null;
};

type PIP = {
  perf_pip_id: string;
  reason?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
};

type SelfAssessment = {
  sa_id?: string;
  status?: string;
  overall_self_rating?: number | null;
  comments?: string | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<BSCCategory, { bg: string; border: string; text: string }> = {
  FINANCIAL: { bg: "#F0FDF4", border: "#BBF7D0", text: "#15803D" },
  CUSTOMER:  { bg: "#EFF6FF", border: "#BFDBFE", text: "#1D4ED8" },
  INTERNAL:  { bg: "#F5F3FF", border: "#DDD6FE", text: "#7C3AED" },
  LEARNING:  { bg: "#FFFBEB", border: "#FDE68A", text: "#B45309" },
};

function goalStatusColor(status: string): string {
  if (status === "ACHIEVED")         return "#10B981";
  if (status === "AT_RISK")          return "#EF4444";
  if (status === "PENDING_APPROVAL") return "#8B5CF6";
  return "#3B82F6";
}

// ─── Goal Card ────────────────────────────────────────────────────────────────

function GoalCard({ goal, onLogProgress }: { goal: Goal; onLogProgress: (id: string) => void }) {
  const cat = CATEGORY_COLORS[goal.category] ?? CATEGORY_COLORS.FINANCIAL;
  const color = goal.statusColor ?? goalStatusColor(goal.status);
  const canLog = !goal.isPending && goal.status !== "ACHIEVED";

  return (
    <View style={g.card}>
      <View style={g.cardTop}>
        <View style={[g.catPill, { backgroundColor: cat.bg, borderColor: cat.border }]}>
          <Text style={[g.catText, { color: cat.text }]}>{goal.category}</Text>
        </View>
        <View style={g.statusRow}>
          {canLog && (
            <Pressable style={g.logBtn} onPress={() => onLogProgress(goal.id)}>
              <Ionicons name="trending-up-outline" size={12} color="#1E40AF" style={{ marginRight: 3 }} />
              <Text style={g.logBtnText}>Log Progress</Text>
            </Pressable>
          )}
          <View style={[g.dot, { backgroundColor: color }]} />
          <Text style={[g.statusText, { color }]}>{goal.status}</Text>
        </View>
      </View>
      <Text style={g.title}>{goal.title}</Text>
      {goal.desc ? <Text style={g.desc}>{goal.desc}</Text> : null}
      {goal.isPending ? (
        <Text style={g.pendingText}>Pending Manager Approval</Text>
      ) : (
        <View style={g.progressRow}>
          <View style={g.progressBg}>
            <View style={[g.progressFill, { width: `${goal.progress}%` as any, backgroundColor: color }]} />
          </View>
          <Text style={g.progressPct}>{goal.progress}%</Text>
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function EmployeePerformanceScreen({ route, navigation }: any) {
  const session: UserSession = route.params?.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [pip, setPip] = useState<PIP | null>(null);
  const [selfAssessment, setSelfAssessment] = useState<SelfAssessment | null>(null);
  const [ratingLabels, setRatingLabels] = useState<string[]>(["Below Exp.", "Below Exp.", "Meets Exp.", "Above Avg.", "Excellent"]);
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const [activeTab, setActiveTab] = useState<"goals" | "evaluation" | "history">("goals");

  // Propose goal modal
  const [proposeOpen, setProposeOpen] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalCategory, setNewGoalCategory] = useState<BSCCategory>("FINANCIAL");
  const [newGoalKPI, setNewGoalKPI] = useState("");
  const [newGoalTarget, setNewGoalTarget] = useState("");
  const [newGoalDeadline, setNewGoalDeadline] = useState("");
  const [proposing, setProposing] = useState(false);

  // Log progress modal
  const [progressOpen, setProgressOpen] = useState(false);
  const [progressGoalId, setProgressGoalId] = useState<string | null>(null);
  const [progressPct, setProgressPct] = useState("50");
  const [progressNotes, setProgressNotes] = useState("");
  const [logging, setLogging] = useState(false);

  // Acknowledge
  const [acknowledging, setAcknowledging] = useState(false);

  useEffect(() => {
    authFetch(`${API_BASE_URL}/performance/pip/my`).then(r => r.json()).then(data => {
      if (Array.isArray(data) && data.length > 0) setPip(data[0]);
      else if (!Array.isArray(data) && data && !data.message) setPip(data);
    }).catch(() => {});

    authFetch(`${API_BASE_URL}/performance/self-assessment/my`).then(r => r.json()).then(d => {
      if (d && !d.message && !d.error) setSelfAssessment(d);
    }).catch(() => {});

    authFetch(`${API_BASE_URL}/performance/settings/labels`).then(r => r.json()).then(d => {
      if (Array.isArray(d) && d.length === 5) setRatingLabels(d);
    }).catch(() => {});

    Promise.all([
      authFetch(`${API_BASE_URL}/performance/employee/dashboard`).then(r => r.json()),
      authFetch(`${API_BASE_URL}/performance/goals/my`).then(r => r.json()),
      authFetch(`${API_BASE_URL}/performance/evaluations/my`).then(r => r.json()),
      authFetch(`${API_BASE_URL}/performance/evaluations/my/history`).then(r => r.json()),
    ])
      .then(([dash, goalsData, evalData, histData]) => {
        setDashboard(dash);
        setGoals(Array.isArray(goalsData) ? goalsData : []);
        if (Array.isArray(evalData) && evalData.length > 0) {
          const ev = evalData.find((e: any) => e.review_period === "MID_YEAR") || evalData[0];
          setEvaluation(ev);
          setHasAcknowledged(!!ev?.employee_acknowledged_at);
        }
        setHistory(Array.isArray(histData) ? histData : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function proposeGoal() {
    if (!newGoalTitle.trim()) { Alert.alert("Validation", "Goal title is required."); return; }
    setProposing(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/performance/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newGoalTitle, category: newGoalCategory, kpi: newGoalKPI, target: newGoalTarget, deadline: newGoalDeadline || null }),
      });
      const created = await res.json();
      if (!res.ok) throw new Error(created.message);
      setGoals(prev => [{ id: created.id ?? created.perf_goals_id, category: newGoalCategory, title: newGoalTitle, desc: newGoalKPI, progress: 0, status: "PENDING_APPROVAL", isPending: true }, ...prev]);
      setProposeOpen(false);
      setNewGoalTitle(""); setNewGoalCategory("FINANCIAL"); setNewGoalKPI(""); setNewGoalTarget(""); setNewGoalDeadline("");
      Alert.alert("Goal Proposed", "Goal submitted for manager approval.");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to propose goal.");
    } finally {
      setProposing(false);
    }
  }

  async function logProgress() {
    if (!progressGoalId) return;
    const pct = parseInt(progressPct, 10);
    if (isNaN(pct) || pct < 0 || pct > 100) { Alert.alert("Validation", "Enter a valid percentage (0-100)."); return; }
    setLogging(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/performance/goals/${progressGoalId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progress_pct: pct, notes: progressNotes }),
      });
      if (!res.ok) throw new Error();
      setGoals(prev => prev.map(g => g.id === progressGoalId ? { ...g, progress: pct } : g));
      setProgressOpen(false);
      setProgressNotes(""); setProgressPct("50");
    } catch {
      Alert.alert("Error", "Failed to log progress.");
    } finally {
      setLogging(false);
    }
  }

  async function acknowledgeEvaluation() {
    if (!evaluation?.evaluation_id) return;
    setAcknowledging(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/performance/evaluations/${evaluation.evaluation_id}/acknowledge`, { method: "POST" });
      if (!res.ok) throw new Error();
      setHasAcknowledged(true);
      Alert.alert("Acknowledged", "You have acknowledged your performance evaluation.");
    } catch {
      Alert.alert("Error", "Failed to acknowledge evaluation.");
    } finally {
      setAcknowledging(false);
    }
  }

  const TABS: Array<{ key: "goals" | "evaluation" | "history"; label: string }> = [
    { key: "goals", label: "Goals" },
    { key: "evaluation", label: "Evaluation" },
    { key: "history", label: "History" },
  ];

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
          <Sidebar role="employee" userName={session?.name ?? ""} email={session?.email ?? ""} activeScreen="Performance" navigation={navigation} />
        )}

        <View style={s.main}>
          <ScrollView
            style={s.scroll}
            contentContainerStyle={[s.scrollContent, isMobile && { paddingBottom: BOTTOM_TAB_HEIGHT + 8 }]}
            showsVerticalScrollIndicator={false}
          >
            <GradientHero>
              <Text style={s.heroEyebrow}>Employee Self-Service</Text>
              <Text style={s.heroTitle}>Performance</Text>
              <Text style={s.heroSub}>Track your goals, view evaluations, and manage your performance journey.</Text>
              {dashboard && (
                <View style={s.heroStats}>
                  <View style={s.heroStatBox}><Text style={s.heroStatLabel}>GOALS</Text><Text style={s.heroStatValue}>{goals.length}</Text></View>
                  <View style={s.heroStatBox}><Text style={s.heroStatLabel}>ACHIEVED</Text><Text style={s.heroStatValue}>{goals.filter(g => g.status === "ACHIEVED").length}</Text></View>
                  <View style={s.heroStatBox}><Text style={s.heroStatLabel}>AT RISK</Text><Text style={s.heroStatValue}>{goals.filter(g => g.status === "AT_RISK").length}</Text></View>
                </View>
              )}
            </GradientHero>

            {/* PIP Banner */}
            {pip && (
              <View style={s.pipBox}>
                <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={s.pipTitle}>Performance Improvement Plan Active</Text>
                  {!!pip.reason && <Text style={s.pipDesc}>{pip.reason}</Text>}
                  {!!pip.end_date && <Text style={s.pipMeta}>Until {new Date(pip.end_date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</Text>}
                </View>
              </View>
            )}

            {/* Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabRow}>
              {TABS.map(tab => (
                <Pressable key={tab.key} style={[s.tab, activeTab === tab.key && s.activeTab]} onPress={() => setActiveTab(tab.key)}>
                  <Text style={[s.tabText, activeTab === tab.key && s.activeTabText]}>{tab.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* ── Goals Tab ─────────────────────────────────────────────────── */}
            {activeTab === "goals" && (
              <>
                <Pressable style={s.proposeBtn} onPress={() => setProposeOpen(true)}>
                  <Ionicons name="add-circle-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={s.proposeBtnText}>Propose a Goal</Text>
                </Pressable>
                {goals.length === 0 ? (
                  <View style={s.emptyBox}><Text style={s.emptyText}>No goals yet. Propose your first goal.</Text></View>
                ) : (
                  goals.map(goal => (
                    <GoalCard key={goal.id} goal={goal} onLogProgress={(id) => { setProgressGoalId(id); setProgressOpen(true); }} />
                  ))
                )}
              </>
            )}

            {/* ── Evaluation Tab ────────────────────────────────────────────── */}
            {activeTab === "evaluation" && (
              evaluation ? (
                <View style={s.card}>
                  <Text style={s.cardTitle}>Current Evaluation</Text>
                  {!!evaluation.review_period && <Text style={s.evalMeta}>Review Period: {evaluation.review_period.replace("_", " ")}</Text>}
                  {evaluation.final_rating != null && <Text style={s.evalRating}>Final Rating: {evaluation.final_rating} — {ratingLabels[Math.round(evaluation.final_rating) - 1] ?? ""}</Text>}
                  {evaluation.manager_rating != null && <Text style={s.evalMeta}>Manager Rating: {evaluation.manager_rating}</Text>}
                  {!!evaluation.completed_at && <Text style={s.evalMeta}>Completed: {new Date(evaluation.completed_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</Text>}
                  {!hasAcknowledged && evaluation.final_rating != null && (
                    <Pressable style={s.ackBtn} onPress={acknowledgeEvaluation} disabled={acknowledging}>
                      {acknowledging ? <ActivityIndicator size="small" color="#fff" /> : (
                        <>
                          <Ionicons name="checkmark-circle-outline" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                          <Text style={s.ackBtnText}>Acknowledge Evaluation</Text>
                        </>
                      )}
                    </Pressable>
                  )}
                  {hasAcknowledged && (
                    <View style={s.acknowledgedRow}>
                      <Ionicons name="checkmark-circle" size={16} color="#15803D" />
                      <Text style={s.acknowledgedText}>You have acknowledged this evaluation.</Text>
                    </View>
                  )}
                  {/* Self-assessment */}
                  {selfAssessment && (
                    <View style={s.saBox}>
                      <Text style={s.saTitle}>Self-Assessment</Text>
                      <Text style={s.saMeta}>Status: {selfAssessment.status ?? "—"}</Text>
                      {selfAssessment.overall_self_rating != null && (
                        <Text style={s.saMeta}>Self Rating: {selfAssessment.overall_self_rating}</Text>
                      )}
                    </View>
                  )}
                </View>
              ) : (
                <View style={s.emptyBox}><Text style={s.emptyText}>No active evaluation for the current period.</Text></View>
              )
            )}

            {/* ── History Tab ───────────────────────────────────────────────── */}
            {activeTab === "history" && (
              history.length === 0 ? (
                <View style={s.emptyBox}><Text style={s.emptyText}>No evaluation history yet.</Text></View>
              ) : (
                history.map((h, idx) => (
                  <View key={idx} style={s.histCard}>
                    <View style={s.histRow}>
                      <Text style={s.histCycle}>{h.cycle ?? h.review_period ?? "—"}</Text>
                      <Text style={s.histYear}>{h.year ?? "—"}</Text>
                    </View>
                    <View style={s.histRow}>
                      <Text style={s.histScore}>{h.score ?? h.final_rating ?? "—"}</Text>
                      {!!h.label && <Text style={s.histLabel}>{h.label}</Text>}
                    </View>
                    {h.status && (
                      <Text style={s.histStatus}>{h.status}</Text>
                    )}
                  </View>
                ))
              )
            )}
          </ScrollView>

          {isMobile && (
            <BottomTabBar role="employee" activeScreen="Performance" navigation={navigation} session={session} />
          )}
        </View>
      </View>

      {/* Propose Goal Modal */}
      <Modal visible={proposeOpen} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <ScrollView contentContainerStyle={s.modalScroll}>
            <View style={s.modalSheet}>
              <Text style={s.modalTitle}>Propose a Goal</Text>
              <Text style={s.modalLabel}>Goal Title *</Text>
              <TextInput style={s.modalInput} value={newGoalTitle} onChangeText={setNewGoalTitle} placeholder="e.g. Increase quarterly sales by 20%" placeholderTextColor="#94A3B8" />
              <Text style={s.modalLabel}>BSC Category</Text>
              <View style={s.catGrid}>
                {(["FINANCIAL", "CUSTOMER", "INTERNAL", "LEARNING"] as BSCCategory[]).map(cat => {
                  const colors = CATEGORY_COLORS[cat];
                  const active = newGoalCategory === cat;
                  return (
                    <Pressable
                      key={cat}
                      style={[s.catOption, active && { backgroundColor: colors.bg, borderColor: colors.border }]}
                      onPress={() => setNewGoalCategory(cat)}
                    >
                      <Text style={[s.catOptionText, active && { color: colors.text }]}>{cat}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={s.modalLabel}>KPI / Description</Text>
              <TextInput style={[s.modalInput, s.modalInputMulti]} value={newGoalKPI} onChangeText={setNewGoalKPI} placeholder="Key performance indicator or description" placeholderTextColor="#94A3B8" multiline numberOfLines={2} />
              <Text style={s.modalLabel}>Target</Text>
              <TextInput style={s.modalInput} value={newGoalTarget} onChangeText={setNewGoalTarget} placeholder="e.g. 20% increase" placeholderTextColor="#94A3B8" />
              <Text style={s.modalLabel}>Deadline (YYYY-MM-DD)</Text>
              <TextInput style={s.modalInput} value={newGoalDeadline} onChangeText={setNewGoalDeadline} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" />
              <View style={s.modalBtnRow}>
                <Pressable style={[s.modalBtn, s.modalBtnOutline]} onPress={() => setProposeOpen(false)} disabled={proposing}>
                  <Text style={s.modalBtnOutlineText}>Cancel</Text>
                </Pressable>
                <Pressable style={[s.modalBtn, s.modalBtnPrimary]} onPress={proposeGoal} disabled={proposing}>
                  {proposing ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.modalBtnPrimaryText}>Submit for Approval</Text>}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Log Progress Modal */}
      <Modal visible={progressOpen} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>Log Progress</Text>
            <Text style={s.modalLabel}>Progress % (0-100)</Text>
            <TextInput style={s.modalInput} value={progressPct} onChangeText={setProgressPct} keyboardType="numeric" placeholder="50" placeholderTextColor="#94A3B8" />
            <Text style={s.modalLabel}>Notes</Text>
            <TextInput style={[s.modalInput, s.modalInputMulti]} value={progressNotes} onChangeText={setProgressNotes} placeholder="Any notes about this update..." placeholderTextColor="#94A3B8" multiline numberOfLines={3} />
            <View style={s.modalBtnRow}>
              <Pressable style={[s.modalBtn, s.modalBtnOutline]} onPress={() => setProgressOpen(false)} disabled={logging}>
                <Text style={s.modalBtnOutlineText}>Cancel</Text>
              </Pressable>
              <Pressable style={[s.modalBtn, s.modalBtnPrimary]} onPress={logProgress} disabled={logging}>
                {logging ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.modalBtnPrimaryText}>Log Progress</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const g = StyleSheet.create({
  card: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#E2E8F0", gap: 8 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 },
  catPill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  catText: { fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  logBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#EFF6FF", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "#BFDBFE" },
  logBtnText: { fontSize: 10, fontWeight: "700", color: "#1E40AF" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: "700" },
  title: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  desc: { fontSize: 12, color: "#64748B", lineHeight: 17 },
  pendingText: { fontSize: 11, fontStyle: "italic", color: "#7C3AED" },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  progressBg: { flex: 1, height: 6, backgroundColor: "#E2E8F0", borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },
  progressPct: { fontSize: 11, fontWeight: "700", color: "#0F172A", minWidth: 32, textAlign: "right" },
});

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
  heroStatBox: { flex: 1, alignItems: "center" },
  heroStatLabel: { fontSize: 8, fontWeight: "700", color: "rgba(255,255,255,0.6)", letterSpacing: 1.5, textTransform: "uppercase" },
  heroStatValue: { fontSize: 22, fontWeight: "800", color: "#FFFFFF", marginTop: 4 },

  pipBox: { flexDirection: "row", backgroundColor: "#FEF2F2", borderRadius: 10, padding: 14, borderWidth: 1, borderColor: "#FECACA", alignItems: "flex-start" },
  pipTitle: { fontSize: 13, fontWeight: "700", color: "#991B1B" },
  pipDesc: { fontSize: 12, color: "#B91C1C", marginTop: 2 },
  pipMeta: { fontSize: 11, color: "#DC2626", marginTop: 2 },

  tabRow: { flexDirection: "row" },
  tab: { paddingHorizontal: 18, paddingVertical: 9, marginRight: 8, borderRadius: 20, backgroundColor: "#F1F5F9" },
  activeTab: { backgroundColor: "#1E40AF" },
  tabText: { fontSize: 13, color: "#64748B", fontWeight: "600" },
  activeTabText: { color: "#FFFFFF" },

  proposeBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#1E40AF", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, alignSelf: "flex-start" },
  proposeBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  emptyBox: { backgroundColor: "#F1F5F9", borderRadius: 12, padding: 28, alignItems: "center" },
  emptyText: { fontSize: 13, color: "#64748B" },

  card: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#E2E8F0", gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  evalMeta: { fontSize: 13, color: "#64748B" },
  evalRating: { fontSize: 16, fontWeight: "700", color: "#1E40AF" },
  ackBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#1E40AF", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, alignSelf: "flex-start", marginTop: 8 },
  ackBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  acknowledgedRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  acknowledgedText: { fontSize: 13, color: "#15803D" },
  saBox: { backgroundColor: "#F8FAFC", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#E2E8F0", gap: 4, marginTop: 4 },
  saTitle: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  saMeta: { fontSize: 12, color: "#64748B" },

  histCard: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#E2E8F0", gap: 4 },
  histRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  histCycle: { fontSize: 13, fontWeight: "600", color: "#0F172A" },
  histYear: { fontSize: 12, color: "#94A3B8" },
  histScore: { fontSize: 15, fontWeight: "700", color: "#1E40AF" },
  histLabel: { fontSize: 12, color: "#64748B" },
  histStatus: { fontSize: 11, color: "#94A3B8" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalScroll: { justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 10 },
  modalTitle: { fontSize: 17, fontWeight: "800", color: "#0F172A" },
  modalLabel: { fontSize: 11, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 1 },
  modalInput: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#0F172A" },
  modalInputMulti: { minHeight: 72, textAlignVertical: "top" },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catOption: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" },
  catOptionText: { fontSize: 11, fontWeight: "700", color: "#64748B" },
  modalBtnRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  modalBtn: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 10, paddingVertical: 11 },
  modalBtnPrimary: { backgroundColor: "#1E40AF" },
  modalBtnPrimaryText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  modalBtnOutline: { borderWidth: 1, borderColor: "#CBD5E1" },
  modalBtnOutlineText: { color: "#475569", fontWeight: "600", fontSize: 14 },
});
