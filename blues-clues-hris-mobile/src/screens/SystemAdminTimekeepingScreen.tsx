import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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

type UserRow = {
  user_id: string;
  employee_id?: string;
  first_name: string;
  last_name: string;
  department_name?: string | null;
};

type PunchRow = {
  log_id: string;
  employee_id: string;
  log_type: "time-in" | "time-out" | "absence";
  timestamp: string;
  location_name?: string | null;
  is_mock_location?: string;
  log_status?: string;
};

type Department = { department_id: string; department_name: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
}

function todayIso() { return new Date().toISOString().slice(0, 10); }

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function SystemAdminTimekeepingScreen({ route, navigation }: any) {
  const session: UserSession = route.params?.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<UserRow[]>([]);
  const [punches, setPunches] = useState<PunchRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState(todayIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [activeTab, setActiveTab] = useState<"roster" | "logs">("roster");

  useEffect(() => {
    authFetch(`${API_BASE_URL}/users/departments`).then(r => r.json()).then((d: Department[]) => { if (Array.isArray(d)) setDepartments(d); }).catch(() => {});
    load();
  }, []);

  function load() {
    setLoading(true);
    Promise.all([
      authFetch(`${API_BASE_URL}/timekeeping/employees?asOf=${dateFrom}`).then(r => r.json()).catch(() => []),
      authFetch(`${API_BASE_URL}/timekeeping/timesheets?from=${dateFrom}&to=${dateTo}`).then(r => r.json()).catch(() => []),
    ]).then(([emps, punchData]) => {
      setEmployees(Array.isArray(emps) ? emps : []);
      setPunches(Array.isArray(punchData) ? punchData : []);
    }).finally(() => setLoading(false));
  }

  const filteredEmployees = employees.filter(e => {
    const name = `${e.first_name} ${e.last_name}`.toLowerCase();
    const matchSearch = search.trim() === "" || name.includes(search.toLowerCase());
    const matchDept = deptFilter === "all" || e.department_name === deptFilter;
    return matchSearch && matchDept;
  });

  const filteredPunches = punches.filter(p => {
    if (search.trim() === "") return true;
    return p.employee_id.toLowerCase().includes(search.toLowerCase());
  });

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}><ActivityIndicator size="large" color="#1E40AF" /><Text style={s.loadingText}>Loading timekeeping data...</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.inner}>
        {!isMobile && (
          <Sidebar role="system_admin" userName={session?.name ?? ""} email={session?.email ?? ""} activeScreen="Timekeeping" navigation={navigation} />
        )}

        <View style={s.main}>
          <ScrollView
            style={s.scroll}
            contentContainerStyle={[s.scrollContent, isMobile && { paddingBottom: BOTTOM_TAB_HEIGHT + 8 }]}
            showsVerticalScrollIndicator={false}
          >
            <GradientHero>
              <Text style={s.heroEyebrow}>System Admin</Text>
              <Text style={s.heroTitle}>Timekeeping</Text>
              <Text style={s.heroSub}>Monitor company-wide attendance, schedules, and punch records.</Text>
              <View style={s.heroStats}>
                <View style={s.heroStat}><Text style={s.heroStatLabel}>EMPLOYEES</Text><Text style={s.heroStatValue}>{employees.length}</Text></View>
                <View style={s.heroStat}><Text style={s.heroStatLabel}>PUNCH LOGS</Text><Text style={s.heroStatValue}>{punches.length}</Text></View>
              </View>
            </GradientHero>

            {/* Date Range + Reload */}
            <View style={s.dateRow}>
              <View style={s.dateBox}>
                <Text style={s.dateLabel}>From</Text>
                <TextInput style={s.dateInput} value={dateFrom} onChangeText={setDateFrom} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" />
              </View>
              <View style={s.dateBox}>
                <Text style={s.dateLabel}>To</Text>
                <TextInput style={s.dateInput} value={dateTo} onChangeText={setDateTo} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" />
              </View>
              <Pressable style={s.loadBtn} onPress={load}>
                <Ionicons name="refresh-outline" size={16} color="#FFFFFF" />
              </Pressable>
            </View>

            {/* Search */}
            <View style={s.searchRow}>
              <Ionicons name="search-outline" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput style={s.searchInput} value={search} onChangeText={setSearch} placeholder="Search employee..." placeholderTextColor="#94A3B8" />
            </View>

            {/* Department Filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.deptRow}>
              <Pressable style={[s.deptChip, deptFilter === "all" && s.deptChipActive]} onPress={() => setDeptFilter("all")}>
                <Text style={[s.deptText, deptFilter === "all" && s.deptTextActive]}>All</Text>
              </Pressable>
              {departments.map(d => (
                <Pressable key={d.department_id} style={[s.deptChip, deptFilter === d.department_name && s.deptChipActive]} onPress={() => setDeptFilter(d.department_name)}>
                  <Text style={[s.deptText, deptFilter === d.department_name && s.deptTextActive]}>{d.department_name}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Tabs */}
            <View style={s.tabRow}>
              {(["roster", "logs"] as const).map(tab => (
                <Pressable key={tab} style={[s.tab, activeTab === tab && s.activeTab]} onPress={() => setActiveTab(tab)}>
                  <Text style={[s.tabText, activeTab === tab && s.activeTabText]}>
                    {tab === "roster" ? "Employee Roster" : "Punch Logs"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* ── Roster ───────────────────────────────────────────────────── */}
            {activeTab === "roster" && (
              filteredEmployees.length === 0 ? (
                <View style={s.emptyBox}><Text style={s.emptyText}>No employees found.</Text></View>
              ) : (
                filteredEmployees.map(emp => (
                  <View key={emp.user_id} style={s.empCard}>
                    <View style={s.empAvatar}><Text style={s.empAvatarText}>{emp.first_name.charAt(0)}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.empName}>{emp.first_name} {emp.last_name}</Text>
                      <Text style={s.empDept}>{emp.department_name ?? "—"}</Text>
                      {!!emp.employee_id && <Text style={s.empId}>ID: {emp.employee_id}</Text>}
                    </View>
                  </View>
                ))
              )
            )}

            {/* ── Punch Logs ───────────────────────────────────────────────── */}
            {activeTab === "logs" && (
              filteredPunches.length === 0 ? (
                <View style={s.emptyBox}><Text style={s.emptyText}>No punch logs found for this date range.</Text></View>
              ) : (
                filteredPunches.map(p => {
                  const isIn = p.log_type === "time-in";
                  const isAbsence = p.log_type === "absence";
                  return (
                    <View key={p.log_id} style={s.punchCard}>
                      <View style={s.punchTop}>
                        <View style={[s.punchBadge, isAbsence ? s.punchBadgeAbsence : isIn ? s.punchBadgeIn : s.punchBadgeOut]}>
                          <Text style={s.punchBadgeText}>{isAbsence ? "Absence" : isIn ? "In" : "Out"}</Text>
                        </View>
                        <Text style={s.punchTime}>{formatTime(p.timestamp)}</Text>
                        <Text style={s.punchDate}>{formatDate(p.timestamp)}</Text>
                      </View>
                      <Text style={s.punchEmpId}>Employee: {p.employee_id}</Text>
                      {!!p.location_name && <Text style={s.punchLocation}>{p.location_name}</Text>}
                      {p.is_mock_location === "true" && (
                        <Text style={s.mockWarning}>⚠ Mock location detected</Text>
                      )}
                    </View>
                  );
                })
              )
            )}
          </ScrollView>

          {isMobile && (
            <BottomTabBar role="system_admin" activeScreen="Timekeeping" navigation={navigation} session={session} />
          )}
        </View>
      </View>
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

  dateRow: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  dateBox: { flex: 1, gap: 4 },
  dateLabel: { fontSize: 10, color: "#94A3B8", fontWeight: "700", textTransform: "uppercase" },
  dateInput: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, color: "#0F172A", backgroundColor: "#FFFFFF" },
  loadBtn: { backgroundColor: "#1E40AF", borderRadius: 8, padding: 10, alignItems: "center", justifyContent: "center" },

  searchRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 10, borderWidth: 1, borderColor: "#E2E8F0", paddingHorizontal: 12, paddingVertical: 9 },
  searchInput: { flex: 1, fontSize: 14, color: "#0F172A" },

  deptRow: { flexDirection: "row" },
  deptChip: { paddingHorizontal: 14, paddingVertical: 7, marginRight: 8, borderRadius: 20, backgroundColor: "#F1F5F9" },
  deptChipActive: { backgroundColor: "#1E40AF" },
  deptText: { fontSize: 12, color: "#64748B", fontWeight: "600" },
  deptTextActive: { color: "#FFFFFF" },

  tabRow: { flexDirection: "row", backgroundColor: "#F1F5F9", borderRadius: 12, padding: 4, gap: 4 },
  tab: { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: 8 },
  activeTab: { backgroundColor: "#FFFFFF" },
  tabText: { fontSize: 13, color: "#64748B", fontWeight: "600" },
  activeTabText: { color: "#0F172A" },

  emptyBox: { backgroundColor: "#F1F5F9", borderRadius: 12, padding: 24, alignItems: "center" },
  emptyText: { fontSize: 13, color: "#64748B" },

  empCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#E2E8F0", gap: 12 },
  empAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#1E3A8A", alignItems: "center", justifyContent: "center" },
  empAvatarText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  empName: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  empDept: { fontSize: 12, color: "#64748B" },
  empId: { fontSize: 11, color: "#94A3B8", marginTop: 1 },

  punchCard: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#E2E8F0", gap: 4 },
  punchTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  punchBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  punchBadgeIn: { backgroundColor: "#F0FDF4" },
  punchBadgeOut: { backgroundColor: "#FEF2F2" },
  punchBadgeAbsence: { backgroundColor: "#FFFBEB" },
  punchBadgeText: { fontSize: 10, fontWeight: "700", color: "#374151" },
  punchTime: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  punchDate: { fontSize: 12, color: "#94A3B8", marginLeft: "auto" },
  punchEmpId: { fontSize: 12, color: "#64748B" },
  punchLocation: { fontSize: 12, color: "#64748B" },
  mockWarning: { fontSize: 11, color: "#B45309", fontWeight: "600" },
});
