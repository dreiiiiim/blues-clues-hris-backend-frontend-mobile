import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Alert, AlertDescription } from "../ui/alert";
import { Badge } from "../ui/badge";
import { CheckCircle, XCircle, AlertCircle, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { HRFormItem } from "@/types/onboarding.types";
import { ScrollArea } from "../ui/scroll-area";

interface HRFormsProps {
  forms: HRFormItem[];
  onUpdate: (forms: HRFormItem[]) => void;
}

export function HRForms({ forms, onUpdate }: HRFormsProps) {
  const [expandedForm, setExpandedForm] = useState<string | null>(null);
  const [formDataState, setFormDataState] = useState<Record<string, Record<string, any>>>({});

  const handleInputChange = (formId: string, field: string, value: any) => {
    setFormDataState(prev => ({
      ...prev,
      [formId]: {
        ...(prev[formId] || {}),
        [field]: value,
      },
    }));
  };

  const handleSubmitForm = (form: HRFormItem) => {
    const formData = formDataState[form.id] || {};
    
    // Validate required fields
    const missingFields = form.fields.filter(
      field => field.required && !formData[field.label]
    );

    if (missingFields.length > 0) {
      alert(`Please fill in all required fields: ${missingFields.map(f => f.label).join(", ")}`);
      return;
    }

    // Update form status
    const updatedForms = forms.map(f => {
      if (f.id === form.id) {
        return {
          ...f,
          status: "submitted" as const,
          formData: formData,
        };
      }
      return f;
    });

    onUpdate(updatedForms);
    setExpandedForm(null);
    alert(`${form.title} submitted successfully!`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-slate-100 text-slate-700"><AlertCircle className="size-3 mr-1" />Pending</Badge>;
      case "submitted":
        return <Badge variant="outline" className="bg-slate-900 text-white"><CheckCircle className="size-3 mr-1" />Submitted</Badge>;
      case "for-review":
        return <Badge variant="outline" className="bg-amber-100 text-amber-800"><AlertCircle className="size-3 mr-1" />For Review</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-teal-100 text-teal-800"><CheckCircle className="size-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-100 text-red-800"><XCircle className="size-3 mr-1" />Rejected</Badge>;
      default:
        return null;
    }
  };

  const renderFormField = (form: HRFormItem, field: any) => {
    const value = formDataState[form.id]?.[field.label] || "";
    const isDisabled = form.status !== "pending" && form.status !== "rejected";

    switch (field.type) {
      case "select":
        return (
          <select
            value={value}
            onChange={(e) => handleInputChange(form.id, field.label, e.target.value)}
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
          </select>
        );
      default:
        return (
          <Input
            type={field.type}
            value={value}
            onChange={(e) => handleInputChange(form.id, field.label, e.target.value)}
            disabled={isDisabled}
            required={field.required}
          />
        );
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">HR Forms & Processes</h3>
        <p className="text-sm text-gray-600">Complete all required HR forms</p>
      </div>

      <ScrollArea className="h-[550px] pr-4">
        <div className="space-y-4">
          {forms.map((form) => (
            <Card key={form.id} className={form.required ? "border-l-4 border-l-red-500" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="size-4" />
                      {form.title}
                      {form.required && <span className="text-red-500 text-sm">*</span>}
                    </CardTitle>
                    <CardDescription className="text-sm mt-1">{form.description}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(form.status)}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedForm(expandedForm === form.id ? null : form.id)}
                    >
                      {expandedForm === form.id ? (
                        <ChevronUp className="size-4" />
                      ) : (
                        <ChevronDown className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {expandedForm === form.id && (
                <CardContent className="space-y-4 border-t pt-4">
                  {form.status === "rejected" && form.remarksHistory && form.remarksHistory.length > 0 && (
                    <Alert className="bg-red-50 border-red-200">
                      <XCircle className="size-4 text-red-600" />
                      <AlertDescription className="text-red-800">
                        <strong>Rejected:</strong> {form.remarksHistory[form.remarksHistory.length - 1].message}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-4">
                    {form.fields.map((field, index) => (
                      <div key={index} className="space-y-2">
                        <Label htmlFor={`${form.id}-${field.label}`}>
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        {renderFormField(form, field)}
                      </div>
                    ))}
                  </div>

                  {(form.status === "pending" || form.status === "rejected") && (
                    <Button onClick={() => handleSubmitForm(form)} className="w-full">
                      <CheckCircle className="size-4 mr-2" />
                      {form.status === "rejected" ? "Resubmit Form" : "Submit Form"}
                    </Button>
                  )}

                  {/* Remarks History */}
                  {form.remarksHistory && form.remarksHistory.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="text-sm font-semibold mb-2">Remarks History</h4>
                      <div className="space-y-2">
                        {form.remarksHistory.map((remark) => (
                          <div key={remark.id} className="border-l-4 border-blue-500 pl-3 py-1">
                            <p className="text-sm text-gray-700">{remark.message}</p>
                            <p className="text-xs text-gray-500">
                              {remark.author} • {remark.date.toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
