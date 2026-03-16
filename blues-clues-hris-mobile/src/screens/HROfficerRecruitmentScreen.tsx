import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
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
import { Ionicons } from "@expo/vector-icons";
import { Sidebar } from "../components/Sidebar";
import { MobileRoleMenu } from "../components/MobileRoleMenu";
import { Header } from "../components/Header";
import { Colors } from "../constants/colors";
import { UserSession, authFetch } from "../services/auth";
import { API_BASE_URL } from "../lib/api";

type JobPosting = {
  job_posting_id: string;
  title: string;
  description: string | null;
  location: string | null;
  employment_type: string | null;
  salary_range: string | null;
  status: "open" | "closed" | "draft";
  posted_at: string;
  closes_at: string | null;
};

type Application = {
  application_id: string;
  status: string;
  applied_at: string;
  applicant_profile: {
    first_name: string | null;
    last_name: string | null;
    email: string;
    applicant_code: string;
  };
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusPillStyle(status: string) {
  if (status === "open") return { bg: "#ECFDF3", border: "#A7F3D0", text: "#15803D" };
  if (status === "closed") return { bg: "#FEF2F2", border: "#FECACA", text: "#B91C1C" };
  return { bg: "#FFFBEB", border: "#FDE68A", text: "#B45309" };
}

function appStatusStyle(status: string) {
  if (status === "hired") return { bg: "#ECFDF3", border: "#A7F3D0", text: "#15803D", label: "Hired" };
  if (status === "rejected") return { bg: "#FEF2F2", border: "#FECACA", text: "#B91C1C", label: "Rejected" };
  if (status === "screening") return { bg: "#FFFBEB", border: "#FDE68A", text: "#B45309", label: "Screening" };
  if (status === "first_interview") return { bg: "#F3E8FF", border: "#DDD6FE", text: "#6D28D9", label: "1st Interview" };
  if (status === "technical_interview") return { bg: "#E0E7FF", border: "#C7D2FE", text: "#4338CA", label: "Technical" };
  if (status === "final_interview") return { bg: "#F5F3FF", border: "#DDD6FE", text: "#6D28D9", label: "Final" };
  return { bg: "#EFF6FF", border: "#BFDBFE", text: "#1D4ED8", label: "Submitted" };
}

type ActiveTab = "details" | "applicants";

export const HROfficerRecruitmentScreen = ({ route, navigation }: any) => {
  const session: UserSession = route.params.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("details");
  const [applications, setApplications] = useState<Application[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(`${API_BASE_URL}/jobs`);
        const data = await res.json().catch(() => []);
        if (!cancelled) setJobs(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setJobs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter(
      (job) =>
        job.title.toLowerCase().includes(q) ||
        (job.location ?? "").toLowerCase().includes(q) ||
        (job.employment_type ?? "").toLowerCase().includes(q) ||
        job.status.toLowerCase().includes(q)
    );
  }, [jobs, search]);

  const openCount = jobs.filter((j) => j.status === "open").length;
  const closedCount = jobs.filter((j) => j.status === "closed").length;
  const draftCount = jobs.filter((j) => j.status === "draft").length;

  const openJobDetail = async (job: JobPosting) => {
    setSelectedJob(job);
    setActiveTab("details");
    setApplications([]);
    setDetailVisible(true);
    setLoadingApplications(true);
    try {
      const res = await authFetch(
        `${API_BASE_URL}/jobs/${job.job_posting_id}/applications`
      );
      const data = await res.json().catch(() => []);
      setApplications(Array.isArray(data) ? data : []);
    } catch {
      setApplications([]);
    } finally {
      setLoadingApplications(false);
    }
  };

  return (
    <SafeAreaView style={{ backgroundColor: Colors.bgApp }} className="flex-1">
      <StatusBar barStyle="dark-content" />
      <View className="flex-1 flex-row">
        {!isMobile && (
          <Sidebar
            role="hr"
            userName={session.name}
            email={session.email}
            activeScreen="Recruitment"
            navigation={navigation}
          />
        )}

        <View className="flex-1">
          {isMobile ? (
            <MobileRoleMenu
              role="hr"
              userName={session.name}
              email={session.email}
              activeScreen="Recruitment"
              navigation={navigation}
            />
          ) : (
            <Header role="hr" userName={session.name} />
          )}

          <ScrollView
            className="flex-1 px-4 py-4"
            showsVerticalScrollIndicator={false}
          >
            {/* Hero */}
            <View style={styles.heroCard}>
              <Text style={styles.heroEyebrow}>Recruitment</Text>
              <Text style={styles.heroTitle}>
                Manage open positions and applicant flow.
              </Text>
              <Text style={styles.heroSubtitle}>
                Tap any job posting to view its details and applicants.
              </Text>
              <View style={styles.heroStatsRow}>
                {[
                  { label: "Total", value: jobs.length },
                  { label: "Open", value: openCount },
                  { label: "Closed", value: closedCount },
                  { label: "Draft", value: draftCount },
                ].map((s) => (
                  <View key={s.label} style={styles.heroStat}>
                    <Text style={styles.heroStatLabel}>{s.label}</Text>
                    <Text style={styles.heroStatValue}>{s.value}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Job Postings */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Job Postings</Text>
                <Text style={styles.sectionSub}>
                  Tap a posting to view details and applicants
                </Text>
              </View>

              <View style={styles.searchWrap}>
                <Text style={styles.searchIcon}>Search</Text>
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search title, location, type, status..."
                  placeholderTextColor={Colors.textPlaceholder}
                  style={styles.searchInput}
                />
              </View>

              {loading ? (
                <View style={styles.emptyWrap}>
                  <ActivityIndicator color={Colors.primary} />
                </View>
              ) : filteredJobs.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyTitle}>
                    {jobs.length === 0 ? "No job postings yet" : "No matching jobs"}
                  </Text>
                  <Text style={styles.emptySub}>
                    Try another keyword or create a new posting from web.
                  </Text>
                </View>
              ) : (
                filteredJobs.map((job) => {
                  const sp = statusPillStyle(job.status);
                  return (
                    <Pressable
                      key={job.job_posting_id}
                      style={({ pressed }) => [
                        styles.jobCard,
                        pressed && { opacity: 0.75 },
                      ]}
                      onPress={() => openJobDetail(job)}
                    >
                      <View style={styles.jobHeaderRow}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={styles.jobTitle}>{job.title}</Text>
                          <Text style={styles.jobMeta}>
                            {job.location ?? "No location"} |{" "}
                            {job.employment_type ?? "No type"}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.statusPill,
                            { backgroundColor: sp.bg, borderColor: sp.border },
                          ]}
                        >
                          <Text style={[styles.statusText, { color: sp.text }]}>
                            {job.status}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.jobDateRow}>
                        <Text style={styles.dateText}>
                          Posted {formatDate(job.posted_at)}
                        </Text>
                        <Text style={styles.dateText}>
                          {job.closes_at
                            ? `Closes ${formatDate(job.closes_at)}`
                            : "No deadline"}
                        </Text>
                      </View>

                      <View style={styles.tapHint}>
                        <Ionicons
                          name="chevron-forward"
                          size={14}
                          color={Colors.primary}
                        />
                        <Text style={styles.tapHintText}>
                          Tap to view details &amp; applicants
                        </Text>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Job Detail Modal */}
      <Modal
        visible={detailVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Modal header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.modalTitle} numberOfLines={2}>
                  {selectedJob?.title ?? "Job Details"}
                </Text>
                {selectedJob && (
                  <View
                    style={[
                      styles.statusPill,
                      {
                        alignSelf: "flex-start",
                        marginTop: 6,
                        backgroundColor: statusPillStyle(selectedJob.status).bg,
                        borderColor: statusPillStyle(selectedJob.status).border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: statusPillStyle(selectedJob.status).text },
                      ]}
                    >
                      {selectedJob.status}
                    </Text>
                  </View>
                )}
              </View>
              <Pressable
                style={styles.closeBtn}
                onPress={() => setDetailVisible(false)}
              >
                <Ionicons name="close" size={18} color={Colors.textSecondary} />
              </Pressable>
            </View>

            {/* Tabs */}
            <View style={styles.tabRow}>
              <Pressable
                style={[styles.tab, activeTab === "details" && styles.tabActive]}
                onPress={() => setActiveTab("details")}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === "details" && styles.tabTextActive,
                  ]}
                >
                  Details
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.tab,
                  activeTab === "applicants" && styles.tabActive,
                ]}
                onPress={() => setActiveTab("applicants")}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === "applicants" && styles.tabTextActive,
                  ]}
                >
                  Applicants
                  {!loadingApplications && applications.length > 0 && (
                    <Text style={styles.tabBadge}> {applications.length}</Text>
                  )}
                </Text>
              </Pressable>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16 }}
              showsVerticalScrollIndicator={false}
            >
              {activeTab === "details" && selectedJob ? (
                <View style={{ gap: 14 }}>
                  {/* Meta row */}
                  <View style={styles.metaGrid}>
                    {[
                      {
                        label: "Location",
                        value: selectedJob.location ?? "—",
                        icon: "location-outline" as const,
                      },
                      {
                        label: "Type",
                        value: selectedJob.employment_type ?? "—",
                        icon: "briefcase-outline" as const,
                      },
                      {
                        label: "Salary",
                        value: selectedJob.salary_range ?? "—",
                        icon: "cash-outline" as const,
                      },
                      {
                        label: "Posted",
                        value: formatDate(selectedJob.posted_at),
                        icon: "calendar-outline" as const,
                      },
                      {
                        label: "Closes",
                        value: selectedJob.closes_at
                          ? formatDate(selectedJob.closes_at)
                          : "No deadline",
                        icon: "time-outline" as const,
                      },
                    ].map((m) => (
                      <View key={m.label} style={styles.metaCard}>
                        <Ionicons
                          name={m.icon}
                          size={16}
                          color={Colors.primary}
                          style={{ marginBottom: 6 }}
                        />
                        <Text style={styles.metaLabel}>{m.label}</Text>
                        <Text style={styles.metaValue}>{m.value}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Description */}
                  {selectedJob.description ? (
                    <View style={styles.descCard}>
                      <Text style={styles.descTitle}>Description</Text>
                      <Text style={styles.descBody}>
                        {selectedJob.description}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.descCard}>
                      <Text style={styles.descTitle}>Description</Text>
                      <Text style={styles.descEmpty}>
                        No description provided.
                      </Text>
                    </View>
                  )}
                </View>
              ) : activeTab === "applicants" ? (
                loadingApplications ? (
                  <View style={styles.emptyWrap}>
                    <ActivityIndicator color={Colors.primary} />
                  </View>
                ) : applications.length === 0 ? (
                  <View style={styles.emptyWrap}>
                    <Text style={styles.emptyTitle}>No applications yet</Text>
                    <Text style={styles.emptySub}>
                      Applications will appear here when candidates apply.
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 10 }}>
                    {applications.map((app) => {
                      const s = appStatusStyle(app.status);
                      const fullName =
                        [
                          app.applicant_profile?.first_name,
                          app.applicant_profile?.last_name,
                        ]
                          .filter(Boolean)
                          .join(" ") || "Unnamed Applicant";
                      return (
                        <View key={app.application_id} style={styles.applicationRow}>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={styles.applicationName}>{fullName}</Text>
                            <Text style={styles.applicationEmail}>
                              {app.applicant_profile?.email ?? "No email"}
                            </Text>
                            <Text style={styles.applicationCode}>
                              {app.applicant_profile?.applicant_code ?? "—"}
                            </Text>
                          </View>
                          <View style={{ alignItems: "flex-end", gap: 6 }}>
                            <View
                              style={[
                                styles.statusPill,
                                { backgroundColor: s.bg, borderColor: s.border },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.statusText,
                                  { color: s.text },
                                ]}
                              >
                                {s.label}
                              </Text>
                            </View>
                            <Text style={styles.dateText}>
                              {formatDate(app.applied_at)}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: "#0F2D7A",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 14,
  },
  heroEyebrow: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "800",
    lineHeight: 28,
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  heroStatsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 14,
    gap: 8,
  },
  heroStat: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minWidth: 72,
  },
  heroStatLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  heroStatValue: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 20,
  },
  sectionHeader: { marginBottom: 10 },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
  sectionSub: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  searchWrap: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgMuted,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  searchIcon: {
    color: Colors.textPlaceholder,
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  searchInput: { color: Colors.textPrimary, fontSize: 13 },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 26,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  emptySub: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },
  jobCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    padding: 12,
    marginBottom: 10,
  },
  jobHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  jobTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 3,
  },
  jobMeta: { color: Colors.textMuted, fontSize: 12 },
  statusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  jobDateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 8,
  },
  dateText: { color: Colors.textPlaceholder, fontSize: 11 },
  tapHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
  },
  tapHintText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    flex: 1,
    marginTop: 60,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  tabRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 16,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 4,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },
  tabTextActive: { color: Colors.primary },
  tabBadge: { color: Colors.primary, fontWeight: "800" },
  // Details tab
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metaCard: {
    backgroundColor: Colors.bgMuted,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 12,
    minWidth: 140,
    flexGrow: 1,
  },
  metaLabel: {
    color: Colors.textPlaceholder,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  metaValue: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  descCard: {
    backgroundColor: Colors.bgMuted,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
  },
  descTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8,
  },
  descBody: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  descEmpty: {
    color: Colors.textPlaceholder,
    fontSize: 13,
    fontStyle: "italic",
  },
  // Applicants tab
  applicationRow: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  applicationName: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  applicationEmail: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  applicationCode: {
    color: Colors.textPlaceholder,
    fontSize: 11,
    marginTop: 1,
  },
});
