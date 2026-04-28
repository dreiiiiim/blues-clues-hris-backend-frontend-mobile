import { BookOpen, CheckCircle2, Loader2, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SfiaSkill } from "@/lib/authApi";

const SFIA_LEVEL_LABELS = [
  "Beginner - needs close supervision (Trainee / Intern)",
  "Assisted - works with guidance on routine tasks (Entry-level)",
  "Applied - works independently on own initiative (Junior / Mid)",
  "Enabled - plans own work and guides teammates (Senior)",
  "Managed - leads team, accountable for outcomes (Team Lead)",
  "Initiating - shapes org-wide programs, drives strategy (Principal)",
  "Strategic - sets company direction and policies (VP / Director)",
];

const CATEGORY_COLORS: Record<string, string> = {
  Business: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  Development: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800",
  Strategy: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
  Operation: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
  Relationships: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
  Management: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800",
  Analytics: "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-800",
  Security: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
};

function getCategoryColor(category: string | null): string {
  return CATEGORY_COLORS[category ?? ""] ?? "bg-muted text-muted-foreground border-border";
}

function getLevelDesc(skill: SfiaSkill, level: number): string {
  const desc = (skill as Record<string, unknown>)[`level_${level}_desc`] as string | null;
  if (!desc) return SFIA_LEVEL_LABELS[level - 1] ?? `Level ${level}`;
  return `L${level} - ${desc.slice(0, 60)}${desc.length > 60 ? "..." : ""}`;
}

export function Step3SfiaSkills({
  sfiaSearch,
  setSfiaSearch,
  handleSuggestSfia,
  suggestingSfia,
  sfiaLoading,
  sfiaSelected,
  sfiaFiltered,
  toggleSfiaSkill,
  setSfiaLevel,
  handleSkipSfia,
  handleSaveSfia,
  savingSfia,
}: Readonly<{
  sfiaSearch: string;
  setSfiaSearch: (value: string) => void;
  handleSuggestSfia: () => Promise<void>;
  suggestingSfia: boolean;
  sfiaLoading: boolean;
  sfiaSelected: Map<string, number>;
  sfiaFiltered: SfiaSkill[];
  toggleSfiaSkill: (skillId: string) => void;
  setSfiaLevel: (skillId: string, level: number) => void;
  handleSkipSfia: () => void;
  handleSaveSfia: () => Promise<void>;
  savingSfia: boolean;
}>) {
  return (
    <div className="space-y-3">
      <Input placeholder="Search skills..." value={sfiaSearch} onChange={(e) => setSfiaSearch(e.target.value)} className="h-9 text-xs" />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void handleSuggestSfia()}
        disabled={suggestingSfia || sfiaLoading}
        className="h-9 w-full gap-2 border-violet-200 bg-violet-50/50 text-xs text-violet-700 transition-all duration-200 hover:border-violet-300 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-900/20 dark:text-violet-300 dark:hover:bg-violet-900/40"
      >
        {suggestingSfia ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        Auto-suggest skills from job description
      </Button>
      <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-3.5 py-3 dark:border-blue-900/40 dark:bg-blue-950/20">
        <div className="mb-1 flex items-center gap-1.5">
          <BookOpen className="h-3 w-3 text-blue-600 dark:text-blue-400" />
          <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-400">How skill levels work</p>
        </div>
        <p className="text-[10px] leading-relaxed text-blue-600/80 dark:text-blue-300/70">
          Check a skill, then set the <span className="font-semibold">minimum experience level</span> required.
          <span className="mt-0.5 block">Beginner to trainee, Applied to independent work, Managed to team lead, Strategic to director.</span>
        </p>
      </div>
      {sfiaSelected.size > 0 && (
        <div className="flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">{sfiaSelected.size} skill{sfiaSelected.size !== 1 ? "s" : ""} selected</span>
          <span className="ml-auto text-xs text-muted-foreground">Applicants scored against these</span>
        </div>
      )}
      <div className="max-h-[34vh] space-y-1.5 overflow-y-auto pr-1">
        {sfiaLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading skills...
          </div>
        ) : sfiaFiltered.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">No skills match your search.</p>
        ) : (
          sfiaFiltered.map((skill) => {
            const isChecked = sfiaSelected.has(skill.skill_id);
            const level = sfiaSelected.get(skill.skill_id) ?? 3;
            return (
              <div
                key={skill.skill_id}
                className={`space-y-2 rounded-xl border p-3 transition-all duration-150 ${isChecked ? "border-primary/40 bg-primary/5 dark:bg-primary/10" : "border-border bg-background hover:bg-muted/30"}`}
              >
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input type="checkbox" checked={isChecked} onChange={() => toggleSfiaSkill(skill.skill_id)} className="h-4 w-4 shrink-0 rounded accent-primary" />
                  <span className="flex-1 text-xs font-medium leading-tight">{skill.skill}</span>
                  {skill.category && (
                    <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${getCategoryColor(skill.category)}`}>
                      {skill.category}
                    </span>
                  )}
                </label>
                {isChecked && (
                  <select
                    value={level}
                    onChange={(e) => setSfiaLevel(skill.skill_id, Number(e.target.value))}
                    className="h-8 w-full rounded-lg border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((l) => (
                      <option key={l} value={l}>{getLevelDesc(skill, l)}</option>
                    ))}
                  </select>
                )}
              </div>
            );
          })
        )}
      </div>
      <div className="flex gap-3 pt-1">
        <Button type="button" variant="ghost" className="gap-1.5 text-muted-foreground" onClick={handleSkipSfia} disabled={savingSfia}>
          Skip for now
        </Button>
        <Button className="flex-1 gap-1.5" onClick={() => void handleSaveSfia()} disabled={savingSfia || sfiaLoading}>
          {savingSfia ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Zap className="h-4 w-4" /><span>Save & Finish</span></>}
        </Button>
      </div>
    </div>
  );
}
