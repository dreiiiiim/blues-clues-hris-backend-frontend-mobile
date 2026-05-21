import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Sidebar } from "../components/Sidebar";
import { BottomTabBar, BOTTOM_TAB_HEIGHT } from "../components/BottomTabBar";
import { GradientHero } from "../components/GradientHero";
import { authFetch, type UserSession } from "../services/auth";
import { API_BASE_URL } from "../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type OnboardingItemStatus =
  | "not-started" | "in-progress" | "for-review" | "approved"
  | "overdue" | "pending" | "submitted" | "rejected" | "issued" | "confirmed";

type OnboardingItem = {
  onboarding_item_id: string;
  title: string;
  status: OnboardingItemStatus;
  is_required: boolean;
  type: string;
  description?: string;
};

type OnboardingSession = {
  session_id: string;
  template_name: string | null;
  employee_name: string | null;
  assigned_position: string | null;
  assigned_department: string | null;
  status: string;
  progress_percentage: number;
  deadline_date: string | null;
  completed_at?: string | null;
  documents: OnboardingItem[];
  tasks: OnboardingItem[];
  equipment: OnboardingItem[];
  hr_forms: OnboardingItem[];
  profile_items: OnboardingItem[];
  welcome: OnboardingItem[];
};

type Stage = "loading" | "welcome" | "onboarding" | "review" | "completion" | "no-session";
type TabKey = "documents" | "tasks" | "equipment" | "forms";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const APPLICANT_BASE = `${API_BASE_URL}/onboarding/applicant`;

function getAuthHeaders(): Record<string, string> {
  return { "Content-Type": "application/json" };
}

function statusColor(status: string): string {
  if (status === "approved" || status === "confirmed") return "#15803D";
  if (status === "for-review" || status === "submitted") return "#B45309";
  if (status === "rejected") return "#B91C1C";
  if (status === "issued") return "#7C3AED";
  if (status === "overdue") return "#B91C1C";
  return "#64748B";
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    "not-started": "Not Started",
    "in-progress": "In Progress",
    "for-review": "For Review",
    approved: "Approved",
    overdue: "Overdue",
    pending: "Pending",
    submitted: "Submitted",
    rejected: "Rejected",
    issued: "Issued",
    confirmed: "Confirmed",
  };
  return map[status] ?? status;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

async function fetchSession(): Promise<OnboardingSession | null> {
  const res = await authFetch(`${APPLICANT_BASE}/session`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch onboarding session");
  return res.json();
}

async function confirmItem(itemId: string): Promise<void> {
  const res = await authFetch(`${APPLICANT_BASE}/items/${itemId}/confirm`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to confirm item");
}

async function submitForReview(sessionId: string): Promise<void> {
  const res = await authFetch(`${APPLICANT_BASE}/session/${sessionId}/submit`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to submit onboarding");
}

// ─── Welcome Stage ────────────────────────────────────────────────────────────

function WelcomeStage({ session, onStart }: { session: OnboardingSession; onStart: () => void }) {
  return (
    <View style={styles.stageBox}>
      <Text style={styles.welcomeIcon}>👋</Text>
      <Text style={styles.welcomeTitle}>Welcome to Your Onboarding</Text>
      <Text style={styles.welcomeDesc}>
        Hi{session.employee_name ? `, ${session.employee_name}` : ""}! You've been assigned an onboarding checklist
        {session.template_name ? ` — "${session.template_name}"` : ""}.
        Complete all required items before{" "}
        {session.deadline_date ? formatDate(session.deadline_date) : "the deadline"}.
      </Text>
      {session.assigned_position && (
        <View style={styles.welcomeMeta}>
          <Text style={styles.welcomeMetaText}>
            {session.assigned_position}
            {session.assigned_department ? ` · ${session.assigned_department}` : ""}
          </Text>
        </View>
      )}
      <Pressable style={styles.primaryBtn} onPress={onStart}>
        <Text style={styles.primaryBtnText}>Get Started</Text>
      </Pressable>
    </View>
  );
}

// ─── Review Stage ─────────────────────────────────────────────────────────────

function ReviewStage() {
  return (
    <View style={styles.stageBox}>
      <Text style={styles.reviewIcon}>📋</Text>
      <Text style={styles.reviewTitle}>Under Review</Text>
      <Text style={styles.reviewDesc}>
        Your onboarding has been submitted and is awaiting HR approval.
        No further action is needed at this time.
      </Text>
    </View>
  );
}

// ─── Completion Stage ─────────────────────────────────────────────────────────

function CompletionStage({ session, onDashboard }: { session: OnboardingSession; onDashboard: () => void }) {
  return (
    <View style={styles.completionBox}>
      <Text style={styles.completionIcon}>✓</Text>
      <Text style={styles.completionTitle}>Onboarding Complete!</Text>
      <Text style={styles.completionDesc}>
        Your onboarding has been approved.
        {session.completed_at
          ? ` Completed on ${formatDate(session.completed_at)}.`
          : ""}
      </Text>
      <Pressable style={styles.primaryBtn} onPress={onDashboard}>
        <Text style={styles.primaryBtnText}>Go to Dashboard</Text>
      </Pressable>
    </View>
  );
}

// ─── Onboarding Tasks Stage ───────────────────────────────────────────────────

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "documents", label: "Documents" },
  { key: "tasks", label: "Tasks" },
  { key: "equipment", label: "Equipment" },
  { key: "forms", label: "HR Forms" },
];

function OnboardingStage({
  session,
  onSessionUpdate,
  onComplete,
}: {
  session: OnboardingSession;
  onSessionUpdate: (s: OnboardingSession) => void;
  onComplete: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("documents");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const displayTasks = (session.tasks ?? []).filter(t => t.type !== "video");
  const itemsMap: Record<TabKey, OnboardingItem[]> = {
    documents: session.documents ?? [],
    tasks: displayTasks,
    equipment: session.equipment ?? [],
    forms: session.hr_forms ?? [],
  };
  const activeItems = itemsMap[activeTab];

  const allItems = [
    ...(session.documents ?? []),
    ...displayTasks,
    ...(session.equipment ?? []),
    ...(session.hr_forms ?? []),
  ];
  const requiredItems = allItems.filter(i => i.is_required);
  const allRequiredDone = requiredItems.every(i => ["approved", "confirmed", "submitted", "for-review"].includes(i.status));

  async function handleConfirm(item: OnboardingItem) {
    setConfirming(item.onboarding_item_id);
    try {
      await confirmItem(item.onboarding_item_id);
      const refreshed = await fetchSession();
      if (refreshed) onSessionUpdate(refreshed);
    } catch {
      // silent — item stays as-is
    } finally {
      setConfirming(null);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await submitForReview(session.session_id);
      onComplete();
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  }

  const isOverdue = session.status === "overdue";

  return (
    <>
      {/* Progress */}
      <View style={styles.card}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Overall Progress</Text>
          <Text style={[styles.progressPct, isOverdue && { color: "#B91C1C" }]}>
            {session.progress_percentage}%
          </Text>
        </View>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${session.progress_percentage}%` as any },
              isOverdue && { backgroundColor: "#B91C1C" },
            ]}
          />
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            Status:{" "}
            <Text style={{ color: statusColor(session.status), fontWeight: "600" }}>
              {statusLabel(session.status)}
            </Text>
          </Text>
          {session.deadline_date && (
            <Text style={styles.metaText}>Deadline: {formatDate(session.deadline_date)}</Text>
          )}
        </View>
      </View>

      {/* Overdue warning */}
      {isOverdue && (
        <View style={styles.overdueBox}>
          <Text style={styles.overdueTitle}>Your onboarding is overdue</Text>
          <Text style={styles.overdueText}>
            The deadline has passed. Please complete your remaining items and contact HR if you need an extension.
          </Text>
        </View>
      )}

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabRow}>
        {TABS.map(tab => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Items */}
      {activeItems.length === 0 ? (
        <Text style={styles.emptyTabText}>No items in this category.</Text>
      ) : (
        activeItems.map(item => {
          const canConfirm = item.status === "pending" || item.status === "not-started";
          const isConfirming = confirming === item.onboarding_item_id;
          return (
            <View key={item.onboarding_item_id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>
                  {item.title}{item.is_required ? " *" : ""}
                </Text>
                <View style={[styles.statusPill, {
                  backgroundColor: statusColor(item.status) + "20",
                  borderColor: statusColor(item.status),
                }]}>
                  <Text style={[styles.statusPillText, { color: statusColor(item.status) }]}>
                    {statusLabel(item.status)}
                  </Text>
                </View>
              </View>
              {item.description ? (
                <Text style={styles.itemDesc}>{item.description}</Text>
              ) : null}
              {canConfirm && (
                <Pressable style={styles.confirmBtn} onPress={() => handleConfirm(item)} disabled={isConfirming}>
                  {isConfirming
                    ? <ActivityIndicator size="small" color="#FFFFFF" />
                    : <Text style={styles.confirmBtnText}>Mark as Done</Text>}
                </Pressable>
              )}
            </View>
          );
        })
      )}

      {/* Submit for Review CTA */}
      {allRequiredDone && session.status !== "for-review" && session.status !== "approved" && (
        <View style={styles.submitBox}>
          <Text style={styles.submitBoxTitle}>Ready to Submit?</Text>
          <Text style={styles.submitBoxDesc}>
            All required items are complete. Submit your onboarding for HR review.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={handleSubmit} disabled={submitting}>
            {submitting
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <Text style={styles.primaryBtnText}>Submit for Review</Text>}
          </Pressable>
        </View>
      )}
    </>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function ApplicantOnboardingScreen({ route, navigation }: any) {
  const session: UserSession = route.params?.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [stage, setStage] = useState<Stage>("loading");
  const [onboarding, setOnboarding] = useState<OnboardingSession | null>(null);

  useEffect(() => {
    fetchSession()
      .then(data => {
        if (!data) { setStage("no-session"); return; }
        setOnboarding(data);
        if (data.status === "approved") setStage("completion");
        else if (data.status === "for-review") setStage("review");
        else if (["in-progress", "overdue"].includes(data.status) || data.progress_percentage > 0) setStage("onboarding");
        else setStage("welcome");
      })
      .catch(() => setStage("no-session"));
  }, []);

  function handleStart() {
    if (onboarding?.welcome?.length) {
      onboarding.welcome
        .filter(w => w.status === "pending")
        .forEach(w => confirmItem(w.onboarding_item_id).catch(() => {}));
    }
    setStage("onboarding");
  }

  const title = onboarding
    ? `Welcome, ${onboarding.employee_name ?? session?.name ?? "Candidate"}`
    : "My Onboarding";
  const subtitle = onboarding
    ? [onboarding.assigned_position, onboarding.assigned_department].filter(Boolean).join(" · ")
    : "Track your onboarding progress";

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        {!isMobile && (
          <Sidebar role="applicant" userName={session?.name ?? ""} email={session?.email ?? ""} activeScreen="Onboarding" navigation={navigation} />
        )}

        <View style={styles.main}>
          <GradientHero>
            <Text style={styles.heroTitle}>{title}</Text>
            <Text style={styles.heroSubtitle}>{subtitle}</Text>
          </GradientHero>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, isMobile && { paddingBottom: BOTTOM_TAB_HEIGHT + 8 }]}
            showsVerticalScrollIndicator={false}
          >
            {stage === "loading" && (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color="#1E40AF" />
                <Text style={styles.loadingText}>Loading onboarding data...</Text>
              </View>
            )}

            {stage === "no-session" && (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>No Onboarding Assigned</Text>
                <Text style={styles.emptyDesc}>
                  Your onboarding session hasn't been set up yet. Please check back later or contact HR.
                </Text>
              </View>
            )}

            {stage === "welcome" && onboarding && (
              <WelcomeStage session={onboarding} onStart={handleStart} />
            )}

            {stage === "onboarding" && onboarding && (
              <OnboardingStage
                session={onboarding}
                onSessionUpdate={setOnboarding}
                onComplete={() => setStage("review")}
              />
            )}

            {stage === "review" && <ReviewStage />}

            {stage === "completion" && onboarding && (
              <CompletionStage
                session={onboarding}
                onDashboard={() => navigation?.navigate?.("ApplicantDashboard", { session })}
              />
            )}
          </ScrollView>

          {isMobile && (
            <BottomTabBar role="applicant" activeScreen="Onboarding" navigation={navigation} session={session} />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  inner: { flex: 1, flexDirection: "row" },
  main: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  centered: { alignItems: "center", paddingVertical: 48 },
  loadingText: { marginTop: 12, color: "#64748B", fontSize: 14 },

  heroTitle: { fontSize: 20, fontWeight: "800", color: "#FFFFFF", marginBottom: 4 },
  heroSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.75)" },

  emptyBox: { backgroundColor: "#F1F5F9", borderRadius: 14, padding: 32, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#1E293B" },
  emptyDesc: { color: "#64748B", textAlign: "center", fontSize: 14, lineHeight: 20 },

  stageBox: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 24, alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#E2E8F0" },
  welcomeIcon: { fontSize: 40 },
  welcomeTitle: { fontSize: 20, fontWeight: "800", color: "#0F172A", textAlign: "center" },
  welcomeDesc: { fontSize: 14, color: "#64748B", textAlign: "center", lineHeight: 20 },
  welcomeMeta: { backgroundColor: "#EFF6FF", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  welcomeMetaText: { fontSize: 13, color: "#1E40AF", fontWeight: "600" },

  reviewIcon: { fontSize: 40 },
  reviewTitle: { fontSize: 20, fontWeight: "800", color: "#92400E", textAlign: "center" },
  reviewDesc: { fontSize: 14, color: "#B45309", textAlign: "center", lineHeight: 20 },

  completionBox: { backgroundColor: "#F0FDF4", borderRadius: 16, padding: 32, alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#BBF7D0" },
  completionIcon: { fontSize: 40, color: "#15803D" },
  completionTitle: { fontSize: 20, fontWeight: "800", color: "#14532D" },
  completionDesc: { fontSize: 14, color: "#166534", textAlign: "center", lineHeight: 20 },

  primaryBtn: { backgroundColor: "#1E40AF", borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12, alignItems: "center", marginTop: 4 },
  primaryBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },

  card: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#E2E8F0", gap: 8 },
  progressRow: { flexDirection: "row", justifyContent: "space-between" },
  progressLabel: { fontSize: 14, fontWeight: "600", color: "#1E293B" },
  progressPct: { fontSize: 14, fontWeight: "700", color: "#1E40AF" },
  progressBarBg: { height: 8, backgroundColor: "#E2E8F0", borderRadius: 4, overflow: "hidden" },
  progressBarFill: { height: 8, backgroundColor: "#1E40AF", borderRadius: 4 },
  metaRow: { flexDirection: "row", justifyContent: "space-between" },
  metaText: { fontSize: 12, color: "#64748B" },

  overdueBox: { backgroundColor: "#FEF2F2", borderRadius: 10, padding: 14, borderWidth: 1, borderColor: "#FECACA", gap: 4 },
  overdueTitle: { fontSize: 14, fontWeight: "700", color: "#991B1B" },
  overdueText: { fontSize: 13, color: "#B91C1C", lineHeight: 18 },

  tabRow: { flexDirection: "row" },
  tab: { paddingHorizontal: 16, paddingVertical: 8, marginRight: 8, borderRadius: 20, backgroundColor: "#F1F5F9" },
  activeTab: { backgroundColor: "#1E40AF" },
  tabText: { fontSize: 13, color: "#64748B", fontWeight: "500" },
  activeTabText: { color: "#FFFFFF", fontWeight: "600" },
  emptyTabText: { color: "#94A3B8", fontSize: 14, textAlign: "center", paddingVertical: 24 },

  itemCard: { backgroundColor: "#FFFFFF", borderRadius: 10, padding: 14, borderWidth: 1, borderColor: "#E2E8F0", gap: 6 },
  itemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  itemTitle: { fontSize: 14, fontWeight: "600", color: "#1E293B", flex: 1, marginRight: 8 },
  itemDesc: { fontSize: 12, color: "#64748B", lineHeight: 17 },
  statusPill: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  statusPillText: { fontSize: 11, fontWeight: "600" },
  confirmBtn: { backgroundColor: "#1E40AF", borderRadius: 8, paddingVertical: 8, alignItems: "center", marginTop: 4 },
  confirmBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },

  submitBox: { backgroundColor: "#F0FDF4", borderRadius: 14, padding: 20, borderWidth: 1, borderColor: "#BBF7D0", gap: 8, alignItems: "center" },
  submitBoxTitle: { fontSize: 16, fontWeight: "700", color: "#14532D" },
  submitBoxDesc: { fontSize: 13, color: "#166534", textAlign: "center", lineHeight: 18 },
});
