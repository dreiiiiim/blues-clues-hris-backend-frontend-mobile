import React, { useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Sidebar } from "../components/Sidebar";
import { MobileRoleMenu } from "../components/MobileRoleMenu";
import { GradientHero } from "../components/GradientHero";
import { UserSession } from "../services/auth";

export const EmployeeProfileScreen = ({ route, navigation }: any) => {
  const session: UserSession = route.params?.session ?? {
    name: "Employee",
    email: "",
    role: "employee",
  };

  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [currentSession, setCurrentSession] = useState<UserSession>(session);
  const [username, setUsername] = useState(session.name);

  const firstName = currentSession.name.split(" ")[0] || "Employee";
  const hasChanges =
    username.trim().length > 0 && username.trim() !== currentSession.name;

  const handleSave = () => {
    const trimmed = username.trim();

    if (!trimmed) {
      Alert.alert("Username required", "Please enter a username before saving.");
      return;
    }

    const updatedSession = { ...currentSession, name: trimmed };
    setCurrentSession(updatedSession);
    setUsername(trimmed);

    Alert.alert(
      "Username updated",
      "The displayed name was updated in the mobile app for this session."
    );
  };

  const handleReset = () => {
    setUsername(currentSession.name);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.layout}>
        {!isMobile && (
          <Sidebar
            role="employee"
            userName={currentSession.name}
            email={currentSession.email}
            activeScreen="Profile"
            navigation={navigation}
          />
        )}

        <View style={styles.mainContent}>
          {isMobile && (
            <MobileRoleMenu
              role="employee"
              userName={currentSession.name}
              email={currentSession.email}
              activeScreen="Profile"
              navigation={navigation}
            />
          )}

          <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <GradientHero style={styles.heroCard}>
              <Text style={styles.heroEyebrow}>Employee Profile</Text>
              <Text style={styles.heroTitle}>Manage your profile, {firstName}</Text>
              <Text style={styles.heroSubtitle}>
                This first pass updates the displayed name used by the mobile app
                session.
              </Text>
            </GradientHero>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Current Details</Text>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Displayed Name</Text>
                <Text style={styles.infoValue}>{currentSession.name}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>
                  {currentSession.email || "—"}
                </Text>
              </View>

              <View style={styles.infoRowLast}>
                <Text style={styles.infoLabel}>Role</Text>
                <Text style={styles.infoValue}>Employee</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Edit Username</Text>
              <Text style={styles.cardSub}>
                Update the name shown in the employee mobile experience.
              </Text>

              <Text style={styles.inputLabel}>Username</Text>
              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder="Enter username"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
                autoCapitalize="words"
              />

              <View style={styles.buttonRow}>
                <Pressable style={styles.secondaryButton} onPress={handleReset}>
                  <Text style={styles.secondaryButtonText}>Reset</Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.primaryButton,
                    !hasChanges && styles.buttonDisabled,
                  ]}
                  onPress={handleSave}
                  disabled={!hasChanges}
                >
                  <Text style={styles.primaryButtonText}>Save Username</Text>
                </Pressable>
              </View>
            </View>

            <Pressable
              style={styles.backButton}
              onPress={() =>
                navigation.replace("EmployeeDashboard", {
                  session: currentSession,
                })
              }
            >
              <Text style={styles.backButtonText}>Back to Dashboard</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  layout: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
  },
  mainContent: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  heroCard: {
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 16,
  },
  heroEyebrow: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 4,
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 13,
    lineHeight: 19,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: {
    color: "#0F172A",
    fontSize: 17,
    fontWeight: "800",
  },
  cardSub: {
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
    marginBottom: 14,
  },
  infoRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },
  infoRowLast: {
    paddingTop: 10,
    paddingBottom: 2,
  },
  infoLabel: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  infoValue: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 4,
  },
  inputLabel: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 14,
    color: "#111827",
    fontSize: 15,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  primaryButton: {
    flex: 1,
    backgroundColor: "#1D4ED8",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  backButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DBE4F0",
    paddingVertical: 14,
    alignItems: "center",
  },
  backButtonText: {
    color: "#1D4ED8",
    fontSize: 14,
    fontWeight: "800",
  },
});