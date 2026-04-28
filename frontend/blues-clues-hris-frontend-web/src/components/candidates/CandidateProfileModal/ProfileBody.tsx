import { ExternalLink, FileText, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ApplicationDetail } from "@/lib/authApi";

function openResume(url: string, name?: string | null) {
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (opened) opened.opener = null;
  if (!opened && name) {
    window.location.href = url;
  }
}

export function ProfileBody({
  detail,
  profile,
}: Readonly<{
  detail: ApplicationDetail;
  profile: NonNullable<ApplicationDetail["applicant_profile"]>;
}>) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
          <p className="text-[10px] font-semibold text-muted-foreground">Code</p>
          <p className="mt-0.5 font-mono text-sm font-bold">{profile.applicant_code ?? "-"}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
          <p className="text-[10px] font-semibold text-muted-foreground">Applied</p>
          <p className="mt-0.5 text-sm font-semibold">{new Date(detail.applied_at).toLocaleDateString()}</p>
        </div>
        <div className="min-w-0 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
          <p className="text-[10px] font-semibold text-muted-foreground">Email</p>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
            <Mail className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm font-semibold" title={profile.email}>
              {profile.email}
            </span>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
          <p className="text-[10px] font-semibold text-muted-foreground">Phone</p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <Phone className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="text-sm font-semibold">{profile.phone_number ?? "-"}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-background p-3.5">
          <p className="mb-2.5 text-[10px] font-semibold text-muted-foreground">SFIA Resume</p>
          {detail.resume_upload?.signed_url ? (
            <div className="space-y-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-full justify-start gap-1.5 text-xs"
                onClick={() => openResume(detail.resume_upload!.signed_url, detail.resume_upload!.file_name)}
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                View SFIA Resume
                <ExternalLink className="ml-auto h-3 w-3" />
              </Button>
              <p className="truncate px-1 text-[10px] text-muted-foreground" title={detail.resume_upload.file_name}>
                {detail.resume_upload.file_name}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 py-2 text-center">
              <FileText className="h-6 w-6 text-muted-foreground/25" />
              <p className="text-[10px] text-muted-foreground">No SFIA resume</p>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-background p-3.5">
          <p className="mb-2.5 text-[10px] font-semibold text-muted-foreground">Profile Resume</p>
          {profile.resume_url ? (
            <div className="space-y-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-full justify-start gap-1.5 text-xs"
                onClick={() => openResume(profile.resume_url!, profile.resume_name)}
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                View Profile Resume
                <ExternalLink className="ml-auto h-3 w-3" />
              </Button>
              {profile.resume_name && (
                <p className="truncate px-1 text-[10px] text-muted-foreground" title={profile.resume_name}>
                  {profile.resume_name}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 py-2 text-center">
              <FileText className="h-6 w-6 text-muted-foreground/25" />
              <p className="text-[10px] text-muted-foreground">No resume uploaded</p>
            </div>
          )}
        </div>
      </div>

      {detail.answers.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Application Answers</p>
          {detail.answers.map((answer) => (
            <div key={answer.answer_id} className="rounded-xl border border-border bg-muted/10 px-4 py-3">
              <p className="text-xs font-semibold">{answer.application_questions.question_text}</p>
              <p className="mt-1 text-sm text-muted-foreground">{String(answer.answer_value ?? "No answer")}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
