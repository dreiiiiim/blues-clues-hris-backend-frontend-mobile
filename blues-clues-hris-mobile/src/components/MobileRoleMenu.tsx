import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  ScrollView,
} from "react-native";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { CommonActions } from "@react-navigation/native";
import { clearSession, UserRole } from "../services/auth";
import { MENU_CONFIG, ROLE_LABELS } from "../constants/config";

type Props = {
  readonly role: UserRole;
  readonly userName: string;
  readonly email?: string;
  readonly activeScreen: string;
  readonly navigation: any;
};

export function MobileRoleMenu({
  role,
  userName,
  email = "",
  activeScreen,
  navigation,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [showLogout, setShowLogout] = useState(false);

  const session = { name: userName, role, email };

  const switchTo = (target: string) => {
    setVisible(false);
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: target, params: { session } }],
      })
    );
  };

  const SCREEN_MAP: Partial<Record<UserRole, Record<string, string>>> = {
    system_admin: { Dashboard: "SystemAdminDashboard", Onboarding: "SystemAdminOnboarding", Users: "SystemAdminUsers", Billing: "SystemAdminBilling", AuditLogs: "SystemAdminAuditLogs" },
    admin:        { Dashboard: "SystemAdminDashboard", Users: "SystemAdminUsers", Billing: "SystemAdminBilling", AuditLogs: "SystemAdminAuditLogs" },
    manager:      { Dashboard: "ManagerDashboard", Timekeeping: "ManagerTimekeeping", Team: "ManagerTeam" },
    hr:           { Dashboard: "HROfficerDashboard", Onboarding: "HROfficerOnboarding", Timekeeping: "HROfficerTimekeeping", Recruitment: "HROfficerRecruitment" },
    employee:     { Dashboard: "EmployeeDashboard", Onboarding: "EmployeeOnboarding", Timekeeping: "EmployeeTimekeeping" },
    applicant:    { Dashboard: "ApplicantDashboard", Jobs: "ApplicantJobs", Applications: "ApplicantApplications" },
  };

  const goToScreen = (screenName: string) => {
    if (screenName === activeScreen) { setVisible(false); return; }

    const target = SCREEN_MAP[role]?.[screenName];
    if (target) { switchTo(target); return; }

    setVisible(false);
  };

  async function confirmLogout() {
    await clearSession();
    setShowLogout(false);
    setVisible(false);
    navigation.reset({
      index: 0,
      routes: [{ name: "Login" }],
    });
  }

  const renderIcon = (name: string, isActive: boolean) => {
    const color = isActive ? "#1e3a8a" : "#475569";

    switch (name) {
      case "Dashboard":
        return (
          <MaterialCommunityIcons
            name="view-grid-outline"
            size={18}
            color={color}
          />
        );
      case "Users":
        return <Feather name="users" size={17} color={color} />;
      case "Billing":
        return <Ionicons name="card-outline" size={17} color={color} />;
      case "Timekeeping":
        return (
          <MaterialCommunityIcons
            name="clock-time-four-outline"
            size={18}
            color={color}
          />
        );
      case "Jobs":
        return <Feather name="briefcase" size={17} color={color} />;
      case "Applications":
      case "Documents":
        return <Ionicons name="document-text-outline" size={17} color={color} />;
      case "Recruitment":
      case "Team":
        return <Feather name="users" size={17} color={color} />;
      case "AuditLogs":
        return <Ionicons name="shield-checkmark-outline" size={17} color={color} />;
      case "Onboarding":
        return <Ionicons name="clipboard-outline" size={17} color={color} />;
      case "Compensation":
        return <Ionicons name="wallet-outline" size={17} color={color} />;
      case "Performance":
        return <Ionicons name="bar-chart-outline" size={17} color={color} />;
      case "Approvals":
        return (
          <Ionicons name="checkmark-done-outline" size={17} color={color} />
        );
      case "Profile":
        return <Ionicons name="person-outline" size={17} color={color} />;
      default:
        return <Feather name="circle" size={16} color={color} />;
    }
  };

  const menu = MENU_CONFIG[role] ?? [];
  const activeItem =
    menu.find((item) => item.name === activeScreen)?.label || "Menu";

  return (
    <>
      <View style={styles.header}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.portalLabel}>{ROLE_LABELS[role] ?? "Portal"}</Text>
          <Text style={styles.userName} numberOfLines={1}>
            {userName}
          </Text>
        </View>

        <Pressable style={styles.menuButton} onPress={() => setVisible(true)}>
          <Ionicons name="menu" size={22} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={styles.activeBar}>
        <Text style={styles.activeBarText}>{activeItem}</Text>
      </View>

      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetTop}>
              <View>
                <Text style={styles.sheetTitle}>Navigate</Text>
                <Text style={styles.sheetSubtitle}>
                  {ROLE_LABELS[role] ?? "Portal"}
                </Text>
              </View>

              <Pressable
                style={styles.closeButton}
                onPress={() => setVisible(false)}
              >
                <Ionicons name="close" size={20} color="#0F172A" />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.menuList}
            >
              {menu.map((item) => {
                const isActive = item.name === activeScreen;

                return (
                  <Pressable
                    key={item.name}
                    style={[
                      styles.menuItem,
                      isActive && styles.menuItemActive,
                    ]}
                    onPress={() => goToScreen(item.name)}
                  >
                    <View style={styles.iconWrap}>
                      {renderIcon(item.name, isActive)}
                    </View>
                    <Text
                      style={[
                        styles.menuText,
                        isActive && styles.menuTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}

              <Pressable
                style={styles.logoutRow}
                onPress={() => {
                  setVisible(false);
                  setShowLogout(true);
                }}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name="log-out-outline" size={18} color="#DC2626" />
                </View>
                <Text style={styles.logoutText}>Sign Out</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={showLogout} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalTop}>
              <View style={styles.modalIconWrap}>
                <Text style={styles.modalIcon}>⚠️</Text>
              </View>

              <View style={styles.modalTextWrap}>
                <Text style={styles.modalTitle}>Confirm Logout</Text>
                <Text style={styles.modalDesc}>
                  Are you sure you want to log out? Your session will end
                  immediately.
                </Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setShowLogout(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>

              <Pressable style={styles.logoutBtn} onPress={confirmLogout}>
                <Text style={styles.logoutBtnText}>Log Out</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#1e3a8a",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  portalLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  userName: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  menuButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  activeBar: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  activeBarText: {
    color: "#1e3a8a",
    fontSize: 14,
    fontWeight: "700",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.38)",
    justifyContent: "flex-start",
  },
  sheet: {
    marginTop: 70,
    marginHorizontal: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    maxHeight: "75%",
  },
  sheetTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sheetTitle: {
    color: "#0F172A",
    fontSize: 20,
    fontWeight: "800",
  },
  sheetSubtitle: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  menuList: {
    paddingBottom: 4,
  },
  menuItem: {
    minHeight: 46,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  menuItemActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  iconWrap: {
    width: 20,
    alignItems: "center",
    marginRight: 12,
  },
  menuText: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "600",
  },
  menuTextActive: {
    color: "#1e3a8a",
    fontWeight: "800",
  },
  logoutRow: {
    minHeight: 46,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    marginTop: 6,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  logoutText: {
    color: "#DC2626",
    fontSize: 15,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
  },
  modalTop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  modalIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  modalIcon: {
    fontSize: 22,
  },
  modalTextWrap: {
    flex: 1,
  },
  modalTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "700",
  },
  modalDesc: {
    color: "#6B7280",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 20,
  },
  cancelBtn: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginRight: 10,
  },
  cancelBtnText: {
    color: "#111827",
    fontWeight: "600",
  },
  logoutBtn: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  logoutBtnText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
