import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Sidebar } from "../components/Sidebar";
import { BottomTabBar, BOTTOM_TAB_HEIGHT } from "../components/BottomTabBar";
import { GradientHero } from "../components/GradientHero";
import { authFetch, type UserSession } from "../services/auth";
import { API_BASE_URL } from "../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type PlanTier = "Starter" | "Professional" | "Enterprise";
type SubscriptionStatus = "active" | "trial" | "expired" | "cancelled";

type Subscription = {
  subscription_id: string;
  company_id: string;
  company_name: string;
  plan: PlanTier;
  amount: number;
  status: SubscriptionStatus;
  next_renewal: string;
  mrr: number;
  seats_used: number;
  seats_limit: number;
};

type PlanConfig = {
  plan: PlanTier;
  price: number;
  seats: number;
  features: string[];
};

type BillingStats = {
  total_mrr: number;
  active_subscriptions: number;
  trial_accounts: number;
  expiring_soon: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_TONES: Record<SubscriptionStatus, { bg: string; border: string; text: string }> = {
  active:    { bg: "#F0FDF4", border: "#BBF7D0", text: "#15803D" },
  trial:     { bg: "#EFF6FF", border: "#BFDBFE", text: "#1D4ED8" },
  expired:   { bg: "#FEF2F2", border: "#FECACA", text: "#B91C1C" },
  cancelled: { bg: "#F1F5F9", border: "#E2E8F0", text: "#64748B" },
};

const PLAN_TONES: Record<PlanTier, { bg: string; text: string }> = {
  Starter:      { bg: "#F1F5F9", text: "#64748B" },
  Professional: { bg: "#F5F3FF", text: "#7C3AED" },
  Enterprise:   { bg: "#FFFBEB", text: "#B45309" },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

function formatUSD(n: number) {
  return `$${n.toLocaleString()}`;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function SystemAdminSubscriptionsScreen({ route, navigation }: any) {
  const session: UserSession = route.params?.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [activeTab, setActiveTab] = useState<"subscriptions" | "plans">("subscriptions");
  const [expandedSub, setExpandedSub] = useState<string | null>(null);

  useEffect(() => {
    // These are mock endpoints — the web app uses static mock data.
    // We call /admin/subscriptions endpoints; they may return 404 if not implemented.
    Promise.all([
      authFetch(`${API_BASE_URL}/admin/subscriptions`).then(r => r.json()).catch(() => MOCK_SUBS),
      authFetch(`${API_BASE_URL}/admin/subscriptions/plans`).then(r => r.json()).catch(() => MOCK_PLANS),
      authFetch(`${API_BASE_URL}/admin/subscriptions/stats`).then(r => r.json()).catch(() => MOCK_STATS),
    ]).then(([subs, plns, stat]) => {
      setSubscriptions(Array.isArray(subs) ? subs : MOCK_SUBS);
      setPlans(Array.isArray(plns) ? plns : MOCK_PLANS);
      setStats(stat && !stat.message ? stat : MOCK_STATS);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}><ActivityIndicator size="large" color="#1E40AF" /><Text style={s.loadingText}>Loading subscriptions...</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.inner}>
        {!isMobile && (
          <Sidebar role="system_admin" userName={session?.name ?? ""} email={session?.email ?? ""} activeScreen="Subscriptions" navigation={navigation} />
        )}

        <View style={s.main}>
          <ScrollView
            style={s.scroll}
            contentContainerStyle={[s.scrollContent, isMobile && { paddingBottom: BOTTOM_TAB_HEIGHT + 8 }]}
            showsVerticalScrollIndicator={false}
          >
            <GradientHero>
              <Text style={s.heroEyebrow}>System Admin</Text>
              <Text style={s.heroTitle}>Subscriptions</Text>
              <Text style={s.heroSub}>Monitor tenant subscription status, billing, and plan configurations.</Text>
              {stats && (
                <View style={s.heroStats}>
                  <View style={s.heroStat}><Text style={s.heroStatLabel}>MRR</Text><Text style={s.heroStatValue}>{formatUSD(stats.total_mrr)}</Text></View>
                  <View style={s.heroStat}><Text style={s.heroStatLabel}>ACTIVE</Text><Text style={s.heroStatValue}>{stats.active_subscriptions}</Text></View>
                  <View style={s.heroStat}><Text style={s.heroStatLabel}>TRIALS</Text><Text style={s.heroStatValue}>{stats.trial_accounts}</Text></View>
                  <View style={s.heroStat}><Text style={s.heroStatLabel}>EXPIRING</Text><Text style={s.heroStatValue}>{stats.expiring_soon}</Text></View>
                </View>
              )}
            </GradientHero>

            {/* Tabs */}
            <View style={s.tabRow}>
              {(["subscriptions", "plans"] as const).map(tab => (
                <Pressable key={tab} style={[s.tab, activeTab === tab && s.activeTab]} onPress={() => setActiveTab(tab)}>
                  <Text style={[s.tabText, activeTab === tab && s.activeTabText]}>
                    {tab === "subscriptions" ? "Subscriptions" : "Plan Tiers"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* ── Subscriptions ────────────────────────────────────────────── */}
            {activeTab === "subscriptions" && (
              subscriptions.map(sub => {
                const tone = STATUS_TONES[sub.status];
                const planTone = PLAN_TONES[sub.plan];
                const days = daysUntil(sub.next_renewal);
                const isExpanded = expandedSub === sub.subscription_id;
                return (
                  <Pressable key={sub.subscription_id} style={s.subCard} onPress={() => setExpandedSub(isExpanded ? null : sub.subscription_id)}>
                    <View style={s.subTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.subName}>{sub.company_name}</Text>
                        <View style={s.subPills}>
                          <View style={[s.pill, { backgroundColor: planTone.bg }]}>
                            <Text style={[s.pillText, { color: planTone.text }]}>{sub.plan}</Text>
                          </View>
                          <View style={[s.pill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                            <Text style={[s.pillText, { color: tone.text }]}>{sub.status}</Text>
                          </View>
                        </View>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={s.subAmount}>{formatUSD(sub.mrr)}<Text style={s.subAmountUnit}>/mo</Text></Text>
                        <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color="#94A3B8" style={{ marginTop: 4 }} />
                      </View>
                    </View>

                    {isExpanded && (
                      <View style={s.subDetail}>
                        <View style={s.detailRow}><Text style={s.detailLabel}>Renewal</Text><Text style={s.detailValue}>{formatDate(sub.next_renewal)}{days <= 30 ? ` (${days} days)` : ""}</Text></View>
                        <View style={s.detailRow}><Text style={s.detailLabel}>Seats</Text><Text style={s.detailValue}>{sub.seats_used} / {sub.seats_limit}</Text></View>
                        <View style={s.seatsBar}>
                          <View style={[s.seatsBarFill, { width: `${Math.min(100, (sub.seats_used / sub.seats_limit) * 100)}%` as any }]} />
                        </View>
                        <View style={s.detailRow}><Text style={s.detailLabel}>Amount</Text><Text style={s.detailValue}>{formatUSD(sub.amount)}</Text></View>
                      </View>
                    )}
                  </Pressable>
                );
              })
            )}

            {/* ── Plans ────────────────────────────────────────────────────── */}
            {activeTab === "plans" && (
              plans.map(plan => {
                const tone = PLAN_TONES[plan.plan];
                return (
                  <View key={plan.plan} style={s.planCard}>
                    <View style={s.planTop}>
                      <View style={[s.planBadge, { backgroundColor: tone.bg }]}>
                        <Text style={[s.planBadgeText, { color: tone.text }]}>{plan.plan}</Text>
                      </View>
                      <Text style={s.planPrice}>{formatUSD(plan.price)}<Text style={s.planPriceUnit}>/mo</Text></Text>
                    </View>
                    <Text style={s.planSeats}>Up to {plan.seats} seats</Text>
                    {plan.features.map((f, i) => (
                      <View key={i} style={s.featureRow}>
                        <Ionicons name="checkmark-circle" size={14} color="#15803D" style={{ marginRight: 8, marginTop: 1 }} />
                        <Text style={s.featureText}>{f}</Text>
                      </View>
                    ))}
                  </View>
                );
              })
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

// Mock data matching what the web app uses (the endpoints return static data)
const MOCK_SUBS: Subscription[] = [
  { subscription_id: "sub-1", company_id: "c1", company_name: "Blue's Clues Inc.",   plan: "Enterprise",   amount: 4999, status: "active",    next_renewal: "2026-04-15", mrr: 4999, seats_used: 342, seats_limit: 500 },
  { subscription_id: "sub-2", company_id: "c2", company_name: "Acme Corporation",    plan: "Professional", amount: 499,  status: "active",    next_renewal: "2026-04-20", mrr: 499,  seats_used: 125, seats_limit: 200 },
  { subscription_id: "sub-3", company_id: "c3", company_name: "Global Services Ltd.",plan: "Enterprise",   amount: 4999, status: "active",    next_renewal: "2026-03-28", mrr: 4999, seats_used: 890, seats_limit: 1000 },
  { subscription_id: "sub-4", company_id: "c4", company_name: "Small Biz Co.",       plan: "Starter",      amount: 99,   status: "expired",   next_renewal: "2026-02-10", mrr: 0,    seats_used: 12,  seats_limit: 25 },
  { subscription_id: "sub-5", company_id: "c5", company_name: "Innovation Labs",     plan: "Professional", amount: 499,  status: "trial",     next_renewal: "2026-03-22", mrr: 0,    seats_used: 8,   seats_limit: 200 },
];
const MOCK_PLANS: PlanConfig[] = [
  { plan: "Starter",      price: 99,   seats: 25,   features: ["Core HR", "Employee Directory", "Basic Reporting"] },
  { plan: "Professional", price: 499,  seats: 200,  features: ["Everything in Starter", "Recruitment Module", "Performance Management", "API Access"] },
  { plan: "Enterprise",   price: 4999, seats: 1000, features: ["Everything in Professional", "Custom Integrations", "Dedicated Support", "SLA Guarantee", "Audit Logs"] },
];
const MOCK_STATS: BillingStats = { total_mrr: 10497, active_subscriptions: 3, trial_accounts: 1, expiring_soon: 1 };

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  inner: { flex: 1, flexDirection: "row" },
  main: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, color: "#64748B", fontSize: 14 },

  heroEyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 1.8, color: "rgba(255,255,255,0.6)", marginBottom: 4, textTransform: "uppercase" },
  heroTitle: { fontSize: 22, fontWeight: "800", color: "#FFFFFF", marginBottom: 4 },
  heroSub: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginBottom: 10 },
  heroStats: { flexDirection: "row", gap: 10, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, padding: 12 },
  heroStat: { flex: 1, alignItems: "center" },
  heroStatLabel: { fontSize: 7, fontWeight: "700", color: "rgba(255,255,255,0.6)", letterSpacing: 1, textTransform: "uppercase" },
  heroStatValue: { fontSize: 16, fontWeight: "800", color: "#FFFFFF", marginTop: 4 },

  tabRow: { flexDirection: "row", backgroundColor: "#F1F5F9", borderRadius: 12, padding: 4, gap: 4 },
  tab: { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: 8 },
  activeTab: { backgroundColor: "#FFFFFF" },
  tabText: { fontSize: 13, color: "#64748B", fontWeight: "600" },
  activeTabText: { color: "#0F172A" },

  subCard: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#E2E8F0", gap: 10 },
  subTop: { flexDirection: "row", alignItems: "flex-start" },
  subName: { fontSize: 14, fontWeight: "700", color: "#0F172A", marginBottom: 6 },
  subPills: { flexDirection: "row", gap: 6 },
  pill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "transparent" },
  pillText: { fontSize: 10, fontWeight: "700" },
  subAmount: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  subAmountUnit: { fontSize: 12, fontWeight: "400", color: "#94A3B8" },
  subDetail: { gap: 6, borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingTop: 10 },
  detailRow: { flexDirection: "row", justifyContent: "space-between" },
  detailLabel: { fontSize: 12, color: "#94A3B8" },
  detailValue: { fontSize: 13, fontWeight: "600", color: "#0F172A" },
  seatsBar: { height: 6, backgroundColor: "#E2E8F0", borderRadius: 3, overflow: "hidden" },
  seatsBarFill: { height: 6, backgroundColor: "#1E40AF", borderRadius: 3 },

  planCard: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#E2E8F0", gap: 8 },
  planTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  planBadge: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  planBadgeText: { fontSize: 12, fontWeight: "700" },
  planPrice: { fontSize: 20, fontWeight: "800", color: "#0F172A" },
  planPriceUnit: { fontSize: 12, fontWeight: "400", color: "#94A3B8" },
  planSeats: { fontSize: 13, color: "#64748B" },
  featureRow: { flexDirection: "row", alignItems: "flex-start" },
  featureText: { fontSize: 13, color: "#475569", flex: 1 },
});
