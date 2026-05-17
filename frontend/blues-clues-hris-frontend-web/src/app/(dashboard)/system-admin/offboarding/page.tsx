"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Copy,
  Trash2,
  Settings,
  Circle,
  X,
  FileText,
  Shield,
  BookOpen,
  LayoutTemplate,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ── Types ─────────────────────────────────────────────────────────────────────

type OffboardingType = "Resignation" | "Termination" | "End of Contract";

interface OffboardingTemplate {
  id: string;
  name: string;
  description: string;
  applicableTypes: OffboardingType[];
  isDefault: boolean;
  requiresKnowledgeTransfer: boolean;
  checklistItems: string[];
  systemAccessItems: string[];
  createdAt: string;
  updatedAt: string;
}

// ── Seed Data ─────────────────────────────────────────────────────────────────

const SEED_TEMPLATES: OffboardingTemplate[] = [
  {
    id: "tpl-1",
    name: "Standard Engineering Offboarding",
    description:
      "Default template for engineering team members including knowledge transfer and technical access revocation.",
    applicableTypes: ["Resignation", "Termination", "End of Contract"],
    isDefault: true,
    requiresKnowledgeTransfer: true,
    checklistItems: [
      "Return company laptop",
      "Return access card",
      "Return company ID",
      "Complete knowledge transfer documentation",
      "Handover all project credentials",
    ],
    systemAccessItems: ["Email", "VPN", "Database", "Cloud Storage", "Internal Applications"],
    createdAt: "2026-01-15",
    updatedAt: "2026-04-18",
  },
  {
    id: "tpl-2",
    name: "Sales Team Offboarding",
    description:
      "Template for sales representatives with CRM and client handover requirements.",
    applicableTypes: ["Resignation", "End of Contract"],
    isDefault: false,
    requiresKnowledgeTransfer: true,
    checklistItems: [
      "Return company devices",
      "Transfer client accounts",
      "Submit final sales report",
      "Return company credit card",
      "Complete CRM handover",
    ],
    systemAccessItems: ["Email", "CRM System", "Sales Portal", "Client Database"],
    createdAt: "2026-02-20",
    updatedAt: "2026-03-15",
  },
  {
    id: "tpl-3",
    name: "Contractor Exit",
    description: "Simplified template for contractors and temporary staff.",
    applicableTypes: ["End of Contract"],
    isDefault: false,
    requiresKnowledgeTransfer: false,
    checklistItems: [
      "Return any borrowed equipment",
      "Submit final deliverables",
      "Sign NDA confirmation",
    ],
    systemAccessItems: ["Email", "Project Portal", "File Storage"],
    createdAt: "2026-03-05",
    updatedAt: "2026-03-25",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() {
  return `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

const TYPE_OPTIONS: OffboardingType[] = ["Resignation", "Termination", "End of Contract"];

// ── Empty form state ──────────────────────────────────────────────────────────

function emptyForm(): Omit<OffboardingTemplate, "id" | "createdAt" | "updatedAt"> {
  return {
    name: "",
    description: "",
    applicableTypes: [],
    isDefault: false,
    requiresKnowledgeTransfer: false,
    checklistItems: [""],
    systemAccessItems: [""],
  };
}

type FormState = Omit<OffboardingTemplate, "id" | "createdAt" | "updatedAt">;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SystemAdminOffboardingPage() {
  const [templates, setTemplates] = useState<OffboardingTemplate[]>(SEED_TEMPLATES);
  const [view, setView] = useState<"list" | "form">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [deleteTarget, setDeleteTarget] = useState<OffboardingTemplate | null>(null);

  // ── Stats ────────────────────────────────────────────────────────────────

  const totalTemplates = templates.length;
  const defaultTemplates = templates.filter((t) => t.isDefault).length;
  const activeTemplates = templates.length;
  const avgChecklist =
    templates.length === 0
      ? 0
      : Math.round(
          templates.reduce((sum, t) => sum + t.checklistItems.filter(Boolean).length, 0) /
            templates.length
        );

  // ── Navigation ────────────────────────────────────────────────────────────

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setView("form");
  }

  function openEdit(tpl: OffboardingTemplate) {
    setEditingId(tpl.id);
    setForm({
      name: tpl.name,
      description: tpl.description,
      applicableTypes: [...tpl.applicableTypes],
      isDefault: tpl.isDefault,
      requiresKnowledgeTransfer: tpl.requiresKnowledgeTransfer,
      checklistItems: [...tpl.checklistItems, ""],
      systemAccessItems: [...tpl.systemAccessItems, ""],
    });
    setView("form");
  }

  function cancelForm() {
    setView("list");
    setEditingId(null);
    setForm(emptyForm());
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  function handleDuplicate(tpl: OffboardingTemplate) {
    const copy: OffboardingTemplate = {
      ...tpl,
      id: uid(),
      name: `${tpl.name} (Copy)`,
      isDefault: false,
      createdAt: today(),
      updatedAt: today(),
    };
    setTemplates((prev) => [...prev, copy]);
    toast.success(`"${copy.name}" created.`);
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setTemplates((prev) => prev.filter((t) => t.id !== deleteTarget.id));
    toast.success(`"${deleteTarget.name}" deleted.`);
    setDeleteTarget(null);
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("Template name is required.");
      return;
    }
    if (form.applicableTypes.length === 0) {
      toast.error("Select at least one offboarding type.");
      return;
    }

    const cleanChecklist = form.checklistItems.filter((i) => i.trim());
    const cleanAccess = form.systemAccessItems.filter((i) => i.trim());

    // If setting as default, unset other defaults
    let updatedTemplates = templates;
    if (form.isDefault) {
      updatedTemplates = templates.map((t) => ({ ...t, isDefault: false }));
    }

    if (editingId) {
      setTemplates(
        updatedTemplates.map((t) =>
          t.id === editingId
            ? {
                ...t,
                ...form,
                checklistItems: cleanChecklist,
                systemAccessItems: cleanAccess,
                updatedAt: today(),
              }
            : t
        )
      );
      toast.success(`"${form.name}" updated.`);
    } else {
      const newTpl: OffboardingTemplate = {
        id: uid(),
        ...form,
        checklistItems: cleanChecklist,
        systemAccessItems: cleanAccess,
        createdAt: today(),
        updatedAt: today(),
      };
      setTemplates([...updatedTemplates, newTpl]);
      toast.success(`"${form.name}" created.`);
    }

    cancelForm();
  }

  // ── Form helpers ─────────────────────────────────────────────────────────

  function toggleType(type: OffboardingType) {
    setForm((f) => ({
      ...f,
      applicableTypes: f.applicableTypes.includes(type)
        ? f.applicableTypes.filter((t) => t !== type)
        : [...f.applicableTypes, type],
    }));
  }

  function updateChecklistItem(idx: number, val: string) {
    setForm((f) => {
      const items = [...f.checklistItems];
      items[idx] = val;
      return { ...f, checklistItems: items };
    });
  }

  function addChecklistItem() {
    setForm((f) => ({ ...f, checklistItems: [...f.checklistItems, ""] }));
  }

  function removeChecklistItem(idx: number) {
    setForm((f) => ({
      ...f,
      checklistItems: f.checklistItems.filter((_, i) => i !== idx),
    }));
  }

  function updateSystemItem(idx: number, val: string) {
    setForm((f) => {
      const items = [...f.systemAccessItems];
      items[idx] = val;
      return { ...f, systemAccessItems: items };
    });
  }

  function addSystemItem() {
    setForm((f) => ({ ...f, systemAccessItems: [...f.systemAccessItems, ""] }));
  }

  function removeSystemItem(idx: number) {
    setForm((f) => ({
      ...f,
      systemAccessItems: f.systemAccessItems.filter((_, i) => i !== idx),
    }));
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">System Administration</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage offboarding templates and system configurations
          </p>
        </div>
        {view === "list" && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-foreground text-background text-sm font-semibold px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity shrink-0"
          >
            <Plus className="h-4 w-4" />
            Create Template
          </button>
        )}
      </div>

      {/* ── LIST VIEW ─────────────────────────────────────────────────────── */}
      {view === "list" && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Templates",    value: totalTemplates,   color: "text-foreground" },
              { label: "Default Templates",  value: defaultTemplates, color: "text-blue-600" },
              { label: "Active Templates",   value: activeTemplates,  color: "text-emerald-600" },
              { label: "Avg. Checklist Items", value: avgChecklist,   color: "text-violet-600" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                  {label}
                </p>
                <p className={`text-3xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Template list */}
          <div>
            <h2 className="text-base font-semibold text-foreground mb-3">Offboarding Templates</h2>
            <div className="space-y-3">
              {templates.length === 0 && (
                <div className="bg-card border border-border rounded-xl p-10 text-center text-muted-foreground text-sm">
                  No templates yet. Click{" "}
                  <button onClick={openCreate} className="text-primary font-semibold hover:underline">
                    + Create Template
                  </button>{" "}
                  to get started.
                </div>
              )}

              {templates.map((tpl) => {
                const filledChecklist = tpl.checklistItems.filter(Boolean);
                const filledAccess = tpl.systemAccessItems.filter(Boolean);
                return (
                  <div
                    key={tpl.id}
                    className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Left: name + meta */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground">{tpl.name}</span>
                          {tpl.isDefault && (
                            <span className="text-[10px] font-bold uppercase tracking-wide bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {tpl.description}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                          {/* Applicable for */}
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                              Applicable for:
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {tpl.applicableTypes.map((t) => (
                                <span
                                  key={t}
                                  className="text-[11px] font-medium bg-muted text-foreground border border-border px-2 py-0.5 rounded-md"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Features */}
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                              Features:
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              <span className="flex items-center gap-1 text-[11px] font-medium bg-muted text-foreground border border-border px-2 py-0.5 rounded-md">
                                <FileText className="h-3 w-3" />
                                {filledChecklist.length} Checklist Items
                              </span>
                              <span className="flex items-center gap-1 text-[11px] font-medium bg-muted text-foreground border border-border px-2 py-0.5 rounded-md">
                                <Shield className="h-3 w-3" />
                                {filledAccess.length} System Access
                              </span>
                              {tpl.requiresKnowledgeTransfer && (
                                <span className="flex items-center gap-1 text-[11px] font-medium bg-muted text-foreground border border-border px-2 py-0.5 rounded-md">
                                  <BookOpen className="h-3 w-3" />
                                  Knowledge Transfer
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <p className="text-[11px] text-muted-foreground mt-3">
                          Created: {fmtDate(tpl.createdAt)} · Last Modified: {fmtDate(tpl.updatedAt)}
                        </p>
                      </div>

                      {/* Right: actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openEdit(tpl)}
                          title="Edit template"
                          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDuplicate(tpl)}
                          title="Duplicate template"
                          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(tpl)}
                          title="Delete template"
                          className="p-2 rounded-lg hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── FORM VIEW ─────────────────────────────────────────────────────── */}
      {view === "form" && (
        <div className="bg-card border border-border rounded-xl shadow-sm p-6 space-y-6">
          {/* Form header */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-bold text-base text-foreground">
                {editingId ? "Edit Template" : "Create New Template"}
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Configure the template settings and checklist items
            </p>
          </div>

          {/* Template Name */}
          <div className="space-y-1.5">
            <label htmlFor="tpl-name" className="text-sm font-semibold text-foreground">
              Template Name <span className="text-red-500">*</span>
            </label>
            <input
              id="tpl-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g., Standard Engineer Offboarding"
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor="tpl-description" className="text-sm font-semibold text-foreground">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="tpl-description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Describe when this template should be used..."
              rows={3}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition resize-none"
            />
          </div>

          {/* Applicable Types */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">
              Applicable Offboarding Types <span className="text-red-500">*</span>
            </p>
            <div className="flex flex-wrap gap-4">
              {TYPE_OPTIONS.map((type) => (
                <label key={type} htmlFor={`tpl-type-${type}`} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    id={`tpl-type-${type}`}
                    type="checkbox"
                    checked={form.applicableTypes.includes(type)}
                    onChange={() => toggleType(type)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <span className="text-sm text-foreground">{type}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-2">
            <label htmlFor="tpl-is-default" className="flex items-center gap-2 cursor-pointer select-none">
              <input
                id="tpl-is-default"
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <span className="text-sm text-foreground">Set as default template</span>
            </label>
            <label htmlFor="tpl-requires-kt" className="flex items-center gap-2 cursor-pointer select-none">
              <input
                id="tpl-requires-kt"
                type="checkbox"
                checked={form.requiresKnowledgeTransfer}
                onChange={(e) =>
                  setForm((f) => ({ ...f, requiresKnowledgeTransfer: e.target.checked }))
                }
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <span className="text-sm text-foreground">Require knowledge transfer sign-off</span>
            </label>
          </div>

          {/* Checklist Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">
                Checklist Items <span className="text-red-500">*</span>
              </p>
              <button
                type="button"
                onClick={addChecklistItem}
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <Plus className="h-3 w-3" />
                Add Item
              </button>
            </div>
            <div className="space-y-2">
              {form.checklistItems.map((item, idx) => (
                <div key={`checklist-${idx}-${item.slice(0, 8)}`} className="flex items-center gap-2">
                  <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => updateChecklistItem(idx, e.target.value)}
                    placeholder="e.g., Return company laptop"
                    className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                  />
                  <button
                    type="button"
                    onClick={() => removeChecklistItem(idx)}
                    className="p-1 text-red-400 hover:text-red-600 transition-colors"
                    title="Remove item"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* System Access to Revoke */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">
                System Access to Revoke
              </p>
              <button
                type="button"
                onClick={addSystemItem}
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <Plus className="h-3 w-3" />
                Add System
              </button>
            </div>
            <div className="space-y-2">
              {form.systemAccessItems.map((item, idx) => (
                <div key={`system-${idx}-${item.slice(0, 8)}`} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => updateSystemItem(idx, e.target.value)}
                    placeholder="e.g., Email, VPN, Database"
                    className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                  />
                  <button
                    type="button"
                    onClick={() => removeSystemItem(idx)}
                    className="p-1 text-red-400 hover:text-red-600 transition-colors"
                    title="Remove system"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Form actions */}
          <div className="flex items-center gap-3 pt-2 border-t border-border">
            <button
              type="button"
              onClick={handleSubmit}
              className="flex items-center gap-2 bg-foreground text-background text-sm font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
            >
              <Settings className="h-4 w-4" />
              {editingId ? "Save Changes" : "Create Template"}
            </button>
            <button
              type="button"
              onClick={cancelForm}
              className="text-sm font-medium text-muted-foreground hover:text-foreground px-4 py-2.5 rounded-lg hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM DIALOG ─────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">"{deleteTarget?.name}"</span>? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} variant="destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
