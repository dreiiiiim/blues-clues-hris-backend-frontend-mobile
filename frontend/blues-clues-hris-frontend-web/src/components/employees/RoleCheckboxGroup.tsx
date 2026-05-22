"use client";

import { HR_ROLE_NAMES } from "@/lib/hrRoleAccess";

export interface RoleOption {
  role_id: string;
  role_name: string;
}

const HR_OFFICER_NAME = "HR Officer";
const HR_SUB_NAMES = new Set<string>(HR_ROLE_NAMES.filter(n => n !== HR_OFFICER_NAME));

export function RoleCheckboxGroup({ roles, selectedIds, onChange, error }: Readonly<{
  roles: RoleOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  error?: string;
}>) {
  const hrOfficerRole = roles.find(r => r.role_name === HR_OFFICER_NAME);
  const hrSubRoles    = roles.filter(r => HR_SUB_NAMES.has(r.role_name));
  const otherRoles    = roles.filter(r => !HR_ROLE_NAMES.includes(r.role_name as typeof HR_ROLE_NAMES[number]));

  const selected         = new Set(selectedIds);
  const hrOfficerChecked = !!hrOfficerRole && selected.has(hrOfficerRole.role_id);

  const toggle = (roleId: string) => {
    const isHrOfficer = hrOfficerRole?.role_id === roleId;
    if (isHrOfficer) {
      if (hrOfficerChecked) {
        const allHrIds = new Set([hrOfficerRole!.role_id, ...hrSubRoles.map(r => r.role_id)]);
        onChange(selectedIds.filter(id => !allHrIds.has(id)));
      } else {
        const allHrIds = [hrOfficerRole!.role_id, ...hrSubRoles.map(r => r.role_id)];
        const next = new Set(selectedIds);
        allHrIds.forEach(id => next.add(id));
        onChange(Array.from(next));
      }
    } else {
      selected.has(roleId)
        ? onChange(selectedIds.filter(id => id !== roleId))
        : onChange([...selectedIds, roleId]);
    }
  };

  const CheckRow = ({ role, indented = false, disabled = false }: { role: RoleOption; indented?: boolean; disabled?: boolean }) => {
    const isChecked = selected.has(role.role_id);
    return (
      <label
        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors select-none
          ${indented ? "ml-5 pl-2.5" : ""}
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
          ${isChecked && !disabled ? "bg-primary/5" : !disabled ? "hover:bg-muted/50" : ""}`}
      >
        <input
          type="checkbox"
          checked={isChecked}
          disabled={disabled}
          onChange={() => toggle(role.role_id)}
          className="h-4 w-4 rounded border-input accent-primary shrink-0"
        />
        <span className="text-sm leading-tight">{role.role_name}</span>
        {disabled && isChecked && (
          <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-primary/60">Included</span>
        )}
      </label>
    );
  };

  const hasHrRoles = hrOfficerRole || hrSubRoles.length > 0;

  return (
    <div className={`rounded-lg border ${error ? "border-red-400" : "border-input"} divide-y divide-border overflow-hidden`}>
      {hasHrRoles && (
        <div className="py-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3 pb-1">HR Roles</p>
          {hrOfficerRole && <CheckRow role={hrOfficerRole} />}
          {hrSubRoles.length > 0 && (
            <div className="mt-0.5 border-l-2 border-primary/20 ml-3.5">
              {hrSubRoles.map(r => <CheckRow key={r.role_id} role={r} indented disabled={hrOfficerChecked} />)}
            </div>
          )}
        </div>
      )}
      {otherRoles.length > 0 && (
        <div className="py-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3 pb-1">Other Roles</p>
          {otherRoles.map(r => <CheckRow key={r.role_id} role={r} />)}
        </div>
      )}
      {roles.length === 0 && (
        <p className="px-3 py-4 text-sm text-muted-foreground text-center">No roles available</p>
      )}
    </div>
  );
}
