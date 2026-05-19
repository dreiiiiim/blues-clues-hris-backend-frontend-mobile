import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  useWindowDimensions,
  Alert,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Sidebar } from "../components/Sidebar";
import { BottomTabBar, BOTTOM_TAB_HEIGHT } from "../components/BottomTabBar";
import { GradientHero } from "../components/GradientHero";
import { authFetch } from "../services/auth";
import { API_BASE_URL } from "../lib/api";

type SubscriptionPlan = {
  plan_id?: string;
  plan_name?: string;
  name?: string;
  description?: string;
  price?: number | string;
  amount?: number | string;
  billing_cycle?: string;
  interval?: string;
  is_active?: boolean;
  features?: any;
};

type CompanyRegistration = {
  registration_id?: string;
  subscription_plan?: string;
  billing_cycle?: string;
  payment_status?: string;
  payment_date?: string;
  transaction_id?: string;
  subscription_status?: string;
  registered_date?: string;
  company_name?: string;
};

type UserStats = {
  total?: number;
  active?: number;
};

function formatDate(val?: string | null): string {
  if (!val) return "—";
  const d = new Date(val);
  return isNaN(d.getTime())
    ? val
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatMoney(val?: number | string | null): string {
  const n = Number(val);
  if (!val || isNaN(n)) return "—";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(n);
}

export function SystemAdminBillingScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const session = route.params?.session ?? { name: "Admin", email: "", role: "system_admin" };
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [registration, setRegistration] = useState<CompanyRegistration | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [plansRes, registrationRes, statsRes] = await Promise.allSettled([
        authFetch(`${API_BASE_URL}/subscription/plans`),
        authFetch(`${API_BASE_URL}/subscription/my-registration`),
        authFetch(`${API_BASE_URL}/users/stats`),
      ]);

      if (plansRes.status === "fulfilled" && plansRes.value.ok) {
        const data = await plansRes.value.json().catch(() => []);
        setPlans(Array.isArray(data) ? data : data?.data ?? []);
      }
      if (registrationRes.status === "fulfilled" && registrationRes.value.ok) {
        const data = await registrationRes.value.json().catch(() => null);
        setRegistration(data?.data ?? data ?? null);
      }
      if (statsRes.status === "fulfilled" && statsRes.value.ok) {
        const data = await statsRes.value.json().catch(() => null);
        setStats(data);
      }
    } catch {
      // silent — show empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const activePlan = plans.find((p) => p.is_active !== false);
  const planName = registration?.subscription_plan ?? activePlan?.plan_name ?? activePlan?.name ?? "—";
  const billingCycle = registration?.billing_cycle ?? activePlan?.billing_cycle ?? activePlan?.interval ?? "—";
  const planPrice = activePlan?.price ?? activePlan?.amount;
  const totalSeats = stats?.total ?? stats?.active ?? null;
  const renewalDate = registration?.payment_date
    ? formatDate(registration.payment_date)
    : "—";
  const subscriptionStatus = registration?.subscription_status ?? registration?.payment_status ?? "—";

  const summaryCards = [
    { label: "Current Plan",   value: planName,                    helper: billingCycle !== "—" ? `${billingCycle} billing` : "Subscription tier" },
    { label: "Active Seats",   value: totalSeats != null ? String(totalSeats) : "—", helper: "Total system users" },
    { label: "Plan Price",     value: planPrice ? formatMoney(planPrice) : "—",      helper: "Per billing period" },
    { label: "Renewal / Last Payment", value: renewalDate,         helper: subscriptionStatus },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.layout}>
        {!isMobile && (
          <Sidebar
            role="system_admin"
            userName={session.name}
            email={session.email}
            activeScreen="Billing"
            navigation={navigation}
          />
        )}

        <View style={styles.mainContent}>
          <ScrollView
            style={styles.container}
            contentContainerStyle={[styles.content, isMobile && { paddingBottom: BOTTOM_TAB_HEIGHT + 16 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            <GradientHero style={styles.heroCard}>
              <Text style={[styles.eyebrow, { color: "rgba(255,255,255,0.75)" }]}>System Admin</Text>
              <Text style={[styles.title, { color: "#FFFFFF" }]}>Billing & Subscription</Text>
              <Text style={[styles.subtitle, { color: "rgba(255,255,255,0.78)" }]}>
                Review subscription plan details, seats, renewal information,
                and available plans.
              </Text>
            </GradientHero>

            {loading ? (
              <ActivityIndicator style={{ marginTop: 32 }} color="#2563EB" />
            ) : (
              <>
                {/* Summary tiles */}
                <View style={styles.summaryRow}>
                  {summaryCards.map((card) => (
                    <View key={card.label} style={styles.summaryCard}>
                      <Text style={styles.summaryLabel}>{card.label}</Text>
                      <Text style={styles.summaryValue} numberOfLines={1}>{card.value}</Text>
                      <Text style={styles.summaryHelper}>{card.helper}</Text>
                    </View>
                  ))}
                </View>

                {/* Plan actions */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Plan Actions</Text>
                  <View style={styles.actionRow}>
                    <Pressable
                      style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.7 }]}
                      onPress={() => Alert.alert("Manage Seats", "Contact your account manager to adjust your license count.")}
                    >
                      <Text style={styles.actionTitle}>Manage Seats →</Text>
                      <Text style={styles.actionText}>Adjust license count based on current staffing.</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.7 }]}
                      onPress={() => Alert.alert("Update Payment", "Contact billing support to update your payment method.")}
                    >
                      <Text style={styles.actionTitle}>Update Payment →</Text>
                      <Text style={styles.actionText}>Review billing method and subscription settings.</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.7 }]}
                      onPress={() => Alert.alert("Download Invoice", "Invoice download will be available in the next update.")}
                    >
                      <Text style={styles.actionTitle}>Download Invoice →</Text>
                      <Text style={styles.actionText}>Access billing statements and recent invoices.</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Available plans */}
                {plans.length > 0 && (
                  <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Subscription Plans</Text>
                    {plans.map((plan, index) => {
                      const name = plan.plan_name ?? plan.name ?? "Plan";
                      const price = plan.price ?? plan.amount;
                      const cycle = plan.billing_cycle ?? plan.interval ?? "";
                      const isLast = index === plans.length - 1;
                      return (
                        <View
                          key={plan.plan_id ?? String(index)}
                          style={[styles.historyRow, !isLast && styles.historyDivider]}
                        >
                          <View style={styles.historyTextWrap}>
                            <Text style={styles.historyTitle}>{name}</Text>
                            {plan.description ? (
                              <Text style={styles.historySubtitle} numberOfLines={2}>{plan.description}</Text>
                            ) : null}
                            {cycle ? <Text style={styles.historyDate}>{cycle}</Text> : null}
                          </View>
                          <Text style={styles.historyAmount}>
                            {price ? formatMoney(price) : "—"}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Registration details */}
                {registration && (
                  <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Registration Info</Text>
                    {[
                      ["Company", registration.company_name ?? "—"],
                      ["Status", registration.subscription_status ?? registration.payment_status ?? "—"],
                      ["Billing Cycle", registration.billing_cycle ?? "—"],
                      ["Payment Date", formatDate(registration.payment_date)],
                      ["Transaction ID", registration.transaction_id ?? "—"],
                      ["Registered", formatDate(registration.registered_date)],
                    ].map(([label, value], i, arr) => (
                      <View key={label} style={[styles.historyRow, i < arr.length - 1 && styles.historyDivider]}>
                        <Text style={[styles.historySubtitle, { flex: 1 }]}>{label}</Text>
                        <Text style={styles.historyTitle} numberOfLines={1}>{value}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {!registration && plans.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No billing data available from the backend.</Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {isMobile && (
            <BottomTabBar role="system_admin" activeScreen="Subscriptions" navigation={navigation} session={session} />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

export default SystemAdminBillingScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F1F5F9" },
  layout: { flex: 1, flexDirection: "row", backgroundColor: "#F1F5F9" },
  mainContent: { flex: 1, backgroundColor: "#F1F5F9" },
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  content: { padding: 16, paddingBottom: 28 },
  heroCard: {
    backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0",
    borderRadius: 20, padding: 20, marginBottom: 16,
  },
  eyebrow: {
    fontSize: 12, fontWeight: "800", color: "#2563EB",
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8,
  },
  title: { fontSize: 24, fontWeight: "800", color: "#0F172A", marginBottom: 8 },
  subtitle: { fontSize: 14, lineHeight: 22, color: "#64748B" },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 16 },
  summaryCard: {
    backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0",
    borderRadius: 18, padding: 16, minWidth: 160, flexGrow: 1,
    marginRight: 12, marginBottom: 12,
  },
  summaryLabel: { fontSize: 13, fontWeight: "700", color: "#64748B", marginBottom: 8 },
  summaryValue: { fontSize: 22, fontWeight: "800", color: "#0F172A", marginBottom: 6 },
  summaryHelper: { fontSize: 12, lineHeight: 18, color: "#94A3B8", fontWeight: "600" },
  sectionCard: {
    backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0",
    borderRadius: 20, padding: 18, marginBottom: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#0F172A", marginBottom: 16 },
  actionRow: { flexDirection: "row", flexWrap: "wrap" },
  actionCard: {
    backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0",
    borderRadius: 18, padding: 16, minWidth: 220, flexGrow: 1,
    marginRight: 12, marginBottom: 12,
  },
  actionTitle: { fontSize: 15, fontWeight: "800", color: "#0F172A", marginBottom: 8 },
  actionText: { fontSize: 13, lineHeight: 20, color: "#64748B" },
  historyRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", paddingVertical: 12,
  },
  historyDivider: { borderBottomWidth: 1, borderBottomColor: "#EEF2F7" },
  historyTextWrap: { flex: 1, paddingRight: 12 },
  historyTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A", marginBottom: 3 },
  historySubtitle: { fontSize: 13, lineHeight: 20, color: "#64748B", marginBottom: 3 },
  historyDate: { fontSize: 11, fontWeight: "700", color: "#94A3B8" },
  historyAmount: { fontSize: 14, fontWeight: "800", color: "#0F172A", marginTop: 2 },
  emptyState: { alignItems: "center", paddingVertical: 32 },
  emptyText: { color: "#94A3B8", fontSize: 14 },
});
