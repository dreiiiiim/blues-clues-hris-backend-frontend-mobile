import { useState } from "react";
import { confirmTask } from "@/lib/onboardingApi";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { HRFormItem, Remark } from "@/types/onboarding.types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DetailedStatusBadge } from "./shared/StatusBadge";
import { RemarksSection } from "./shared/RemarksSection";

interface HRFormsProps {
  forms: HRFormItem[];
  remarks: Remark[];
  onUpdate: (forms: HRFormItem[]) => void;
}

interface FormField {
  label: string;
  type: string;
  required: boolean;
}

interface StatutoryFieldFormat {
  maxLength: number;
  placeholder: string;
  format: (digits: string) => string;
}

const STATUTORY_FIELD_FORMATS: Record<string, StatutoryFieldFormat> = {
  sss: {
    maxLength: 12,
    placeholder: "12-3456789-0",
    format: (digits) => {
      const value = digits.slice(0, 10);
      const groups = [value.slice(0, 2), value.slice(2, 9), value.slice(9, 10)];
      return groups.filter(Boolean).join("-");
    },
  },
  philhealth: {
    maxLength: 15,
    placeholder: "12-345678901-2",
    format: (digits) => {
      const value = digits.slice(0, 12);
      const groups = [value.slice(0, 2), value.slice(2, 11), value.slice(11, 12)];
      return groups.filter(Boolean).join("-");
    },
  },
  pagibig: {
    maxLength: 14,
    placeholder: "1234-5678-9012",
    format: (digits) => {
      const value = digits.slice(0, 12);
      const groups = [value.slice(0, 4), value.slice(4, 8), value.slice(8, 12)];
      return groups.filter(Boolean).join("-");
    },
  },
  tin: {
    maxLength: 15,
    placeholder: "123-456-789-000",
    format: (digits) => {
      const value = digits.slice(0, 12);
      const groups = [value.slice(0, 3), value.slice(3, 6), value.slice(6, 9), value.slice(9, 12)];
      return groups.filter(Boolean).join("-");
    },
  },
};

function getFormFields(form: HRFormItem): FormField[] {
  if (!form.rich_content) return [];
  try {
    return JSON.parse(form.rich_content);
  } catch {
    return [];
  }
}

function getStatutoryFieldFormat(label: string): StatutoryFieldFormat | null {
  const normalized = label.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (normalized.includes("philhealth")) return STATUTORY_FIELD_FORMATS.philhealth;
  if (normalized.includes("pagibig")) return STATUTORY_FIELD_FORMATS.pagibig;
  if (/\bsss\b/i.test(label)) return STATUTORY_FIELD_FORMATS.sss;
  if (/\btin\b/i.test(label)) return STATUTORY_FIELD_FORMATS.tin;

  return null;
}

function formatStatutoryFieldValue(field: FormField, rawValue: string) {
  const formatter = getStatutoryFieldFormat(field.label);
  if (!formatter) return rawValue;
  return formatter.format(rawValue.replace(/\D/g, ""));
}

export function HRForms({ forms, remarks, onUpdate }: Readonly<HRFormsProps>) {
  const [expandedForm, setExpandedForm] = useState<string | null>(null);
  const [formDataState, setFormDataState] = useState<Record<string, Record<string, any>>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});

  const handleInputChange = (formId: string, field: string, value: any) => {
    setFormDataState(prev => ({
      ...prev,
      [formId]: {
        ...prev[formId],
        [field]: value,
      },
    }));
  };

  const handleSubmitForm = async (form: HRFormItem) => {
    const formData = formDataState[form.onboarding_item_id] || {};
    const fields = getFormFields(form);

    const missingFields = fields.filter(
      field => field.required && !formData[field.label]
    );

    if (missingFields.length > 0) {
      alert(`Please fill in all required fields: ${missingFields.map(f => f.label).join(", ")}`);
      return;
    }

    setSubmitting(prev => ({ ...prev, [form.onboarding_item_id]: true }));
    try {
      await confirmTask(form.onboarding_item_id);
      const updatedForms = forms.map(f => {
        if (f.onboarding_item_id === form.onboarding_item_id) {
          return {
            ...f,
            status: "confirmed" as const,
          };
        }
        return f;
      });
      onUpdate(updatedForms);
      setExpandedForm(null);
      alert(`${form.title} submitted successfully!`);
    } catch {
      alert("Failed to submit form. Please try again.");
    } finally {
      setSubmitting(prev => ({ ...prev, [form.onboarding_item_id]: false }));
    }
  };

  const renderFormField = (form: HRFormItem, field: FormField) => {
    const value = formDataState[form.onboarding_item_id]?.[field.label] || "";
    const isDisabled = form.status !== "pending" && form.status !== "rejected";
    const statutoryFormat = getStatutoryFieldFormat(field.label);

    if (field.type === "select") {
      return (
        <select
          value={value}
          onChange={(e) => handleInputChange(form.onboarding_item_id, field.label, e.target.value)}
          disabled={isDisabled}
          className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:cursor-not-allowed disabled:opacity-50"
          required={field.required}
        >
          <option value="">Select...</option>
          {field.label === "Account Type" && (
            <>
              <option value="Savings">Savings</option>
              <option value="Checking">Checking</option>
            </>
          )}
          {field.label === "Civil Status" && (
            <>
              <option value="Single">Single</option>
              <option value="Married">Married</option>
              <option value="Widowed">Widowed</option>
              <option value="Separated">Separated</option>
            </>
          )}
          {field.label === "Tax Status" && (
            <>
              <option value="S">S – Single</option>
              <option value="S1">S1 – Single, 1 dependent</option>
              <option value="S2">S2 – Single, 2 dependents</option>
              <option value="S3">S3 – Single, 3 dependents</option>
              <option value="S4">S4 – Single, 4+ dependents</option>
              <option value="ME">ME – Married Employee</option>
              <option value="ME1">ME1 – Married, 1 dependent</option>
              <option value="ME2">ME2 – Married, 2 dependents</option>
              <option value="ME3">ME3 – Married, 3 dependents</option>
              <option value="ME4">ME4 – Married, 4+ dependents</option>
              <option value="HF">HF – Head of Family</option>
              <option value="Z">Z – Zero Exemption</option>
            </>
          )}
        </select>
      );
    }
    return (
      <Input
        type={statutoryFormat ? "text" : field.type}
        inputMode={statutoryFormat ? "numeric" : undefined}
        maxLength={statutoryFormat?.maxLength}
        placeholder={statutoryFormat?.placeholder}
        value={value}
        onChange={(e) => {
          handleInputChange(
            form.onboarding_item_id,
            field.label,
            formatStatutoryFieldValue(field, e.target.value),
          );
        }}
        disabled={isDisabled}
        required={field.required}
      />
    );
  };

  const isFormsRemark = (tag: string) => {
    const v = (tag || "").trim().toLowerCase();
    return v === "forms" || v === "hr forms" || v === "hr_forms";
  };
  const formsRemarks = remarks.filter(r => isFormsRemark(r.tab_tag));

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">HR Forms &amp; Processes</h3>
        <p className="text-sm text-gray-600">Complete all required HR forms</p>
      </div>

      <ScrollArea className="h-137.5 pr-4">
        <div className="space-y-4">
          {forms.map((form) => {
            const fields = getFormFields(form);
            const formRemarks = remarks.filter(r => isFormsRemark(r.tab_tag));
            return (
              <Card key={form.onboarding_item_id} className={form.is_required ? "border-l-4 border-l-red-500" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="size-4" />
                        {form.title}
                        {form.is_required && <span className="text-red-500 text-sm">*</span>}
                      </CardTitle>
                      {form.description && (
                        <CardDescription className="text-sm mt-1">{form.description}</CardDescription>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <DetailedStatusBadge status={form.status} />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedForm(expandedForm === form.onboarding_item_id ? null : form.onboarding_item_id)}
                      >
                        {expandedForm === form.onboarding_item_id ? (
                          <ChevronUp className="size-4" />
                        ) : (
                          <ChevronDown className="size-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {expandedForm === form.onboarding_item_id && (
                  <CardContent className="space-y-4 border-t pt-4">
                    {form.status === "rejected" && formRemarks.length > 0 && (
                      <Alert className="bg-red-50 border-red-200">
                        <XCircle className="size-4 text-red-600" />
                        <AlertDescription className="text-red-800">
                          <strong>Rejected:</strong> {formRemarks.at(-1)!.remark_text}
                        </AlertDescription>
                      </Alert>
                    )}

                    {fields.length > 0 && (
                      <div className="space-y-4">
                        {fields.map((field, index) => (
                          <div key={field.label} className="space-y-2">
                            <Label htmlFor={`${form.onboarding_item_id}-${field.label}`}>
                              {field.label}
                              {field.required && <span className="text-red-500 ml-1">*</span>}
                            </Label>
                            {renderFormField(form, field)}
                          </div>
                        ))}
                      </div>
                    )}

                    {fields.length === 0 && form.description && (
                      <p className="text-sm text-gray-600">{form.description}</p>
                    )}

                    {(form.status === "pending" || form.status === "rejected") && (
                      <Button
                        onClick={() => handleSubmitForm(form)}
                        className="w-full"
                        disabled={submitting[form.onboarding_item_id]}
                      >
                        <CheckCircle className="size-4 mr-2" />
                        {submitting[form.onboarding_item_id]
                          ? "Submitting..."
                          : form.status === "rejected" ? "Resubmit Form" : "Submit Form"}
                      </Button>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      <RemarksSection remarks={formsRemarks} />
    </div>
  );
}
