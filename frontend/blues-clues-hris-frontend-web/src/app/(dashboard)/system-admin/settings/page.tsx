"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getLifecyclePermissions,
  saveLifecyclePermissions,
  type LifecycleModule,
  type HRRole,
} from "@/lib/adminApi";
import { Button } from "@/components/ui/button";
import {
  Shield, UserPlus, Users, DollarSign,
  TrendingUp, LogOut, Check, RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────

const HR_ROLES: HRRole[] = ["HR Officer", "Manager", "Employee", "Applicant"];

const ROLE_COLORS: Record<HRRole, string> = {
  "HR Officer": "bg-blue-100 text-blue-700 border-blue-200",
  Manager:      "bg-green-100 text-green-700 border-green-200",
  Employee:     "bg-purple-100 text-purple-700 border-purple-200",
  Applicant:    "bg-amber-100 text-amber-700 border-amber-200",
};

const MODULE_ICONS: Record<string, React.ElementType> = {
  recruitment:  UserPlus,
  onboarding:   Users,
  compensation: DollarSign,
  performance:  TrendingUp,
  offboarding:  LogOut,
};

// ─── Checkbox card ────────────────────────────────────────────────────────────

function RoleCheckbox({
  role,
  checked,
  onChange,
}: {
  role: HRRole;
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-sm font-semibold w-full text-left ${
        checked
          ? "border-primary bg-primary/5 text-foreground"
          : "border-border bg-background text-muted-foreground hover:border-border/80"
      }`}
    >
      <div className={`h-5 w-5 rounded flex items-center justify-center border-2 shrink-0 transition-colors ${
        checked ? "bg-primary border-primary" : "border-muted-foreground/40 bg-background"
      }`}>
        {checked && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />}
      </div>
      <span>{role}</span>
    </button>
  );
}

// ─── Module row ───────────────────────────────────────────────────────────────

function ModuleCard({
  module,
  onChange,
}: {
  module: LifecycleModule;
  onChange: (role: HRRole, val: boolean) => void;
}) {
  const Icon = MODULE_ICONS[module.module_id] ?? Shield;
  const grantedCount = Object.values(module.permissions).filter(Boolean).length;

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-start gap-4">
        <div className="p-2.5 bg-primary/10 text-primary rounded-lg shrink-0">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-bold text-foreground">{module.name}</h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border uppercase tracking-wide">
              {grantedCount}/{HR_ROLES.length} Roles
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{module.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {HR_ROLES.map(role => (
          <RoleCheckbox
            key={role}
            role={role}
            checked={module.permissions[role]}
            onChange={val => onChange(role, val)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GlobalSettingsPage() {
  const [modules, setModules]       = useState<LifecycleModule[]>([]);
  const [original, setOriginal]     = useState<LifecycleModule[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [isDirty, setIsDirty]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLifecyclePermissions();
      setModules(data);
      setOriginal(JSON.parse(JSON.stringify(data))); // deep copy for reset
    } catch {
      toast.error("Failed to load permissions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleChange = (moduleId: string, role: HRRole, val: boolean) => {
    setModules(prev => {
      const updated = prev.map(m =>
        m.module_id === moduleId
          ? { ...m, permissions: { ...m.permissions, [role]: val } }
          : m
      );
      setIsDirty(JSON.stringify(updated) !== JSON.stringify(original));
      return updated;
    });
  };

  const handleReset = () => {
    setModules(JSON.parse(JSON.stringify(original)));
    setIsDirty(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveLifecyclePermissions(
        modules.map(m => ({ module_id: m.module_id, permissions: m.permissions }))
      );
      setOriginal(JSON.parse(JSON.stringify(modules)));
      setIsDirty(false);
      toast.success("Permissions saved successfully.");
    } catch {
      toast.error("Failed to save permissions.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 text-primary rounded-lg">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">HR Lifecycle RBAC Permissions</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure role-based access control for each HR lifecycle stage. Check the boxes to grant permissions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Role legend */}
          <div className="hidden md:flex items-center gap-2 mr-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Roles:</span>
            {HR_ROLES.map(r => (
              <span key={r} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ROLE_COLORS[r]}`}>
                {r}
              </span>
            ))}
          </div>
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={handleReset}
            disabled={!isDirty || saving}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
          <Button
            className="gap-1.5"
            onClick={handleSave}
            disabled={!isDirty || saving}
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Unsaved changes banner */}
      {isDirty && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm font-medium">
          <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
          You have unsaved changes.
        </div>
      )}

      {/* Module cards */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Loading permissions...</div>
      ) : (
        <div className="space-y-4">
          {modules.map(m => (
            <ModuleCard
              key={m.module_id}
              module={m}
              onChange={(role, val) => handleChange(m.module_id, role, val)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
