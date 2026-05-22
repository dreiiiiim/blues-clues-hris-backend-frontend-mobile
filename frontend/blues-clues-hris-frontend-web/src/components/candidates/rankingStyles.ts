const RANK_BADGE_STYLES = [
  "bg-amber-100 text-amber-700 border border-amber-300",
  "bg-slate-100 text-slate-600 border border-slate-300",
  "bg-orange-50 text-orange-600 border border-orange-200",
] as const;

const RANK_STAR_STYLES = [
  "fill-amber-500 text-amber-500",
  "fill-slate-400 text-slate-400",
  "fill-orange-400 text-orange-400",
] as const;

const PODIUM_BG_STYLES = ["bg-amber-100", "bg-slate-100", "bg-orange-50"] as const;
const PODIUM_ICON_STYLES = ["text-amber-600", "text-slate-500", "text-orange-500"] as const;

export function fitTextColor(pct: number): string {
  if (pct >= 80) return "text-green-600";
  if (pct >= 60) return "text-amber-600";
  return "text-red-500";
}

export function getFitScoreClasses(score: number): string {
  if (score >= 80) return "bg-green-50 text-green-700 border-green-200";
  if (score >= 60) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-muted text-muted-foreground border-border";
}

export function rankBadgeStyle(rank: number): string {
  return RANK_BADGE_STYLES[rank - 1] ?? "bg-muted text-muted-foreground border border-border";
}

export function rankStarClass(rank: number): string {
  return RANK_STAR_STYLES[rank - 1] ?? RANK_STAR_STYLES[2];
}

export function podiumBg(index: number): string {
  return PODIUM_BG_STYLES[index] ?? PODIUM_BG_STYLES[2];
}

export function podiumIconColor(index: number): string {
  return PODIUM_ICON_STYLES[index] ?? PODIUM_ICON_STYLES[2];
}
