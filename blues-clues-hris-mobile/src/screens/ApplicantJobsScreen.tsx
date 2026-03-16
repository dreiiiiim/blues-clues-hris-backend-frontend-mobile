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
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Sidebar } from "../components/Sidebar";
import { MobileRoleMenu } from "../components/MobileRoleMenu";
import { authFetch } from "../services/auth";
import { API_BASE_URL } from "../lib/api";

type JobItem = {
  job_posting_id: string;
  title: string;
  department: string;
  location: string;
  posted: string;
  type: string;
  description: string;
  salary_range: string;
};

type Question = {
  question_id: string;
  question_text: string;
  question_type: "text" | "multiple_choice" | "checkbox";
  options: string[] | null;
  is_required: boolean;
  sort_order: number;
};

function statusPillStyle(type: string) {
  switch (type?.toLowerCase()) {
    case "full-time":
      return { bg: "#ECFDF3", border: "#A7F3D0", text: "#15803D" };
    case "part-time":
      return { bg: "#FFFBEB", border: "#FDE68A", text: "#B45309" };
    case "contract":
      return { bg: "#EFF6FF", border: "#BFDBFE", text: "#1D4ED8" };
    case "internship":
      return { bg: "#F5F3FF", border: "#DDD6FE", text: "#6D28D9" };
    default:
      return { bg: "#F3F4F6", border: "#E5E7EB", text: "#374151" };
  }
}

export function ApplicantJobsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const session = route.params?.session ?? {
    name: "Applicant",
    email: "",
    role: "applicant",
  };
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [search, setSearch] = useState("");
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail + apply modal
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobItem | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "apply">("details");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(`${API_BASE_URL}/jobs/applicant/open`);
        const data = await res.json().catch(() => []);
        if (!cancelled && Array.isArray(data)) {
          setJobs(
            data.map((j: any) => ({
              job_posting_id:
                j.job_posting_id ?? j.job_id ?? j.id ?? String(Math.random()),
              title: j.title ?? j.job_title ?? "Untitled",
              department: j.department ?? j.department_name ?? "—",
              location: j.location ?? "—",
              posted: j.posted_at
                ? new Date(j.posted_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "—",
              type: j.employment_type ?? j.type ?? "Full-time",
              description: j.description ?? "",
              salary_range: j.salary_range ?? "",
            }))
          );
        }
      } catch {
        // leave empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredJobs = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return jobs;
    return jobs.filter(
      (j) =>
        j.title.toLowerCase().includes(kw) ||
        j.department.toLowerCase().includes(kw) ||
        j.location.toLowerCase().includes(kw) ||
        j.type.toLowerCase().includes(kw)
    );
  }, [search, jobs]);

  async function openJob(job: JobItem) {
    setSelectedJob(job);
    setActiveTab("details");
    setAnswers({});
    setQuestions([]);
    setModalVisible(true);
    setLoadingQuestions(true);
    try {
      const res = await authFetch(
        `${API_BASE_URL}/jobs/${job.job_posting_id}/questions`
      );
      const data = await res.json().catch(() => []);
      const qs: Question[] = Array.isArray(data) ? data : [];
      qs.sort((a, b) => a.sort_order - b.sort_order);
      setQuestions(qs);
    } catch {
      setQuestions([]);
    } finally {
      setLoadingQuestions(false);
    }
  }

  function setAnswer(qid: string, value: string) {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  }

  function toggleCheckbox(qid: string, option: string) {
    setAnswers((prev) => {
      const selected = (prev[qid] ?? "").split(",").filter(Boolean);
      const idx = selected.indexOf(option);
      if (idx === -1) selected.push(option);
      else selected.splice(idx, 1);
      return { ...prev, [qid]: selected.join(",") };
    });
  }

  async function handleSubmit() {
    if (!selectedJob) return;

    for (const q of questions) {
      if (q.is_required && !answers[q.question_id]?.trim()) {
        Alert.alert("Required", `Please answer: "${q.question_text}"`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const body = {
        answers: questions.map((q) => ({
          question_id: q.question_id,
          answer_value: answers[q.question_id] ?? "",
        })),
      };

      const res = await authFetch(
        `${API_BASE_URL}/jobs/${selectedJob.job_posting_id}/apply`,
        { method: "POST", body: JSON.stringify(body) }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.message || "Failed to submit");
      }

      setModalVisible(false);
      Alert.alert(
        "Submitted!",
        `Your application for "${selectedJob.title}" was submitted successfully.`
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.layout}>
        {!isMobile && (
          <Sidebar
            role="applicant"
            userName={session.name}
            email={session.email}
            activeScreen="Jobs"
            navigation={navigation}
          />
        )}

        <View style={styles.mainContent}>
          {isMobile && (
            <MobileRoleMenu
              role="applicant"
              userName={session.name}
              email={session.email}
              activeScreen="Jobs"
              navigation={navigation}
            />
          )}

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Hero */}
            <View style={styles.heroCard}>
              <Text style={styles.eyebrow}>Applicant Portal</Text>
              <Text style={styles.heroTitle}>Open Positions</Text>
              <Text style={styles.heroSubtitle}>
                Browse available roles and submit your application directly from
                your phone.
              </Text>
              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>
                    {loading ? "—" : jobs.length}
                  </Text>
                  <Text style={styles.heroStatLabel}>Open Roles</Text>
                </View>
              </View>
            </View>

            {/* Search */}
            <View style={styles.searchWrap}>
              <Ionicons
                name="search-outline"
                size={20}
                color="#6B7280"
                style={{ marginRight: 10 }}
              />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search by title, department, location..."
                placeholderTextColor="#9CA3AF"
                style={styles.searchInput}
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch("")}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </Pressable>
              )}
            </View>

            {/* Job list */}
            {loading ? (
              <ActivityIndicator
                size="large"
                color="#3366E8"
                style={{ marginTop: 32 }}
              />
            ) : filteredJobs.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons
                  name="briefcase-outline"
                  size={36}
                  color="#D1D5DB"
                  style={{ marginBottom: 12 }}
                />
                <Text style={styles.emptyTitle}>
                  {jobs.length === 0
                    ? "No open positions right now"
                    : "No jobs match your search"}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {jobs.length === 0
                    ? "Check back later for new opportunities."
                    : "Try a different keyword."}
                </Text>
              </View>
            ) : (
              filteredJobs.map((job) => {
                const pill = statusPillStyle(job.type);
                return (
                  <Pressable
                    key={job.job_posting_id}
                    style={({ pressed }) => [
                      styles.jobCard,
                      pressed && styles.jobCardPressed,
                    ]}
                    onPress={() => openJob(job)}
                  >
                    <View style={styles.jobTop}>
                      <View style={styles.jobTextWrap}>
                        <Text style={styles.jobTitle}>{job.title}</Text>
                        <Text style={styles.jobMeta}>
                          {job.department} · {job.location}
                        </Text>
                        <Text style={styles.jobPosted}>
                          Posted {job.posted}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.typePill,
                          {
                            backgroundColor: pill.bg,
                            borderColor: pill.border,
                          },
                        ]}
                      >
                        <Text
                          style={[styles.typePillText, { color: pill.text }]}
                        >
                          {job.type}
                        </Text>
                      </View>
                    </View>

                    {job.description ? (
                      <Text style={styles.jobDesc} numberOfLines={2}>
                        {job.description}
                      </Text>
                    ) : null}

                    <View style={styles.cardFooter}>
                      {job.salary_range ? (
                        <View style={styles.salaryBadge}>
                          <Ionicons
                            name="cash-outline"
                            size={13}
                            color="#15803D"
                          />
                          <Text style={styles.salaryText}>
                            {job.salary_range}
                          </Text>
                        </View>
                      ) : (
                        <View />
                      )}
                      <View style={styles.applyHint}>
                        <Text style={styles.applyHintText}>View & Apply</Text>
                        <Ionicons
                          name="chevron-forward"
                          size={14}
                          color="#3366E8"
                        />
                      </View>
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>

      {/* Job Detail + Apply Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
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
                  <Text style={styles.modalMeta}>
                    {selectedJob.department} · {selectedJob.location}
                  </Text>
                )}
              </View>
              <Pressable
                style={styles.closeBtn}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={18} color="#374151" />
              </Pressable>
            </View>

            {/* Tabs */}
            <View style={styles.tabRow}>
              <Pressable
                style={[
                  styles.tab,
                  activeTab === "details" && styles.tabActive,
                ]}
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
                style={[styles.tab, activeTab === "apply" && styles.tabActive]}
                onPress={() => setActiveTab("apply")}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === "apply" && styles.tabTextActive,
                  ]}
                >
                  Apply
                </Text>
              </Pressable>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* ── Details tab ── */}
              {activeTab === "details" && selectedJob && (
                <View style={{ gap: 14 }}>
                  <View style={styles.metaGrid}>
                    {[
                      {
                        icon: "location-outline" as const,
                        label: "Location",
                        value: selectedJob.location || "—",
                      },
                      {
                        icon: "briefcase-outline" as const,
                        label: "Type",
                        value: selectedJob.type || "—",
                      },
                      {
                        icon: "cash-outline" as const,
                        label: "Salary",
                        value: selectedJob.salary_range || "Not specified",
                      },
                      {
                        icon: "calendar-outline" as const,
                        label: "Posted",
                        value: selectedJob.posted || "—",
                      },
                    ].map((m) => (
                      <View key={m.label} style={styles.metaCard}>
                        <Ionicons
                          name={m.icon}
                          size={16}
                          color="#3366E8"
                          style={{ marginBottom: 6 }}
                        />
                        <Text style={styles.metaLabel}>{m.label}</Text>
                        <Text style={styles.metaValue}>{m.value}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.descCard}>
                    <Text style={styles.descTitle}>About this role</Text>
                    {selectedJob.description ? (
                      <Text style={styles.descBody}>
                        {selectedJob.description}
                      </Text>
                    ) : (
                      <Text style={styles.descEmpty}>
                        No description provided for this role.
                      </Text>
                    )}
                  </View>

                  <Pressable
                    style={styles.applyBtn}
                    onPress={() => setActiveTab("apply")}
                  >
                    <Text style={styles.applyBtnText}>
                      Apply for this Position
                    </Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </Pressable>
                </View>
              )}

              {/* ── Apply tab ── */}
              {activeTab === "apply" && selectedJob && (
                <View style={{ gap: 16 }}>
                  <View style={styles.formHeader}>
                    <Text style={styles.formTitle}>Application Form</Text>
                    <Text style={styles.formSubtitle}>
                      {selectedJob.title}
                    </Text>
                  </View>

                  {loadingQuestions ? (
                    <ActivityIndicator
                      color="#3366E8"
                      style={{ marginVertical: 24 }}
                    />
                  ) : questions.length === 0 ? (
                    <View style={styles.noQuestionsCard}>
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={36}
                        color="#3366E8"
                        style={{ marginBottom: 10 }}
                      />
                      <Text style={styles.noQuestionsTitle}>
                        No additional questions
                      </Text>
                      <Text style={styles.noQuestionsText}>
                        This posting has no form questions. You can submit your
                        application right away.
                      </Text>
                    </View>
                  ) : (
                    questions.map((q, idx) => (
                      <View key={q.question_id} style={styles.questionCard}>
                        <Text style={styles.questionLabel}>
                          {idx + 1}.{"  "}{q.question_text}
                          {q.is_required && (
                            <Text style={styles.requiredStar}> *</Text>
                          )}
                        </Text>

                        {/* Text answer */}
                        {q.question_type === "text" && (
                          <TextInput
                            style={styles.textAnswer}
                            placeholder="Your answer..."
                            placeholderTextColor="#9CA3AF"
                            value={answers[q.question_id] ?? ""}
                            onChangeText={(v) => setAnswer(q.question_id, v)}
                            multiline
                            numberOfLines={3}
                            textAlignVertical="top"
                          />
                        )}

                        {/* Multiple choice */}
                        {q.question_type === "multiple_choice" &&
                          (q.options ?? []).map((opt, oidx) => {
                            const selected = answers[q.question_id] === opt;
                            return (
                              <Pressable
                                key={`${q.question_id}-opt-${oidx}`}
                                style={[
                                  styles.choiceOption,
                                  selected && styles.choiceOptionSelected,
                                ]}
                                onPress={() => setAnswer(q.question_id, opt)}
                              >
                                <View
                                  style={[
                                    styles.radioCircle,
                                    selected && styles.radioCircleSelected,
                                  ]}
                                >
                                  {selected && (
                                    <View style={styles.radioInner} />
                                  )}
                                </View>
                                <Text
                                  style={[
                                    styles.choiceText,
                                    selected && styles.choiceTextSelected,
                                  ]}
                                >
                                  {opt}
                                </Text>
                              </Pressable>
                            );
                          })}

                        {/* Checkbox */}
                        {q.question_type === "checkbox" &&
                          (q.options ?? []).map((opt, oidx) => {
                            const checked = (answers[q.question_id] ?? "")
                              .split(",")
                              .filter(Boolean)
                              .includes(opt);
                            return (
                              <Pressable
                                key={`${q.question_id}-chk-${oidx}`}
                                style={[
                                  styles.choiceOption,
                                  checked && styles.choiceOptionSelected,
                                ]}
                                onPress={() =>
                                  toggleCheckbox(q.question_id, opt)
                                }
                              >
                                <View
                                  style={[
                                    styles.checkBox,
                                    checked && styles.checkBoxSelected,
                                  ]}
                                >
                                  {checked && (
                                    <Ionicons
                                      name="checkmark"
                                      size={12}
                                      color="#FFFFFF"
                                    />
                                  )}
                                </View>
                                <Text
                                  style={[
                                    styles.choiceText,
                                    checked && styles.choiceTextSelected,
                                  ]}
                                >
                                  {opt}
                                </Text>
                              </Pressable>
                            );
                          })}
                      </View>
                    ))
                  )}

                  <Pressable
                    style={[
                      styles.submitBtn,
                      submitting && styles.submitBtnDisabled,
                    ]}
                    onPress={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <Text style={styles.submitBtnText}>
                          Submit Application
                        </Text>
                        <Ionicons
                          name="checkmark-circle-outline"
                          size={18}
                          color="#FFFFFF"
                        />
                      </>
                    )}
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F3F4F6" },
  layout: { flex: 1, flexDirection: "row", backgroundColor: "#F3F4F6" },
  mainContent: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },

  // Hero
  heroCard: {
    backgroundColor: "#1E3A8A",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  eyebrow: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 6,
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 14,
  },
  heroStats: { flexDirection: "row" },
  heroStat: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  heroStatValue: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 2,
  },
  heroStatLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontWeight: "700",
  },

  // Search
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#111827" },

  // Empty
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    marginTop: 8,
  },
  emptyTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
  },
  emptySubtitle: {
    color: "#6B7280",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },

  // Job card
  jobCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  jobCardPressed: { opacity: 0.75 },
  jobTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  jobTextWrap: { flex: 1, paddingRight: 10 },
  jobTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  jobMeta: { color: "#6B7280", fontSize: 13, marginBottom: 2 },
  jobPosted: { color: "#9CA3AF", fontSize: 12 },
  typePill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  typePillText: { fontSize: 11, fontWeight: "800" },
  jobDesc: {
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: 10,
  },
  salaryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ECFDF3",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  salaryText: { color: "#15803D", fontSize: 12, fontWeight: "700" },
  applyHint: { flexDirection: "row", alignItems: "center", gap: 3 },
  applyHintText: { color: "#3366E8", fontSize: 13, fontWeight: "700" },

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
    flex: 1,
    marginTop: 60,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: { color: "#0F172A", fontSize: 18, fontWeight: "800" },
  modalMeta: { color: "#6B7280", fontSize: 13, marginTop: 4 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  tabRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingHorizontal: 16,
  },
  tab: { paddingVertical: 12, paddingHorizontal: 16, marginRight: 4 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: "#3366E8" },
  tabText: { color: "#6B7280", fontSize: 14, fontWeight: "700" },
  tabTextActive: { color: "#3366E8" },

  // Details tab
  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metaCard: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 12,
    minWidth: 140,
    flexGrow: 1,
  },
  metaLabel: {
    color: "#9CA3AF",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  metaValue: { color: "#0F172A", fontSize: 13, fontWeight: "700" },
  descCard: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 14,
  },
  descTitle: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8,
  },
  descBody: { color: "#374151", fontSize: 13, lineHeight: 20 },
  descEmpty: { color: "#9CA3AF", fontSize: 13, fontStyle: "italic" },
  applyBtn: {
    backgroundColor: "#3366E8",
    borderRadius: 16,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  applyBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },

  // Apply tab
  formHeader: {
    backgroundColor: "#EEF4FF",
    borderWidth: 1,
    borderColor: "#BFD4FF",
    borderRadius: 14,
    padding: 14,
  },
  formTitle: { color: "#1D4ED8", fontSize: 15, fontWeight: "800" },
  formSubtitle: { color: "#3366D6", fontSize: 13, marginTop: 2 },
  noQuestionsCard: {
    backgroundColor: "#EEF4FF",
    borderWidth: 1,
    borderColor: "#BFD4FF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  noQuestionsTitle: {
    color: "#1D4ED8",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 6,
  },
  noQuestionsText: {
    color: "#3366D6",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  questionCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  questionLabel: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  requiredStar: { color: "#DC2626" },
  textAnswer: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#F9FAFB",
    minHeight: 80,
  },
  choiceOption: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  choiceOptionSelected: {
    borderColor: "#3366E8",
    backgroundColor: "#EEF4FF",
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  radioCircleSelected: { borderColor: "#3366E8" },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#3366E8",
  },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  checkBoxSelected: { borderColor: "#3366E8", backgroundColor: "#3366E8" },
  choiceText: { color: "#374151", fontSize: 14, flex: 1 },
  choiceTextSelected: { color: "#1D4ED8", fontWeight: "700" },
  submitBtn: {
    backgroundColor: "#3366E8",
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
});
