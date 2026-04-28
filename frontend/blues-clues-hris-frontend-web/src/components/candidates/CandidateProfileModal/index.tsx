"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { getApplicationDetail, type ApplicationDetail } from "@/lib/authApi";
import { getApplicationStatusStyle, getNormalizedStatusLabel } from "@/components/candidates/ApplicationStatusBadge";
import { getFitScoreClasses } from "@/components/candidates/rankingStyles";
import { ProfileLoadingState } from "./ProfileLoadingState";
import { ProfileErrorState } from "./ProfileErrorState";
import { ProfileBody } from "./ProfileBody";

export function CandidateProfileModal({
  applicationId,
  onClose,
}: Readonly<{
  applicationId: string;
  onClose: () => void;
}>) {
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getApplicationDetail(applicationId);
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load applicant profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getApplicationDetail(applicationId)
      .then((data) => {
        if (active) setDetail(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to load applicant profile");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applicationId]);

  const profile = detail?.applicant_profile;
  const applicantName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "Applicant Profile";
  const initials = profile
    ? `${profile.first_name?.charAt(0) ?? ""}${profile.last_name?.charAt(0) ?? ""}`.toUpperCase() || "?"
    : "?";
  const normalizedStatus = detail ? getNormalizedStatusLabel(detail.status) : "";
  const statusStyle = detail ? getApplicationStatusStyle(detail.status) : "";
  const sfiaScore = detail?.sfia_match_percentage ?? detail?.survey_score ?? null;
  const sfiaScoreRounded = sfiaScore == null ? null : Math.round(sfiaScore);

  let content: ReactNode = null;
  if (loading) {
    content = <ProfileLoadingState />;
  } else if (error) {
    content = <ProfileErrorState error={error} onRetry={loadDetail} />;
  } else if (detail && profile) {
    content = <ProfileBody detail={detail} profile={profile} />;
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="relative shrink-0 bg-[linear-gradient(135deg,#0f172a_0%,#1e3a8a_60%,#1e1b4b_100%)] px-5 pb-14 pt-5">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 cursor-pointer rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Applicant Profile</p>
          <h3 className="mt-1.5 truncate pr-8 text-xl font-bold text-white">{applicantName}</h3>
          {profile?.email && (
            <p className="mt-0.5 max-w-sm truncate text-sm text-white/60" title={profile.email}>
              {profile.email}
            </p>
          )}
        </div>

        <div className="relative shrink-0 px-5">
          <div className="-mt-7 flex items-end justify-between">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border-4 border-card bg-primary text-lg font-bold text-primary-foreground shadow-md">
              {initials}
            </div>
            {detail && !loading && (
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${statusStyle}`}>
                  {normalizedStatus}
                </span>
                {sfiaScoreRounded !== null && (
                  <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${getFitScoreClasses(sfiaScoreRounded)}`}>
                    {sfiaScoreRounded}% Fit
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-5 pt-3">{content}</div>
      </div>
    </div>
  );
}
