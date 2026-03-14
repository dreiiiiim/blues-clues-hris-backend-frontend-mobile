import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  useWindowDimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Sidebar } from "../components/Sidebar";
import { MobileRoleMenu } from "../components/MobileRoleMenu";
import { TimekeepingTable, TimekeepingLog } from "../components/TimekeepingTable";

const MOCK_TIMEKEEPING_LOGS: TimekeepingLog[] = [
  {
    id: "1",
    employeeName: "Sarah Fernandez",
    date: "Mar 13, 2026",
    timeIn: "8:01 AM",
    timeOut: "5:08 PM",
    totalHours: "8h 07m",
    status: "Present",
  },
  {
    id: "2",
    employeeName: "Michael Torres",
    date: "Mar 13, 2026",
    timeIn: "8:17 AM",
    timeOut: "5:00 PM",
    totalHours: "7h 43m",
    status: "Late",
  },
  {
    id: "3",
    employeeName: "Angela Reyes",
    date: "Mar 13, 2026",
    timeIn: "7:56 AM",
    timeOut: "4:31 PM",
    totalHours: "7h 35m",
    status: "Undertime",
  },
  {
    id: "4",
    employeeName: "Daniel Cruz",
    date: "Mar 13, 2026",
    timeIn: "--",
    timeOut: "--",
    totalHours: "0h 00m",
    status: "Absent",
  },
  {
    id: "5",
    employeeName: "Patricia Santos",
    date: "Mar 13, 2026",
    timeIn: "--",
    timeOut: "--",
    totalHours: "0h 00m",
    status: "On Leave",
  },
  {
    id: "6",
    employeeName: "Joseph Navarro",
    date: "Mar 12, 2026",
    timeIn: "8:05 AM",
    timeOut: "5:15 PM",
    totalHours: "8h 10m",
    status: "Present",
  },
  {
    id: "7",
    employeeName: "Camille Garcia",
    date: "Mar 12, 2026",
    timeIn: "8:22 AM",
    timeOut: "5:02 PM",
    totalHours: "7h 40m",
    status: "Late",
  },
  {
    id: "8",
    employeeName: "Rafael Mendoza",
    date: "Mar 12, 2026",
    timeIn: "7:58 AM",
    timeOut: "4:44 PM",
    totalHours: "7h 46m",
    status: "Present",
  },
  {
    id: "9",
    employeeName: "Nina Lopez",
    date: "Mar 11, 2026",
    timeIn: "8:09 AM",
    timeOut: "5:01 PM",
    totalHours: "7h 52m",
    status: "Late",
  },
  {
    id: "10",
    employeeName: "Carlo Bautista",
    date: "Mar 11, 2026",
    timeIn: "8:00 AM",
    timeOut: "5:12 PM",
    totalHours: "8h 12m",
    status: "Present",
  },
  {
    id: "11",
    employeeName: "Jasmine Villanueva",
    date: "Mar 11, 2026",
    timeIn: "8:03 AM",
    timeOut: "4:26 PM",
    totalHours: "7h 23m",
    status: "Undertime",
  },
  {
    id: "12",
    employeeName: "Leo Ramirez",
    date: "Mar 10, 2026",
    timeIn: "7:54 AM",
    timeOut: "5:06 PM",
    totalHours: "8h 12m",
    status: "Present",
  },
];

const SUMMARY_CARDS = [
  { id: "1", label: "Group Heads", value: "12", helper: "Under department" },
  { id: "2", label: "Present Today", value: "6", helper: "Complete logs" },
  { id: "3", label: "Late / Issues", value: "4", helper: "Needs attention" },
  { id: "4", label: "Pending Review", value: "3", helper: "For checking" },
];

export function ManagerDashboardScreen() {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.layout}>
        {!isMobile && (
          <Sidebar
            role="manager"
            userName="Rick Grimes"
            activeScreen="Timekeeping"
            navigation={navigation}
          />
        )}

        <View style={styles.mainContent}>
          {isMobile && (
            <MobileRoleMenu
              role="manager"
              userName="Rick Grimes"
              activeScreen="Timekeeping"
              navigation={navigation}
            />
          )}

          <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.heroCard}>
              <Text style={styles.eyebrow}>Manager Portal</Text>
              <Text style={styles.title}>Timekeeping Logs</Text>
              <Text style={styles.subtitle}>
                Review daily attendance records of all group heads under your
                department, including time in, time out, total hours, and
                status.
              </Text>
            </View>

            <View style={styles.summaryRow}>
              {SUMMARY_CARDS.map((card) => (
                <View key={card.id} style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>{card.label}</Text>
                  <Text style={styles.summaryValue}>{card.value}</Text>
                  <Text style={styles.summaryHelper}>{card.helper}</Text>
                </View>
              ))}
            </View>

            <TimekeepingTable
              logs={MOCK_TIMEKEEPING_LOGS}
              title="Manager Timekeeping Logs"
              subtitle="Track and filter group head attendance records."
            />
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
  container: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    color: "#2563EB",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: "#64748B",
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    padding: 16,
    minWidth: 160,
    flexGrow: 1,
    marginRight: 12,
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 6,
  },
  summaryHelper: {
    fontSize: 12,
    lineHeight: 18,
    color: "#94A3B8",
    fontWeight: "600",
  },
});