"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getCompanies, type Company } from "@/lib/adminApi";
import {
  createSystemAdminOffboardingTemplate,
  deleteSystemAdminOffboardingTemplate,
  getSystemAdminOffboardingTemplates,
  updateSystemAdminOffboardingTemplate,
  type OffboardingTemplateCategory,
  type OffboardingTemplateItemInput,
  type SystemAdminOffboardingTemplate,
} from "@/lib/offboardingApi";
import {
  ClipboardList,
  Copy,
  FileCog,
  Loader2,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

type ApplicableType = "Resignation" | "Termination" | "End of Contract";

type TemplateFormState = {
  template_name: string;
  employee_type: string;
  description: string;
  applicable_offboarding_types: ApplicableType[];
  is_default: boolean;
  require_knowledge_transfer: boolean;
  items: OffboardingTemplateItemInput[];
  system_access_to_revoke: string[];
};

const CATEGORY_OPTIONS: OffboardingTemplateCategory[] = ["Document", "Task", "Asset"];
const OFFBOARDING_TYPES: ApplicableType[] = ["Resignation", "Termination", "End of Contract"];

const EMPTY_ITEM: OffboardingTemplateItemInput = {
  item_name: "",
  description: "",
  is_required: true,
  category: "Task",
  is_custom: true,
};

const EMPTY_FORM: TemplateFormState = {
  template_name: "",
  employee_type: "",
  description: "",
  applicable_offboarding_types: [],
  is_default: false,
  require_knowledge_transfer: true,
  items: [{ ...EMPTY_ITEM }],
  system_access_to_revoke: [""],
};

function formatDate(value?: string) {
  if (!value) return "N/A";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "N/A"
    : parsed.toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      });
}

function normalizeTemplateToForm(template: SystemAdminOffboardingTemplate): TemplateFormState {
  return {
    template_name: template.template_name ?? "",
    employee_type: template.employee_type ?? "",
    description: template.description ?? "",
    applicable_offboarding_types: template.applicable_offboarding_types ?? [],
    is_default: template.is_default ?? false,
    require_knowledge_transfer: template.require_knowledge_transfer ?? true,
    items:
      template.offboarding_checklist_template_items?.length > 0
        ? template.offboarding_checklist_template_items.map((item) => ({
            item_name: item.item_name,
            description: item.description ?? "",
            is_required: item.is_required,
            category: item.category ?? "Task",
            is_custom: item.is_custom ?? true,
          }))
        : [{ ...EMPTY_ITEM }],
    system_access_to_revoke:
      template.system_access_to_revoke && template.system_access_to_revoke.length > 0
        ? [...template.system_access_to_revoke]
        : [""],
  };
}

export default function SystemAdminOffboardingPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [templates, setTemplates] = useState<SystemAdminOffboardingTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateFormState>(EMPTY_FORM);

  useEffect(() => {
    (async () => {
      try {
        const result = await getCompanies();
        setCompanies(result);
        if (result.length > 0) setSelectedCompanyId(result[0].company_id);
      } catch (error: any) {
        toast.error(error?.message || "Failed to load companies.");
      } finally {
        setLoadingCompanies(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedCompanyId) return;
    void loadTemplates(selectedCompanyId);
  }, [selectedCompanyId]);

  async function loadTemplates(companyId: string) {
    setLoadingTemplates(true);
    try {
      const result = await getSystemAdminOffboardingTemplates(companyId);
      setTemplates(result);

      if (result.length === 0) {
        setSelectedTemplateId(null);
        setForm(EMPTY_FORM);
        return;
      }

      const activeTemplate =
        result.find((template) => template.template_id === selectedTemplateId) ?? result[0];
      setSelectedTemplateId(activeTemplate.template_id);
      setForm(normalizeTemplateToForm(activeTemplate));
    } catch (error: any) {
      toast.error(error?.message || "Failed to load offboarding templates.");
      setTemplates([]);
      setSelectedTemplateId(null);
      setForm(EMPTY_FORM);
    } finally {
      setLoadingTemplates(false);
    }
  }

  const selectedCompanyName = useMemo(
    () => companies.find((company) => company.company_id === selectedCompanyId)?.name ?? "Selected company",
    [companies, selectedCompanyId],
  );

  const stats = useMemo(() => {
    const totalTemplates = templates.length;
    const defaultTemplates = templates.filter((template) => template.is_default).length;
    const activeTemplates = templates.filter((template) => template.offboarding_checklist_template_items.length > 0).length;
    const totalItems = templates.reduce((sum, template) => sum + template.offboarding_checklist_template_items.length, 0);

    return {
      totalTemplates,
      defaultTemplates,
      activeTemplates,
      averageItems: totalTemplates === 0 ? 0 : Math.round(totalItems / totalTemplates),
    };
  }, [templates]);

  function startNewTemplate() {
    setSelectedTemplateId(null);
    setForm(EMPTY_FORM);
  }

  function chooseTemplate(template: SystemAdminOffboardingTemplate) {
    setSelectedTemplateId(template.template_id);
    setForm(normalizeTemplateToForm(template));
  }

  function duplicateTemplate(template: SystemAdminOffboardingTemplate) {
    setSelectedTemplateId(null);
    setForm({
      ...normalizeTemplateToForm(template),
      template_name: `${template.template_name} Copy`,
      is_default: false,
    });
  }

  function updateItem(index: number, patch: Partial<OffboardingTemplateItemInput>) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }));
  }

  function updateSystemAccess(index: number, value: string) {
    setForm((prev) => ({
      ...prev,
      system_access_to_revoke: prev.system_access_to_revoke.map((item, itemIndex) => (itemIndex === index ? value : item)),
    }));
  }

  function addChecklistItem() {
    setForm((prev) => ({ ...prev, items: [...prev.items, { ...EMPTY_ITEM }] }));
  }

  function removeChecklistItem(index: number) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.length === 1 ? [{ ...EMPTY_ITEM }] : prev.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function addSystemAccess() {
    setForm((prev) => ({
      ...prev,
      system_access_to_revoke: [...prev.system_access_to_revoke, ""],
    }));
  }

  function removeSystemAccess(index: number) {
    setForm((prev) => ({
      ...prev,
      system_access_to_revoke:
        prev.system_access_to_revoke.length === 1
          ? [""]
          : prev.system_access_to_revoke.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function toggleApplicableType(value: ApplicableType, checked: boolean) {
    setForm((prev) => ({
      ...prev,
      applicable_offboarding_types: checked
        ? [...prev.applicable_offboarding_types, value]
        : prev.applicable_offboarding_types.filter((item) => item !== value),
    }));
  }

  async function handleSave() {
    if (!selectedCompanyId) {
      toast.error("Select a company first.");
      return;
    }

    const payload = {
      template_name: form.template_name.trim(),
      employee_type: form.employee_type.trim() || undefined,
      description: form.description.trim() || undefined,
      applicable_offboarding_types: form.applicable_offboarding_types,
      is_default: form.is_default,
      require_knowledge_transfer: form.require_knowledge_transfer,
      items: form.items
        .map((item) => ({
          item_name: item.item_name.trim(),
          description: item.description?.trim() || undefined,
          is_required: item.is_required,
          category: item.category ?? "Task",
          is_custom: item.is_custom ?? true,
        }))
        .filter((item) => item.item_name.length > 0),
      system_access_to_revoke: form.system_access_to_revoke
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    };

    if (!payload.template_name) {
      toast.error("Template name is required.");
      return;
    }
    if (!payload.description) {
      toast.error("Description is required.");
      return;
    }
    if (payload.items.length === 0) {
      toast.error("Add at least one checklist item.");
      return;
    }

    setSaving(true);
    try {
      if (selectedTemplateId) {
        await updateSystemAdminOffboardingTemplate(selectedCompanyId, selectedTemplateId, payload);
        toast.success("Offboarding template updated.");
      } else {
        await createSystemAdminOffboardingTemplate(selectedCompanyId, payload);
        toast.success("Offboarding template created.");
      }
      await loadTemplates(selectedCompanyId);
    } catch (error: any) {
      toast.error(error?.message || "Failed to save template.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(template: SystemAdminOffboardingTemplate) {
    if (!selectedCompanyId) return;
    if (!window.confirm(`Delete "${template.template_name}"? This cannot be undone.`)) return;

    setDeletingId(template.template_id);
    try {
      await deleteSystemAdminOffboardingTemplate(selectedCompanyId, template.template_id);
      toast.success("Offboarding template deleted.");
      await loadTemplates(selectedCompanyId);
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete template.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[28px] border border-border/70 bg-background px-6 py-6 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)] md:px-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">System Administration</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Manage offboarding templates and system configurations. Changes here affect checklist generation,
              required knowledge transfer, and system access revocation for each tenant.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-[260px] space-y-2">
              <Label htmlFor="company" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Tenant
              </Label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId} disabled={loadingCompanies || companies.length === 0}>
                <SelectTrigger id="company" className="h-12 rounded-2xl border-border/80 bg-background px-4">
                  <SelectValue placeholder={loadingCompanies ? "Loading companies..." : "Select company"} />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.company_id} value={company.company_id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={startNewTemplate} className="h-12 rounded-2xl bg-black px-5 text-sm font-semibold text-white hover:bg-black/90">
              <Plus className="mr-2 h-4 w-4" />
              Create Template
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-[24px] border-border/80 shadow-none">
            <CardHeader className="pb-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Total Templates</p>
              <CardTitle className="text-5xl font-bold">{stats.totalTemplates}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="rounded-[24px] border-border/80 shadow-none">
            <CardHeader className="pb-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Default Templates</p>
              <CardTitle className="text-5xl font-bold text-blue-600">{stats.defaultTemplates}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="rounded-[24px] border-border/80 shadow-none">
            <CardHeader className="pb-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Active Templates</p>
              <CardTitle className="text-5xl font-bold text-emerald-600">{stats.activeTemplates}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="rounded-[24px] border-border/80 shadow-none">
            <CardHeader className="pb-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Avg. Checklist Items</p>
              <CardTitle className="text-5xl font-bold text-violet-600">{stats.averageItems}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="rounded-[28px] border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Offboarding Templates</CardTitle>
            <p className="text-sm text-muted-foreground">
              Active tenant: <span className="font-medium text-foreground">{selectedCompanyName}</span>
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingTemplates ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading templates...
              </div>
            ) : templates.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
                No offboarding templates yet.
              </div>
            ) : (
              templates.map((template) => (
                <button
                  type="button"
                  key={template.template_id}
                  onClick={() => chooseTemplate(template)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
                    selectedTemplateId === template.template_id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-base font-semibold text-foreground">{template.template_name}</p>
                        {template.is_default ? (
                          <Badge className="border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50">
                            Default
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {template.description || "No description provided."}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {template.offboarding_checklist_template_items.length} checklist item(s) • Created {formatDate(template.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button type="button" variant="ghost" size="icon" onClick={(event) => { event.stopPropagation(); chooseTemplate(template); }} title="Edit template">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={(event) => { event.stopPropagation(); duplicateTemplate(template); }} title="Duplicate template">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(event) => { event.stopPropagation(); void handleDelete(template); }}
                        disabled={deletingId === template.template_id}
                        title="Delete template"
                      >
                        {deletingId === template.template_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-500" />}
                      </Button>
                    </div>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/80 shadow-sm">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <FileCog className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl">
                  {selectedTemplateId ? "Edit Template" : "Create Template"}
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Configure template settings, checklist items, and system access to revoke.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="space-y-2">
              <Label htmlFor="template_name">Template Name *</Label>
              <Input
                id="template_name"
                value={form.template_name}
                onChange={(event) => setForm((prev) => ({ ...prev, template_name: event.target.value }))}
                placeholder="Standard Engineering Offboarding"
                className="rounded-2xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Default template for engineering team members including knowledge transfer and access revocation."
                className="min-h-[112px] rounded-2xl"
              />
            </div>

            <div className="space-y-4">
              <Label>Applicable Offboarding Types *</Label>
              <div className="flex flex-wrap gap-5">
                {OFFBOARDING_TYPES.map((type) => (
                  <label key={type} className="flex items-center gap-2 text-sm text-foreground">
                    <Checkbox
                      checked={form.applicable_offboarding_types.includes(type)}
                      onCheckedChange={(checked) => toggleApplicableType(type, checked === true)}
                    />
                    {type}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <Checkbox
                  checked={form.is_default}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_default: checked === true }))}
                />
                Set as default template
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <Checkbox
                  checked={form.require_knowledge_transfer}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, require_knowledge_transfer: checked === true }))
                  }
                />
                Require knowledge transfer sign-off
              </label>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Checklist Items *</Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Required return items, documents, and tasks for this template.
                  </p>
                </div>
                <Button type="button" variant="ghost" onClick={addChecklistItem} className="gap-2 text-primary">
                  <Plus className="h-4 w-4" />
                  Add Item
                </Button>
              </div>

              <div className="space-y-3">
                {form.items.map((item, index) => (
                  <div key={`item-${index}`} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
                    <Input
                      value={item.item_name}
                      onChange={(event) => updateItem(index, { item_name: event.target.value })}
                      placeholder={index === form.items.length - 1 ? "e.g., Return company laptop" : "Checklist item"}
                      className="rounded-2xl"
                    />
                    <Select
                      value={item.category ?? "Task"}
                      onValueChange={(value) => updateItem(index, { category: value as OffboardingTemplateCategory })}
                    >
                      <SelectTrigger className="rounded-2xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeChecklistItem(index)}>
                      <X className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>System Access To Revoke</Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    These access records will be seeded into the case for revocation tracking.
                  </p>
                </div>
                <Button type="button" variant="ghost" onClick={addSystemAccess} className="gap-2 text-primary">
                  <Plus className="h-4 w-4" />
                  Add System
                </Button>
              </div>

              <div className="space-y-3">
                {form.system_access_to_revoke.map((item, index) => (
                  <div key={`access-${index}`} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                    <Input
                      value={item}
                      onChange={(event) => updateSystemAccess(index, event.target.value)}
                      placeholder={index === form.system_access_to_revoke.length - 1 ? "e.g., Email, VPN, Database" : "System name"}
                      className="rounded-2xl"
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeSystemAccess(index)}>
                      <X className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  <ClipboardList className="mr-1.5 h-3.5 w-3.5" />
                  {form.items.filter((item) => item.item_name.trim().length > 0).length} Checklist Items
                </Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                  {form.system_access_to_revoke.filter((item) => item.trim().length > 0).length} Systems
                </Badge>
              </div>

              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" onClick={startNewTemplate} disabled={saving}>
                  Cancel
                </Button>
                <Button type="button" onClick={() => void handleSave()} disabled={saving} className="bg-black text-white hover:bg-black/90">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Changes
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
