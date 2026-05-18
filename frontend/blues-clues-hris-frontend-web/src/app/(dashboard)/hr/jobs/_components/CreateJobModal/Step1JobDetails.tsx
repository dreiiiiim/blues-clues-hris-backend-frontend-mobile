import type { Dispatch, SetStateAction, SyntheticEvent } from "react";
import { Loader2, MoveRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CreateFormState {
  title: string;
  description: string;
  location: string;
  employment_type: string;
  salary_range: string;
  closes_at: string;
  department_id: string;
}

export function Step1JobDetails({
  form,
  setForm,
  departments,
  saving,
  onClose,
  onSubmit,
  onSaveDraft,
}: Readonly<{
  form: CreateFormState;
  setForm: Dispatch<SetStateAction<CreateFormState>>;
  departments: { department_id: string; department_name: string }[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (e: SyntheticEvent<HTMLFormElement>) => Promise<void>;
  onSaveDraft: () => Promise<void>;
}>) {
  return (
    <form id="step1-form" onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="create-title" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Job Title *</label>
        <Input
          id="create-title"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="e.g. Senior Software Engineer"
          required
          className="h-10"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="create-description" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Description *</label>
        <textarea
          id="create-description"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Describe the role, responsibilities, and requirements..."
          required
          rows={4}
          className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="create-department" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Department</label>
        <select
          id="create-department"
          value={form.department_id}
          onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value }))}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">Select department</option>
          {departments.map((d) => (
            <option key={d.department_id} value={d.department_id}>{d.department_name}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="create-location" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Location</label>
          <Input id="create-location" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="e.g. Manila" className="h-10" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="create-employment-type" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Employment Type</label>
          <select
            id="create-employment-type"
            value={form.employment_type}
            onChange={(e) => setForm((f) => ({ ...f, employment_type: e.target.value }))}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Select type</option>
            <option>Full-time</option>
            <option>Part-time</option>
            <option>Contract</option>
            <option>Internship</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="create-salary" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Salary Range</label>
          <Input id="create-salary" value={form.salary_range} onChange={(e) => setForm((f) => ({ ...f, salary_range: e.target.value }))} placeholder="e.g. 50k - 80k" className="h-10" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="create-closes-at" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Closes On</label>
          <Input id="create-closes-at" type="date" value={form.closes_at} onChange={(e) => setForm((f) => ({ ...f, closes_at: e.target.value }))} className="h-10" />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1 gap-1.5 border-dashed text-muted-foreground hover:text-foreground"
          disabled={saving || !form.title.trim() || !form.description.trim()}
          onClick={onSaveDraft}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save as Draft"}
        </Button>
        <Button type="submit" className="flex-1 gap-1.5" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Next</span><MoveRight className="h-4 w-4" /></>}
        </Button>
      </div>
    </form>
  );
}
