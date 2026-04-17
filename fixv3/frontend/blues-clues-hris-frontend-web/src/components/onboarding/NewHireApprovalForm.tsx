"use client";

import { useState, useEffect } from "react";
import {
  getMyOnboarding,
  saveOnboarding,
  submitOnboarding,
  getApplicantProfile,
  OnboardingSubmission,
} from "@/lib/authApi";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, Clock, AlertTriangle, Send, UserCheck, Plus, Minus, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type EmergencyContact = {
  contact_name: string;
  relationship: string;
  emergency_phone_number: string;
  emergency_email_address: string;
};

type FormData = {
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  date_of_birth: string;
  nationality: string;
  civil_status: string;
  preferred_username: string;
};

// ─── DOB Picker ───────────────────────────────────────────────────────────────

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getDaysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

function DOBPicker({
  value,
  onChange,
  disabled,
}: Readonly<{ value: string; onChange: (v: string) => void; disabled?: boolean }>) {
  // value format: YYYY-MM-DD or ""
  const parts = value ? value.split("-") : ["", "", ""];
  const year  = parts[0] ?? "";
  const month = parts[1] ?? "";
  const day   = parts[2] ?? "";

  const numYear  = parseInt(year) || 0;
  const numMonth = parseInt(month) || 0;
  const maxDay   = numYear && numMonth ? getDaysInMonth(numMonth, numYear) : 31;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);
  const days  = Array.from({ length: maxDay }, (_, i) => i + 1);

  function emit(y: string, m: string, d: string) {
    if (y && m && d) {
      const clampedDay = Math.min(parseInt(d), getDaysInMonth(parseInt(m), parseInt(y)));
      onChange(`${y}-${m.padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`);
    } else {
      onChange("");
    }
  }

  const selectClass =
    "flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="grid grid-cols-3 gap-2">
      <select
        value={month}
        onChange={(e) => emit(year, e.target.value, day)}
        disabled={disabled}
        className={selectClass}
        aria-label="Month"
      >
        <option value="">Month</option>
        {MONTHS.map((m, i) => (
          <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>
        ))}
      </select>
      <select
        value={day}
        onChange={(e) => emit(year, month, e.target.value)}
        disabled={disabled}
        className={selectClass}
        aria-label="Day"
      >
        <option value="">Day</option>
        {days.map((d) => (
          <option key={d} value={String(d).padStart(2, "0")}>{d}</option>
        ))}
      </select>
      <select
        value={year}
        onChange={(e) => emit(e.target.value, month, day)}
        disabled={disabled}
        className={selectClass}
        aria-label="Year"
      >
        <option value="">Year</option>
        {years.map((y) => (
          <option key={y} value={String(y)}>{y}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const emptyContact = (): EmergencyContact => ({
  contact_name: "",
  relationship: "",
  emergency_phone_number: "",
  emergency_email_address: "",
});

const emptyForm = (): FormData => ({
  first_name: "",
  last_name: "",
  phone: "",
  address: "",
  date_of_birth: "",
  nationality: "",
  civil_status: "",
  preferred_username: "",
});

function seedForm(sub: OnboardingSubmission | null): FormData {
  if (!sub) return emptyForm();
  return {
    first_name: sub.first_name ?? "",
    last_name: sub.last_name ?? "",
    phone: sub.phone ?? "",
    address: sub.address ?? "",
    date_of_birth: sub.date_of_birth ?? "",
    nationality: sub.nationality ?? "",
    civil_status: sub.civil_status ?? "",
    preferred_username: sub.preferred_username ?? "",
  };
}

function seedContacts(sub: OnboardingSubmission | null): EmergencyContact[] {
  if (!sub) return [emptyContact()];
  // Legacy single-contact fields
  const legacy: EmergencyContact = {
    contact_name: sub.emergency_contact_name ?? "",
    relationship: sub.emergency_contact_relationship ?? "",
    emergency_phone_number: sub.emergency_contact_phone ?? "",
    emergency_email_address: "",
  };
  if (legacy.contact_name || legacy.emergency_phone_number) return [legacy];
  return [emptyContact()];
}

function normalizeForm(form: FormData): FormData {
  return {
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    phone: form.phone.trim(),
    address: form.address.trim(),
    date_of_birth: form.date_of_birth.trim(),
    nationality: form.nationality.trim(),
    civil_status: form.civil_status.trim(),
    preferred_username: form.preferred_username.trim(),
  };
}

function getMissingRequiredFields(form: FormData, contacts: EmergencyContact[]): string[] {
  const required: Array<[keyof FormData, string]> = [
    ["first_name", "first name"],
    ["last_name", "last name"],
    ["phone", "phone"],
    ["address", "address"],
    ["date_of_birth", "date of birth"],
    ["nationality", "nationality"],
    ["civil_status", "civil status"],
    ["preferred_username", "preferred username"],
  ];
  const missing = required
    .filter(([key]) => !form[key].trim())
    .map(([, label]) => label);

  const primaryContact = contacts[0];
  if (!primaryContact?.contact_name.trim()) missing.push("emergency contact name");
  if (!primaryContact?.emergency_phone_number.trim()) missing.push("emergency contact phone");
  if (!primaryContact?.relationship.trim()) missing.push("emergency contact relationship");

  return missing;
}

function buildSavePayload(form: FormData, contacts: EmergencyContact[]) {
  const primary = contacts[0] ?? emptyContact();
  return {
    ...normalizeForm(form),
    // Legacy single-contact fields (existing API)
    emergency_contact_name: primary.contact_name.trim(),
    emergency_contact_phone: primary.emergency_phone_number.trim(),
    emergency_contact_relationship: primary.relationship.trim(),
    // Array field for future backend support
    emergency_contacts: contacts.map((c) => ({
      contact_name: c.contact_name.trim(),
      relationship: c.relationship.trim(),
      emergency_phone_number: c.emergency_phone_number.trim(),
      emergency_email_address: c.emergency_email_address.trim(),
    })),
  };
}

// ─── Field label component ────────────────────────────────────────────────────

function FieldLabel({ htmlFor, children, required }: Readonly<{ htmlFor?: string; children: React.ReactNode; required?: boolean }>) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-gray-700 block mb-1.5">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

// ─── Main Component ───────────────────────────────────────────────────────────

export function NewHireApprovalForm() {
  const [submission, setSubmission]   = useState<OnboardingSubmission | null>(null);
  const [form, setForm]               = useState<FormData>(emptyForm());
  const [contacts, setContacts]       = useState<EmergencyContact[]>([emptyContact()]);
  const [loading, setLoading]         = useState(true);
  const [autofilling, setAutofilling] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [saveError, setSaveError]     = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [savedOk, setSavedOk]         = useState(false);

  useEffect(() => {
    getMyOnboarding()
      .then((data) => {
        setSubmission(data);
        setForm(seedForm(data));
        setContacts(seedContacts(data));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSavedOk(false);
  };

  const setContact = (index: number, field: keyof EmergencyContact, value: string) => {
    setContacts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setSavedOk(false);
  };

  const addContact = () => {
    setContacts((prev) => [...prev, emptyContact()]);
  };

  const removeContact = (index: number) => {
    setContacts((prev) => prev.filter((_, i) => i !== index));
  };

  // 2a — Autofill from applicant profile
  const handleAutofill = async () => {
    setAutofilling(true);
    try {
      const profile = await getApplicantProfile();
      setForm((prev) => ({
        ...prev,
        first_name:    profile.first_name   || prev.first_name,
        last_name:     profile.last_name    || prev.last_name,
        phone:         profile.phone_number || prev.phone,
        address:       profile.complete_address || prev.address,
        date_of_birth: profile.date_of_birth   || prev.date_of_birth,
        nationality:   profile.nationality     || prev.nationality,
        civil_status:  profile.civil_status    || prev.civil_status,
      }));
      setSavedOk(false);
      toast.success("Fields filled from your profile — review before submitting.");
    } catch {
      toast.error("Could not load profile data. Please fill in the fields manually.");
    } finally {
      setAutofilling(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSavedOk(false);
    try {
      const payload = buildSavePayload(form, contacts);
      const updated = await saveOnboarding(payload);
      setSubmission(updated as OnboardingSubmission);
      setForm(seedForm(updated as OnboardingSubmission));
      setContacts(seedContacts(updated as OnboardingSubmission));
      setSavedOk(true);
    } catch (err: any) {
      setSaveError(err?.message || "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    const payload = buildSavePayload(normalizeForm(form), contacts);
    const missing = getMissingRequiredFields(normalizeForm(form), contacts);
    if (missing.length > 0) {
      setSubmitError(`Please complete required fields before submitting: ${missing.join(", ")}.`);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSavedOk(false);
    try {
      const saved = await saveOnboarding(payload);
      setSubmission(saved);
      setForm(seedForm(saved));
      setContacts(seedContacts(saved));
      const updated = await submitOnboarding();
      setSubmission(updated);
      setForm(seedForm(updated));
      setContacts(seedContacts(updated));
    } catch (err: any) {
      setSubmitError(err?.message || "Failed to submit. Please fill in all required fields.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-muted-foreground animate-pulse">Loading your onboarding form...</div>;
  }

  if (!submission) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center space-y-2 max-w-md">
          <h2 className="text-xl font-semibold text-slate-800">No onboarding record found.</h2>
          <p className="text-slate-500">Please contact HR if you believe this is an error.</p>
        </div>
      </div>
    );
  }

  const status = submission.status;
  const isReadOnly = status === "submitted" || status === "approved";

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-slate-800">Welcome Aboard!</h2>
        <p className="text-slate-500 mt-1 text-sm">
          Please complete your onboarding profile. HR will review and activate your employee account.
        </p>
        {submission.job_postings?.title && (
          <p className="text-sm text-slate-400 mt-0.5">
            Position: <span className="font-medium text-slate-600">{submission.job_postings.title}</span>
          </p>
        )}
      </div>

      {/* Status banners */}
      {status === "submitted" && (
        <Alert className="bg-blue-50 border-blue-200">
          <Clock className="size-4 text-blue-600 shrink-0 mt-0.5" />
          <AlertDescription className="text-blue-800 text-sm">
            Your profile has been <strong>submitted</strong> and is awaiting HR review. You will be notified once it is processed.
          </AlertDescription>
        </Alert>
      )}

      {status === "approved" && (
        <Alert className="bg-emerald-50 border-emerald-200">
          <CheckCircle className="size-4 text-emerald-600 shrink-0 mt-0.5" />
          <AlertDescription className="text-emerald-800 text-sm">
            Your profile has been <strong>approved</strong>. Check your email for your employee account credentials.
          </AlertDescription>
        </Alert>
      )}

      {status === "rejected" && submission.hr_notes && (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
          <AlertDescription className="text-amber-800 text-sm">
            <p className="font-semibold">HR has requested changes:</p>
            <p className="mt-0.5">{submission.hr_notes}</p>
          </AlertDescription>
        </Alert>
      )}

      <ScrollArea className="h-[calc(100vh-280px)] pr-4">
        <div className="space-y-5">

          {/* Personal Information */}
          <Card className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="text-base font-semibold text-gray-900">Personal Information</CardTitle>
                  <CardDescription className="text-xs mt-0.5">Fields marked * are required to submit.</CardDescription>
                </div>
                {/* 2a — Autofill button */}
                {!isReadOnly && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAutofill}
                    disabled={autofilling}
                    className="h-8 px-3 text-xs border-blue-200 text-blue-700 hover:bg-blue-50 shrink-0"
                  >
                    {autofilling ? (
                      <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Auto-filling…</>
                    ) : (
                      <><UserCheck className="h-3 w-3 mr-1.5" />Auto-fill from my profile</>
                    )}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel htmlFor="first_name" required>First Name</FieldLabel>
                  <Input id="first_name" value={form.first_name} onChange={(e) => set("first_name", e.target.value)} disabled={isReadOnly} />
                </div>
                <div>
                  <FieldLabel htmlFor="last_name" required>Last Name</FieldLabel>
                  <Input id="last_name" value={form.last_name} onChange={(e) => set("last_name", e.target.value)} disabled={isReadOnly} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel htmlFor="phone" required>Phone Number</FieldLabel>
                  <Input id="phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} disabled={isReadOnly} />
                </div>
                <div>
                  {/* 2c — DOB picker with dropdowns */}
                  <FieldLabel required>Date of Birth</FieldLabel>
                  <DOBPicker
                    value={form.date_of_birth}
                    onChange={(v) => set("date_of_birth", v)}
                    disabled={isReadOnly}
                  />
                </div>
              </div>

              <div>
                <FieldLabel htmlFor="address" required>Complete Address</FieldLabel>
                <Input id="address" value={form.address} onChange={(e) => set("address", e.target.value)} disabled={isReadOnly} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel htmlFor="nationality" required>Nationality</FieldLabel>
                  <Input id="nationality" value={form.nationality} onChange={(e) => set("nationality", e.target.value)} disabled={isReadOnly} />
                </div>
                <div>
                  <FieldLabel htmlFor="civil_status" required>Civil Status</FieldLabel>
                  <select
                    id="civil_status"
                    value={form.civil_status}
                    onChange={(e) => set("civil_status", e.target.value)}
                    disabled={isReadOnly}
                    className={selectClass}
                  >
                    <option value="">Select...</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Separated">Separated</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Emergency Contacts — 2b dynamic list */}
          <Card className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold text-gray-900">Emergency Contacts</CardTitle>
                  <CardDescription className="text-xs mt-0.5">At least one contact required.</CardDescription>
                </div>
                {!isReadOnly && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addContact}
                    className="h-8 px-3 text-xs border-gray-200 text-gray-700 hover:bg-gray-50 shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Contact
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              {contacts.map((contact, index) => (
                <div
                  key={index}
                  className={`rounded-xl border border-gray-100 bg-gray-50/60 p-4 space-y-3 ${index > 0 ? "relative" : ""}`}
                >
                  {contacts.length > 1 && (
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact {index + 1}</p>
                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => removeContact(index)}
                          className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors cursor-pointer"
                          title="Remove contact"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <FieldLabel htmlFor={`ec_name_${index}`} required={index === 0}>Full Name</FieldLabel>
                      <Input
                        id={`ec_name_${index}`}
                        value={contact.contact_name}
                        onChange={(e) => setContact(index, "contact_name", e.target.value)}
                        disabled={isReadOnly}
                        placeholder="e.g. Maria Santos"
                      />
                    </div>
                    <div>
                      <FieldLabel htmlFor={`ec_rel_${index}`} required={index === 0}>Relationship</FieldLabel>
                      <Input
                        id={`ec_rel_${index}`}
                        value={contact.relationship}
                        onChange={(e) => setContact(index, "relationship", e.target.value)}
                        disabled={isReadOnly}
                        placeholder="e.g. Mother"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <FieldLabel htmlFor={`ec_phone_${index}`} required={index === 0}>Phone Number</FieldLabel>
                      <Input
                        id={`ec_phone_${index}`}
                        type="tel"
                        value={contact.emergency_phone_number}
                        onChange={(e) => setContact(index, "emergency_phone_number", e.target.value)}
                        disabled={isReadOnly}
                        placeholder="+63 9XX XXX XXXX"
                      />
                    </div>
                    <div>
                      <FieldLabel htmlFor={`ec_email_${index}`}>Email (optional)</FieldLabel>
                      <Input
                        id={`ec_email_${index}`}
                        type="email"
                        value={contact.emergency_email_address}
                        onChange={(e) => setContact(index, "emergency_email_address", e.target.value)}
                        disabled={isReadOnly}
                        placeholder="email@example.com"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Account Setup */}
          <Card className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-gray-900">Account Setup</CardTitle>
              <CardDescription className="text-xs mt-0.5">Choose your preferred employee username for logging in.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div>
                <FieldLabel htmlFor="preferred_username" required>Preferred Username</FieldLabel>
                <Input
                  id="preferred_username"
                  value={form.preferred_username}
                  onChange={(e) => set("preferred_username", e.target.value)}
                  disabled={isReadOnly}
                  placeholder="e.g. jdelacruz"
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          {!isReadOnly && (
            <div className="space-y-3 pb-4">
              {saveError && (
                <Alert className="bg-red-50 border-red-200">
                  <AlertDescription className="text-red-700 text-sm">{saveError}</AlertDescription>
                </Alert>
              )}
              {submitError && (
                <Alert className="bg-red-50 border-red-200">
                  <AlertDescription className="text-red-700 text-sm">{submitError}</AlertDescription>
                </Alert>
              )}
              {savedOk && (
                <Alert className="bg-emerald-50 border-emerald-200">
                  <CheckCircle className="size-4 text-emerald-600 shrink-0" />
                  <AlertDescription className="text-emerald-700 text-sm">Draft saved successfully.</AlertDescription>
                </Alert>
              )}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 cursor-pointer" onClick={handleSave} disabled={saving || submitting}>
                  {saving ? <><Loader2 className="size-4 mr-2 animate-spin" />Saving…</> : "Save Draft"}
                </Button>
                <Button className="flex-1 cursor-pointer" onClick={handleSubmit} disabled={saving || submitting}>
                  {submitting ? (
                    <><Loader2 className="size-4 mr-2 animate-spin" />Submitting…</>
                  ) : (
                    <><Send className="size-4 mr-2" />Submit for Review</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
