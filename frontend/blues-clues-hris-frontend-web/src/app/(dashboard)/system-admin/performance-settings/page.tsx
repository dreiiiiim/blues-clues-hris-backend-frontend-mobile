"use client";

import { useEffect, useState } from "react";
import {
  Settings, Plus, Trash2, Calendar, Star,
  AlertTriangle, Shield, ToggleLeft, ToggleRight, Check, X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/authApi";
import { API_BASE_URL } from "@/lib/api";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ViolationRule {
  id: string;
  condition: string;
  action: string;
  affectedBenefits: string;
}

interface RatingLabel {
  value: number;
  label: string;
}

interface BonusRule {
  id: string;
  ratingMin: number;
  ratingMax: number;
  amountType: 'percentage' | 'fixed';
  bonusPct: number;
  meritPct: number;
  bonusAmount: number;
  meritAmount: number;
  promotionEligible: boolean;
}

interface Cycle {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "GOAL_SETTING" | "MID_YEAR" | "YEAR_END" | "COMPLETED";
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SystemAdminPerformancePage() {
  // Cycle toggles
  const [cycleEnabled,  setCycleEnabled]  = useState(true);
  const [selfProposed,  setSelfProposed]  = useState(true);
  const [autoBonuses,   setAutoBonuses]   = useState(true);
  const [industryKPIs,  setIndustryKPIs]  = useState(false);

  // Cycle dates
  const [cycleDates, setCycleDates] = useState({
    goalSettingStart: "",
    goalSettingEnd:   "",
    midYearReview:    "",
    yearEndReview:    "",
  });

  // PIP
  const [pipLimit,    setPipLimit]    = useState(2);
  const [pipDuration, setPipDuration] = useState("60");
  const [pipAction,   setPipAction]   = useState("Escalate to Termination");

  // Rating labels
  const [ratingLabels, setRatingLabels] = useState<RatingLabel[]>([
    { value: 1, label: "Below Expectations" },
    { value: 2, label: "Below Expectations" },
    { value: 3, label: "Meets Expectations"  },
    { value: 4, label: "Above Average"       },
    { value: 5, label: "Excellent"           },
  ]);

  // Violation rules
  const [rules, setRules] = useState<ViolationRule[]>([]);
  const [newRule, setNewRule] = useState<Omit<ViolationRule, "id">>({
    condition: "", action: "", affectedBenefits: "",
  });

  // Bonus rules
  const [bonusRules, setBonusRules] = useState<BonusRule[]>([]);
  const [newBonusRule, setNewBonusRule] = useState({ ratingMin: 4, ratingMax: 5, amountType: 'percentage' as 'percentage' | 'fixed', bonusPct: 10, meritPct: 5, bonusAmount: 0, meritAmount: 0, promotionEligible: false });

  // Cycles
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [newCycle, setNewCycle] = useState({ name: "", startDate: "", endDate: "" });
  const [cycleAdding, setCycleAdding] = useState(false);
  const [editingCycleId, setEditingCycleId] = useState<string | null>(null);
  const [editCycleForm, setEditCycleForm] = useState({ name: "", startDate: "", endDate: "" });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    authFetch(`${API_BASE_URL}/performance/settings/full`)
      .then(r => r.json())
      .then((data) => {
        const settings = data?.settings;
        const vRules = data?.violation_rules ?? [];
        const bRules = data?.bonus_rules ?? [];
        if (settings && !settings.message && !settings.error) {
          setCycleEnabled(settings.module_enabled ?? true);
          setSelfProposed(settings.self_proposed_goals_enabled ?? true);
          setAutoBonuses(settings.auto_compute_bonuses ?? true);
          setIndustryKPIs(settings.kpi_suggestions_enabled ?? false);
          setCycleDates({
            goalSettingStart: settings.goal_setting_start ?? "",
            goalSettingEnd:   settings.goal_setting_end   ?? "",
            midYearReview:    settings.midyear_review_date ?? "",
            yearEndReview:    settings.yearend_review_date ?? "",
          });
          setPipLimit(settings.pip_max_attempts ?? 2);
          setPipDuration(String(settings.pip_default_duration_days ?? 60));
          setPipAction(settings.pip_failure_action ?? "Escalate to Termination");
          setRatingLabels([
            { value: 1, label: settings.rating_label_1 ?? "Below Expectations" },
            { value: 2, label: settings.rating_label_2 ?? "Below Expectations" },
            { value: 3, label: settings.rating_label_3 ?? "Meets Expectations"  },
            { value: 4, label: settings.rating_label_4 ?? "Above Average"       },
            { value: 5, label: settings.rating_label_5 ?? "Excellent"           },
          ]);
        }
        if (Array.isArray(vRules)) {
          setRules(vRules.map((r: any) => ({
            id: r.rule_id ?? r.id,
            condition: r.rule_description ?? r.condition ?? `${r.violation_count} ${r.severity_threshold} violations`,
            action: r.resulting_action ?? r.action ?? "—",
            affectedBenefits: r.affectedBenefits ?? ([
              r.affects_bonus ? "Bonus" : null,
              r.affects_merit ? "Merit Increase" : null,
              r.affects_perks ? "Perks" : null,
            ].filter(Boolean).join(", ") || "—"),
          })));
        }
        if (Array.isArray(bRules)) {
          setBonusRules(bRules.map((r: any) => ({
            id: r.bonus_rule_id ?? r.id,
            ratingMin: r.rating_min,
            ratingMax: r.rating_max,
            amountType: r.amount_type === 'fixed' ? 'fixed' : 'percentage',
            bonusPct: r.bonus_pct ?? 0,
            meritPct: r.merit_increase_pct ?? 0,
            bonusAmount: r.bonus_fixed_amount ?? 0,
            meritAmount: r.merit_fixed_amount ?? 0,
            promotionEligible: r.promotion_eligible,
          })));
        }
      }).catch(() => toast.error("Failed to load settings"));
    authFetch(`${API_BASE_URL}/performance/cycles`).then(r => r.json()).then((data) => {
      if (Array.isArray(data)) {
        setCycles(data.map((c: any) => ({
          id: c.perf_cycle_id,
          name: c.cycle_name,
          startDate: c.start_date?.slice(0, 10) ?? "",
          endDate: c.end_date?.slice(0, 10) ?? "",
          status: c.status,
        })));
      }
    }).catch(() => {});
  }, []);

  const updateRatingLabel = (value: number, label: string) => {
    setRatingLabels(prev => prev.map(r => r.value === value ? { ...r, label } : r));
  };

  const handleAddRule = async () => {
    if (!newRule.condition.trim() || !newRule.action.trim()) return;
    try {
      const res = await authFetch(`${API_BASE_URL}/performance/violation-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          violation_count: 1,
          severity_threshold: "HIGH",
          within_days: 90,
          resulting_action: newRule.action,
          affects_bonus: newRule.affectedBenefits.toLowerCase().includes("bonus"),
          affects_merit: newRule.affectedBenefits.toLowerCase().includes("merit"),
          affects_perks: newRule.affectedBenefits.toLowerCase().includes("perk"),
          suspension_days: 0,
          rule_description: newRule.condition,
        }),
      });
      const created = await res.json();
      if (!res.ok) throw new Error(created.message);
      setRules(prev => [...prev, {
        id: created.rule_id,
        condition: created.rule_description,
        action: created.resulting_action,
        affectedBenefits: newRule.affectedBenefits,
      }]);
      setNewRule({ condition: "", action: "", affectedBenefits: "" });
      toast.success("Rule added");
    } catch (err: any) {
      toast.error(err.message || "Failed to add rule");
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm("Delete this violation rule? This cannot be undone.")) return;
    try {
      await authFetch(`${API_BASE_URL}/performance/violation-rules/${id}`, { method: "DELETE" });
      setRules(prev => prev.filter(r => r.id !== id));
      toast.success("Rule deleted");
    } catch {
      toast.error("Failed to delete rule");
    }
  };

  const handleAddBonusRule = async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/performance/bonus-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating_min: newBonusRule.ratingMin,
          rating_max: newBonusRule.ratingMax,
          bonus_pct: newBonusRule.bonusPct,
          merit_increase_pct: newBonusRule.meritPct,
          promotion_eligible: newBonusRule.promotionEligible,
          amount_type: newBonusRule.amountType,
          bonus_fixed_amount: newBonusRule.amountType === 'fixed' ? newBonusRule.bonusAmount : undefined,
          merit_fixed_amount: newBonusRule.amountType === 'fixed' ? newBonusRule.meritAmount : undefined,
        }),
      });
      const created = await res.json();
      if (!res.ok) throw new Error(created.message);
      setBonusRules(prev => [...prev, {
        id: created.bonus_rule_id ?? created.id,
        ratingMin: created.rating_min,
        ratingMax: created.rating_max,
        amountType: created.amount_type === 'fixed' ? 'fixed' : 'percentage',
        bonusPct: created.bonus_pct ?? 0,
        meritPct: created.merit_increase_pct ?? 0,
        bonusAmount: created.bonus_fixed_amount ?? 0,
        meritAmount: created.merit_fixed_amount ?? 0,
        promotionEligible: created.promotion_eligible,
      }]);
      toast.success("Bonus rule added");
    } catch (err: any) {
      toast.error(err.message || "Failed to add bonus rule");
    }
  };

  const handleDeleteBonusRule = async (id: string) => {
    if (!confirm("Delete this bonus rule? This cannot be undone.")) return;
    try {
      await authFetch(`${API_BASE_URL}/performance/bonus-rules/${id}`, { method: "DELETE" });
      setBonusRules(prev => prev.filter(r => r.id !== id));
      toast.success("Bonus rule deleted");
    } catch {
      toast.error("Failed to delete bonus rule");
    }
  };

  const handleEditCycleSave = async (id: string) => {
    try {
      await authFetch(`${API_BASE_URL}/performance/cycles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycle_name: editCycleForm.name,
          start_date: editCycleForm.startDate,
          end_date: editCycleForm.endDate,
        }),
      });
      setCycles(prev => prev.map(c => c.id === id
        ? { ...c, name: editCycleForm.name, startDate: editCycleForm.startDate, endDate: editCycleForm.endDate }
        : c
      ));
      setEditingCycleId(null);
      toast.success("Cycle updated");
    } catch {
      toast.error("Failed to update cycle");
    }
  };

  const handleDeleteCycle = async (id: string) => {
    if (!confirm("Delete this cycle? This cannot be undone.")) return;
    try {
      const res = await authFetch(`${API_BASE_URL}/performance/cycles/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      setCycles(prev => prev.filter(c => c.id !== id));
      toast.success("Cycle deleted");
    } catch (e: any) {
      toast.error(e.message || "Failed to delete cycle");
    }
  };

  const handleCreateCycle = async () => {
    if (!newCycle.name.trim() || !newCycle.startDate || !newCycle.endDate) return;
    if (newCycle.startDate >= newCycle.endDate) {
      toast.error("End date must be after start date");
      return;
    }
    try {
      const res = await authFetch(`${API_BASE_URL}/performance/cycles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycle_name: newCycle.name, start_date: newCycle.startDate, end_date: newCycle.endDate }),
      });
      const created = await res.json();
      if (!res.ok) throw new Error(created.message);
      setCycles(prev => [...prev, {
        id: created.perf_cycle_id,
        name: created.cycle_name,
        startDate: created.start_date?.slice(0, 10) ?? newCycle.startDate,
        endDate: created.end_date?.slice(0, 10) ?? newCycle.endDate,
        status: created.status ?? "GOAL_SETTING",
      }]);
      setNewCycle({ name: "", startDate: "", endDate: "" });
      setCycleAdding(false);
      toast.success("Cycle created");
    } catch (err: any) {
      toast.error(err.message || "Failed to create cycle");
    }
  };

  const handlePatchCycle = async (id: string, status: string) => {
    try {
      await authFetch(`${API_BASE_URL}/performance/cycles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setCycles(prev => prev.map(c => c.id === id ? { ...c, status: status as Cycle["status"] } : c));
      toast.success("Cycle status updated");
    } catch {
      toast.error("Failed to update cycle");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/performance/settings/full`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            module_enabled: cycleEnabled,
            self_proposed_goals_enabled: selfProposed,
            auto_compute_bonuses: autoBonuses,
            kpi_suggestions_enabled: industryKPIs,
            goal_setting_start: cycleDates.goalSettingStart,
            goal_setting_end: cycleDates.goalSettingEnd,
            midyear_review_date: cycleDates.midYearReview,
            yearend_review_date: cycleDates.yearEndReview,
            pip_max_attempts: pipLimit,
            pip_default_duration_days: parseInt(pipDuration) || 60,
            pip_failure_action: pipAction,
            rating_label_1: ratingLabels[0].label,
            rating_label_2: ratingLabels[1].label,
            rating_label_3: ratingLabels[2].label,
            rating_label_4: ratingLabels[3].label,
            rating_label_5: ratingLabels[4].label,
          },
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      toast.success("Settings saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const activeCycleName = (cycles.find(c => c.status !== "COMPLETED") ?? cycles[0])?.name ?? "Current Cycle";

  function ToggleRow({
    label, sub, value, onChange,
  }: { label: string; sub: string; value: boolean; onChange: () => void }) {
    return (
      <div className="flex items-center justify-between py-4 border-b border-border last:border-0">
        <div className="flex-1 pr-6">
          <p className="text-sm font-bold text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{sub}</p>
        </div>
        <button
          onClick={onChange}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-bold text-xs transition-colors shrink-0
            ${value
              ? "bg-primary/10 border-primary text-primary"
              : "bg-muted border-border text-muted-foreground"}`}
        >
          {value
            ? <><ToggleRight className="h-4 w-4" /> On</>
            : <><ToggleLeft  className="h-4 w-4" /> Off</>}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-primary via-primary/90 to-blue-600 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1">
            <div className="p-3 bg-white/10 rounded-xl border border-white/20 shrink-0">
              <Settings className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-widest uppercase text-white/70 mb-1">
                SYSTEM ADMINISTRATION
              </p>
              <h1 className="text-2xl font-bold mb-1">Performance Settings Panel</h1>
              <p className="text-sm text-white/85 leading-relaxed">
                Configure cycles, rating scales, PIP limits, and rule-based disciplinary logic.
                Changes apply to all employees in the next cycle.
              </p>
            </div>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-xl px-5 py-4 text-center shrink-0">
            <p className="text-[9px] font-bold text-white/60 uppercase tracking-widest mb-1">MODULE STATUS</p>
            <div className="flex items-center justify-center gap-1.5 my-1">
              <span className={`w-2 h-2 rounded-full ${cycleEnabled ? "bg-green-400" : "bg-gray-400"}`} />
              <span className={`text-sm font-bold tracking-widest ${cycleEnabled ? "text-green-400" : "text-gray-400"}`}>
                {cycleEnabled ? "ACTIVE" : "INACTIVE"}
              </span>
            </div>
            <p className="text-[9px] text-white/70 font-semibold">{activeCycleName} Running</p>
          </div>
        </div>
      </div>

      {/* ── Performance Cycle Card ────────────────────────────── */}
      <Card className="p-6 border-border">
        <p className="text-base font-bold">Performance Cycle</p>
        <p className="text-xs text-muted-foreground mt-0.5 mb-4">Enable/disable the module and define key cycle dates</p>

        <div className="border-t border-border">
          <ToggleRow label="Performance Management Module" sub="Turn the entire performance cycle on or off system-wide" value={cycleEnabled} onChange={() => setCycleEnabled(v => !v)} />
          <ToggleRow label="Self-Proposed Goals" sub="Allow employees to draft goals for manager review" value={selfProposed} onChange={() => setSelfProposed(v => !v)} />
          <ToggleRow label="Auto-computed Bonuses" sub="Use rule engine to calculate performance bonuses automatically" value={autoBonuses} onChange={() => setAutoBonuses(v => !v)} />
          <ToggleRow label="Industry KPI Suggestions" sub="(Optional) Enable KPI search integration" value={industryKPIs} onChange={() => setIndustryKPIs(v => !v)} />
        </div>

        {cycleEnabled && (
          <>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-6 mb-3">
              CYCLE DATES — {activeCycleName.toUpperCase()}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "goalSettingStart", label: "Goal Setting Start"   },
                { key: "goalSettingEnd",   label: "Goal Setting End"     },
                { key: "midYearReview",    label: "Mid-Year Review Date" },
                { key: "yearEndReview",    label: "Year-End Review Date" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    {label}
                  </label>
                  <Input
                    type="date"
                    value={cycleDates[key as keyof typeof cycleDates]}
                    onChange={e => setCycleDates(prev => ({ ...prev, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* ── Rating Scale Config ───────────────────────────────── */}
      <Card className="p-6 border-border">
        <p className="text-base font-bold">Rating Scale</p>
        <p className="text-xs text-muted-foreground mt-0.5 mb-5">Likert 1–5 (fixed) — labels configurable</p>

        <div className="space-y-3">
          {ratingLabels.map(r => (
            <div key={r.value} className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base shrink-0 border-2
                ${r.value === 5 ? "bg-green-50 border-green-300 text-green-700"
                : r.value === 4 ? "bg-blue-50 border-blue-300 text-blue-700"
                : r.value === 3 ? "bg-amber-50 border-amber-300 text-amber-700"
                :                  "bg-red-50 border-red-300 text-red-700"}`}>
                {r.value}
              </div>
              <div className="flex items-center gap-1.5 flex-1">
                {[...Array(r.value)].map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                ))}
                {[...Array(5 - r.value)].map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 text-border" />
                ))}
              </div>
              <Input
                className="flex-1"
                value={r.label}
                onChange={e => updateRatingLabel(r.value, e.target.value)}
                placeholder="Label description..."
              />
            </div>
          ))}
        </div>
      </Card>

      {/* ── PIP Configuration ────────────────────────────────── */}
      <Card className="p-6 border-border space-y-5">
        <div>
          <p className="text-base font-bold">PIP Configuration</p>
          <p className="text-xs text-muted-foreground mt-0.5">Performance Improvement Plan limits</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-3 block">
              Max PIPs Per Employee / Year
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPipLimit(v => Math.max(1, v - 1))}
                className="w-9 h-9 rounded-xl bg-muted border border-border flex items-center justify-center text-lg font-bold hover:bg-muted/80 transition-colors"
              >−</button>
              <div className="w-16 h-12 rounded-xl bg-primary/10 border-2 border-primary flex items-center justify-center">
                <span className="text-2xl font-bold text-primary">{pipLimit}</span>
              </div>
              <button
                onClick={() => setPipLimit(v => Math.min(5, v + 1))}
                className="w-9 h-9 rounded-xl bg-muted border border-border flex items-center justify-center text-lg font-bold hover:bg-muted/80 transition-colors"
              >+</button>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">
              Default PIP Duration (Days)
            </label>
            <Input
              type="number"
              value={pipDuration}
              onChange={e => setPipDuration(e.target.value)}
              placeholder="e.g. 60"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 block">
            After {pipLimit} Failed PIP{pipLimit > 1 ? "s" : ""} — Action
          </label>
          <Input
            value={pipAction}
            onChange={e => setPipAction(e.target.value)}
            placeholder="e.g. Escalate to Termination"
          />
        </div>

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-xs text-amber-800 leading-relaxed">
            <span className="font-bold">Current rule:</span> After {pipLimit} failed PIP{pipLimit > 1 ? "s" : ""} — {pipAction}
          </p>
        </div>
      </Card>

      {/* ── Violation Rule Builder ────────────────────────────── */}
      <Card className="border-border overflow-hidden">
        <div className="p-6 border-b border-border flex items-start justify-between">
          <div>
            <p className="text-base font-bold">Violation Rule Builder</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Define disciplinary thresholds — executed by the rule engine
            </p>
          </div>
          <div className="p-2 bg-red-50 rounded-lg border border-red-200">
            <Shield className="h-4 w-4 text-red-600" />
          </div>
        </div>

        <div className="divide-y divide-border">
          {rules.length === 0
            ? <p className="text-xs text-muted-foreground text-center py-6">No rules defined yet.</p>
            : rules.map(rule => (
              <div key={rule.id} className="p-5 flex items-start gap-4 hover:bg-muted/20 transition-colors">
                <div className="p-2 bg-red-50 rounded-lg border border-red-200 shrink-0 mt-0.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">IF</span>
                    <span className="px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200 text-xs font-bold">{rule.condition}</span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">→ THEN</span>
                    <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-xs font-bold">{rule.action}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold">Affected benefits:</span> {rule.affectedBenefits}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteRule(rule.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          }
        </div>

        <div className="p-6 bg-muted/20 border-t border-border">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">Add New Rule</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5 block">Condition</label>
              <Input
                placeholder="e.g. 3 HIGH violations"
                value={newRule.condition}
                onChange={e => setNewRule(prev => ({ ...prev, condition: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5 block">Action</label>
              <Input
                placeholder="e.g. Auto-Suspension"
                value={newRule.action}
                onChange={e => setNewRule(prev => ({ ...prev, action: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5 block">Affected Benefits</label>
              <Input
                placeholder="e.g. Bonus, Merit Increase"
                value={newRule.affectedBenefits}
                onChange={e => setNewRule(prev => ({ ...prev, affectedBenefits: e.target.value }))}
              />
            </div>
          </div>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={handleAddRule}
            disabled={!newRule.condition.trim() || !newRule.action.trim()}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Rule
          </Button>
        </div>
      </Card>

      {/* ── Performance Cycles ───────────────────────────────── */}
      <Card className="border-border overflow-hidden">
        <div className="p-6 border-b border-border flex items-start justify-between">
          <div>
            <p className="text-base font-bold">Performance Cycles</p>
            <p className="text-xs text-muted-foreground mt-0.5 mb-2">
              Only one cycle can be active at a time. The system automatically uses the most recently created cycle that is <span className="font-semibold">not COMPLETED</span>. Mark a cycle as <span className="font-semibold">COMPLETED</span> to retire it and activate the next one.
            </p>
            {cycles.filter(c => c.status !== "COMPLETED").length > 1 && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2 flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    Multiple active cycles detected. Only <span className="font-bold">{activeCycleName}</span> is being used by the system. Mark older cycles as COMPLETED to avoid confusion.
                  </span>
                </p>
            )}
          </div>
          <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setCycleAdding(v => !v)}>
            <Plus className="h-3.5 w-3.5" /> New Cycle
          </Button>
        </div>

        <div className="divide-y divide-border">
          {cycles.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No cycles created yet.</p>
          ) : cycles.map(cycle => (
            <div key={cycle.id} className="p-5 flex items-center gap-4 hover:bg-muted/20 transition-colors">
              {editingCycleId === cycle.id ? (
                <div className="flex-1 grid grid-cols-3 gap-2 mr-1">
                  <Input className="text-xs h-8" value={editCycleForm.name}
                    onChange={e => setEditCycleForm(p => ({ ...p, name: e.target.value }))} placeholder="Cycle name" />
                  <Input type="date" className="text-xs h-8" value={editCycleForm.startDate}
                    onChange={e => setEditCycleForm(p => ({ ...p, startDate: e.target.value }))} />
                  <Input type="date" className="text-xs h-8" value={editCycleForm.endDate}
                    onChange={e => setEditCycleForm(p => ({ ...p, endDate: e.target.value }))} />
                </div>
              ) : (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">{cycle.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{cycle.startDate} → {cycle.endDate}</p>
                </div>
              )}
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={cycle.status}
                  onChange={e => handlePatchCycle(cycle.id, e.target.value)}
                  className="text-xs font-bold border border-border rounded-lg px-2 py-1.5 bg-background focus:outline-none focus:border-primary"
                >
                  {(["GOAL_SETTING", "MID_YEAR", "YEAR_END", "COMPLETED"] as const).map(s => (
                    <option key={s} value={s}>{s.replace("_", " ")}</option>
                  ))}
                </select>
                {editingCycleId === cycle.id ? (
                  <>
                    <Button size="sm" className="text-xs h-7" onClick={() => handleEditCycleSave(cycle.id)}>Save</Button>
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setEditingCycleId(null)}>Cancel</Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="outline" className="text-xs h-7"
                      onClick={() => { setEditingCycleId(cycle.id); setEditCycleForm({ name: cycle.name, startDate: cycle.startDate, endDate: cycle.endDate }); }}>
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs h-7 text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => handleDeleteCycle(cycle.id)}>
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {cycleAdding && (
          <div className="p-6 bg-muted/20 border-t border-border">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">Create New Cycle</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5 block">Cycle Name</label>
                <Input placeholder="e.g. FY 2027" value={newCycle.name}
                  onChange={e => setNewCycle(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5 block">Start Date</label>
                <Input type="date" value={newCycle.startDate}
                  onChange={e => setNewCycle(p => ({ ...p, startDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5 block">End Date</label>
                <Input type="date" value={newCycle.endDate}
                  onChange={e => setNewCycle(p => ({ ...p, endDate: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="gap-1.5" onClick={handleCreateCycle}
                disabled={!newCycle.name.trim() || !newCycle.startDate || !newCycle.endDate}>
                <Plus className="h-3.5 w-3.5" /> Create Cycle
              </Button>
              <Button size="sm" variant="outline" onClick={() => setCycleAdding(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </Card>

      {/* ── Bonus & Merit Formulas ────────────────────────────── */}
      <Card className="border-border overflow-hidden">
        <div className="p-6 border-b border-border flex items-start justify-between">
          <div>
            <p className="text-base font-bold">Bonus &amp; Merit Formulas</p>
            <p className="text-xs text-muted-foreground mt-0.5">Parameter-based computation tied to rating scale</p>
          </div>
          <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
            <Star className="h-4 w-4 text-primary" />
          </div>
        </div>

        <div className="border-b border-border">
          <div className="grid grid-cols-5 px-4 py-2.5 bg-muted/40 border-b border-border">
            {["RATING", "BONUS", "MERIT", "PROMO ELIGIBLE", ""].map(h => (
              <p key={h} className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{h}</p>
            ))}
          </div>
          {bonusRules.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No bonus rules configured.</p>
          ) : bonusRules.map(rule => (
            <div key={rule.id} className="grid grid-cols-5 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/20 transition-colors items-center">
              <p className="text-sm font-bold">{rule.ratingMin}–{rule.ratingMax}</p>
              <p className="text-sm font-semibold">{rule.amountType === 'fixed' ? `₱${Number(rule.bonusAmount).toLocaleString()}` : `${rule.bonusPct}%`}</p>
              <p className="text-sm font-semibold">{rule.amountType === 'fixed' ? `₱${Number(rule.meritAmount).toLocaleString()}` : `${rule.meritPct}%`}</p>
              <div>
                {rule.promotionEligible ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-50 text-green-700 border border-green-200 text-[10px] font-bold"><Check className="h-3 w-3" />Eligible</span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-600 border border-red-200 text-[10px] font-bold"><X className="h-3 w-3" />Not eligible</span>
                )}
              </div>
              <button onClick={() => handleDeleteBonusRule(rule.id)}
                className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors justify-self-end">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="p-6 bg-muted/20">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">Add Bonus Rule</p>
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setNewBonusRule(p => ({ ...p, amountType: 'percentage' }))}
              className={`px-3 py-1.5 rounded-xl border font-bold text-xs transition-colors
                ${newBonusRule.amountType === 'percentage' ? "bg-primary/10 border-primary text-primary" : "bg-muted border-border text-muted-foreground"}`}>
              Percentage
            </button>
            <button
              onClick={() => setNewBonusRule(p => ({ ...p, amountType: 'fixed' }))}
              className={`px-3 py-1.5 rounded-xl border font-bold text-xs transition-colors
                ${newBonusRule.amountType === 'fixed' ? "bg-primary/10 border-primary text-primary" : "bg-muted border-border text-muted-foreground"}`}>
              Fixed Amount (₱)
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5 block">Rating Min</label>
              <Input type="number" min={1} max={5} value={newBonusRule.ratingMin}
                onChange={e => setNewBonusRule(p => ({ ...p, ratingMin: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5 block">Rating Max</label>
              <Input type="number" min={1} max={5} value={newBonusRule.ratingMax}
                onChange={e => setNewBonusRule(p => ({ ...p, ratingMax: Number(e.target.value) }))} />
            </div>
            {newBonusRule.amountType === 'percentage' ? (
              <>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5 block">Bonus %</label>
                  <Input type="number" min={0} value={newBonusRule.bonusPct}
                    onChange={e => setNewBonusRule(p => ({ ...p, bonusPct: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5 block">Merit %</label>
                  <Input type="number" min={0} value={newBonusRule.meritPct}
                    onChange={e => setNewBonusRule(p => ({ ...p, meritPct: Number(e.target.value) }))} />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5 block">Bonus ₱</label>
                  <Input type="number" min={0} value={newBonusRule.bonusAmount}
                    onChange={e => setNewBonusRule(p => ({ ...p, bonusAmount: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5 block">Merit ₱</label>
                  <Input type="number" min={0} value={newBonusRule.meritAmount}
                    onChange={e => setNewBonusRule(p => ({ ...p, meritAmount: Number(e.target.value) }))} />
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-4 mb-3">
            <button onClick={() => setNewBonusRule(p => ({ ...p, promotionEligible: !p.promotionEligible }))}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-bold text-xs transition-colors
                ${newBonusRule.promotionEligible ? "bg-primary/10 border-primary text-primary" : "bg-muted border-border text-muted-foreground"}`}>
              {newBonusRule.promotionEligible ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
              Promotion Eligible
            </button>
          </div>
          <Button size="sm" className="gap-1.5" onClick={handleAddBonusRule}>
            <Plus className="h-3.5 w-3.5" /> Add Bonus Rule
          </Button>
        </div>

        <div className="p-6 pt-0">
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl border-dashed">
            <p className="text-xs text-indigo-900 leading-relaxed">
              <span className="font-bold">INTEGRATION:</span> Approved outcomes auto-propagate to the{" "}
              <span className="text-primary font-bold">Compensation &amp; Benefits</span> module.
            </p>
          </div>
        </div>
      </Card>

      {/* ── Save Settings ─────────────────────────────────────── */}
      <div className="flex justify-end gap-3 pb-6">
        <Button variant="outline" onClick={() => window.location.reload()}>Discard Changes</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save All Settings"}
        </Button>
      </div>

    </div>
  );
}
