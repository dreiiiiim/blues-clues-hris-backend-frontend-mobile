import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { Sidebar } from "../components/Sidebar";
import { BottomTabBar, BOTTOM_TAB_HEIGHT } from "../components/BottomTabBar";
import { GradientHero } from "../components/GradientHero";
import { authFetch, UserSession } from "../services/auth";
import { API_BASE_URL } from "../lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

interface SFIAPillar {
  name: string;
  demand: number;
  supply: number;
  weight: number;
}

interface RankedCandidate {
  application_id: string;
  first_name: string;
  last_name: string;
  email: string;
  applied_at: string;
  status: string;
  fit_percentage: number;
  sfia_rank: number;
  manual_rank: number;
  pillars: SFIAPillar[];
}

interface JobOption {
  job_posting_id: string;
  title: string;
  department: string;
  total_applicants: number;
}

// ── Style helpers ──────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  "Final Interview": { bg: "#F5F3FF", border: "#DDD6FE", text: "#6D28D9" },
  "Technical":       { bg: "#E0E7FF", border: "#C7D2FE", text: "#4338CA" },
  "Screening":       { bg: "#FFFBEB", border: "#FDE68A", text: "#B45309" },
  "Submitted":       { bg: "#F1F5F9", border: "#E2E8F0", text: "#64748B" },
  "submitted":       { bg: "#F1F5F9", border: "#E2E8F0", text: "#64748B" },
  "Hired":           { bg: "#ECFDF3", border: "#A7F3D0", text: "#15803D" },
  "Rejected":        { bg: "#FEF2F2", border: "#FECACA", text: "#B91C1C" },
};

function fitColor(pct: number): string {
  if (pct >= 80) return "#16A34A";
  if (pct >= 60) return "#D97706";
  return "#DC2626";
}

function rankBadgeColors(rank: number) {
  if (rank === 1) return { bg: "#FEF3C7", border: "#FCD34D", text: "#92400E" };
  if (rank === 2) return { bg: "#F1F5F9", border: "#CBD5E1", text: "#475569" };
  if (rank === 3) return { bg: "#FFF7ED", border: "#FDBA74", text: "#9A3412" };
  return { bg: "#F8FAFC", border: "#E2E8F0", text: "#64748B" };
}

const AVATAR_COLORS = ["#1E3A8A", "#0F766E", "#6D28D9", "#B45309", "#991B1B", "#065F46"];
function avatarColor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ── Data helpers ───────────────────────────────────────────────────────────

function mapApplicationToCandidate(app: any, index: number): RankedCandidate {
  const sfiaScore = Number(app.sfia_match_percentage ?? app.sfia_matching_percentage ?? app.pre_screening_score ?? 0);
  const fitPct = Math.min(100, Math.max(0, Math.round(sfiaScore)));

  // Map per-skill SFIA scores — ranked endpoint returns skill_breakdown[]
  const skills: any[] = Array.isArray(app.skill_breakdown) ? app.skill_breakdown
    : Array.isArray(app.sfia_skill_scores) ? app.sfia_skill_scores : [];
  const pillars: SFIAPillar[] = skills.length > 0
    ? skills.map((s: any) => ({
        name: s.skill_name ?? s.name ?? "Skill",
        demand: Math.min(100, Math.round(Number(s.demand_level ?? s.required_level ?? 0) * 14.28)),
        supply: Math.min(100, Math.round(Number(s.supply_level ?? s.candidate_level ?? 0) * 14.28)),
        weight: Number(s.weight ?? 1 / skills.length),
      }))
    : [];

  const firstName = app.first_name ?? app.applicant?.first_name ?? "";
  const lastName  = app.last_name  ?? app.applicant?.last_name  ?? "";

  return {
    application_id: app.application_id ?? app.id ?? String(index),
    first_name: firstName,
    last_name:  lastName,
    email: app.email ?? app.applicant?.email ?? "—",
    applied_at: app.applied_at ?? app.application_timestamp ?? "",
    status: app.status ?? "Submitted",
    fit_percentage: fitPct,
    sfia_rank: app.manual_rank_position ?? index + 1,
    manual_rank: app.manual_rank_position ?? index + 1,
    pillars,
  };
}

// ── Pillar visualization ───────────────────────────────────────────────────

function PillarBars({ pillars }: { pillars: SFIAPillar[] }) {
  if (pillars.length === 0) {
    return (
      <View style={styles.pillarWrap}>
        <Text style={styles.pillarTitle}>SFIA Skill Breakdown</Text>
        <Text style={{ color: "#94A3B8", fontSize: 12, marginTop: 4 }}>
          Detailed skill scores not available for this candidate.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.pillarWrap}>
      <Text style={styles.pillarTitle}>Skill Demand vs Supply — SFIA Pillars</Text>
      {pillars.map((p) => {
        const hasGap = p.supply < p.demand;
        return (
          <View key={p.name} style={styles.pillarRow}>
            <View style={styles.pillarLabelRow}>
              <Text style={styles.pillarName}>{p.name}</Text>
              <Text style={[styles.pillarScore, { color: hasGap ? "#DC2626" : "#16A34A" }]}>
                {p.supply} / {p.demand}
              </Text>
            </View>
            <View style={styles.barLabelRow}>
              <Text style={styles.barLabel}>Demand</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${p.demand}%`, backgroundColor: "#94A3B8" }]} />
              </View>
              <Text style={styles.barNum}>{p.demand}</Text>
            </View>
            <View style={styles.barLabelRow}>
              <Text style={styles.barLabel}>Supply</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${p.supply}%`, backgroundColor: hasGap ? "#F87171" : "#4ADE80" }]} />
              </View>
              <Text style={styles.barNum}>{p.supply}</Text>
            </View>
          </View>
        );
      })}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#94A3B8" }]} />
          <Text style={styles.legendText}>Demand</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#4ADE80" }]} />
          <Text style={styles.legendText}>Supply (met)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#F87171" }]} />
          <Text style={styles.legendText}>Supply (gap)</Text>
        </View>
      </View>
    </View>
  );
}

// ── Candidate card ─────────────────────────────────────────────────────────

function CandidateCard({ candidate, rank }: { candidate: RankedCandidate; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const statusStyle = STATUS_STYLES[candidate.status] ?? STATUS_STYLES["Submitted"];
  const rankColors = rankBadgeColors(rank);
  const ac = avatarColor(candidate.first_name || candidate.email);
  const initials = `${(candidate.first_name || "?").charAt(0)}${(candidate.last_name || "").charAt(0)}`.toUpperCase();

  return (
    <View style={styles.candidateCard}>
      <View style={styles.candidateRow}>
        <View style={[styles.rankBadge, { backgroundColor: rankColors.bg, borderColor: rankColors.border }]}>
          {rank <= 3
            ? <Text style={{ fontSize: 13 }}>{rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"}</Text>
            : <Text style={[styles.rankText, { color: rankColors.text }]}>#{rank}</Text>}
        </View>
        <View style={[styles.candidateAvatar, { backgroundColor: ac }]}>
          <Text style={styles.candidateAvatarText}>{initials}</Text>
        </View>
        <View style={styles.candidateInfo}>
          <Text style={styles.candidateName} numberOfLines={1}>
            {candidate.first_name} {candidate.last_name}
          </Text>
          <Text style={styles.candidateEmail} numberOfLines={1}>{candidate.email}</Text>
        </View>
        <View style={styles.fitWrap}>
          <Text style={[styles.fitScore, { color: fitColor(candidate.fit_percentage) }]}>
            {candidate.fit_percentage}%
          </Text>
          <Text style={styles.fitLabel}>Fit</Text>
        </View>
        <Pressable onPress={() => setExpanded((v) => !v)} style={styles.expandBtn}>
          <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color="#64748B" />
        </Pressable>
      </View>

      <View style={styles.statusRow}>
        <View style={[styles.statusPill, { backgroundColor: statusStyle.bg, borderColor: statusStyle.border }]}>
          <Text style={[styles.statusText, { color: statusStyle.text }]}>{candidate.status}</Text>
        </View>
      </View>

      {expanded && <PillarBars pillars={candidate.pillars} />}
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────

export const HROfficerCandidateEvaluationScreen = ({ route, navigation }: any) => {
  const session: UserSession = route.params.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobOption | null>(null);
  const [jobDropdownOpen, setJobDropdownOpen] = useState(false);
  const [candidates, setCandidates] = useState<RankedCandidate[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // ── Fetch jobs ─────────────────────────────────────────────────────
  const fetchJobs = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/jobs`);
      if (!res.ok) return;
      const data = await res.json().catch(() => []);
      const raw: any[] = Array.isArray(data) ? data : data?.data ?? [];
      const mapped: JobOption[] = raw.map((j: any) => ({
        job_posting_id: j.job_posting_id ?? j.id ?? "",
        title: j.title ?? j.job_title ?? "Untitled",
        department: j.department_name ?? j.department ?? "—",
        total_applicants: Number(j.total_applicants ?? j.applicant_count ?? 0),
      }));
      setJobs(mapped);
      if (mapped.length > 0) {
        setSelectedJob(mapped[0]);
      }
    } catch {
      // silent
    } finally {
      setJobsLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ── Fetch candidates for selected job ──────────────────────────────
  const fetchCandidates = useCallback(async (jobId: string) => {
    setCandidatesLoading(true);
    setCandidates([]);
    try {
      // Try ranked SFIA endpoint first, fall back to regular applications
      const rankedRes = await authFetch(`${API_BASE_URL}/jobs/${jobId}/candidates/ranked`).catch(() => null);

      if (rankedRes && rankedRes.ok) {
        const data = await rankedRes.json().catch(() => ({}));
        // Ranked endpoint returns { candidates: [...], ... }
        const raw: any[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.candidates)
          ? data.candidates
          : data?.data ?? [];
        setCandidates(raw.map((c, i) => mapApplicationToCandidate(c, i)));
      } else {
        // Fallback: regular applications endpoint
        const appsRes = await authFetch(`${API_BASE_URL}/jobs/${jobId}/applications`);
        if (appsRes.ok) {
          const data = await appsRes.json().catch(() => []);
          const raw: any[] = Array.isArray(data) ? data : (data?.data ?? data?.applications ?? []);
          // Sort by sfia_match_percentage descending
          const sorted = [...raw].sort(
            (a, b) => Number(b.sfia_match_percentage ?? b.sfia_matching_percentage ?? b.pre_screening_score ?? 0)
                     - Number(a.sfia_match_percentage ?? a.sfia_matching_percentage ?? a.pre_screening_score ?? 0)
          );
          setCandidates(sorted.map((c, i) => mapApplicationToCandidate(c, i)));
        }
      }
    } catch {
      setCandidates([]);
    } finally {
      setCandidatesLoading(false);
    }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  useEffect(() => {
    if (selectedJob?.job_posting_id) {
      fetchCandidates(selectedJob.job_posting_id);
      setShowAll(false);
    }
  }, [selectedJob, fetchCandidates]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchJobs();
  };

  // ── Save manual rank ────────────────────────────────────────────────
  const handleSaveManualRank = async () => {
    if (!selectedJob) return;
    try {
      const rankings = candidates.map((c, i) => ({
        application_id: c.application_id,
        rank: i + 1,
      }));
      await authFetch(`${API_BASE_URL}/jobs/${selectedJob.job_posting_id}/candidates/manual-rank`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rankings }),
      });
    } catch {
      // silent — backend endpoint may not be implemented yet
    }
  };

  // ── Derived lists ───────────────────────────────────────────────────
  const sorted = [...candidates].sort((a, b) => a.sfia_rank - b.sfia_rank);
  const top3 = sorted.slice(0, 3);
  const visibleList = showAll ? sorted : sorted.slice(0, 20);
  const avgFit = sorted.length > 0
    ? Math.round(sorted.slice(0, Math.min(20, sorted.length)).reduce((s, c) => s + c.fit_percentage, 0) / Math.min(20, sorted.length))
    : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.layout}>
        {!isMobile && (
          <Sidebar role="hr" userName={session.name} email={session.email} activeScreen="Candidates" navigation={navigation} />
        )}

        <View style={styles.main}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.content, isMobile && { paddingBottom: BOTTOM_TAB_HEIGHT + 16 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {/* Hero */}
            <GradientHero style={styles.heroCard}>
              <View style={styles.heroCircle1} />
              <View style={styles.heroCircle2} />
              <View style={styles.heroTopRow}>
                <View style={styles.heroIconWrap}>
                  <Feather name="award" size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.heroEyebrow}>HR Recruitment</Text>
              </View>
              <Text style={styles.heroTitle}>Candidate Evaluation</Text>
              <Text style={styles.heroSubtitle}>
                Candidates ranked by SFIA fit score. Pull-to-refresh to reload.
              </Text>
              <View style={styles.heroStatsRow}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{avgFit}%</Text>
                  <Text style={styles.heroStatLabel}>Avg Fit</Text>
                </View>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{candidates.length}</Text>
                  <Text style={styles.heroStatLabel}>Candidates</Text>
                </View>
                <View style={styles.heroStat}>
                  <Text style={[styles.heroStatValue, { color: "#34D399" }]}>
                    {sorted[0]?.fit_percentage ?? 0}%
                  </Text>
                  <Text style={styles.heroStatLabel}>Top Score</Text>
                </View>
              </View>
            </GradientHero>

            {jobsLoading ? (
              <ActivityIndicator style={{ marginTop: 32 }} color="#1E3A8A" />
            ) : (
              <>
                {/* Job selector */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Job Posting</Text>
                  {jobs.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <Text style={styles.emptyText}>No job postings found.</Text>
                    </View>
                  ) : (
                    <>
                      <Pressable
                        style={styles.jobSelectorBtn}
                        onPress={() => setJobDropdownOpen((v) => !v)}
                      >
                        <Feather name="briefcase" size={15} color="#64748B" style={{ marginRight: 8 }} />
                        <Text style={styles.jobSelectorText} numberOfLines={1}>
                          {selectedJob?.title ?? "Select a job"}
                        </Text>
                        <Feather name={jobDropdownOpen ? "chevron-up" : "chevron-down"} size={15} color="#64748B" />
                      </Pressable>

                      {jobDropdownOpen && (
                        <View style={styles.dropdown}>
                          {jobs.map((job) => (
                            <Pressable
                              key={job.job_posting_id}
                              style={[
                                styles.dropdownItem,
                                job.job_posting_id === selectedJob?.job_posting_id && styles.dropdownItemActive,
                              ]}
                              onPress={() => {
                                setSelectedJob(job);
                                setJobDropdownOpen(false);
                              }}
                            >
                              <Text style={styles.dropdownItemTitle}>{job.title}</Text>
                              <Text style={styles.dropdownItemSub}>
                                {job.department} · {job.total_applicants} applicants
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </>
                  )}
                </View>

                {candidatesLoading ? (
                  <ActivityIndicator style={{ marginTop: 24 }} color="#1E3A8A" />
                ) : candidates.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>No candidates for this job posting yet.</Text>
                  </View>
                ) : (
                  <>
                    {/* Top 3 podium */}
                    {top3.length > 0 && (
                      <View style={styles.podiumRow}>
                        {top3.map((c, i) => (
                          <View key={c.application_id} style={styles.podiumCard}>
                            <Text style={styles.podiumMedal}>{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</Text>
                            <Text style={styles.podiumName} numberOfLines={1}>
                              {c.first_name} {c.last_name}
                            </Text>
                            <Text style={[styles.podiumScore, { color: fitColor(c.fit_percentage) }]}>
                              {c.fit_percentage}%
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Candidate list */}
                    <View style={styles.listCard}>
                      <View style={styles.listToolbar}>
                        <View>
                          <Text style={styles.listTitle}>
                            {showAll ? `All ${sorted.length} Candidates` : `Top ${Math.min(20, sorted.length)} Candidates`}
                          </Text>
                          <Text style={styles.listSubtitle}>Sorted by SFIA fit score</Text>
                        </View>
                        <Pressable style={styles.saveBtn} onPress={handleSaveManualRank}>
                          <Text style={styles.saveBtnText}>Save Order</Text>
                        </Pressable>
                      </View>

                      <View style={styles.candidateList}>
                        {visibleList.map((candidate, index) => (
                          <CandidateCard key={candidate.application_id} candidate={candidate} rank={index + 1} />
                        ))}
                      </View>

                      {sorted.length > 20 && (
                        <Pressable style={styles.showAllBtn} onPress={() => setShowAll((v) => !v)}>
                          <Text style={styles.showAllText}>
                            {showAll ? "Show Top 20 Only" : `Show All ${sorted.length} Candidates`}
                          </Text>
                          <Feather name={showAll ? "chevron-up" : "chevron-down"} size={14} color="#1E3A8A" />
                        </Pressable>
                      )}

                      <View style={styles.listFooter}>
                        <Text style={styles.listFooterText}>
                          Showing {visibleList.length} of {sorted.length} candidates
                        </Text>
                      </View>
                    </View>
                  </>
                )}
              </>
            )}
          </ScrollView>

          {isMobile && (
            <BottomTabBar role="hr" activeScreen="Candidates" navigation={navigation} session={session} />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F1F5F9" },
  layout: { flex: 1, flexDirection: "row" },
  main: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 14 },

  heroCard: { borderRadius: 20, padding: 20, overflow: "hidden" },
  heroCircle1: { position: "absolute", top: -50, right: -50, width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.05)" },
  heroCircle2: { position: "absolute", bottom: -30, left: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(16,185,129,0.08)" },
  heroTopRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  heroIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", marginRight: 10 },
  heroEyebrow: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.2 },
  heroTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "800", marginBottom: 6 },
  heroSubtitle: { color: "rgba(255,255,255,0.78)", fontSize: 13, lineHeight: 20, marginBottom: 14 },
  heroStatsRow: { flexDirection: "row", gap: 8 },
  heroStat: { backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  heroStatValue: { color: "#FFFFFF", fontSize: 18, fontWeight: "800", marginBottom: 2 },
  heroStatLabel: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: "700" },

  section: { gap: 6 },
  sectionLabel: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, color: "#64748B" },
  jobSelectorBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  jobSelectorText: { flex: 1, color: "#0F172A", fontSize: 14, fontWeight: "600" },
  dropdown: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 14, overflow: "hidden", marginTop: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 12 },
  dropdownItemActive: { backgroundColor: "#EFF6FF" },
  dropdownItemTitle: { color: "#0F172A", fontSize: 14, fontWeight: "700" },
  dropdownItemSub: { color: "#64748B", fontSize: 12, marginTop: 2 },

  podiumRow: { flexDirection: "row", gap: 10 },
  podiumCard: { flex: 1, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 16, padding: 12, alignItems: "center", gap: 4 },
  podiumMedal: { fontSize: 22 },
  podiumName: { color: "#0F172A", fontSize: 12, fontWeight: "700", textAlign: "center" },
  podiumScore: { fontSize: 16, fontWeight: "800" },

  listCard: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 20, overflow: "hidden" },
  listToolbar: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", backgroundColor: "#FAFBFF" },
  listTitle: { color: "#0F172A", fontSize: 15, fontWeight: "800" },
  listSubtitle: { color: "#64748B", fontSize: 12, marginTop: 2, maxWidth: 180 },
  saveBtn: { backgroundColor: "#1E3A8A", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  saveBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },

  candidateList: { padding: 12, gap: 10 },
  candidateCard: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 16, padding: 12 },
  candidateRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rankBadge: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  rankText: { fontSize: 11, fontWeight: "800" },
  candidateAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  candidateAvatarText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  candidateInfo: { flex: 1, minWidth: 0 },
  candidateName: { color: "#0F172A", fontSize: 13, fontWeight: "700" },
  candidateEmail: { color: "#64748B", fontSize: 11, marginTop: 1 },
  fitWrap: { alignItems: "flex-end", flexShrink: 0 },
  fitScore: { fontSize: 16, fontWeight: "800", lineHeight: 18 },
  fitLabel: { color: "#94A3B8", fontSize: 9, fontWeight: "700", textTransform: "uppercase" },
  expandBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  statusRow: { flexDirection: "row", marginTop: 8, paddingLeft: 42 },
  statusPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },

  pillarWrap: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#E2E8F0", gap: 10 },
  pillarTitle: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8, color: "#64748B", marginBottom: 2 },
  pillarRow: { gap: 3 },
  pillarLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  pillarName: { color: "#0F172A", fontSize: 12, fontWeight: "600" },
  pillarScore: { fontSize: 12, fontWeight: "700" },
  barLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  barLabel: { color: "#94A3B8", fontSize: 10, width: 44, textAlign: "right" },
  barTrack: { flex: 1, height: 7, backgroundColor: "#E2E8F0", borderRadius: 999, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 999 },
  barNum: { color: "#94A3B8", fontSize: 10, width: 22 },
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: "#64748B", fontSize: 10 },

  showAllBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  showAllText: { color: "#1E3A8A", fontSize: 13, fontWeight: "700" },
  listFooter: { paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#F1F5F9", backgroundColor: "#FAFBFF" },
  listFooterText: { color: "#94A3B8", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.7 },

  emptyBox: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 16, padding: 24, alignItems: "center" },
  emptyText: { color: "#94A3B8", fontSize: 14 },
});
