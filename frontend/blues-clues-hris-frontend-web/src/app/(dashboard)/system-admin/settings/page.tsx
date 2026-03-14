"use client";

import { type ElementType, useCallback, useEffect, useState } from "react";
import {
  getLifecyclePermissions,
  saveLifecyclePermissions,
  type LifecycleModule,
  type HRRole,
} from "@/lib/adminApi";
import { Button } from "@/components/ui/button";
import {
  Shield,
  UserPlus,
  Users,
  DollarSign,
  TrendingUp,
  LogOut,
  Check,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

const HR_ROLES: HRRole[] = ["HR Officer", "Manager", "Employee", "Applicant"];

const ROLE_COLORS: Record<HRRole, string> = {
  "HR Officer": "bg-blue-100 text-blue-700 border-blue-200",
  Manager: "bg-green-100 text-green-700 border-green-200",
  Employee: "bg-purple-100 text-purple-700 border-purple-200",
  Applicant: "bg-amber-100 text-amber-700 border-amber-200",
};

const MODULE_ICONS: Record<string, ElementType> = {
  recruitment: UserPlus,
  onboarding: Users,
  compensation: DollarSign,
  performance: TrendingUp,
  offboarding: LogOut,
};

function RoleCheckbox({
  role,
  checked,
  onChange,
}: {
  role: HRRole;
  checked: boolean;
  onChange: (value: boolean) => void;
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
      <div
        className={`h-5 w-5 rounded flex items-center justify-center border-2 shrink-0 transition-colors ${
          checked ? "bg-primary border-primary" : "border-muted-foreground/40 bg-background"
        }`}
      >
        {checked && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />}
      </div>
      <span>{role}</span>
    </button>
  );
}

function ModuleCard({
  module,
  onChange,
}: {
  module: LifecycleModule;
  onChange: (role: HRRole, value: boolean) => void;
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
        {HR_ROLES.map((role) => (
          <RoleCheckbox
            key={role}
            role={role}
            checked={module.permissions[role]}
            onChange={(value) => onChange(role, value)}
          />
        ))}
      </div>
    </div>
  );
}

export default function GlobalSettingsPage() {
  const [modules, setModules] = useState<LifecycleModule[]>([]);
  const [original, setOriginal] = useState<LifecycleModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLifecyclePermissions();
      setModules(data);
      setOriginal(JSON.parse(JSON.stringify(data)));
    } catch {
      toast.error("Failed to load permissions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleChange = (moduleId: string, role: HRRole, value: boolean) => {
    setModules((current) => {
      const updated = current.map((item) =>
        item.module_id === moduleId
          ? { ...item, permissions: { ...item.permissions, [role]: value } }
          : item,
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
        modules.map((module) => ({ module_id: module.module_id, permissions: module.permissions })),
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
          <div className="hidden md:flex items-center gap-2 mr-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Roles:</span>
            {HR_ROLES.map((role) => (
              <span key={role} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ROLE_COLORS[role]}`}>
                {role}
              </span>
            ))}
          </div>
          <Button variant="outline" className="gap-1.5" onClick={handleReset} disabled={!isDirty || saving}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
          <Button className="gap-1.5" onClick={handleSave} disabled={!isDirty || saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {isDirty && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm font-medium">
          <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
          You have unsaved changes.
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Loading permissions...</div>
      ) : (
        <div className="space-y-4">
          {modules.map((module) => (
            <ModuleCard
              key={module.module_id}
              module={module}
              onChange={(role, value) => handleChange(module.module_id, role, value)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
