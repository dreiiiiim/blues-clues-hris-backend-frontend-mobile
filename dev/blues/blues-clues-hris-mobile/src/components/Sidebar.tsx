import React, { useState } from "react";
import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { CommonActions } from "@react-navigation/native";
import { clearSession, UserRole } from "../services/auth";
import { ROLE_LABELS, MENU_CONFIG, APP_SUBTITLE } from "../constants/config";
import { getInitial } from "../lib/utils";

type Props = {
  role: UserRole;
  userName: string;
  activeScreen: string;
  navigation: any;
};

export const Sidebar = ({ role, userName, activeScreen, navigation }: Props) => {
  const [showLogout, setShowLogout] = useState(false);
  const initial = getInitial(userName);

  async function confirmLogout() {
    await clearSession();
    setShowLogout(false);
    navigation.reset({
      index: 0,
      routes: [{ name: "Login" }],
    });
  }

  const session = {
    name: userName,
    role,
    email:
      role === "system_admin" || role === "admin"
        ? "rickgrimes"
        : role === "applicant"
        ? "montanielandrei@gmail.com"
        : "",
  };

  const switchTo = (target: string) => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: target, params: { session } }],
      })
    );
  };

  const goToScreen = (screenName: string) => {
    if (screenName === activeScreen) return;

    if (role === "system_admin" || role === "admin") {
      if (screenName === "Dashboard") {
        switchTo("SystemAdminDashboard");
        return;
      }

      if (screenName === "Users") {
        switchTo("SystemAdminUsers");
        return;
      }

      if (screenName === "Billing") {
        switchTo("SystemAdminBilling");
        return;
      }
    }

    if (role === "manager") {
      if (screenName === "Dashboard") {
        switchTo("ManagerDashboard");
        return;
      }

      if (screenName === "Timekeeping") {
        switchTo("ManagerDashboard");
        return;
      }
    }

    if (role === "applicant") {
      if (screenName === "Dashboard") {
        switchTo("ApplicantDashboard");
        return;
      }
    }
  };

  const menu = MENU_CONFIG[role] ?? [];

  const renderIcon = (name: string, isActive: boolean) => {
    const color = isActive ? "#FFFFFF" : "rgba(255,255,255,0.88)";

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
        return (
          <Ionicons name="document-text-outline" size={17} color={color} />
        );
      case "Recruitment":
        return <Feather name="users" size={17} color={color} />;
      case "Onboarding":
        return <Ionicons name="clipboard-outline" size={17} color={color} />;
      case "Compensation":
        return <Ionicons name="wallet-outline" size={17} color={color} />;
      case "Performance":
        return <Ionicons name="bar-chart-outline" size={17} color={color} />;
      case "Team":
        return <Feather name="users" size={17} color={color} />;
      case "Approvals":
        return (
          <Ionicons name="checkmark-done-outline" size={17} color={color} />
        );
      case "Profile":
        return <Ionicons name="person-outline" size={17} color={color} />;
      case "Documents":
        return (
          <Ionicons name="document-text-outline" size={17} color={color} />
        );
      default:
        return <Feather name="circle" size={16} color={color} />;
    }
  };

  return (
    <>
      <View style={styles.sidebar}>
        <View style={styles.topBrand}>
          <View style={styles.brandRow}>
            <View style={styles.logoCircle}>
              <MaterialCommunityIcons
                name="layers-outline"
                size={18}
                color="#FFFFFF"
              />
            </View>
            <View>
              <Text style={styles.brandTitle}>Blue&apos;s Clues</Text>
              <Text style={styles.brandSubtitle}>{APP_SUBTITLE}</Text>
            </View>
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionLabel}>MAIN MENU</Text>

          {menu.map((item) => {
            const isActive = activeScreen === item.name;

            return (
              <Pressable
                key={item.name}
                style={[styles.menuItem, isActive && styles.menuItemActive]}
                onPress={() => goToScreen(item.name)}
              >
                <View style={styles.menuIcon}>
                  {renderIcon(item.name, isActive)}
                </View>
                <Text style={[styles.menuText, isActive && styles.menuTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.accountSection}>
          <Text style={styles.sectionLabel}>ACCOUNT</Text>

          <Pressable style={styles.signOutRow} onPress={() => setShowLogout(true)}>
            <Ionicons
              name="log-out-outline"
              size={17}
              color="rgba(255,255,255,0.9)"
            />
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </View>

        <View style={styles.bottomProfile}>
          <View style={styles.bottomProfileRow}>
            <View style={styles.bottomAvatar}>
              <Text style={styles.bottomAvatarText}>{initial}</Text>
            </View>

            <View style={styles.bottomProfileText}>
              <Text numberOfLines={1} style={styles.bottomName}>
                {userName}
              </Text>
              <Text numberOfLines={1} style={styles.bottomRole}>
                {ROLE_LABELS[role] ?? role}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <Modal transparent visible={showLogout} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalTop}>
              <View style={styles.modalIconWrap}>
                <Text style={styles.modalIcon}>⚠️</Text>
              </View>

              <View style={{ flex: 1 }}>
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
};

const styles = StyleSheet.create({
  sidebar: {
    width: 240,
    backgroundColor: "#1F3F95",
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.08)",
  },
  topBrand: {
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 18,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  brandTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 20,
  },
  brandSubtitle: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 1,
  },
  menuSection: {
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  sectionLabel: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  menuItem: {
    height: 38,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  menuItemActive: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  menuIcon: {
    width: 18,
    alignItems: "center",
    marginRight: 12,
  },
  menuText: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 16,
    fontWeight: "600",
  },
  menuTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  accountSection: {
    marginTop: "auto",
    paddingHorizontal: 14,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingTop: 18,
  },
  signOutRow: {
    height: 38,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  signOutText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 12,
  },
  bottomProfile: {
    backgroundColor: "#18357F",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  bottomProfileRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  bottomAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  bottomAvatarText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  bottomProfileText: {
    flex: 1,
  },
  bottomName: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  bottomRole: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: 2,
    textTransform: "uppercase",
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