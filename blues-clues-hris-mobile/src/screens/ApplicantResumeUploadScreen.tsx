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

export const ApplicantResumeUploadScreen = ({ route, navigation }: any) => {
  const session: UserSession = route.params?.session ?? {
    name: "Applicant",
    email: "",
    role: "applicant",
  };

  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const handleChooseResume = () => {
    Alert.alert(
      "Upload setup needed",
      "Resume file picking will be enabled in the next step after installing expo-document-picker."
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.layout}>
        {!isMobile && (
          <Sidebar
            role="applicant"
            userName={session.name}
            email={session.email}
            activeScreen="Resume"
            navigation={navigation}
          />
        )}

        <View style={styles.mainContent}>
          {isMobile && (
            <MobileRoleMenu
              role="applicant"
              userName={session.name}
              email={session.email}
              activeScreen="Resume"
              navigation={navigation}
            />
          )}

          <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <GradientHero style={styles.heroCard}>
              <Text style={styles.heroEyebrow}>Resume Upload</Text>
              <Text style={styles.heroTitle}>Keep your resume updated</Text>
              <Text style={styles.heroSubtitle}>
                Upload your latest resume before applying to roles.
              </Text>
            </GradientHero>

            <View style={styles.resumeCard}>
              <Text style={styles.cardTitle}>Resume Status</Text>
              <Text style={styles.cardSub}>
                No resume has been selected in mobile yet.
              </Text>

              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>No File Selected</Text>
              </View>

              <View style={styles.divider} />

              <Text style={styles.helperTitle}>Accepted format</Text>
              <Text style={styles.helperText}>
                PDF is recommended for best compatibility.
              </Text>

              <Text style={styles.helperTitle}>What happens next</Text>
              <Text style={styles.helperText}>
                In the next step, we will connect this screen to actual file
                selection and upload handling.
              </Text>

              <Pressable
                style={styles.primaryButton}
                onPress={handleChooseResume}
              >
                <Text style={styles.primaryButtonText}>Choose Resume File</Text>
              </Pressable>
            </View>

            <Pressable
              style={styles.backButton}
              onPress={() =>
                navigation.replace("ApplicantDashboard", { session })
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
    color: "rgba(255,255,255,0.65)",
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
  resumeCard: {
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
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 14,
  },
  statusPill: {
    alignSelf: "flex-start",
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FDBA74",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 14,
  },
  statusPillText: {
    color: "#C2410C",
    fontSize: 12,
    fontWeight: "800",
  },
  divider: {
    height: 1,
    backgroundColor: "#EEF2F7",
    marginBottom: 14,
  },
  helperTitle: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 4,
  },
  helperText: {
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: "#1D4ED8",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  primaryButtonText: {
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