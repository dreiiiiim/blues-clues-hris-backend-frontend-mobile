import React, { useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CommonActions } from "@react-navigation/native";
import { clearSession, type UserRole } from "../services/auth";

type TabItem = {
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  screen: string | null;
};

type MoreItem = {
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  screen: string;
};

const MAIN_TABS: Partial<Record<UserRole, TabItem[]>> = {
  employee: [
    { name: "Dashboard", label: "Home", icon: "home-outline", activeIcon: "home", screen: "EmployeeDashboard" },
    { name: "Leave", label: "Leave", icon: "calendar-outline", activeIcon: "calendar", screen: "EmployeeLeave" },
    { name: "Timekeeping", label: "Time", icon: "time-outline", activeIcon: "time", screen: "EmployeeTimekeeping" },
    { name: "Payslips", label: "Payslips", icon: "receipt-outline", activeIcon: "receipt", screen: "EmployeePayslips" },
    { name: "More", label: "More", icon: "grid-outline", activeIcon: "grid", screen: null },
  ],
  hr: [
    { name: "Dashboard", label: "Home", icon: "home-outline", activeIcon: "home", screen: "HROfficerDashboard" },
    { name: "Jobs", label: "Jobs", icon: "briefcase-outline", activeIcon: "briefcase", screen: "HROfficerJobs" },
    { name: "Approvals", label: "Approvals", icon: "checkmark-done-outline", activeIcon: "checkmark-done", screen: "HROfficerApprovals" },
    { name: "Onboarding", label: "Onboard", icon: "clipboard-outline", activeIcon: "clipboard", screen: "HROfficerOnboarding" },
    { name: "More", label: "More", icon: "grid-outline", activeIcon: "grid", screen: null },
  ],
  manager: [
    { name: "Dashboard", label: "Home", icon: "home-outline", activeIcon: "home", screen: "ManagerDashboard" },
    { name: "Team", label: "Team", icon: "people-outline", activeIcon: "people", screen: "ManagerTeam" },
    { name: "Timekeeping", label: "Time", icon: "time-outline", activeIcon: "time", screen: "ManagerTimekeeping" },
    { name: "Approvals", label: "Approvals", icon: "checkmark-done-outline", activeIcon: "checkmark-done", screen: "ManagerApprovals" },
    { name: "More", label: "More", icon: "grid-outline", activeIcon: "grid", screen: null },
  ],
  applicant: [
    { name: "Dashboard", label: "Home", icon: "home-outline", activeIcon: "home", screen: "ApplicantDashboard" },
    { name: "Jobs", label: "Jobs", icon: "briefcase-outline", activeIcon: "briefcase", screen: "ApplicantJobs" },
    { name: "Applications", label: "Applied", icon: "document-text-outline", activeIcon: "document-text", screen: "ApplicantApplications" },
    { name: "Profile", label: "Profile", icon: "person-outline", activeIcon: "person", screen: "ApplicantProfile" },
    { name: "Onboarding", label: "Onboard", icon: "clipboard-outline", activeIcon: "clipboard", screen: "ApplicantOnboarding" },
  ],
  system_admin: [
    { name: "Dashboard", label: "Home", icon: "home-outline", activeIcon: "home", screen: "SystemAdminDashboard" },
    { name: "Users", label: "Users", icon: "people-outline", activeIcon: "people", screen: "SystemAdminUsers" },
    { name: "AuditLogs", label: "Audit", icon: "shield-checkmark-outline", activeIcon: "shield-checkmark", screen: "SystemAdminAuditLogs" },
    { name: "Approvals", label: "Approvals", icon: "checkmark-done-outline", activeIcon: "checkmark-done", screen: "SystemAdminApprovals" },
    { name: "More", label: "More", icon: "grid-outline", activeIcon: "grid", screen: null },
  ],
  admin: [
    { name: "Dashboard", label: "Home", icon: "home-outline", activeIcon: "home", screen: "SystemAdminDashboard" },
    { name: "Users", label: "Users", icon: "people-outline", activeIcon: "people", screen: "SystemAdminUsers" },
    { name: "AuditLogs", label: "Audit", icon: "shield-checkmark-outline", activeIcon: "shield-checkmark", screen: "SystemAdminAuditLogs" },
    { name: "More", label: "More", icon: "grid-outline", activeIcon: "grid", screen: null },
  ],
};

const MORE_ITEMS: Partial<Record<UserRole, MoreItem[]>> = {
  employee: [
    { name: "Overtime", label: "Overtime", icon: "timer-outline", screen: "EmployeeOvertime" },
    { name: "Performance", label: "Performance", icon: "bar-chart-outline", screen: "EmployeePerformance" },
    { name: "Documents", label: "Documents", icon: "document-text-outline", screen: "EmployeeDocuments" },
    { name: "Profile", label: "Profile", icon: "person-outline", screen: "EmployeeProfile" },
    { name: "Onboarding", label: "Onboarding", icon: "clipboard-outline", screen: "EmployeeOnboarding" },
    { name: "Offboarding", label: "Offboarding", icon: "log-out-outline", screen: "EmployeeOffboarding" },
  ],
  hr: [
    { name: "Timekeeping", label: "Timekeeping", icon: "time-outline", screen: "HROfficerTimekeeping" },
    { name: "Candidates", label: "Candidates", icon: "people-outline", screen: "HROfficerCandidates" },
    { name: "Offboarding", label: "Offboarding", icon: "log-out-outline", screen: "HROfficerOffboarding" },
    { name: "Performance", label: "Performance", icon: "bar-chart-outline", screen: "HROfficerPerformance" },
    { name: "Payroll", label: "Payroll", icon: "cash-outline", screen: "HROfficerPayroll" },
    { name: "Payslips", label: "Payslips", icon: "receipt-outline", screen: "HROfficerPayslips" },
  ],
  manager: [
    { name: "Performance", label: "Performance", icon: "bar-chart-outline", screen: "ManagerPerformance" },
    { name: "Payslips", label: "Payslips", icon: "receipt-outline", screen: "ManagerPayslips" },
    { name: "Offboarding", label: "Offboarding", icon: "log-out-outline", screen: "ManagerOffboarding" },
  ],
  system_admin: [
    { name: "Timekeeping", label: "Timekeeping", icon: "time-outline", screen: "SystemAdminTimekeeping" },
    { name: "Onboarding", label: "Onboarding", icon: "clipboard-outline", screen: "SystemAdminOnboarding" },
    { name: "Offboarding", label: "Offboarding", icon: "log-out-outline", screen: "SystemAdminOffboarding" },
    { name: "Compensation", label: "Compensation", icon: "cash-outline", screen: "SystemAdminCompensationSettings" },
    { name: "Subscriptions", label: "Subscriptions", icon: "card-outline", screen: "SystemAdminBilling" },
    { name: "Perf Settings", label: "Perf Settings", icon: "bar-chart-outline", screen: "SystemAdminPerformanceSettings" },
    { name: "Settings", label: "Settings", icon: "settings-outline", screen: "SystemAdminSettings" },
  ],
  admin: [
    { name: "Subscriptions", label: "Subscriptions", icon: "card-outline", screen: "SystemAdminBilling" },
  ],
};

type Props = {
  role: UserRole;
  activeScreen: string;
  navigation: any;
  session: {
    name: string;
    role: string;
    email: string;
    activePortal?: string;
    availablePortals?: string[];
    roleSwitchOptions?: Array<{ role_id: string; role_name: string; portal_key: string }>;
  };
};

export function BottomTabBar({ role, activeScreen, navigation, session }: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(300)).current;

  const tabs = MAIN_TABS[role] ?? [];
  const moreItems = MORE_ITEMS[role] ?? [];

  function openMore() {
    slideAnim.setValue(300);
    setMoreOpen(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }

  function closeMore(callback?: () => void) {
    Animated.timing(slideAnim, {
      toValue: 300,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setMoreOpen(false);
      callback?.();
    });
  }

  function goTo(screen: string) {
    closeMore(() => {
      navigation.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: screen, params: { session } }] })
      );
    });
  }

  function openPortalSelect() {
    closeMore(() => {
      navigation.navigate("PortalSelect", {
        session,
        availablePortals: session.availablePortals,
        roleSwitchOptions: session.roleSwitchOptions,
      });
    });
  }

  function handleTabPress(tab: TabItem) {
    if (!tab.screen) {
      openMore();
      return;
    }
    if (tab.name === activeScreen) return;
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: tab.screen, params: { session } }] })
    );
  }

  async function confirmLogout() {
    await clearSession();
    setLogoutOpen(false);
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  }

  // Determine if active tab is in "More" items
  const isMoreActive = moreItems.some((item) => item.name === activeScreen);

  return (
    <>
      {/* ── Bottom Tab Bar ──────────────────────────────────────── */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const isActive =
            tab.screen === null
              ? isMoreActive
              : tab.name === activeScreen || tab.screen === activeScreen || activeScreen.startsWith(tab.name);
          return (
            <Pressable
              key={tab.name}
              style={styles.tabItem}
              onPress={() => handleTabPress(tab)}
              android_ripple={{ color: "rgba(37,99,235,0.10)", borderless: true }}
            >
              <View style={[styles.tabIconWrap, isActive && styles.tabIconWrapActive]}>
                <Ionicons
                  name={isActive ? tab.activeIcon : tab.icon}
                  size={22}
                  color={isActive ? "#FFFFFF" : "#94A3B8"}
                />
              </View>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── More Slide-Up Modal ──────────────────────────────────── */}
      <Modal visible={moreOpen} transparent animationType="none" statusBarTranslucent onRequestClose={() => closeMore()}>
        <TouchableWithoutFeedback onPress={() => closeMore()}>
          <View style={styles.moreBackdrop} />
        </TouchableWithoutFeedback>

        <Animated.View style={[styles.moreSheet, { transform: [{ translateY: slideAnim }] }]}>
          {/* Sheet handle */}
          <View style={styles.sheetHandle} />

          {/* User info */}
          <View style={styles.moreUserRow}>
            <View style={styles.moreAvatar}>
              <Text style={styles.moreAvatarText}>
                {(session.name || "U").split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)}
              </Text>
            </View>
            <View>
              <Text style={styles.moreUserName}>{session.name}</Text>
              <Text style={styles.moreUserRole}>{session.role?.replace("_", " ")?.toUpperCase()}</Text>
            </View>
          </View>

          <Text style={styles.moreSectionLabel}>More Navigation</Text>

          {/* Grid of more items */}
          <ScrollView showsVerticalScrollIndicator={false} style={styles.moreScroll}>
            <View style={styles.moreGrid}>
              {moreItems.map((item) => {
                const isActive = item.name === activeScreen;
                return (
                  <Pressable
                    key={item.screen}
                    style={[styles.moreGridItem, isActive && styles.moreGridItemActive]}
                    onPress={() => goTo(item.screen)}
                  >
                    <View style={[styles.moreGridIcon, isActive && styles.moreGridIconActive]}>
                      <Ionicons name={item.icon} size={22} color={isActive ? "#FFFFFF" : "#1E3A8A"} />
                    </View>
                    <Text style={[styles.moreGridLabel, isActive && styles.moreGridLabelActive]} numberOfLines={2}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Divider + Sign Out */}
          <View style={styles.moreDivider} />
          {Array.isArray(session.availablePortals) && session.availablePortals.length > 1 ? (
            <Pressable style={styles.switchPortalRow} onPress={openPortalSelect}>
              <View style={styles.switchPortalIcon}>
                <Ionicons name="shuffle-outline" size={18} color="#1E3A8A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchPortalText}>Switch Portal</Text>
                <Text style={styles.switchPortalSub}>
                  {session.activePortal?.replace("-", " ") ?? "Choose another portal"}
                </Text>
              </View>
            </Pressable>
          ) : null}
          <Pressable style={styles.signOutRow} onPress={() => closeMore(() => setLogoutOpen(true))}>
            <View style={styles.signOutIcon}>
              <Ionicons name="log-out-outline" size={18} color="#DC2626" />
            </View>
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </Animated.View>
      </Modal>

      {/* ── Logout Confirmation ──────────────────────────────────── */}
      <Modal visible={logoutOpen} transparent animationType="fade" onRequestClose={() => setLogoutOpen(false)}>
        <View style={styles.logoutOverlay}>
          <View style={styles.logoutCard}>
            <View style={styles.logoutIconWrap}>
              <Ionicons name="log-out-outline" size={28} color="#DC2626" />
            </View>
            <Text style={styles.logoutTitle}>Sign Out?</Text>
            <Text style={styles.logoutDesc}>Your session will end immediately. Any unsaved progress will be lost.</Text>
            <View style={styles.logoutActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setLogoutOpen(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.logoutBtn} onPress={() => void confirmLogout()}>
                <Text style={styles.logoutBtnText}>Sign Out</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const TAB_HEIGHT = Platform.OS === "ios" ? 80 : 76;
export const BOTTOM_TAB_HEIGHT = TAB_HEIGHT;

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    height: TAB_HEIGHT,
    paddingBottom: Platform.OS === "ios" ? 16 : 14,
    paddingTop: 8,
    paddingHorizontal: 4,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  tabIconWrap: {
    width: 40,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconWrapActive: {
    backgroundColor: "#1E3A8A",
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#94A3B8",
    textAlign: "center",
  },
  tabLabelActive: {
    color: "#1E3A8A",
    fontWeight: "800",
  },

  // More sheet
  moreBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.5)",
  },
  moreSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    maxHeight: "75%",
    elevation: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    marginBottom: 16,
  },
  moreUserRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    marginBottom: 12,
  },
  moreAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1E3A8A",
    alignItems: "center",
    justifyContent: "center",
  },
  moreAvatarText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  moreUserName: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },
  moreUserRole: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.7,
    marginTop: 1,
  },
  moreSectionLabel: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  moreScroll: {
    flexGrow: 0,
  },
  moreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingBottom: 4,
  },
  moreGridItem: {
    width: "30%",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFF",
  },
  moreGridItemActive: {
    borderColor: "#1E3A8A",
    backgroundColor: "#EFF6FF",
  },
  moreGridIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  moreGridIconActive: {
    backgroundColor: "#1E3A8A",
  },
  moreGridLabel: {
    color: "#334155",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
  moreGridLabelActive: {
    color: "#1E3A8A",
  },
  moreDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 12,
  },
  signOutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  switchPortalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
    marginBottom: 6,
  },
  switchPortalIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  switchPortalText: {
    color: "#1E3A8A",
    fontSize: 14,
    fontWeight: "700",
  },
  switchPortalSub: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 1,
  },
  signOutIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
  },
  signOutText: {
    color: "#DC2626",
    fontSize: 14,
    fontWeight: "700",
  },

  // Logout modal
  logoutOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  logoutCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  logoutIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  logoutTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "800",
  },
  logoutDesc: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  logoutActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
    width: "100%",
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelBtnText: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 14,
  },
  logoutBtn: {
    flex: 1,
    backgroundColor: "#DC2626",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  logoutBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
});
