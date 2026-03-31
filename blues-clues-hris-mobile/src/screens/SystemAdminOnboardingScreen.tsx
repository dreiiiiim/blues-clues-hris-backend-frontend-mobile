import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Sidebar } from "../components/Sidebar";
import { MobileRoleMenu } from "../components/MobileRoleMenu";
import { Header } from "../components/Header";
import { GradientHero } from "../components/GradientHero";
import { UserSession, authFetch } from "../services/auth";
import { API_BASE_URL } from "../lib/api";

type TemplateItem = {
  item_id: string;
  type: string;
  tab_category: string;
  title: string;
  is_required: boolean;
};

type OnboardingTemplate = {
  template_id: string;
  name: string;
  department_id: string;
  position_id: string;
  default_deadline_days: number;
  created_at: string;
  template_items: TemplateItem[];
  position_name?: string | null;
  department_name?: string | null;
};

export const SystemAdminOnboardingScreen = ({ route, navigation }: any) => {
  const session: UserSession = route.params.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authFetch(`${API_BASE_URL}/onboarding/system-admin/templates`)
      .then(res => res.json())
      .then(data => setTemplates(Array.isArray(data) ? data : []))
      .catch(() => setError("Failed to load templates."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        {!isMobile && (
          <Sidebar role={session.role as any} activeScreen="SystemAdminOnboarding" navigation={navigation} session={session} />
        )}
        <View style={styles.content}>
          <Header
            title="Onboarding Templates"
            subtitle="Manage onboarding templates and assignments"
            rightElement={
              <MobileRoleMenu
                role={session.role as any}
                userName={session.name}
                email={session.email}
                activeScreen="SystemAdminOnboarding"
                navigation={navigation}
              />
            }
          />

          <GradientHero
            title="Template Management"
            subtitle="Create and manage onboarding templates"
          />

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{templates.length}</Text>
                <Text style={styles.statLabel}>Templates</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>
                  {templates.reduce((acc, t) => acc + (t.template_items?.length ?? 0), 0)}
                </Text>
                <Text style={styles.statLabel}>Total Items</Text>
              </View>
            </View>

            {loading && (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color="#1E40AF" />
                <Text style={styles.loadingText}>Loading templates...</Text>
              </View>
            )}

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {!loading && !error && templates.length === 0 && (
              <Text style={styles.emptyText}>No templates found. Create one from the web admin panel.</Text>
            )}

            {templates.map(template => {
              const items = template.template_items || [];
              const docCount = items.filter(i => i.tab_category === "documents").length;
              const taskCount = items.filter(i => i.tab_category === "tasks").length;
              const equipCount = items.filter(i => i.tab_category === "equipment").length;
              const formCount = items.filter(i => i.tab_category === "hr_forms").length;
              const profileCount = items.filter(i => i.tab_category === "profile").length;
              const welcomeCount = items.filter(i => i.tab_category === "welcome").length;
              return (
                <View key={template.template_id} style={styles.templateCard}>
                  <Text style={styles.templateName}>{template.name}</Text>
                  <Text style={styles.templateMeta}>
                    {template.position_name ?? template.position_id} • {template.department_name ?? template.department_id}
                  </Text>
                  <Text style={styles.templateMeta}>
                    Deadline: {template.default_deadline_days} days
                  </Text>
                  <Text style={styles.templateCreated}>
                    Created: {new Date(template.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                  </Text>

                  <View style={styles.itemsSummary}>
                    <View style={styles.itemChip}>
                      <Text style={styles.itemChipNum}>{docCount}</Text>
                      <Text style={styles.itemChipLabel}>Docs</Text>
                    </View>
                    <View style={styles.itemChip}>
                      <Text style={styles.itemChipNum}>{taskCount}</Text>
                      <Text style={styles.itemChipLabel}>Tasks</Text>
                    </View>
                    <View style={styles.itemChip}>
                      <Text style={styles.itemChipNum}>{equipCount}</Text>
                      <Text style={styles.itemChipLabel}>Equipment</Text>
                    </View>
                    <View style={styles.itemChip}>
                      <Text style={styles.itemChipNum}>{formCount}</Text>
                      <Text style={styles.itemChipLabel}>Forms</Text>
                    </View>
                    {profileCount > 0 && (
                      <View style={styles.itemChip}>
                        <Text style={styles.itemChipNum}>{profileCount}</Text>
                        <Text style={styles.itemChipLabel}>Profile</Text>
                      </View>
                    )}
                    {welcomeCount > 0 && (
                      <View style={styles.itemChip}>
                        <Text style={styles.itemChipNum}>{welcomeCount}</Text>
                        <Text style={styles.itemChipLabel}>Welcome</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  inner: { flex: 1, flexDirection: "row" },
  content: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  statCard: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 10, padding: 14, borderLeftWidth: 4, borderLeftColor: "#1E40AF", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  statNum: { fontSize: 24, fontWeight: "800", color: "#1E293B" },
  statLabel: { fontSize: 11, color: "#64748B", marginTop: 2 },
  centered: { alignItems: "center", paddingVertical: 40 },
  loadingText: { marginTop: 12, color: "#64748B" },
  errorBox: { backgroundColor: "#FEF2F2", borderRadius: 8, padding: 16, borderWidth: 1, borderColor: "#FECACA" },
  errorText: { color: "#B91C1C", fontSize: 14 },
  emptyText: { color: "#64748B", textAlign: "center", paddingVertical: 24 },
  templateCard: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  templateName: { fontSize: 16, fontWeight: "700", color: "#1E293B", marginBottom: 4 },
  templateMeta: { fontSize: 13, color: "#3B82F6", fontWeight: "600", marginBottom: 2 },
  templateCreated: { fontSize: 11, color: "#94A3B8", marginBottom: 12 },
  itemsSummary: { flexDirection: "row", gap: 8 },
  itemChip: { flex: 1, backgroundColor: "#F1F5F9", borderRadius: 8, padding: 8, alignItems: "center" },
  itemChipNum: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  itemChipLabel: { fontSize: 10, color: "#64748B", marginTop: 1 },
});
