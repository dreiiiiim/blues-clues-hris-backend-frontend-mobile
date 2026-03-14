import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TextInput,
  Pressable,
  useWindowDimensions,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Sidebar } from "../components/Sidebar";
import { MobileRoleMenu } from "../components/MobileRoleMenu";
import { authFetch } from "../services/auth";
import { API_BASE_URL } from "../lib/api";

type UserItem = {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  username: string;
  email: string;
  role: string;
  department: string;
  startDate: string;
  status: "Pending" | "Active" | "Locked" | "Inactive";
};

const MODULE_OPTIONS = [
  "Recruitment",
  "Onboarding",
  "Compensation",
  "Performance",
];

function mapStatus(raw: string): UserItem["status"] {
  switch (raw?.toLowerCase()) {
    case "active":   return "Active";
    case "pending":  return "Pending";
    case "locked":   return "Locked";
    default:         return "Inactive";
  }
}

export function SystemAdminUsersScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const session = route.params?.session ?? { name: "Admin", email: "", role: "system_admin" };
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [search, setSearch] = useState("");
  const [selectedModules, setSelectedModules] = useState<string[]>(["Recruitment", "Onboarding"]);
  const [allUsers, setAllUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(`${API_BASE_URL}/users`);
        const data = await res.json().catch(() => []);
        if (!cancelled && Array.isArray(data)) {
          const mapped: UserItem[] = data.map((u: any) => ({
            id: u.user_id ?? u.id ?? String(Math.random()),
            firstName: u.first_name ?? "",
            lastName: u.last_name ?? "",
            employeeId: u.employee_id ?? u.username ?? "—",
            username: u.username ?? "—",
            email: u.email ?? "",
            role: u.role_name ?? u.role ?? "—",
            department: u.department_name ?? u.department ?? "—",
            startDate: u.created_at ? new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—",
            status: mapStatus(u.status ?? u.account_status ?? "inactive"),
          }));
          setAllUsers(mapped);
        }
      } catch {
        // leave empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const users = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return allUsers;
    return allUsers.filter((user) =>
      `${user.firstName} ${user.lastName}`.toLowerCase().includes(keyword) ||
      user.email.toLowerCase().includes(keyword) ||
      user.role.toLowerCase().includes(keyword) ||
      user.department.toLowerCase().includes(keyword) ||
      user.employeeId.toLowerCase().includes(keyword)
    );
  }, [search, allUsers]);

  const toggleModule = (module: string) => {
    setSelectedModules((prev) =>
      prev.includes(module)
        ? prev.filter((item) => item !== module)
        : [...prev, module]
    );
  };

  const getStatusStyle = (status: UserItem["status"]) => {
    switch (status) {
      case "Active":
        return {
          backgroundColor: "#DCFCE7",
          borderColor: "#BBF7D0",
          textColor: "#166534",
        };
      case "Pending":
        return {
          backgroundColor: "#FEF3C7",
          borderColor: "#FDE68A",
          textColor: "#92400E",
        };
      case "Locked":
        return {
          backgroundColor: "#FEE2E2",
          borderColor: "#FECACA",
          textColor: "#B91C1C",
        };
      default:
        return {
          backgroundColor: "#E5E7EB",
          borderColor: "#D1D5DB",
          textColor: "#374151",
        };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.layout}>
        {!isMobile && (
          <Sidebar
            role="system_admin"
            userName={session.name}
            email={session.email}
            activeScreen="Users"
            navigation={navigation}
          />
        )}

        <View style={styles.mainContent}>
          {isMobile && (
            <MobileRoleMenu
              role="system_admin"
              userName={session.name}
              email={session.email}
              activeScreen="Users"
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
              <Text style={styles.title}>User Management</Text>
              <Text style={styles.subtitle}>
                Create accounts, assign HR module access, manage invite links,
                and control activation status.
              </Text>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.sectionTitle}>Add User</Text>

              <View style={styles.inputGrid}>
                <TextInput style={styles.input} placeholder="First Name" placeholderTextColor="#94A3B8" />
                <TextInput style={styles.input} placeholder="Last Name" placeholderTextColor="#94A3B8" />
                <TextInput style={styles.input} placeholder="Employee ID" placeholderTextColor="#94A3B8" />
                <TextInput style={styles.input} placeholder="Username" placeholderTextColor="#94A3B8" />
                <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#94A3B8" />
                <TextInput style={styles.input} placeholder="Role" placeholderTextColor="#94A3B8" />
                <TextInput style={styles.input} placeholder="Department" placeholderTextColor="#94A3B8" />
                <TextInput style={styles.input} placeholder="Start Date" placeholderTextColor="#94A3B8" />
              </View>

              <Text style={styles.subsectionTitle}>HR RBAC Modules</Text>
              <View style={styles.checkboxRow}>
                {MODULE_OPTIONS.map((module) => {
                  const selected = selectedModules.includes(module);

                  return (
                    <Pressable
                      key={module}
                      style={[
                        styles.checkboxPill,
                        selected && styles.checkboxPillActive,
                      ]}
                      onPress={() => toggleModule(module)}
                    >
                      <Ionicons
                        name={selected ? "checkbox" : "square-outline"}
                        size={18}
                        color={selected ? "#1D4ED8" : "#64748B"}
                        style={styles.checkboxIcon}
                      />
                      <Text
                        style={[
                          styles.checkboxText,
                          selected && styles.checkboxTextActive,
                        ]}
                      >
                        {module}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.subsectionTitle}>Invite Link Tools</Text>
              <View style={styles.actionRow}>
                <Pressable style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Generate Link</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Copy Link</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Resend Invite</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Set Expiry</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.tableCard}>
              <Text style={styles.sectionTitle}>Users</Text>

              <View style={styles.searchBox}>
                <Ionicons
                  name="search-outline"
                  size={18}
                  color="#64748B"
                  style={styles.searchIcon}
                />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search users..."
                  placeholderTextColor="#94A3B8"
                  style={styles.searchInput}
                />
              </View>

              {loading ? (
                <ActivityIndicator style={{ margin: 20 }} color="#2563EB" />
              ) : users.length === 0 ? (
                <Text style={{ color: "#94A3B8", textAlign: "center", padding: 20 }}>No users found.</Text>
              ) : null}

              {!loading && users.map((user) => {
                const statusStyle = getStatusStyle(user.status);

                return (
                  <View key={user.id} style={styles.userCard}>
                    <View style={styles.userTop}>
                      <View style={styles.userInfo}>
                        <Text style={styles.userName}>
                          {user.firstName} {user.lastName}
                        </Text>
                        <Text style={styles.userMeta}>
                          {user.employeeId} • {user.role}
                        </Text>
                        <Text style={styles.userMeta}>
                          {user.department} • {user.email}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor: statusStyle.backgroundColor,
                            borderColor: statusStyle.borderColor,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            { color: statusStyle.textColor },
                          ]}
                        >
                          {user.status}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.userBottom}>
                      <Pressable style={styles.smallButton}>
                        <Text style={styles.smallButtonText}>Edit</Text>
                      </Pressable>
                      <Pressable style={styles.smallButton}>
                        <Text style={styles.smallButtonText}>Lock / Unlock</Text>
                      </Pressable>
                      <Pressable style={styles.smallButton}>
                        <Text style={styles.smallButtonText}>
                          Activate / Deactivate
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

export default SystemAdminUsersScreen;

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
  formCard: {
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
  subsectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 6,
    marginBottom: 12,
  },
  inputGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 10,
  },
  input: {
    minWidth: 180,
    flexGrow: 1,
    height: 48,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    paddingHorizontal: 14,
    marginRight: 10,
    marginBottom: 10,
    backgroundColor: "#F8FAFC",
    color: "#0F172A",
  },
  checkboxRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  checkboxPill: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 10,
    marginBottom: 10,
    backgroundColor: "#FFFFFF",
  },
  checkboxPillActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  checkboxIcon: {
    marginRight: 8,
  },
  checkboxText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
  },
  checkboxTextActive: {
    color: "#1D4ED8",
    fontWeight: "700",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  secondaryButton: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginRight: 10,
    marginBottom: 10,
  },
  secondaryButtonText: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "700",
  },
  tableCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 20,
    padding: 18,
  },
  searchBox: {
    height: 46,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: "#0F172A",
    fontSize: 14,
  },
  userCard: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
  },
  userTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  userInfo: {
    flex: 1,
    paddingRight: 10,
  },
  userName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  userMeta: {
    fontSize: 13,
    lineHeight: 20,
    color: "#64748B",
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "800",
  },
  userBottom: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  smallButton: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  smallButtonText: {
    color: "#1D4ED8",
    fontSize: 13,
    fontWeight: "700",
  },
});