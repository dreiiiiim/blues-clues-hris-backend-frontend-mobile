import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Sidebar } from "../components/Sidebar";
import { BottomTabBar, BOTTOM_TAB_HEIGHT } from "../components/BottomTabBar";
import { Header } from "../components/Header";
import { GradientHero } from "../components/GradientHero";
import { Colors } from "../constants/colors";
import { authFetch, type UserSession } from "../services/auth";
import { API_BASE_URL } from "../lib/api";

type EmployeeProfile = {
  employee_id?: string;
  department_name?: string;
  department_id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  account_status?: string;
  onboarding_status?: string;
  start_date?: string;
};

type TimekeepingStatus = {
  status?: string;
  time_in?: { timestamp: string } | null;
  time_out?: { timestamp: string } | null;
  hours_worked?: number;
};

type EmployeeDocument = {
  document_id?: string;
  document_type?: string;
  status?: string;
};

type LeaveBalance = {
  leave_type?: string;
  type?: string;
  remaining?: number;
  allocated_days?: number;
  used_days?: number;
};

function formatDate(val?: string | null): string {
  if (!val) return "—";
  const d = new Date(val);
  return isNaN(d.getTime()) ? val : d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

function formatTime(val?: string | null): string {
  if (!val) return "—";
  const d = new Date(val);
  return isNaN(d.getTime())
    ? val
    : d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
}

export const EmployeeDashboardScreen = ({ route, navigation }: any) => {
  const session: UserSession = route.params.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [tkStatus, setTkStatus] = useState<TimekeepingStatus | null>(null);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, tkRes, docsRes, leaveRes] = await Promise.allSettled([
        authFetch(`${API_BASE_URL}/users/me`),
        authFetch(`${API_BASE_URL}/timekeeping/my-status`),
        authFetch(`${API_BASE_URL}/users/me/documents`),
        authFetch(`${API_BASE_URL}/leave/balances`),
      ]);

      if (profileRes.status === "fulfilled" && profileRes.value.ok) {
        const data = await profileRes.value.json().catch(() => null);
        setProfile(data);
      }
      if (tkRes.status === "fulfilled" && tkRes.value.ok) {
        const data = await tkRes.value.json().catch(() => null);
        setTkStatus(data);
      }
      if (docsRes.status === "fulfilled" && docsRes.value.ok) {
        const data = await docsRes.value.json().catch(() => []);
        setDocuments(Array.isArray(data) ? data : []);
      }
      if (leaveRes.status === "fulfilled" && leaveRes.value.ok) {
        const data = await leaveRes.value.json().catch(() => []);
        setLeaveBalances(Array.isArray(data) ? data : []);
      }
    } catch {
      // silently fail — show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const firstName = profile?.first_name ?? session.name.split(" ")[0];
  const docApproved = documents.filter((d) => d.status?.toLowerCase() === "approved").length;
  const docPending = documents.filter((d) => d.status?.toLowerCase() === "pending").length;
  const clockedIn = tkStatus?.status === "present" || tkStatus?.status === "late";

  const vacationBalance = leaveBalances.find(
    (b) => (b.leave_type ?? b.type ?? "").toLowerCase().includes("vacation"),
  );
  const sickBalance = leaveBalances.find(
    (b) => (b.leave_type ?? b.type ?? "").toLowerCase().includes("sick"),
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.rootRow}>
        {!isMobile && (
          <Sidebar
            role="employee"
            userName={session.name}
            email={session.email}
            activeScreen="Dashboard"
            navigation={navigation}
          />
        )}

        <View style={styles.mainCol}>
          {!isMobile && <Header role="employee" userName={session.name} />}

          <ScrollView contentContainerStyle={[styles.content, isMobile && { paddingBottom: BOTTOM_TAB_HEIGHT + 8 }]} showsVerticalScrollIndicator={false}>
            {/* Hero */}
            <GradientHero style={{ marginBottom: 0 }}>
              <Text style={styles.heroEyebrow}>Staff Portal</Text>
              <Text style={styles.heroTitle}>Welcome back, {firstName}</Text>
              <Text style={styles.heroSub}>
                {profile?.department_name
                  ? `${profile.department_name} · ${profile.account_status ?? "Active"}`
                  : "Your HRIS dashboard — manage your work life in one place."}
              </Text>
            </GradientHero>

            {loading ? (
              <ActivityIndicator style={{ marginTop: 24 }} color={Colors.primary} />
            ) : (
              <>
                {/* Today's Status */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Today's Status</Text>
                  <View style={styles.statusRow}>
                    <View style={[styles.statusDot, { backgroundColor: clockedIn ? "#16A34A" : "#94A3B8" }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.statusLabel}>
                        {tkStatus?.status === "present"
                          ? "Clocked In"
                          : tkStatus?.status === "late"
                          ? "Clocked In (Late)"
                          : tkStatus?.status === "on-leave"
                          ? "On Leave"
                          : "Not Clocked In"}
                      </Text>
                      {tkStatus?.time_in ? (
                        <Text style={styles.statusTime}>
                          In: {formatTime(tkStatus.time_in.timestamp)}
                          {tkStatus.time_out ? `  ·  Out: ${formatTime(tkStatus.time_out.timestamp)}` : ""}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      style={styles.clockBtn}
                      onPress={() => navigation.replace("EmployeeTimekeeping", { session })}
                    >
                      <Ionicons name="time-outline" size={14} color={Colors.primary} />
                      <Text style={styles.clockBtnText}>Timekeeping</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Quick Actions */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Quick Actions</Text>
                  <View style={styles.quickGrid}>
                    <Pressable style={styles.quickAction} onPress={() => navigation.replace("EmployeeTimekeeping", { session })}>
                      <Ionicons name="time-outline" size={20} color={Colors.primary} />
                      <Text style={styles.quickActionLabel}>Clock In / Out</Text>
                      <Text style={styles.quickActionSub}>Timekeeping</Text>
                    </Pressable>
                    <Pressable style={styles.quickAction} onPress={() => navigation.replace("EmployeeLeave", { session })}>
                      <Ionicons name="calendar-outline" size={20} color="#059669" />
                      <Text style={styles.quickActionLabel}>Request Leave</Text>
                      <Text style={styles.quickActionSub}>Leave</Text>
                    </Pressable>
                    <Pressable style={styles.quickAction} onPress={() => navigation.replace("EmployeeOvertime", { session })}>
                      <Ionicons name="timer-outline" size={20} color="#D97706" />
                      <Text style={styles.quickActionLabel}>File Overtime</Text>
                      <Text style={styles.quickActionSub}>Overtime</Text>
                    </Pressable>
                    <Pressable style={styles.quickAction} onPress={() => navigation.replace("EmployeeProfile", { session })}>
                      <Ionicons name="person-outline" size={20} color="#7C3AED" />
                      <Text style={styles.quickActionLabel}>My Profile</Text>
                      <Text style={styles.quickActionSub}>Profile</Text>
                    </Pressable>
                    <Pressable style={styles.quickAction} onPress={() => navigation.replace("EmployeePayslips", { session })}>
                      <Ionicons name="receipt-outline" size={20} color="#DC2626" />
                      <Text style={styles.quickActionLabel}>Payslips</Text>
                      <Text style={styles.quickActionSub}>Compensation</Text>
                    </Pressable>
                    <Pressable style={styles.quickAction} onPress={() => navigation.replace("EmployeeDocuments", { session })}>
                      <Ionicons name="document-text-outline" size={20} color="#0284C7" />
                      <Text style={styles.quickActionLabel}>Documents</Text>
                      <Text style={styles.quickActionSub}>My Files</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Documents Tracker */}
                <View style={styles.card}>
                  <View style={styles.cardHeadRow}>
                    <Text style={styles.cardTitle}>My Documents</Text>
                    <Pressable onPress={() => navigation.replace("EmployeeDocuments", { session })}>
                      <Text style={styles.viewAll}>View All</Text>
                    </Pressable>
                  </View>
                  <View style={styles.metricsRow}>
                    <StatTile label="Approved" value={`${docApproved}`} accent="#16A34A" />
                    <StatTile label="Pending" value={`${docPending}`} accent="#D97706" />
                    <StatTile label="Total" value={`${documents.length}`} accent="#64748B" />
                  </View>
                  {documents.length === 0 && (
                    <Text style={styles.emptyText}>No documents uploaded yet. Go to Documents to upload your files.</Text>
                  )}
                </View>

                {/* Leave Balances */}
                {leaveBalances.length > 0 && (
                  <View style={styles.card}>
                    <View style={styles.cardHeadRow}>
                      <Text style={styles.cardTitle}>Leave Balances</Text>
                      <Pressable onPress={() => navigation.replace("EmployeeLeave", { session })}>
                        <Text style={styles.viewAll}>View All</Text>
                      </Pressable>
                    </View>
                    <View style={styles.metricsRow}>
                      {vacationBalance && (
                        <StatTile
                          label="Vacation"
                          value={`${vacationBalance.remaining ?? (vacationBalance.allocated_days ?? 0) - (vacationBalance.used_days ?? 0)}d`}
                          accent={Colors.primary}
                        />
                      )}
                      {sickBalance && (
                        <StatTile
                          label="Sick"
                          value={`${sickBalance.remaining ?? (sickBalance.allocated_days ?? 0) - (sickBalance.used_days ?? 0)}d`}
                          accent="#059669"
                        />
                      )}
                      <StatTile label="Types" value={`${leaveBalances.length}`} accent="#64748B" />
                    </View>
                  </View>
                )}

                {/* Profile Snapshot */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Profile Snapshot</Text>
                  <ProfileRow label="Full Name" value={session.name} />
                  <ProfileRow label="Email" value={profile?.email ?? session.email ?? "—"} />
                  <ProfileRow label="Employee ID" value={profile?.employee_id ?? "—"} />
                  <ProfileRow label="Department" value={profile?.department_name ?? profile?.department_id ?? "—"} />
                  <ProfileRow label="Status" value={profile?.account_status ?? "Active"} />
                  {profile?.start_date && (
                    <ProfileRow label="Start Date" value={formatDate(profile.start_date)} last />
                  )}
                </View>
              </>
            )}
          </ScrollView>
          {isMobile && (
            <BottomTabBar role="employee" activeScreen="Dashboard" navigation={navigation} session={session} />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

function StatTile({ label, value, accent = "#111827" }: { readonly label: string; readonly value: string; readonly accent?: string }) {
  return (
    <View style={[styles.statTile, { borderTopColor: accent, borderTopWidth: 3 }]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
    </View>
  );
}

function ProfileRow({ label, value, last }: { readonly label: string; readonly value: string; readonly last?: boolean }) {
  return (
    <View style={[styles.profileRow, last && styles.profileRowLast]}>
      <Text style={styles.profileLabel}>{label}</Text>
      <Text style={styles.profileValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  rootRow: { flex: 1, flexDirection: "row" },
  mainCol: { flex: 1 },
  content: { paddingHorizontal: 12, paddingVertical: 12, paddingBottom: 32, gap: 12 },

  // Hero
  heroEyebrow: { color: "rgba(255,255,255,0.78)", fontSize: 10, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  heroTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "800", marginTop: 4 },
  heroSub: { color: "rgba(255,255,255,0.86)", fontSize: 12, lineHeight: 18, marginTop: 6 },

  // Card
  card: {
    borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bgCard, paddingHorizontal: 14, paddingVertical: 14,
  },
  cardTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: "800", marginBottom: 12 },
  cardHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  viewAll: { color: Colors.primary, fontSize: 12, fontWeight: "700" },

  // Today's Status
  statusRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { color: Colors.textPrimary, fontSize: 14, fontWeight: "700" },
  statusTime: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  clockBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderWidth: 1, borderColor: Colors.primaryBorder ?? "#BFDBFE",
    backgroundColor: Colors.primaryLight ?? "#EFF6FF",
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7,
  },
  clockBtnText: { color: Colors.primary, fontSize: 12, fontWeight: "700" },

  // Quick Actions grid
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickAction: {
    width: "30.5%",
    backgroundColor: "#F8FAFF",
    borderWidth: 1, borderColor: Colors.primaryBorder ?? "#BFDBFE",
    borderRadius: 14, paddingHorizontal: 10, paddingVertical: 12, alignItems: "center", gap: 4,
  },
  quickActionLabel: { color: Colors.textPrimary, fontSize: 11, fontWeight: "800", textAlign: "center" },
  quickActionSub: { color: Colors.textMuted, fontSize: 10, fontWeight: "600", textAlign: "center" },

  // Metrics row
  metricsRow: { flexDirection: "row", gap: 8 },
  statTile: {
    flex: 1, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bgCard, paddingHorizontal: 10, paddingVertical: 10,
  },
  statLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.7 },
  statValue: { color: Colors.textPrimary, fontSize: 20, fontWeight: "800", marginTop: 3 },

  // Profile rows
  profileRow: {
    paddingTop: 9, paddingBottom: 9,
    borderBottomWidth: 1, borderBottomColor: Colors.bgSubtle ?? "#F1F5F9",
  },
  profileRowLast: { borderBottomWidth: 0 },
  profileLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 0.7, textTransform: "uppercase" },
  profileValue: { color: Colors.textPrimary, fontSize: 14, fontWeight: "700", marginTop: 2 },

  emptyText: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
});
