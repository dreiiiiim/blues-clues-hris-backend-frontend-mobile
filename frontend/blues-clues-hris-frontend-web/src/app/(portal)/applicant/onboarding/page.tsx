"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getMyOnboarding, getApplicantProfile, saveOnboarding, submitOnboarding,
  type OnboardingSubmission, type ApplicantProfile,
} from "@/lib/authApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle2, Clock, Loader2, Send, UserCheck, XCircle,
} from "lucide-react";
import { DateOfBirthPicker } from "@/components/ui/date-of-birth-picker";
import { toast } from "sonner";

type Stage = "loading" | "form" | "submitted" | "approved" | "rejected";

function StatusBanner({ status, hrNotes }: { status: Stage; hrNotes?: string | null }) {
  if (status === "submitted") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
        <Clock className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-800">Submitted — Awaiting HR Review</p>
          <p className="text-xs text-blue-600 mt-0.5">
            Your profile has been submitted. HR will review and create your employee account.
          </p>
        </div>
      </div>
    );
  }
  if (status === "approved") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-emerald-800">Approved — Check your email</p>
          <p className="text-xs text-emerald-600 mt-0.5">
            HR approved your onboarding. An invite link was sent to your email to set up your employee account.
          </p>
        </div>
      </div>
    );
  }
  if (status === "rejected") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
        <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-red-800">Rejected — Please revise and resubmit</p>
          {hrNotes && <p className="text-xs text-red-600 mt-0.5">HR note: {hrNotes}</p>}
        </div>
      </div>
    );
  }
  return null;
}

export default function ApplicantOnboardingPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("loading");
  const [record, setRecord] = useState<OnboardingSubmission | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    first_name: "", last_name: "", phone: "", address: "",
    date_of_birth: "", nationality: "", civil_status: "",
    emergency_contact_name: "", emergency_contact_phone: "",
    emergency_contact_relationship: "", preferred_username: "",
  });

  useEffect(() => {
    getMyOnboarding()
      .then((rec) => {
        if (!rec) { router.replace("/applicant/dashboard"); return; }
        setRecord(rec);
        setForm({
          first_name:                    rec.first_name ?? "",
          last_name:                     rec.last_name ?? "",
          phone:                         rec.phone ?? "",
          address:                       rec.address ?? "",
          date_of_birth:                 rec.date_of_birth ?? "",
          nationality:                   rec.nationality ?? "",
          civil_status:                  rec.civil_status ?? "",
          emergency_contact_name:        rec.emergency_contact_name ?? "",
          emergency_contact_phone:       rec.emergency_contact_phone ?? "",
          emergency_contact_relationship: rec.emergency_contact_relationship ?? "",
          preferred_username:            rec.preferred_username ?? "",
        });
        const s = rec.status;
        setStage(
          s === "approved" ? "approved"
          : s === "submitted" ? "submitted"
          : s === "rejected"  ? "rejected"
          : "form"
        );
        // Autofill blank fields from applicant profile
        if (s !== "submitted" && s !== "approved") {
          getApplicantProfile().then((p: ApplicantProfile) => {
            setForm((prev) => ({
              ...prev,
              first_name:    prev.first_name    || p.first_name  || "",
              last_name:     prev.last_name     || p.last_name   || "",
              phone:         prev.phone         || p.phone_number || "",
              address:       prev.address       || p.complete_address || "",
              date_of_birth: prev.date_of_birth || p.date_of_birth || "",
              nationality:   prev.nationality   || p.nationality  || "",
              civil_status:  prev.civil_status  || p.civil_status || "",
            }));
          }).catch(() => {});
        }
      })
      .catch(() => router.replace("/applicant/dashboard"));
  }, [router]);

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveOnboarding(form);
      toast.success("Progress saved.");
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    const required: [string, string][] = [
      ["first_name", "First name"], ["last_name", "Last name"],
      ["phone", "Phone number"], ["address", "Address"],
      ["date_of_birth", "Date of birth"], ["nationality", "Nationality"],
      ["civil_status", "Civil status"],
      ["emergency_contact_name", "Emergency contact name"],
      ["emergency_contact_phone", "Emergency contact phone"],
      ["preferred_username", "Preferred username"],
    ];
    const missing = required.filter(([k]) => !form[k as keyof typeof form].trim()).map(([, l]) => l);
    if (missing.length) { toast.error(`Missing: ${missing.join(", ")}`); return; }
    if (/\s/.test(form.preferred_username)) { toast.error("Username must not contain spaces."); return; }

    setSubmitting(true);
    try {
      await saveOnboarding(form);
      await submitOnboarding();
      setStage("submitted");
      toast.success("Onboarding submitted! HR will review shortly.");
    } catch (e: any) {
      toast.error(e?.message ?? "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (stage === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[300px] gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  const isReadOnly = stage === "submitted" || stage === "approved";
  const jobTitle = (record as any)?.job_postings?.title;

  return (
    <div className="animate-in fade-in duration-500 max-w-3xl mx-auto space-y-6">
      {/* Hero */}
      <div className="rounded-[22px] bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] text-white px-8 py-10 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60 mb-2">
          Candidate Portal
        </p>
        <h1 className="text-2xl font-bold tracking-tight mb-1">New Hire Onboarding</h1>
        {jobTitle && (
          <p className="text-sm text-white/70">Position: <span className="font-semibold text-white">{jobTitle}</span></p>
        )}
      </div>

      <StatusBanner status={stage} hrNotes={record?.hr_notes} />

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal Information</CardTitle>
          <CardDescription className="text-xs">Required for your employee account setup</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">First Name *</Label>
              <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} disabled={isReadOnly} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Last Name *</Label>
              <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} disabled={isReadOnly} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone Number *</Label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} disabled={isReadOnly} placeholder="+63 9XX XXX XXXX" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Date of Birth *</Label>
              <DateOfBirthPicker value={form.date_of_birth} onChange={(v) => set("date_of_birth", v)} disabled={isReadOnly} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nationality *</Label>
              <Input value={form.nationality} onChange={(e) => set("nationality", e.target.value)} disabled={isReadOnly} placeholder="e.g. Filipino" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Civil Status *</Label>
              {isReadOnly ? (
                <Input value={form.civil_status || "—"} disabled />
              ) : (
                <Select value={form.civil_status} onValueChange={(v) => set("civil_status", v)}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {["Single","Married","Widowed","Separated"].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Complete Address *</Label>
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} disabled={isReadOnly} placeholder="Street, Barangay, City, Province, ZIP" />
          </div>
        </CardContent>
      </Card>

      {/* Emergency Contact */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Emergency Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Full Name *</Label>
              <Input value={form.emergency_contact_name} onChange={(e) => set("emergency_contact_name", e.target.value)} disabled={isReadOnly} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone *</Label>
              <Input value={form.emergency_contact_phone} onChange={(e) => set("emergency_contact_phone", e.target.value)} disabled={isReadOnly} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Relationship</Label>
              <Input value={form.emergency_contact_relationship} onChange={(e) => set("emergency_contact_relationship", e.target.value)} disabled={isReadOnly} placeholder="e.g. Mother" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Setup */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account Setup</CardTitle>
          <CardDescription className="text-xs">This will be your login username as an employee</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label className="text-xs">Preferred Username * <span className="font-normal text-muted-foreground">(no spaces)</span></Label>
            <Input
              value={form.preferred_username}
              onChange={(e) => set("preferred_username", e.target.value.replace(/\s/g, ""))}
              disabled={isReadOnly}
              placeholder="e.g. juan.delacruz"
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      {!isReadOnly && (
        <div className="flex gap-3 pb-8">
          <Button variant="outline" onClick={handleSave} disabled={saving || submitting} className="flex-1">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Draft
          </Button>
          <Button onClick={handleSubmit} disabled={saving || submitting} className="flex-1">
            {submitting
              ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
              : <Send className="h-4 w-4 mr-2" />}
            Submit to HR
          </Button>
        </div>
      )}
    </div>
  );
}
