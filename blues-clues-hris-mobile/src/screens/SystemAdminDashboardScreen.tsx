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

const SUMMARY_CARDS = [
  {
    id: "1",
    label: "Total Users",
    value: "1,284",
    helper: "Across all departments",
  },
  {
    id: "2",
    label: "Active HR Modules",
    value: "4",
    helper: "Recruitment to performance",
  },
  {
    id: "3",
    label: "Pending Activations",
    value: "18",
    helper: "Awaiting invite acceptance",
  },
  {
    id: "4",
    label: "Locked Accounts",
    value: "6",
    helper: "Restricted by admin",
  },
];

const RECENT_ACTIVITY = [
  {
    id: "1",
    title: "New HR Officer account created",
    subtitle: "Recruitment and Onboarding access assigned",
    time: "10 mins ago",
  },
  {
    id: "2",
    title: "Invite link resent",
    subtitle: "User activation email was sent again",
    time: "32 mins ago",
  },
  {
    id: "3",
    title: "Billing plan updated",
    subtitle: "Subscription seats were adjusted",
    time: "1 hour ago",
  },
  {
    id: "4",
    title: "User account locked",
    subtitle: "Temporary restriction applied by system admin",
    time: "3 hours ago",
  },
];

export function SystemAdminDashboardScreen() {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.layout}>
        {!isMobile && (
          <Sidebar
            role="system_admin"
            userName="Rick Grimes"
            activeScreen="Dashboard"
            navigation={navigation}
          />
        )}

        <View style={styles.mainContent}>
          {isMobile && (
            <MobileRoleMenu
              role="system_admin"
              userName="Rick Grimes"
              activeScreen="Dashboard"
              navigation={navigation}
            />
          )}

          <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.heroCard}>
              <Text style={styles.eyebrow}>System Admin</Text>
              <Text style={styles.title}>Admin Dashboard</Text>
              <Text style={styles.subtitle}>
                Manage user access, HR lifecycle permissions, invite links, and
                subscription operations from one place.
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

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Recent Admin Activity</Text>

              {RECENT_ACTIVITY.map((item, index) => (
                <View
                  key={item.id}
                  style={[
                    styles.activityRow,
                    index !== RECENT_ACTIVITY.length - 1 && styles.activityDivider,
                  ]}
                >
                  <View style={styles.activityDot} />
                  <View style={styles.activityTextWrap}>
                    <Text style={styles.activityTitle}>{item.title}</Text>
                    <Text style={styles.activitySubtitle}>{item.subtitle}</Text>
                  </View>
                  <Text style={styles.activityTime}>{item.time}</Text>
                </View>
              ))}
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>

              <View style={styles.quickActionsRow}>
                <View style={styles.quickActionCard}>
                  <Text style={styles.quickActionTitle}>Users</Text>
                  <Text style={styles.quickActionText}>
                    Create accounts, assign roles, and review pending users.
                  </Text>
                </View>

                <View style={styles.quickActionCard}>
                  <Text style={styles.quickActionTitle}>Billing</Text>
                  <Text style={styles.quickActionText}>
                    Review plan details, seat usage, and subscription status.
                  </Text>
                </View>
              </View>
            </View>
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
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 16,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
  },
  activityDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },
  activityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#2563EB",
    marginTop: 6,
    marginRight: 12,
  },
  activityTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 4,
  },
  activitySubtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: "#64748B",
  },
  activityTime: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94A3B8",
    marginTop: 1,
  },
  quickActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  quickActionCard: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    padding: 16,
    minWidth: 220,
    flexGrow: 1,
    marginRight: 12,
    marginBottom: 12,
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#64748B",
  },
});