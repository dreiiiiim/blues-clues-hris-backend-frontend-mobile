import React from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Sidebar } from "../components/Sidebar";
import { MobileRoleMenu } from "../components/MobileRoleMenu";
import { GradientHero } from "../components/GradientHero";
import { UserSession } from "../services/auth";

const REQUIRED_DOCUMENTS = [
  {
    id: "gov-id",
    title: "Government ID",
    description: "Upload a valid ID for employee verification.",
  },
  {
    id: "tax-form",
    title: "Tax Forms",
    description: "Submit your required tax-related onboarding documents.",
  },
  {
    id: "employment-contract",
    title: "Signed Contract",
    description: "Attach your signed employment agreement.",
  },
];

export const EmployeeDocumentsScreen = ({ route, navigation }: any) => {
  const session: UserSession = route.params?.session ?? {
    name: "Employee",
    email: "",
    role: "employee",
  };

  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const handleUploadPress = (title: string) => {
    Alert.alert(
      "Upload setup needed",
      `${title} will be connected to real file picking in the next step after installing expo-document-picker.`
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.layout}>
        {!isMobile && (
          <Sidebar
            role="employee"
            userName={session.name}
            email={session.email}
            activeScreen="Documents"
            navigation={navigation}
          />
        )}

        <View style={styles.mainContent}>
          {isMobile && (
            <MobileRoleMenu
              role="employee"
              userName={session.name}
              email={session.email}
              activeScreen="Documents"
              navigation={navigation}
            />
          )}

          <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <GradientHero style={styles.heroCard}>
              <Text style={styles.heroEyebrow}>Employee Documents</Text>
              <Text style={styles.heroTitle}>Upload required files</Text>
              <Text style={styles.heroSubtitle}>
                This screen is ready for the upload flow. Real file selection
                will be added in the next step.
              </Text>
            </GradientHero>

            <View style={styles.noteCard}>
              <Text style={styles.noteTitle}>Current setup note</Text>
              <Text style={styles.noteText}>
                The upload UI is now in place, but the app still needs a
                document picker package before it can select actual files.
              </Text>
            </View>

            {REQUIRED_DOCUMENTS.map((doc) => (
              <View key={doc.id} style={styles.docCard}>
                <Text style={styles.docTitle}>{doc.title}</Text>
                <Text style={styles.docDesc}>{doc.description}</Text>

                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Status</Text>
                  <View style={styles.pendingPill}>
                    <Text style={styles.pendingPillText}>Pending Upload</Text>
                  </View>
                </View>

                <Pressable
                  style={styles.uploadButton}
                  onPress={() => handleUploadPress(doc.title)}
                >
                  <Text style={styles.uploadButtonText}>Upload Document</Text>
                </Pressable>
              </View>
            ))}

            <Pressable
              style={styles.backButton}
              onPress={() =>
                navigation.replace("EmployeeDashboard", { session })
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
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    lineHeight: 19,
  },
  noteCard: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  noteTitle: {
    color: "#1D4ED8",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 6,
  },
  noteText: {
    color: "#1E3A8A",
    fontSize: 13,
    lineHeight: 20,
  },
  docCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    marginBottom: 14,
  },
  docTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
  },
  docDesc: {
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 14,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  statusLabel: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
  },
  pendingPill: {
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FDBA74",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pendingPillText: {
    color: "#C2410C",
    fontSize: 12,
    fontWeight: "800",
  },
  uploadButton: {
    backgroundColor: "#1D4ED8",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  uploadButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
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