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
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Sidebar } from "../components/Sidebar";
import { MobileRoleMenu } from "../components/MobileRoleMenu";
import { authFetch } from "../services/auth";
import { API_BASE_URL } from "../lib/api";

type JobItem = {
  id: string;
  title: string;
  department: string;
  location: string;
  posted: string;
  type: string;
};

type ApplicationItem = {
  id: string;
  jobTitle: string;
  status: string;
  stage: string;
};

const STAGES = ["Applied", "Screening", "Interview", "Final", "Offer"];

function stageIndex(stage: string): number {
  const s = stage?.toLowerCase() ?? "";
  if (s.includes("screen")) return 1;
  if (s.includes("interview") || s.includes("technical") || s.includes("1st") || s.includes("first")) return 2;
  if (s.includes("final")) return 3;
  if (s.includes("offer") || s.includes("decision")) return 4;
  return 0;
}

export function ApplicantDashboardScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const session = route.params?.session ?? { name: "Applicant", email: "", role: "applicant" };
  const { width } = useWindowDimensions();
  const isMobile = width < 900;
  const [search, setSearch] = useState("");
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingApps, setLoadingApps] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(`${API_BASE_URL}/jobs/applicant/open`);
        const data = await res.json().catch(() => []);
        if (!cancelled && Array.isArray(data)) {
          const mapped: JobItem[] = data.map((j: any) => ({
            id: j.job_id ?? j.id ?? String(Math.random()),
            title: j.title ?? j.job_title ?? "Untitled",
            department: j.department ?? j.department_name ?? "—",
            location: j.location ?? "—",
            posted: j.posted_at
              ? new Date(j.posted_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : j.created_at
              ? new Date(j.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : "—",
            type: j.employment_type ?? j.type ?? "Full-time",
          }));
          setJobs(mapped);
        }
      } catch {
        // leave empty — backend may require applicant token
      } finally {
        if (!cancelled) setLoadingJobs(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(`${API_BASE_URL}/jobs/applicant/my-applications`);
        const data = await res.json().catch(() => []);
        if (!cancelled && Array.isArray(data)) {
          const mapped: ApplicationItem[] = data.map((a: any) => ({
            id: a.application_id ?? a.id ?? String(Math.random()),
            jobTitle: a.job_title ?? a.title ?? "Unknown Position",
            status: a.status ?? "In Review",
            stage: a.current_stage ?? a.stage ?? "Applied",
          }));
          setApplications(mapped);
        }
      } catch {
        // leave empty
      } finally {
        if (!cancelled) setLoadingApps(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredJobs = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return jobs;
    return jobs.filter((job) =>
      job.title.toLowerCase().includes(keyword) ||
      job.department.toLowerCase().includes(keyword) ||
      job.location.toLowerCase().includes(keyword) ||
      job.type.toLowerCase().includes(keyword)
    );
  }, [search, jobs]);

  const latestApp = applications[0] ?? null;
  const currentStageIdx = latestApp ? stageIndex(latestApp.stage) : -1;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.layout}>
        {!isMobile && (
          <Sidebar role="applicant" userName={session.name} email={session.email} activeScreen="Dashboard" navigation={navigation} />
        )}

        <View style={styles.mainContent}>
          {isMobile && (
            <MobileRoleMenu role="applicant" userName={session.name} email={session.email} activeScreen="Dashboard" navigation={navigation} />
          )}

          <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.heroCard}>
              <View style={styles.heroTextWrap}>
                <Text style={styles.heroTitle}>Applicant Portal</Text>
                <Text style={styles.heroSubtitle}>Blue&apos;s Clues HRIS</Text>
              </View>
              {!isMobile && (
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{session.name.charAt(0).toUpperCase()}</Text>
                </View>
              )}
            </View>

            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={22} color="#6B7280" style={styles.searchIcon} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search jobs..."
                placeholderTextColor="#6B7280"
                style={styles.searchInput}
              />
            </View>

            {/* Application Status */}
            {loadingApps ? (
              <View style={styles.sectionCard}>
                <ActivityIndicator color="#3366D6" />
              </View>
            ) : latestApp ? (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionEyebrow}>Latest Application</Text>
                <Text style={styles.currentStatus}>Status: {latestApp.status}</Text>
                <Text style={styles.currentRole}>{latestApp.jobTitle}</Text>
                <View style={styles.phasePill}>
                  <Text style={styles.phasePillText}>{latestApp.stage}</Text>
                </View>
              </View>
            ) : null}

            {/* Progress Tracker */}
            {latestApp && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Application Progress</Text>
                <View style={styles.progressLabels}>
                  {STAGES.map((s, i) => (
                    <Text key={s} style={i <= currentStageIdx ? styles.progressLabelActive : styles.progressLabelMuted} numberOfLines={1}>
                      {s}
                    </Text>
                  ))}
                </View>
                <View style={styles.progressRow}>
                  {STAGES.map((s, i) => (
                    <React.Fragment key={s}>
                      {i > 0 && (
                        <View style={i <= currentStageIdx ? styles.progressLineActive : styles.progressLineMuted} />
                      )}
                      {i < currentStageIdx ? (
                        <View style={styles.progressStepDone}>
                          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                        </View>
                      ) : i === currentStageIdx ? (
                        <View style={styles.progressStepCurrent}>
                          <Text style={styles.progressStepCurrentText}>{i + 1}</Text>
                        </View>
                      ) : (
                        <View style={styles.progressStepMuted}>
                          <Text style={styles.progressStepMutedText}>{i + 1}</Text>
                        </View>
                      )}
                    </React.Fragment>
                  ))}
                </View>
              </View>
            )}

            {/* Available Positions */}
            <View style={styles.positionsCard}>
              <Text style={styles.sectionTitle}>Available Positions</Text>
              <Text style={styles.positionsSubtitle}>Discover roles that match your expertise</Text>

              {loadingJobs ? (
                <ActivityIndicator color="#3366E8" style={{ marginVertical: 20 }} />
              ) : filteredJobs.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>{jobs.length === 0 ? "No open positions" : "No jobs found"}</Text>
                  <Text style={styles.emptySubtitle}>
                    {jobs.length === 0 ? "Check back later for new opportunities." : "Try a different keyword."}
                  </Text>
                </View>
              ) : (
                filteredJobs.map((job) => (
                  <View key={job.id} style={styles.jobCard}>
                    <View style={styles.jobTopRow}>
                      <View style={styles.jobTextWrap}>
                        <Text style={styles.jobTitle}>{job.title}</Text>
                        <Text style={styles.jobMeta}>{job.department} • {job.location}</Text>
                        <Text style={styles.jobPosted}>{job.posted}</Text>
                      </View>
                      <View style={styles.jobTypePill}>
                        <Text style={styles.jobTypeText}>{job.type}</Text>
                      </View>
                    </View>
                    <Pressable
                      style={styles.applyButton}
                      onPress={() => Alert.alert("Apply", `Opening application for ${job.title}`)}
                    >
                      <Text style={styles.applyButtonText}>Apply Now →</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F3F4F6" },
  layout: { flex: 1, flexDirection: "row", backgroundColor: "#F3F4F6" },
  mainContent: { flex: 1, backgroundColor: "#F3F4F6" },
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  content: { padding: 16, paddingBottom: 28 },
  heroCard: {
    backgroundColor: "#2646A3",
    borderRadius: 0,
    paddingHorizontal: 20,
    paddingVertical: 24,
    marginHorizontal: -16,
    marginTop: -16,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroTextWrap: { flex: 1 },
  heroTitle: { color: "#FFFFFF", fontSize: 26, fontWeight: "800", marginBottom: 4 },
  heroSubtitle: { color: "rgba(255,255,255,0.82)", fontSize: 14, fontWeight: "700", letterSpacing: 1 },
  avatarCircle: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: "#E5E7EB", alignItems: "center", justifyContent: "center", marginLeft: 16,
  },
  avatarText: { color: "#2646A3", fontSize: 20, fontWeight: "800" },
  searchWrap: {
    height: 52, borderRadius: 16, borderWidth: 1.5, borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, marginBottom: 16,
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 15, color: "#111827" },
  sectionCard: {
    backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1,
    borderColor: "#E5E7EB", padding: 16, marginBottom: 14,
  },
  sectionEyebrow: {
    color: "#3366D6", fontSize: 11, fontWeight: "800", letterSpacing: 2,
    textTransform: "uppercase", marginBottom: 10,
  },
  currentStatus: { color: "#0F172A", fontSize: 22, fontWeight: "800", marginBottom: 8 },
  currentRole: { color: "#6B7280", fontSize: 15, lineHeight: 22, marginBottom: 14 },
  phasePill: {
    alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999, backgroundColor: "#EEF4FF", borderWidth: 1, borderColor: "#BFD4FF",
  },
  phasePillText: { color: "#3366D6", fontSize: 13, fontWeight: "700" },
  sectionTitle: { color: "#0F172A", fontSize: 18, fontWeight: "800", marginBottom: 16 },
  progressLabels: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  progressLabelActive: { color: "#3366D6", fontSize: 10, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", flex: 1, textAlign: "center" },
  progressLabelMuted: { color: "#9CA3AF", fontSize: 10, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", flex: 1, textAlign: "center" },
  progressRow: { flexDirection: "row", alignItems: "center" },
  progressStepDone: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#3366E8", alignItems: "center", justifyContent: "center" },
  progressStepCurrent: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#FFFFFF", borderWidth: 3, borderColor: "#3366E8", alignItems: "center", justifyContent: "center" },
  progressStepCurrentText: { color: "#3366E8", fontSize: 15, fontWeight: "800" },
  progressStepMuted: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F9FAFB", borderWidth: 2, borderColor: "#D1D5DB", alignItems: "center", justifyContent: "center" },
  progressStepMutedText: { color: "#9CA3AF", fontSize: 15, fontWeight: "800" },
  progressLineActive: { flex: 1, height: 4, backgroundColor: "#3366E8" },
  progressLineMuted: { flex: 1, height: 4, backgroundColor: "#D1D5DB" },
  positionsCard: {
    backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1,
    borderColor: "#E5E7EB", padding: 16,
  },
  positionsSubtitle: { color: "#6B7280", fontSize: 14, lineHeight: 20, marginBottom: 16 },
  jobCard: {
    backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB",
    borderRadius: 18, padding: 16, marginBottom: 14,
  },
  jobTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 },
  jobTextWrap: { flex: 1, paddingRight: 10 },
  jobTitle: { color: "#0F172A", fontSize: 16, fontWeight: "800", marginBottom: 6 },
  jobMeta: { color: "#6B7280", fontSize: 13, lineHeight: 20, marginBottom: 2 },
  jobPosted: { color: "#9CA3AF", fontSize: 12 },
  jobTypePill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#F9FAFB" },
  jobTypeText: { color: "#374151", fontSize: 12, fontWeight: "700" },
  applyButton: { alignSelf: "flex-start", backgroundColor: "#3366E8", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
  applyButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  emptyCard: { backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 16, padding: 20, alignItems: "center" },
  emptyTitle: { color: "#0F172A", fontSize: 15, fontWeight: "800", marginBottom: 6 },
  emptySubtitle: { color: "#6B7280", fontSize: 13, textAlign: "center", lineHeight: 20 },
});
