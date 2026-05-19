import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Sidebar } from "../components/Sidebar";
import { BottomTabBar, BOTTOM_TAB_HEIGHT } from "../components/BottomTabBar";
import { GradientHero } from "../components/GradientHero";
import { authFetch, type UserSession, type UserRole } from "../services/auth";
import { API_BASE_URL } from "../lib/api";

type StatCard = { label: string; value: string; helper?: string };
type SectionItem = { title: string; subtitle?: string; meta?: string; tone?: "default" | "success" | "warning" | "danger" };
type SectionCard = { title: string; subtitle?: string; items: SectionItem[] };
type ActionCard = { label: string; route: string; icon?: keyof typeof Ionicons.glyphMap };
type PageModel = {
  eyebrow?: string;
  title: string;
  subtitle: string;
  stats?: StatCard[];
  sections?: SectionCard[];
  actions?: ActionCard[];
};

type LoaderContext = {
  session: UserSession;
  navigation: any;
};

type ScreenConfig = {
  role: UserRole;
  activeScreen: string;
  load: (ctx: LoaderContext) => Promise<PageModel>;
};

async function fetchJson(path: string): Promise<any> {
  const res = await authFetch(`${API_BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`Request failed: ${path}`);
  }
  return res.json().catch(() => null);
}

function toArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (value?.data && Array.isArray(value.data)) return value.data;
  if (value?.items && Array.isArray(value.items)) return value.items;
  return value ? [value] : [];
}

function textValue(value: any): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return JSON.stringify(value);
}

function formatDate(value: any): string {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? textValue(value) : date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

function formatMoney(value: any): string {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return textValue(value);
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(numeric);
}

function statValueFromNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return String(value);
}

function buildKeyValueItems(source: Record<string, any>, keys: Array<[string, string]>, tone: SectionItem["tone"] = "default"): SectionItem[] {
  return keys.map(([label, key]) => ({
    title: label,
    subtitle: textValue(source?.[key]),
    meta: "Info",
    tone,
  }));
}
function approvalTone(status: any): SectionItem["tone"] {
  const normalized = String(status ?? "").toLowerCase();
  if (normalized.includes("approved") || normalized.includes("complete") || normalized.includes("ack")) {
    return "success";
  }
  if (normalized.includes("rejected") || normalized.includes("deny")) {
    return "danger";
  }
  return "warning";
}
function progressTone(progress: any): SectionItem["tone"] {
  const numeric = Number(progress ?? 0);
  if (numeric >= 80) return "success";
  if (numeric >= 50) return "warning";
  return "default";
}
function progressLabel(progress: any, status: any): string {
  return progress != null ? `${progress}%` : textValue(status ?? "Open");
}
function evaluationSubtitle(ratingStatus: any, reviewPeriod: any): string {
  const parts = [textValue(ratingStatus ?? "")];
  if (reviewPeriod) parts.push(`· ${reviewPeriod}`);
  return parts.join(" ").trim();
}
function hasCompletedStatus(status: any): boolean {
  return String(status ?? "").toLowerCase().includes("completed");
}

function toneStyle(tone?: SectionItem["tone"]) {
  switch (tone) {
    case "success": return { backgroundColor: "#ECFDF3", borderColor: "#BBF7D0" };
    case "warning": return { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" };
    case "danger": return { backgroundColor: "#FEF2F2", borderColor: "#FECACA" };
    default: return { backgroundColor: "#F1F5F9", borderColor: "#E2E8F0" };
  }
}

function SectionBlock({ section }: { section: SectionCard }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.subtitle ? <Text style={styles.sectionSubtitle}>{section.subtitle}</Text> : null}
        </View>
      </View>

      <View style={styles.sectionList}>
        {section.items.length === 0 ? (
          <Text style={styles.emptyText}>Nothing to show here yet.</Text>
        ) : (
          section.items.map((item, index) => (
            <View key={`${section.title}-${index}`} style={[styles.itemRow, index !== section.items.length - 1 && styles.itemRowBorder]}>
              <View style={styles.itemTextWrap}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                {item.subtitle ? <Text style={styles.itemSubtitle}>{item.subtitle}</Text> : null}
              </View>
              <View style={[styles.itemPill, toneStyle(item.tone)]}>
                <Text style={styles.itemPillText}>{item.meta ?? "View"}</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

function createBackendScreen(config: ScreenConfig) {
  return function BackendScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const session: UserSession = route.params?.session ?? {
      name: "Blue's Clues User",
      email: "",
      role: config.role,
      userId: "",
    };
    const { width } = useWindowDimensions();
    const isMobile = width < 900;

    const [page, setPage] = useState<PageModel | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          const result = await config.load({ session, navigation });
          if (!cancelled) setPage(result);
        } catch {
          if (!cancelled) {
            setPage({
              eyebrow: "Unavailable",
              title: "Could not load data",
              subtitle: "The backend request failed. Please try again.",
              sections: [],
            });
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [navigation, session]);

    const content = page ?? {
      eyebrow: "Loading",
      title: "Loading page",
      subtitle: "Fetching the latest backend data...",
      sections: [],
    };

    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.layout}>
          {!isMobile && (
            <Sidebar
              role={config.role}
              userName={session.name}
              email={session.email}
              activeScreen={config.activeScreen}
              navigation={navigation}
            />
          )}

          <View style={styles.mainContent}>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={[styles.content, isMobile && { paddingBottom: BOTTOM_TAB_HEIGHT + 8 }]}
              showsVerticalScrollIndicator={false}
            >
              <GradientHero style={styles.heroCard}>
                <Text style={styles.heroEyebrow}>{content.eyebrow ?? config.activeScreen}</Text>
                <Text style={styles.heroTitle}>{content.title}</Text>
                <Text style={styles.heroSubtitle}>{content.subtitle}</Text>

                {content.actions?.length ? (
                  <View style={styles.actionsRow}>
                    {content.actions.map((action) => (
                      <Pressable
                        key={action.label}
                        style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.78 }]}
                        onPress={() => action.route && navigation?.navigate?.(action.route, { session })}
                      >
                        {action.icon ? <Ionicons name={action.icon} size={16} color="#FFFFFF" /> : null}
                        <Text style={styles.actionButtonText}>{action.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </GradientHero>

              {loading ? (
                <ActivityIndicator style={{ marginTop: 24 }} color="#1E3A8A" />
              ) : (
                <>
                  {content.stats?.length ? (
                    <View style={styles.statsGrid}>
                      {content.stats.map((stat) => (
                        <View key={stat.label} style={styles.statCard}>
                          <Text style={styles.statLabel}>{stat.label}</Text>
                          <Text style={styles.statValue}>{stat.value}</Text>
                          {stat.helper ? <Text style={styles.statHelper}>{stat.helper}</Text> : null}
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {content.sections?.map((section) => (
                    <SectionBlock key={section.title} section={section} />
                  ))}
                </>
              )}
            </ScrollView>

            {isMobile && (
              <BottomTabBar
                role={config.role}
                activeScreen={config.activeScreen}
                navigation={navigation}
                session={session}
              />
            )}
          </View>
        </View>
      </SafeAreaView>
    );
  };
}

function nameOf(user: UserSession): string {
  return user.name || user.email || "Blue's Clues User";
}

export const ApplicantProfileScreen = createBackendScreen({
  role: "applicant",
  activeScreen: "Profile",
  load: async ({ session }) => {
    const [me, requests] = await Promise.all([
      fetchJson("/users/me").catch(() => null),
      fetchJson("/users/me/change-requests").catch(() => []),
    ]);

    const requestRows = toArray(requests).map((item: any) => ({
      title: item.reason ?? item.field_type ?? "Change request",
      subtitle: item.review_reason ?? item.status ?? formatDate(item.created_at),
      meta: textValue(item.status ?? "Pending"),
      tone: approvalTone(item.status),
    }));

    return {
      eyebrow: "Applicant",
      title: "My Profile",
      subtitle: `Your profile data and change requests for ${nameOf(session)}.`,
      stats: [
        { label: "Email", value: textValue(me?.email ?? session.email), helper: "Primary login" },
        { label: "Status", value: textValue(me?.status ?? me?.account_status ?? "Active"), helper: "Account state" },
        { label: "Resume", value: me?.resume_name ? "Uploaded" : "Not uploaded", helper: me?.resume_uploaded_at ? formatDate(me.resume_uploaded_at) : "Upload from resume screen" },
        { label: "Role", value: textValue(me?.role ?? session.role), helper: "Applicant portal" },
      ],
      actions: [
        { label: "Upload Resume", route: "ApplicantResumeUpload", icon: "cloud-upload-outline" },
        { label: "Open Dashboard", route: "ApplicantDashboard", icon: "grid-outline" },
      ],
      sections: [
        {
          title: "Profile Snapshot",
          subtitle: "Key fields mirrored from the shared backend.",
          items: buildKeyValueItems(me ?? {}, [
            ["First Name", "first_name"],
            ["Last Name", "last_name"],
            ["Personal Email", "personal_email"],
            ["Phone", "phone_number"],
            ["Nationality", "nationality"],
            ["Civil Status", "civil_status"],
            ["Address", "complete_address"],
          ]),
        },
        {
          title: "Change Requests",
          subtitle: "Profile updates waiting for HR review.",
          items: requestRows,
        },
      ],
    };
  },
});

export const ApplicantOnboardingScreen = createBackendScreen({
  role: "applicant",
  activeScreen: "Onboarding",
  load: async ({ session }) => {
    const sessionData = await fetchJson("/onboarding/portal/session").catch(() => null);
    const sessionId = sessionData?.session_id ?? sessionData?.id ?? null;
    const items = toArray(sessionData?.items ?? sessionData?.onboarding_items ?? sessionData?.checklist);

    return {
      eyebrow: "Applicant Onboarding",
      title: "Onboarding Setup",
      subtitle: sessionData ? "Continue your onboarding submission, documents, and profile details." : "No onboarding session is active yet.",
      stats: [
        { label: "Session", value: sessionId ? textValue(sessionId).slice(0, 8) : "None", helper: sessionId ? "Active session" : "Start from HR invite" },
        { label: "Stage", value: textValue(sessionData?.status ?? "Draft"), helper: "Progress state" },
        { label: "Deadline", value: formatDate(sessionData?.deadline_date ?? sessionData?.deadline), helper: "Expected completion" },
        { label: "Items", value: statValueFromNumber(items.length), helper: "Tasks and uploads" },
      ],
      actions: [
        { label: "Resume Upload", route: "ApplicantResumeUpload", icon: "document-text-outline" },
        { label: "Open Profile", route: "ApplicantProfile", icon: "person-outline" },
      ],
      sections: [
        {
          title: "Session Details",
          subtitle: "The onboarding wizard data returned by the shared backend.",
          items: buildKeyValueItems(sessionData ?? {}, [
            ["Assigned Position", "assigned_position"],
            ["Assigned Department", "assigned_department"],
            ["Status", "status"],
            ["Progress", "progress_percentage"],
            ["Deadline", "deadline_date"],
          ]),
        },
        {
          title: "Checklist Items",
          subtitle: "Uploaded documents and required steps.",
          items: items.map((item: any) => ({
            title: item.title ?? item.item_name ?? item.name ?? "Onboarding item",
            subtitle: textValue(item.status ?? item.delivery_method ?? item.description),
            meta: textValue(item.status ?? "Pending"),
            tone: String(item.status ?? "").toLowerCase().includes("complete") ? "success" : "warning",
          })),
        },
      ],
    };
  },
});

export const EmployeeProfileScreen = createBackendScreen({
  role: "employee",
  activeScreen: "Profile",
  load: async ({ session }) => {
    const [me, requests] = await Promise.all([
      fetchJson("/users/me").catch(() => null),
      fetchJson("/users/me/change-requests").catch(() => []),
    ]);

    return {
      eyebrow: "Staff Portal",
      title: "My Profile",
      subtitle: `Employment details, contact info, and change requests for ${nameOf(session)}.`,
      stats: [
        { label: "Employee ID", value: textValue(me?.employee_id ?? "—"), helper: "Company identifier" },
        { label: "Department", value: textValue(me?.department_name ?? me?.department_id ?? "—"), helper: "Current assignment" },
        { label: "Status", value: textValue(me?.account_status ?? "Active"), helper: "Account state" },
        { label: "Onboarding", value: textValue(me?.onboarding_status ?? "Complete"), helper: "Workflow state" },
      ],
      actions: [
        { label: "View Documents", route: "EmployeeDocuments", icon: "folder-open-outline" },
        { label: "Leave", route: "EmployeeLeave", icon: "calendar-outline" },
      ],
      sections: [
        {
          title: "Profile Snapshot",
          subtitle: "Pulled directly from the shared users endpoint.",
          items: buildKeyValueItems(me ?? {}, [
            ["First Name", "first_name"],
            ["Middle Name", "middle_name"],
            ["Last Name", "last_name"],
            ["Email", "email"],
            ["Personal Email", "personal_email"],
            ["Phone", "phone_number"],
            ["Bank", "bank_name"],
            ["Address", "complete_address"],
          ]),
        },
        {
          title: "Change Requests",
          subtitle: "Requested updates awaiting review.",
          items: toArray(requests).map((item: any) => ({
            title: item.field_type ?? item.reason ?? "Change request",
            subtitle: textValue(item.status ?? item.review_reason ?? item.reason),
            meta: textValue(item.status ?? "Pending"),
            tone: approvalTone(item.status),
          })),
        },
      ],
    };
  },
});

// EmployeeLeaveScreen moved to src/screens/EmployeeLeaveScreen.tsx (interactive with file form)

export const EmployeePayslipsScreen = createBackendScreen({
  role: "employee",
  activeScreen: "Payslips",
  load: async ({ session }) => {
    const payslips = toArray(await fetchJson("/cnb/me/payslips").catch(() => []));
    const latest = payslips[0] ?? null;

    return {
      eyebrow: "Compensation",
      title: "My Payslips",
      subtitle: `Payslip history and current pay information for ${nameOf(session)}.`,
      stats: [
        { label: "Payslips", value: statValueFromNumber(payslips.length), helper: "Total available" },
        { label: "Latest Net Pay", value: formatMoney(latest?.net_pay ?? latest?.netPay), helper: latest ? formatDate(latest?.pay_period_end ?? latest?.created_at ?? latest?.payout_date) : "No payslip yet" },
        { label: "Status", value: textValue(latest?.status ?? "—"), helper: "Most recent payslip" },
        { label: "Acknowledged", value: textValue(latest?.employee_ack_status ?? latest?.ack_status ?? "—"), helper: "Receipt state" },
      ],
      sections: [
        {
          title: "Payslip History",
          subtitle: "Most recent first.",
          items: payslips.map((item: any) => ({
            title: item.payslip_code ?? item.payslip_id ?? "Payslip",
            subtitle: `${formatMoney(item.net_pay ?? item.netPay)} · ${formatDate(item.created_at ?? item.payout_date)}`,
            meta: textValue(item.status ?? "Pending"),
            tone: String(item.status ?? "").toLowerCase().includes("approved") ? "success" : "default",
          })),
        },
      ],
    };
  },
});

export const EmployeeDocumentsScreen = createBackendScreen({
  role: "employee",
  activeScreen: "Documents",
  load: async ({ session }) => {
    const docs = toArray(await fetchJson("/users/me/documents").catch(() => []));
    return {
      eyebrow: "Documents",
      title: "My Documents",
      subtitle: `Submitted employee documents for ${nameOf(session)}.`,
      stats: [
        { label: "Documents", value: statValueFromNumber(docs.length), helper: "Uploaded files" },
        { label: "Approved", value: statValueFromNumber(docs.filter((d: any) => String(d.status ?? "").toLowerCase() === "approved").length), helper: "Accepted by HR" },
        { label: "Pending", value: statValueFromNumber(docs.filter((d: any) => String(d.status ?? "").toLowerCase() === "pending").length), helper: "Waiting review" },
        { label: "Replacements", value: statValueFromNumber(docs.filter((d: any) => d.replacement_requested_at || d.replacement_status).length), helper: "Replacement requests" },
      ],
      sections: [
        {
          title: "Document List",
          subtitle: "Document type, file name, and current review status.",
          items: docs.map((item: any) => ({
            title: item.document_type ?? item.file_name ?? "Document",
            subtitle: `${textValue(item.file_name ?? item.file_path)} · ${formatDate(item.uploaded_at ?? item.created_at)}`,
            meta: textValue(item.status ?? "Pending"),
            tone: String(item.status ?? "").toLowerCase() === "approved" ? "success" : String(item.status ?? "").toLowerCase() === "rejected" ? "danger" : "warning",
          })),
        },
      ],
    };
  },
});

export const EmployeePerformanceScreen = createBackendScreen({
  role: "employee",
  activeScreen: "Performance",
  load: async ({ session }) => {
    const [goals, evaluations] = await Promise.all([
      fetchJson("/performance/goals/my").catch(() => []),
      fetchJson("/performance/evaluations/my/history").catch(() => []),
    ]);

    return {
      eyebrow: "Performance",
      title: "My Performance",
      subtitle: `Goals and evaluation history for ${nameOf(session)}.`,
      stats: [
        { label: "Goals", value: statValueFromNumber(toArray(goals).length), helper: "Current objectives" },
        { label: "Evaluations", value: statValueFromNumber(toArray(evaluations).length), helper: "Historical reviews" },
        { label: "Active", value: statValueFromNumber(toArray(goals).filter((g: any) => String(g.status ?? "").toLowerCase() !== "completed").length), helper: "Open goals" },
        { label: "Reviews", value: statValueFromNumber(toArray(evaluations).filter((e: any) => e.document_url).length), helper: "With documents" },
      ],
      sections: [
        {
          title: "Goals",
          subtitle: "Employee goals pulled from the performance module.",
          items: toArray(goals).map((item: any) => ({
            title: item.goal_name ?? item.title ?? "Goal",
            subtitle: `${textValue(item.status ?? "Open")} · ${textValue(item.priority ?? item.review_type ?? "Priority")}`,
            meta: textValue(item.progress_pct != null ? `${item.progress_pct}%` : item.status ?? "Open"),
            tone: Number(item.progress_pct ?? 0) >= 80 ? "success" : Number(item.progress_pct ?? 0) >= 50 ? "warning" : "default",
          })),
        },
        {
          title: "Evaluations",
          subtitle: "Recent reviews and acknowledgement history.",
          items: toArray(evaluations).map((item: any) => ({
            title: item.review_type ?? item.rating_status ?? "Evaluation",
            subtitle: evaluationSubtitle(item.rating_status, item.review_period),
            meta: textValue(item.perf_status ?? item.status ?? "Review"),
            tone: String(item.perf_status ?? "").toLowerCase().includes("ack") ? "success" : "default",
          })),
        },
      ],
    };
  },
});

// EmployeeOffboardingScreen moved to src/screens/EmployeeOffboardingScreen.tsx (with resignation form)
export const _EmployeeOffboardingScreen_MOVED = createBackendScreen({
  role: "employee",
  activeScreen: "Offboarding",
  load: async ({ session }) => {
    const cases = toArray(await fetchJson("/offboarding/employee/cases/my").catch(() => []));
    const current = cases[0] ?? null;
    const caseId = current?.case_id ?? current?.id ?? null;

    const [checklist, finalPay, clearance] = caseId
      ? await Promise.all([
          fetchJson(`/offboarding/employee/cases/${caseId}/checklist`).catch(() => []),
          fetchJson(`/offboarding/employee/cases/${caseId}/final-pay`).catch(() => null),
          fetchJson(`/offboarding/employee/cases/${caseId}/clearance-documents`).catch(() => []),
        ])
      : [[], null, []];

    return {
      eyebrow: "Offboarding",
      title: "My Offboarding",
      subtitle: `Offboarding status and checklist for ${nameOf(session)}.`,
      stats: [
        { label: "Cases", value: statValueFromNumber(cases.length), helper: "Active submissions" },
        { label: "Checklist", value: statValueFromNumber(toArray(checklist).length), helper: "Required items" },
        { label: "Clearance", value: statValueFromNumber(toArray(clearance).length), helper: "Clearance documents" },
        { label: "Final Pay", value: textValue(finalPay?.status ?? current?.status ?? "—"), helper: finalPay ? formatMoney(finalPay.total_amount ?? finalPay.totalAmount ?? finalPay.amount) : "Pending" },
      ],
      sections: [
        {
          title: "Cases",
          subtitle: "Your offboarding requests.",
          items: cases.map((item: any) => ({
            title: item.offboarding_type ?? item.reason ?? "Offboarding",
            subtitle: `${textValue(item.status ?? "Submitted")} · Last day ${formatDate(item.last_working_day)}`,
            meta: textValue(item.status ?? "Submitted"),
            tone: String(item.status ?? "").toLowerCase().includes("approve") ? "success" : "warning",
          })),
        },
        {
          title: "Checklist",
          subtitle: "Returned assets and clearances.",
          items: toArray(checklist).map((item: any) => ({
            title: item.item_name ?? item.title ?? "Checklist item",
            subtitle: textValue(item.category ?? item.notes ?? item.status),
            meta: textValue(item.status ?? "Pending"),
            tone: String(item.status ?? "").toLowerCase().includes("clear") ? "success" : "warning",
          })),
        },
      ],
    };
  },
});

export const ManagerPerformanceScreen = createBackendScreen({
  role: "manager",
  activeScreen: "Performance",
  load: async ({ session }) => {
    const [goals, evaluations] = await Promise.all([
      fetchJson("/performance/goals/team").catch(() => []),
      fetchJson("/performance/evaluations/team").catch(() => []),
    ]);
    return {
      eyebrow: "Management",
      title: "Team Performance",
      subtitle: `Manager performance view for ${nameOf(session)}.`,
      stats: [
        { label: "Team Goals", value: statValueFromNumber(toArray(goals).length), helper: "Goals owned by the team" },
        { label: "Evaluations", value: statValueFromNumber(toArray(evaluations).length), helper: "Reviews in progress" },
        { label: "Open Goals", value: statValueFromNumber(toArray(goals).filter((g: any) => String(g.status ?? "").toLowerCase() !== "completed").length), helper: "Still active" },
        { label: "Acknowledge", value: statValueFromNumber(toArray(evaluations).filter((e: any) => e.employee_acknowledged_at).length), helper: "Employee acknowledgment" },
      ],
      sections: [
        { title: "Team Goals", subtitle: "Goals visible to managers.", items: toArray(goals).map((item: any) => ({ title: item.goal_name ?? item.title ?? "Goal", subtitle: textValue(item.status ?? item.review_period), meta: textValue(item.progress_pct != null ? `${item.progress_pct}%` : item.status ?? "Open"), tone: Number(item.progress_pct ?? 0) >= 80 ? "success" : "warning" })) },
        { title: "Evaluations", subtitle: "Submitted and draft evaluations.", items: toArray(evaluations).map((item: any) => ({ title: item.review_type ?? "Evaluation", subtitle: textValue(item.rating_status ?? item.perf_status ?? item.review_period), meta: textValue(item.perf_status ?? "Review"), tone: String(item.perf_status ?? "").toLowerCase().includes("approved") ? "success" : "default" })) },
        { title: "Evaluations", subtitle: "Submitted and draft evaluations.", items: toArray(evaluations).map((item: any) => ({ title: item.review_type ?? "Evaluation", subtitle: textValue(item.rating_status ?? item.perf_status ?? item.review_period), meta: textValue(item.perf_status ?? "Review"), tone: approvalTone(item.perf_status) })) },
      ],
    };
  },
});

export const ManagerOffboardingScreen = createBackendScreen({
  role: "manager",
  activeScreen: "Offboarding",
  load: async ({ session }) => {
    const cases = toArray(await fetchJson("/offboarding/manager/cases").catch(() => []));
    return {
      eyebrow: "Management",
      title: "Team Offboarding",
      subtitle: `Manager offboarding queue for ${nameOf(session)}.`,
      stats: [
        { label: "Cases", value: statValueFromNumber(cases.length), helper: "Managed offboarding cases" },
        { label: "Submitted", value: statValueFromNumber(cases.filter((c: any) => String(c.status ?? "").toLowerCase().includes("submitted")).length), helper: "Waiting review" },
        { label: "Approved", value: statValueFromNumber(cases.filter((c: any) => String(c.status ?? "").toLowerCase().includes("approve")).length), helper: "Completed" },
        { label: "Rejected", value: statValueFromNumber(cases.filter((c: any) => String(c.status ?? "").toLowerCase().includes("reject")).length), helper: "Returned to employee" },
      ],
      sections: [
        { title: "Cases", subtitle: "Offboarding work in the manager queue.", items: cases.map((item: any) => ({ title: item.offboarding_type ?? item.reason ?? "Offboarding", subtitle: `${textValue(item.employee_name ?? item.employee_id)} · ${formatDate(item.created_at ?? item.submission_date)}`, meta: textValue(item.status ?? "Submitted"), tone: String(item.status ?? "").toLowerCase().includes("approve") ? "success" : "warning" })) },
      ],
    };
  },
});

// ManagerApprovalsScreen moved to src/screens/ManagerApprovalsScreen.tsx (interactive with approve/reject tabs)

export const ManagerPayslipsScreen = createBackendScreen({
  role: "manager",
  activeScreen: "Payslips",
  load: async ({ session }) => {
    const payslips = toArray(await fetchJson("/cnb/me/payslips").catch(() => []));
    return {
      eyebrow: "Compensation",
      title: "My Payslips",
      subtitle: `Manager payslips for ${nameOf(session)}.`,
      stats: [
        { label: "Payslips", value: statValueFromNumber(payslips.length), helper: "Available records" },
        { label: "Latest Net", value: formatMoney(payslips[0]?.net_pay), helper: formatDate(payslips[0]?.created_at ?? payslips[0]?.payout_date) },
        { label: "Status", value: textValue(payslips[0]?.status ?? "—"), helper: "Most recent" },
        { label: "Ack", value: textValue(payslips[0]?.employee_ack_status ?? "—"), helper: "Acknowledgement" },
      ],
      sections: [
        { title: "Payslip History", subtitle: "Most recent entries.", items: payslips.map((item: any) => ({ title: item.payslip_code ?? item.payslip_id ?? "Payslip", subtitle: `${formatMoney(item.net_pay)} · ${formatDate(item.created_at ?? item.payout_date)}`, meta: textValue(item.status ?? "Pending") })) },
      ],
    };
  },
});

export const HROffboardingScreen = createBackendScreen({
  role: "hr",
  activeScreen: "Offboarding",
  load: async ({ session }) => {
    const cases = toArray(await fetchJson("/offboarding/hr/cases").catch(() => []));
    return {
      eyebrow: "HR Offboarding",
      title: "Offboarding Cases",
      subtitle: `HR case management for ${nameOf(session)}.`,
      stats: [
        { label: "Cases", value: statValueFromNumber(cases.length), helper: "Open and completed cases" },
        { label: "Submitted", value: statValueFromNumber(cases.filter((c: any) => String(c.status ?? "").toLowerCase().includes("submit")).length), helper: "New submissions" },
        { label: "Approved", value: statValueFromNumber(cases.filter((c: any) => String(c.status ?? "").toLowerCase().includes("approve")).length), helper: "Cleared cases" },
        { label: "Rejected", value: statValueFromNumber(cases.filter((c: any) => String(c.status ?? "").toLowerCase().includes("reject")).length), helper: "Returned cases" },
      ],
      sections: [
        { title: "Cases", subtitle: "HR-managed offboarding pipeline.", items: cases.map((item: any) => ({ title: item.offboarding_type ?? item.reason ?? "Offboarding", subtitle: `${textValue(item.employee_name ?? item.employee_id)} · ${formatDate(item.created_at ?? item.submission_date)}`, meta: textValue(item.status ?? "Submitted"), tone: String(item.status ?? "").toLowerCase().includes("approve") ? "success" : "warning" })) },
      ],
    };
  },
});

// HROfficerApprovalsScreen moved to src/screens/HROfficerApprovalsScreen.tsx (interactive with approve/reject tabs)

export const HROfficerPerformanceScreen = createBackendScreen({
  role: "hr",
  activeScreen: "Performance",
  load: async ({ session }) => {
    const [goals, evaluations] = await Promise.all([
      fetchJson("/performance/goals/all").catch(() => []),
      fetchJson("/performance/evaluations/all").catch(() => []),
    ]);

    return {
      eyebrow: "HR Performance",
      title: "Performance Management",
      subtitle: `Organization-wide performance data for ${nameOf(session)}.`,
      stats: [
        { label: "Goals", value: statValueFromNumber(toArray(goals).length), helper: "All company goals" },
        { label: "Evaluations", value: statValueFromNumber(toArray(evaluations).length), helper: "All reviews" },
        { label: "Approved", value: statValueFromNumber(toArray(goals).filter((g: any) => String(g.status ?? "").toLowerCase().includes("approve")).length), helper: "Approved goals" },
        { label: "Open", value: statValueFromNumber(toArray(goals).filter((g: any) => !String(g.status ?? "").toLowerCase().includes("complete")).length), helper: "Active goals" },
      ],
      sections: [
        { title: "All Goals", subtitle: "Company-wide goal list.", items: toArray(goals).map((item: any) => ({ title: item.goal_name ?? item.title ?? "Goal", subtitle: textValue(item.user_name ?? item.user_id ?? item.status), meta: textValue(item.status ?? item.progress_pct ?? "Open"), tone: Number(item.progress_pct ?? 0) >= 80 ? "success" : "warning" })) },
        { title: "All Evaluations", subtitle: "Performance review history.", items: toArray(evaluations).map((item: any) => ({ title: item.review_type ?? "Evaluation", subtitle: textValue(item.rating_status ?? item.perf_status ?? item.review_period), meta: textValue(item.perf_status ?? "Review"), tone: String(item.perf_status ?? "").toLowerCase().includes("ack") ? "success" : "default" })) },
      ],
    };
  },
});

export const HROfficerPayslipsScreen = createBackendScreen({
  role: "hr",
  activeScreen: "Payslips",
  load: async () => {
    const periods = toArray(await fetchJson("/cnb/payroll/periods").catch(() => []));
    return {
      eyebrow: "Compensation",
      title: "Payroll Periods",
      subtitle: "View payroll periods and generated payslip batches.",
      stats: [
        { label: "Periods", value: statValueFromNumber(periods.length), helper: "Payroll runs" },
        { label: "Draft", value: statValueFromNumber(periods.filter((p: any) => String(p.status ?? "").toLowerCase().includes("draft")).length), helper: "Unprocessed" },
        { label: "Processed", value: statValueFromNumber(periods.filter((p: any) => String(p.status ?? "").toLowerCase().includes("processed")).length), helper: "Completed" },
        { label: "Pending", value: statValueFromNumber(periods.filter((p: any) => String(p.status ?? "").toLowerCase().includes("pending")).length), helper: "Review queue" },
      ],
      sections: [
        { title: "Payroll Periods", subtitle: "Company payroll windows.", items: periods.map((item: any) => ({ title: `${formatDate(item.cutoff_start_date)} → ${formatDate(item.cutoff_end_date)}`, subtitle: `${textValue(item.status ?? "Draft")} · Payout ${formatDate(item.payout_date)}`, meta: textValue(item.status ?? "Draft") })) },
      ],
    };
  },
});

export const SystemAdminTimekeepingScreen = createBackendScreen({
  role: "system_admin",
  activeScreen: "Timekeeping",
  load: async ({ session }) => {
    const [absenceRequests, employees] = await Promise.all([
      fetchJson("/timekeeping/absence-requests?status=PENDING").catch(() => []),
      fetchJson("/timekeeping/employees").catch(() => []),
    ]);

    return {
      eyebrow: "Timekeeping",
      title: "System Admin Timekeeping",
      subtitle: `Organization timekeeping overview for ${nameOf(session)}.`,
      stats: [
        { label: "Absences", value: statValueFromNumber(toArray(absenceRequests).length), helper: "Pending reviews" },
        { label: "Employees", value: statValueFromNumber(toArray(employees).length), helper: "Eligible staff" },
        { label: "Reviewed", value: statValueFromNumber(toArray(absenceRequests).filter((r: any) => String(r.status ?? "").toLowerCase().includes("approve")).length), helper: "Approved absences" },
        { label: "Denied", value: statValueFromNumber(toArray(absenceRequests).filter((r: any) => String(r.status ?? "").toLowerCase().includes("deny")).length), helper: "Denied absences" },
      ],
      sections: [
        { title: "Absence Requests", subtitle: "Company-wide absence queue.", items: toArray(absenceRequests).map((item: any) => ({ title: textValue(item.employee_name ?? item.employee_id), subtitle: `${formatDate(item.date)} · ${item.absence_reason ?? item.review_reason ?? "Absence"}`, meta: textValue(item.status ?? "Pending"), tone: String(item.status ?? "").toLowerCase().includes("approve") ? "success" : "warning" })) },
      ],
    };
  },
});

export const SystemAdminOffboardingScreen = createBackendScreen({
  role: "system_admin",
  activeScreen: "Offboarding",
  load: async ({ session }) => {
    const [auditLogs, templates] = await Promise.all([
      fetchJson("/offboarding/system-admin/audit-logs").catch(() => []),
      fetchJson(`/offboarding/system-admin/tenants/${encodeURIComponent(session.userId || session.email || "current")}/checklist-templates`).catch(() => []),
    ]);

    return {
      eyebrow: "Offboarding",
      title: "System Admin Offboarding",
      subtitle: `Tenant offboarding audit and template controls for ${nameOf(session)}.`,
      stats: [
        { label: "Audit Logs", value: statValueFromNumber(toArray(auditLogs).length), helper: "Cross-tenant history" },
        { label: "Templates", value: statValueFromNumber(toArray(templates).length), helper: "Tenant templates" },
        { label: "Enabled", value: "Yes", helper: "Module control" },
        { label: "Scope", value: "All Tenants", helper: "System admin access" },
      ],
      sections: [
        { title: "Offboarding Audit Logs", subtitle: "Recent module activity.", items: toArray(auditLogs).map((item: any) => ({ title: item.action_type ?? item.action ?? "Audit entry", subtitle: `${textValue(item.company_id)} · ${textValue(item.target_table ?? item.target_record_id ?? "Record")}`, meta: formatDate(item.timestamp ?? item.created_at), tone: "default" })) },
        { title: "Checklist Templates", subtitle: "Tenant-specific offboarding templates.", items: toArray(templates).map((item: any) => ({ title: item.template_name ?? item.name ?? "Template", subtitle: textValue(item.description ?? item.employee_type ?? item.is_default), meta: textValue(item.is_default ? "Default" : "Custom"), tone: item.is_default ? "success" : "default" })) },
      ],
    };
  },
});

export const SystemAdminApprovalsScreen = createBackendScreen({
  role: "system_admin",
  activeScreen: "Approvals",
  load: async ({ session }) => {
    const [leaveRequests, documents, goals] = await Promise.all([
      fetchJson("/leave/requests?status=Pending").catch(() => []),
      fetchJson("/users/documents/pending").catch(() => []),
      fetchJson("/performance/goals/all").catch(() => []),
    ]);

    return {
      eyebrow: "Approvals",
      title: "System Admin Approvals",
      subtitle: `Cross-module approval queue for ${nameOf(session)}.`,
      stats: [
        { label: "Leave", value: statValueFromNumber(toArray(leaveRequests).length), helper: "Pending leave requests" },
        { label: "Documents", value: statValueFromNumber(toArray(documents).length), helper: "Pending documents" },
        { label: "Goals", value: statValueFromNumber(toArray(goals).length), helper: "Performance goals" },
        { label: "Total", value: statValueFromNumber(toArray(leaveRequests).length + toArray(documents).length + toArray(goals).length), helper: "Combined queue" },
      ],
      sections: [
        { title: "Leave Requests", subtitle: "Awaiting review.", items: toArray(leaveRequests).map((item: any) => ({ title: `${formatDate(item.start_date)} → ${formatDate(item.end_date)}`, subtitle: item.reason ?? item.leave_type ?? "Leave request", meta: textValue(item.status ?? "Pending"), tone: "warning" })) },
        { title: "Documents", subtitle: "HR document queue.", items: toArray(documents).map((item: any) => ({ title: item.document_type ?? item.file_name ?? "Document", subtitle: textValue(item.employee_name ?? item.user_id), meta: textValue(item.status ?? "Pending"), tone: "warning" })) },
      ],
    };
  },
});

export const SystemAdminCompensationSettingsScreen = createBackendScreen({
  role: "system_admin",
  activeScreen: "Compensation Settings",
  load: async ({ session }) => {
    const [statutory, benefits, brackets, baselines] = await Promise.all([
      fetchJson("/cnb/statutory-deduction-config").catch(() => null),
      fetchJson("/cnb/benefits-catalog").catch(() => []),
      fetchJson("/cnb/tax-brackets").catch(() => []),
      fetchJson("/cnb/salary-baselines").catch(() => []),
    ]);

    return {
      eyebrow: "Compensation",
      title: "Compensation Settings",
      subtitle: `C&B configuration for ${nameOf(session)}.`,
      stats: [
        { label: "Benefits", value: statValueFromNumber(toArray(benefits).length), helper: "Benefit catalog items" },
        { label: "Tax Brackets", value: statValueFromNumber(toArray(brackets).length), helper: "Configured brackets" },
        { label: "Baselines", value: statValueFromNumber(toArray(baselines).length), helper: "Salary baselines" },
        { label: "Config", value: statutory ? "Loaded" : "Missing", helper: "Deduction defaults" },
      ],
      sections: [
        { title: "Statutory Defaults", subtitle: "Current deduction config.", items: statutory ? buildKeyValueItems(statutory, [["SSS Type", "sss_type"], ["SSS Value", "sss_value"], ["PhilHealth Type", "philhealth_type"], ["PhilHealth Value", "philhealth_value"], ["Pag-IBIG Type", "pagibig_type"], ["Pag-IBIG Value", "pagibig_value"]]) : [] },
        { title: "Benefits Catalog", subtitle: "Existing company benefits.", items: toArray(benefits).map((item: any) => ({ title: item.benefit_name ?? item.name ?? "Benefit", subtitle: `${textValue(item.benefit_type ?? item.type)} · ${formatMoney(item.default_amount ?? item.amount)}`, meta: item.is_active === false ? "Inactive" : "Active", tone: item.is_active === false ? "danger" : "success" })) },
      ],
    };
  },
});

export const SystemAdminSubscriptionsScreen = createBackendScreen({
  role: "system_admin",
  activeScreen: "Subscriptions",
  load: async () => {
    const plans = toArray(await fetchJson("/subscription/plans").catch(() => []));
    return {
      eyebrow: "Subscription",
      title: "Subscription Plans",
      subtitle: "Plans exposed by the shared backend.",
      stats: [
        { label: "Plans", value: statValueFromNumber(plans.length), helper: "Available tiers" },
        { label: "Monthly", value: statValueFromNumber(plans.filter((p: any) => String(p.billing_cycle ?? p.interval ?? "").toLowerCase().includes("month")).length), helper: "Monthly options" },
        { label: "Annual", value: statValueFromNumber(plans.filter((p: any) => String(p.billing_cycle ?? p.interval ?? "").toLowerCase().includes("year")).length), helper: "Annual options" },
        { label: "Active", value: statValueFromNumber(plans.filter((p: any) => p.is_active !== false).length), helper: "Live plans" },
      ],
      sections: [
        { title: "Plans", subtitle: "Subscription catalog.", items: plans.map((item: any) => ({ title: item.plan_name ?? item.name ?? "Plan", subtitle: `${textValue(item.description ?? item.features ?? "No description")} · ${formatMoney(item.price ?? item.amount ?? 0)}`, meta: textValue(item.billing_cycle ?? item.interval ?? "Plan"), tone: item.is_active === false ? "danger" : "success" })) },
      ],
    };
  },
});

export const SystemAdminPerformanceSettingsScreen = createBackendScreen({
  role: "system_admin",
  activeScreen: "Performance Settings",
  load: async ({ session }) => {
    const settings = await fetchJson("/performance/settings/full").catch(() => null);
    return {
      eyebrow: "Performance",
      title: "Performance Settings",
      subtitle: `Module-wide performance settings for ${nameOf(session)}.`,
      stats: [
        { label: "Module", value: textValue(settings?.module_enabled ?? true), helper: "Performance module enabled" },
        { label: "Auto Bonus", value: textValue(settings?.auto_compute_bonuses ?? false), helper: "Bonus automation" },
        { label: "Self Goals", value: textValue(settings?.self_proposed_goals_enabled ?? true), helper: "Employee goal setting" },
        { label: "PIP Attempts", value: textValue(settings?.pip_max_attempts ?? 2), helper: "Default retry count" },
      ],
      sections: [
        { title: "Performance Settings", subtitle: "Full backend configuration.", items: settings ? buildKeyValueItems(settings, [["Cycle Enabled", "module_enabled"], ["Self Proposed Goals", "self_proposed_goals_enabled"], ["Auto Compute Bonuses", "auto_compute_bonuses"], ["KPI Suggestions", "kpi_suggestions_enabled"], ["PIP Max Attempts", "pip_max_attempts"], ["PIP Duration Days", "pip_default_duration_days"], ["Failure Action", "pip_failure_action"], ["Rating 1", "rating_label_1"], ["Rating 5", "rating_label_5"]]) : [] },
      ],
    };
  },
});

// EmployeeOvertimeScreen moved to src/screens/EmployeeOvertimeScreen.tsx (interactive with OT filing form)

export const HROfficerPayrollScreen = createBackendScreen({
  role: "hr",
  activeScreen: "Payroll",
  load: async ({ session }) => {
    const [periods, baselines, catalog] = await Promise.all([
      fetchJson("/cnb/payroll/periods").catch(() => []),
      fetchJson("/cnb/salary-baselines").catch(() => []),
      fetchJson("/cnb/benefits-catalog").catch(() => []),
    ]);

    const periodRows = toArray(periods).map((item: any) => ({
      title: `${formatDate(item.cutoff_start_date)} → ${formatDate(item.cutoff_end_date)}`,
      subtitle: `Payout: ${formatDate(item.payout_date)} · ${textValue(item.status ?? "Draft")}`,
      meta: textValue(item.status ?? "Draft"),
      tone: String(item.status ?? "").toLowerCase().includes("processed") || String(item.status ?? "").toLowerCase().includes("released") ? "success" : "warning" as SectionItem["tone"],
    }));

    const baselineRows = toArray(baselines).map((item: any) => ({
      title: `${textValue(item.first_name ?? "")} ${textValue(item.last_name ?? "")}`.trim() || textValue(item.user_id),
      subtitle: `${formatMoney(item.basic_salary)} · ${textValue(item.pay_frequency ?? "monthly")} · Effective ${formatDate(item.effective_date)}`,
      meta: textValue(item.pay_frequency ?? "monthly"),
      tone: "default" as SectionItem["tone"],
    }));

    const draft = toArray(periods).filter((p: any) => String(p.status ?? "").toLowerCase().includes("draft")).length;
    const processed = toArray(periods).filter((p: any) => String(p.status ?? "").toLowerCase().includes("processed") || String(p.status ?? "").toLowerCase().includes("released")).length;

    return {
      eyebrow: "Compensation & Benefits",
      title: "Payroll Management",
      subtitle: `Run payroll, manage salary baselines, and review benefit catalog for ${nameOf(session)}.`,
      stats: [
        { label: "Payroll Periods", value: statValueFromNumber(toArray(periods).length), helper: "Total runs" },
        { label: "Processed", value: statValueFromNumber(processed), helper: "Completed periods" },
        { label: "Draft", value: statValueFromNumber(draft), helper: "Pending periods" },
        { label: "Benefits", value: statValueFromNumber(toArray(catalog).length), helper: "Catalog items" },
      ],
      actions: [
        { label: "Payslips", route: "HROfficerPayslips", icon: "receipt-outline" },
        { label: "Timekeeping", route: "HROfficerTimekeeping", icon: "time-outline" },
      ],
      sections: [
        {
          title: "Payroll Periods",
          subtitle: "Recent payroll cutoff runs.",
          items: periodRows.length > 0 ? periodRows : [{ title: "No payroll periods yet.", subtitle: "Run payroll from the web portal.", meta: "Info", tone: "default" }],
        },
        {
          title: "Salary Baselines",
          subtitle: "Current employee salary records.",
          items: baselineRows.length > 0 ? baselineRows : [{ title: "No salary baselines set.", subtitle: "Set baselines from the web portal.", meta: "Info", tone: "default" }],
        },
      ],
    };
  },
});

export const SystemAdminSettingsScreen = createBackendScreen({
  role: "system_admin",
  activeScreen: "Settings",
  load: async ({ session }) => {
    const [tenantConfig, modules, permissions] = await Promise.all([
      fetchJson("/users/tenant-config").catch(() => null),
      fetchJson("/users/tenant-modules").catch(() => []),
      fetchJson("/users/hr-lifecycle/permissions").catch(() => []),
    ]);

    return {
      eyebrow: "System Settings",
      title: "Tenant Settings",
      subtitle: `Tenant configuration and lifecycle permissions for ${nameOf(session)}.`,
      stats: [
        { label: "Modules", value: statValueFromNumber(toArray(modules).length), helper: "Tenant modules" },
        { label: "Permissions", value: statValueFromNumber(toArray(permissions).length), helper: "Lifecycle permissions" },
        { label: "Timezone", value: textValue(tenantConfig?.timezone ?? "Asia/Manila"), helper: "Tenant locale" },
        { label: "Currency", value: textValue(tenantConfig?.currency ?? "PHP"), helper: "Payroll currency" },
      ],
      sections: [
        { title: "Tenant Configuration", subtitle: "Shared org and payroll settings.", items: tenantConfig ? buildKeyValueItems(tenantConfig, [["Timezone", "timezone"], ["Date Format", "date_format"], ["Currency", "currency"], ["Org Structure", "org_structure"]]) : [] },
        { title: "Tenant Modules", subtitle: "Active module list.", items: toArray(modules).map((item: any) => ({ title: item.module_name ?? item.name ?? "Module", subtitle: textValue(item.status ?? "Inactive"), meta: textValue(item.status ?? "Inactive"), tone: String(item.status ?? "").toLowerCase() === "active" ? "success" : "warning" })) },
      ],
    };
  },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F1F5F9" },
  layout: { flex: 1, flexDirection: "row", backgroundColor: "#F1F5F9" },
  mainContent: { flex: 1, backgroundColor: "#F1F5F9" },
  scroll: { flex: 1, backgroundColor: "#F1F5F9" },
  content: { padding: 16, paddingBottom: 28 },
  heroCard: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 20, padding: 20, marginBottom: 16 },
  heroEyebrow: { fontSize: 12, fontWeight: "800", color: "#DBEAFE", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  heroTitle: { fontSize: 24, fontWeight: "800", color: "#FFFFFF", marginBottom: 8 },
  heroSubtitle: { fontSize: 14, lineHeight: 22, color: "rgba(255,255,255,0.82)" },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  actionButton: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  actionButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  statCard: { minWidth: 150, flex: 1, backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E2E8F0", padding: 16 },
  statLabel: { fontSize: 12, color: "#64748B", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  statValue: { fontSize: 22, color: "#0F172A", fontWeight: "800", marginTop: 8 },
  statHelper: { marginTop: 4, fontSize: 12, color: "#94A3B8" },
  sectionCard: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 20, padding: 16, marginBottom: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  sectionSubtitle: { fontSize: 13, color: "#64748B", marginTop: 4, lineHeight: 20 },
  sectionList: { gap: 2 },
  itemRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
  itemRowBorder: { borderBottomWidth: 1, borderBottomColor: "#EEF2F7" },
  itemTextWrap: { flex: 1, paddingRight: 10 },
  itemTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  itemSubtitle: { fontSize: 12, color: "#64748B", marginTop: 3, lineHeight: 18 },
  itemPill: { minWidth: 78, alignItems: "center", justifyContent: "center", borderRadius: 999, borderWidth: 1, paddingVertical: 7, paddingHorizontal: 10 },
  itemPillText: { fontSize: 11, fontWeight: "800", color: "#334155", textTransform: "uppercase", letterSpacing: 0.4 },
  emptyText: { fontSize: 13, color: "#94A3B8", paddingVertical: 8 },
});
