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
import { MobileRoleMenu } from "../components/MobileRoleMenu";
import { Header } from "../components/Header";
import { GradientHero } from "../components/GradientHero";
import { UserSession, authFetch } from "../services/auth";
import { API_BASE_URL } from "../lib/api";

type SessionSummary = {
  session_id: string;
  employee_name: string | null;
  assigned_position: string;
  assigned_department: string;
  status: string;
  progress_percentage: number;
  deadline_date: string;
};

function statusColor(status: string) {
  if (status === "approved") return "#15803D";
  if (status === "for-review") return "#B45309";
  if (status === "in-progress") return "#1D4ED8";
  if (status === "overdue") return "#B91C1C";
  if (status === "not-started") return "#64748B";
  return "#64748B";
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    "not-started": "Not Started",
    "in-progress": "In Progress",
    "for-review": "For Review",
    approved: "Approved",
    overdue: "Overdue",
  };
  return map[status] ?? status;
}

export const HROfficerOnboardingScreen = ({ route, navigation }: any) => {
  const session: UserSession = route.params.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authFetch(`${API_BASE_URL}/onboarding/hr/sessions`)
      .then(res => res.json())
      .then(data => setSessions(Array.isArray(data) ? data : []))
      .catch(() => setError("Failed to load onboarding sessions."))
      .finally(() => setLoading(false));
  }, []);

  const forReviewCount = sessions.filter(s => s.status === "for-review").length;
  const inProgressCount = sessions.filter(s => s.status === "in-progress").length;
  const approvedCount = sessions.filter(s => s.status === "approved").length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        {!isMobile && (
          <Sidebar role={session.role as any} activeScreen="HROfficerOnboarding" navigation={navigation} session={session} />
        )}
        <View style={styles.content}>
          <Header
            title="Onboarding Management"
            subtitle="Review employee onboarding progress"
            rightElement={
              <MobileRoleMenu
                role={session.role as any}
                userName={session.name}
                email={session.email}
                activeScreen="HROfficerOnboarding"
                navigation={navigation}
              />
            }
          />

          <GradientHero
            title="Onboarding Dashboard"
            subtitle="Manage and review employee sessions"
          />

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { borderLeftColor: "#B45309" }]}>
                <Text style={styles.statNum}>{forReviewCount}</Text>
                <Text style={styles.statLabel}>For Review</Text>
              </View>
              <View style={[styles.statCard, { borderLeftColor: "#1D4ED8" }]}>
                <Text style={styles.statNum}>{inProgressCount}</Text>
                <Text style={styles.statLabel}>In Progress</Text>
              </View>
              <View style={[styles.statCard, { borderLeftColor: "#15803D" }]}>
                <Text style={styles.statNum}>{approvedCount}</Text>
                <Text style={styles.statLabel}>Approved</Text>
              </View>
            </View>

            {loading && (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color="#1E40AF" />
                <Text style={styles.loadingText}>Loading sessions...</Text>
              </View>
            )}

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {!loading && !error && sessions.length === 0 && (
              <Text style={styles.emptyText}>No onboarding sessions found.</Text>
            )}

            {sessions.map(s => (
              <View key={s.session_id} style={styles.sessionCard}>
                <View style={styles.sessionHeader}>
                  <View style={styles.sessionInfo}>
                    <Text style={styles.empName}>{s.employee_name ?? "Unknown Employee"}</Text>
                    <Text style={styles.empRole}>{s.assigned_position} • {s.assigned_department}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: statusColor(s.status) + "20", borderColor: statusColor(s.status) }]}>
                    <Text style={[styles.statusPillText, { color: statusColor(s.status) }]}>
                      {statusLabel(s.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.progressRow}>
                  <Text style={styles.progressLabel}>Progress</Text>
                  <Text style={styles.progressPct}>{s.progress_percentage}%</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${s.progress_percentage}%` as any, backgroundColor: statusColor(s.status) }]} />
                </View>

                <Text style={styles.deadlineText}>
                  Deadline: {new Date(s.deadline_date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  inner: { flex: 1, flexDirection: "row" },
  content: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  statCard: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 10, padding: 14, borderLeftWidth: 4, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  statNum: { fontSize: 24, fontWeight: "800", color: "#1E293B" },
  statLabel: { fontSize: 11, color: "#64748B", marginTop: 2 },
  centered: { alignItems: "center", paddingVertical: 40 },
  loadingText: { marginTop: 12, color: "#64748B" },
  errorBox: { backgroundColor: "#FEF2F2", borderRadius: 8, padding: 16, borderWidth: 1, borderColor: "#FECACA" },
  errorText: { color: "#B91C1C", fontSize: 14 },
  emptyText: { color: "#64748B", textAlign: "center", paddingVertical: 24 },
  sessionCard: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  sessionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  sessionInfo: { flex: 1, marginRight: 8 },
  empName: { fontSize: 15, fontWeight: "700", color: "#1E293B" },
  empRole: { fontSize: 12, color: "#64748B", marginTop: 2 },
  statusPill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1 },
  statusPillText: { fontSize: 11, fontWeight: "600" },
  progressRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  progressLabel: { fontSize: 12, color: "#64748B" },
  progressPct: { fontSize: 12, fontWeight: "600", color: "#1E293B" },
  progressBarBg: { height: 6, backgroundColor: "#E2E8F0", borderRadius: 3, overflow: "hidden", marginBottom: 8 },
  progressBarFill: { height: 6, borderRadius: 3 },
  deadlineText: { fontSize: 11, color: "#94A3B8" },
});
