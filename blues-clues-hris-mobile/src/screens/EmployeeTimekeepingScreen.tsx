import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  useWindowDimensions,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Sidebar } from "../components/Sidebar";
import { MobileRoleMenu } from "../components/MobileRoleMenu";
import { authFetch } from "../services/auth";
import { API_BASE_URL } from "../lib/api";

// Parse Supabase timestamps (no Z suffix) as UTC
function parseTs(ts: string): Date {
  return new Date(ts.includes("Z") || ts.includes("+") ? ts : ts + "Z");
}

function formatTime(ts: string | null): string {
  if (!ts) return "—";
  return parseTs(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });
}

function formatHours(timeIn: string | null, timeOut: string | null): string {
  if (!timeIn || !timeOut) return "—";
  const diff =
    (parseTs(timeOut).getTime() - parseTs(timeIn).getTime()) / 3_600_000;
  const h = Math.floor(diff);
  const m = Math.round((diff - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function deriveStatus(timeIn: string | null): "Present" | "Late" | "Absent" {
  if (!timeIn) return "Absent";
  const hour = parseInt(
    parseTs(timeIn).toLocaleString("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Manila",
    }),
    10
  );
  return hour >= 9 ? "Late" : "Present";
}

function todayPHT(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

function formatDateStr(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type PunchRow = {
  log_id: string;
  employee_id: string;
  log_type: "time-in" | "time-out";
  timestamp: string;
  latitude: number | null;
  longitude: number | null;
};

type DayRecord = {
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  status: "Present" | "Late" | "Absent";
};

export function EmployeeTimekeepingScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const session = route.params?.session ?? {
    name: "Employee",
    email: "",
    role: "employee",
  };
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayIn, setTodayIn] = useState<string | null>(null);
  const [todayOut, setTodayOut] = useState<string | null>(null);
  const [history, setHistory] = useState<DayRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const today = todayPHT();
      const startDate = (() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
      })();

      const res = await authFetch(
        `${API_BASE_URL}/timekeeping/my-timesheet?start=${startDate}&end=${today}`
      );
      if (!res.ok) throw new Error("Failed to load timesheet");
      const punches: PunchRow[] = await res.json();

      // Group punches by local date (PHT)
      const byDate: Record<
        string,
        { timeIn: string | null; timeOut: string | null }
      > = {};
      for (const p of punches) {
        const d = parseTs(p.timestamp).toLocaleDateString("en-CA", {
          timeZone: "Asia/Manila",
        });
        if (!byDate[d]) byDate[d] = { timeIn: null, timeOut: null };
        if (p.log_type === "time-in" && !byDate[d].timeIn)
          byDate[d].timeIn = p.timestamp;
        if (p.log_type === "time-out") byDate[d].timeOut = p.timestamp;
      }

      // Today's punch state
      const t = byDate[today] ?? { timeIn: null, timeOut: null };
      setTodayIn(t.timeIn);
      setTodayOut(t.timeOut);

      // Build sorted history
      const records: DayRecord[] = Object.entries(byDate)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, { timeIn, timeOut }]) => ({
          date,
          timeIn,
          timeOut,
          status: deriveStatus(timeIn),
        }));
      setHistory(records);
    } catch {
      Alert.alert("Error", "Failed to load timekeeping data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handlePunch(type: "time-in" | "time-out") {
    setPunching(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/timekeeping/${type}`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.message || "Failed to punch");
      }

      Alert.alert(
        "Success",
        type === "time-in"
          ? "Clocked in successfully!"
          : "Clocked out successfully!"
      );
      await loadData();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Something went wrong.");
    } finally {
      setPunching(false);
    }
  }

  const clockStr = currentTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Manila",
  });
  const dateStr = currentTime.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  });

  const canClockIn = !todayIn;
  const canClockOut = !!todayIn && !todayOut;

  const getStatusStyle = (status: "Present" | "Late" | "Absent") => {
    if (status === "Present")
      return { bg: "#DCFCE7", border: "#BBF7D0", text: "#166534" };
    if (status === "Late")
      return { bg: "#FEF3C7", border: "#FDE68A", text: "#92400E" };
    return { bg: "#E5E7EB", border: "#D1D5DB", text: "#374151" };
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.layout}>
        {!isMobile && (
          <Sidebar
            role="employee"
            userName={session.name}
            email={session.email}
            activeScreen="Timekeeping"
            navigation={navigation}
          />
        )}

        <View style={styles.mainContent}>
          {isMobile && (
            <MobileRoleMenu
              role="employee"
              userName={session.name}
              email={session.email}
              activeScreen="Timekeeping"
              navigation={navigation}
            />
          )}

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Hero Clock */}
            <View style={styles.heroCard}>
              <Text style={styles.eyebrow}>Employee Portal</Text>
              <Text style={styles.heroTime}>{clockStr}</Text>
              <Text style={styles.heroDate}>{dateStr}</Text>
            </View>

            {/* Today's Status */}
            <View style={styles.statusRow}>
              <View style={styles.statusBox}>
                <Text style={styles.statusLabel}>Time In</Text>
                <Text style={styles.statusValue}>{formatTime(todayIn)}</Text>
              </View>
              <View style={styles.statusBox}>
                <Text style={styles.statusLabel}>Time Out</Text>
                <Text style={styles.statusValue}>{formatTime(todayOut)}</Text>
              </View>
              <View style={styles.statusBox}>
                <Text style={styles.statusLabel}>Hours Worked</Text>
                <Text style={styles.statusValue}>
                  {formatHours(todayIn, todayOut)}
                </Text>
              </View>
            </View>

            {/* Clock Buttons */}
            <View style={styles.buttonRow}>
              <Pressable
                style={[
                  styles.punchBtn,
                  styles.clockInBtn,
                  (!canClockIn || punching) && styles.btnDisabled,
                ]}
                onPress={() => handlePunch("time-in")}
                disabled={!canClockIn || punching}
              >
                {punching && canClockIn ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.punchBtnText}>Clock In</Text>
                )}
              </Pressable>

              <Pressable
                style={[
                  styles.punchBtn,
                  styles.clockOutBtn,
                  (!canClockOut || punching) && styles.btnDisabled,
                ]}
                onPress={() => handlePunch("time-out")}
                disabled={!canClockOut || punching}
              >
                {punching && canClockOut ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.punchBtnText}>Clock Out</Text>
                )}
              </Pressable>
            </View>

            {/* History */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Attendance History</Text>
              <Text style={styles.sectionSubtitle}>Last 30 days</Text>
            </View>

            {loading ? (
              <ActivityIndicator
                size="large"
                color="#1F3F95"
                style={{ marginTop: 24 }}
              />
            ) : history.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No records found</Text>
                <Text style={styles.emptyText}>
                  Your attendance history will appear here.
                </Text>
              </View>
            ) : (
              history.map((rec) => {
                const s = getStatusStyle(rec.status);
                return (
                  <View key={rec.date} style={styles.historyCard}>
                    <View style={styles.historyTop}>
                      <Text style={styles.historyDate}>
                        {formatDateStr(rec.date)}
                      </Text>
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: s.bg, borderColor: s.border },
                        ]}
                      >
                        <Text style={[styles.badgeText, { color: s.text }]}>
                          {rec.status}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.historyInfoRow}>
                      <View style={styles.infoBox}>
                        <Text style={styles.infoLabel}>Time In</Text>
                        <Text style={styles.infoValue}>
                          {formatTime(rec.timeIn)}
                        </Text>
                      </View>
                      <View style={styles.infoBox}>
                        <Text style={styles.infoLabel}>Time Out</Text>
                        <Text style={styles.infoValue}>
                          {formatTime(rec.timeOut)}
                        </Text>
                      </View>
                      <View style={styles.infoBox}>
                        <Text style={styles.infoLabel}>Hours</Text>
                        <Text style={styles.infoValue}>
                          {formatHours(rec.timeIn, rec.timeOut)}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  layout: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
  },
  mainContent: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  heroCard: {
    backgroundColor: "#0F2D7A",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    alignItems: "center",
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    color: "rgba(255,255,255,0.75)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  heroTime: {
    fontSize: 42,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 1,
    marginBottom: 6,
  },
  heroDate: {
    fontSize: 14,
    color: "rgba(255,255,255,0.78)",
    fontWeight: "600",
  },
  statusRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  statusBox: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    padding: 14,
    marginRight: 10,
    alignItems: "center",
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 6,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  buttonRow: {
    flexDirection: "row",
    marginBottom: 24,
  },
  punchBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  clockInBtn: {
    backgroundColor: "#16A34A",
  },
  clockOutBtn: {
    backgroundColor: "#DC2626",
    marginRight: 0,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  punchBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  sectionHeader: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    padding: 28,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
  },
  historyCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  historyTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  historyDate: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  historyInfoRow: {
    flexDirection: "row",
  },
  infoBox: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginRight: 8,
  },
  infoLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "700",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "800",
  },
});
