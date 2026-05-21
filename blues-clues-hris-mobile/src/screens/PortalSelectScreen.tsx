import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { RoleSwitchOption, authFetch } from "../services/auth";
import { API_BASE_URL } from "../lib/api";
import { Colors } from "../constants/colors";

const { width: SCREEN_W } = Dimensions.get("window");
const H_PAD = 24;
const CARD_GAP = 16;
const CARD_W = (SCREEN_W - H_PAD * 2 - CARD_GAP) / 2;

type PortalDef = {
  portal_key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const PORTALS: PortalDef[] = [
  { portal_key: "employee",     label: "Employee",     icon: "person-outline" },
  { portal_key: "hr",           label: "HR Officer",   icon: "shield-checkmark-outline" },
  { portal_key: "manager",      label: "Manager",      icon: "briefcase-outline" },
  { portal_key: "admin",        label: "Admin",        icon: "business-outline" },
  { portal_key: "system-admin", label: "System Admin", icon: "layers-outline" },
];

function roleToPortalKey(role?: string): string | null {
  switch (role) {
    case "employee":
    case "hr":
    case "manager":
    case "admin":
      return role;
    case "system_admin":
      return "system-admin";
    default:
      return null;
  }
}

interface Props {
  route: {
    params: {
      session: any;
      roleSwitchOptions?: RoleSwitchOption[];
      availablePortals?: string[];
    };
  };
  navigation: any;
}

export const PortalSelectScreen: React.FC<Props> = ({ route, navigation }) => {
  const { session, roleSwitchOptions = [], availablePortals = [] } = route.params;
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  const getScreen = (key: string): string => {
    switch (key) {
      case "employee":     return "EmployeeDashboard";
      case "hr":           return "HROfficerDashboard";
      case "manager":      return "ManagerDashboard";
      case "system-admin":
      case "admin":        return "SystemAdminDashboard";
      default:             return "EmployeeDashboard";
    }
  };

  const handleSelect = async (portalKey: string, roleId?: string) => {
    if (!roleId || loading) return;
    setSelectedRoleId(roleId);
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/switch-role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role_id: roleId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`Failed to switch: ${data?.message || "Unknown error"}`);
        setLoading(false);
        return;
      }
      navigation.replace(getScreen(portalKey), { session: { ...session } });
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Network error"}`);
      setLoading(false);
    }
  };

  const firstName = session.name?.split(" ")[0] || "there";
  const initials = (session.name || session.email || "U")
    .split(" ")
    .filter(Boolean)
    .map((w: string) => w.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const visiblePortals = PORTALS.filter((p) => {
    const option = roleSwitchOptions.find((r) => r.portal_key === p.portal_key);
    return availablePortals.includes(p.portal_key) || !!option;
  });

  const currentPortal = roleToPortalKey(session.role);
  const displayPortals =
    visiblePortals.length > 0
      ? visiblePortals
      : PORTALS.filter((portal) => portal.portal_key === currentPortal);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#EEF2F8" }}
      contentContainerStyle={[
        styles.root,
        { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 40 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Brand + avatar greeting */}
      <View style={styles.header}>
        <View style={styles.avatarBox}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.brandLabel}>Blue's Clues HRIS</Text>
        <Text style={styles.greeting}>Welcome, {firstName}</Text>
        <Text style={styles.sub}>
          {displayPortals.length === 1 ? "Entering your portal…" : "Choose a portal to continue"}
        </Text>
      </View>

      {/* Cards grid */}
      <View style={styles.grid}>
        {displayPortals.map((portal) => {
          const option = roleSwitchOptions.find((r) => r.portal_key === portal.portal_key);
          const isBusy = loading && selectedRoleId === option?.role_id;
          const isActive =
            session.active_portal === portal.portal_key ||
            (!session.active_portal && portal.portal_key === displayPortals[0]?.portal_key);

          return (
            <View key={portal.portal_key} style={styles.cardWrap}>
              <Pressable
                onPress={() => handleSelect(portal.portal_key, option?.role_id)}
                disabled={loading}
                style={({ pressed }) => StyleSheet.flatten([
                  styles.card,
                  isActive ? styles.cardActive : null,
                  pressed && !loading ? styles.cardPressed : null,
                ].filter(Boolean))}
              >
                {isBusy ? (
                  <ActivityIndicator size="large" color={Colors.primary} />
                ) : (
                  <Ionicons
                    name={portal.icon}
                    size={52}
                    color={isActive ? Colors.primary : "#9CA3AF"}
                    strokeWidth={1.5}
                    style={{ marginLeft: 4 }}
                  />
                )}
                <Text style={[styles.cardLabel, isActive && styles.cardLabelActive]}>
                  {portal.label}
                </Text>
              </Pressable>

              {/* Radio dot */}
              <View style={styles.radioDot}>
                <View style={[styles.radioOuterRing, isActive && styles.radioOuterRingActive]} />
                {isActive && <View style={styles.radioInnerDot} />}
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    paddingHorizontal: H_PAD,
    width: "100%",
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
    width: "100%",
  },
  avatarBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 1,
  },
  brandLabel: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  greeting: {
    color: Colors.textPrimary,
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 6,
  },
  sub: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: "500",
  },

  // Cards grid
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: CARD_GAP,
    justifyContent: "center",
    width: "100%",
  },
  cardWrap: {
    alignItems: "center",
    gap: 10,
    width: CARD_W,
  },
  card: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    padding: 20,
  },
  cardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
    shadowColor: Colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  cardPressed: {
    transform: [{ scale: 0.96 }],
    shadowOpacity: 0.03,
    elevation: 1,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "#9CA3AF",
    textAlign: "center",
  },
  cardLabelActive: {
    color: Colors.primary,
  },

  // Radio dot
  radioDot: {
    width: 20,
    height: 20,
    position: "relative",
  },
  radioOuterRing: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
    position: "absolute",
    top: 0,
    left: 0,
  },
  radioOuterRingActive: {
    borderColor: Colors.primary,
  },
  radioInnerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
    position: "absolute",
    top: 5,
    left: 5,
  },
});
