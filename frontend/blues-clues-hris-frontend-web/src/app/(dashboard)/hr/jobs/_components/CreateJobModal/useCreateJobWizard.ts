"use client";

import { useEffect, useMemo, useState } from "react";
import { authFetch, listSfiaSkills, suggestJobSfiaSkills, updateJobSfiaSkills, type SfiaSkill } from "@/lib/authApi";
import { API_BASE_URL } from "@/lib/api";
import { toast } from "sonner";

export interface CreateJobPosting {
  job_posting_id: string;
  title: string;
  description: string;
  location: string | null;
  employment_type: string | null;
  salary_range: string | null;
  status: "open" | "closed" | "draft";
  posted_at: string;
  closes_at: string | null;
  department_id: string | null;
  applicant_count?: number;
}

export interface CreateQuestion {
  id: string;
  question_text: string;
  question_type: "text" | "multiple_choice" | "checkbox";
  options: string[];
  is_required: boolean;
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await authFetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Request failed");
  return data as T;
}

export function useCreateJobWizard(onCreate: (job: CreateJobPosting) => void) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [createdJob, setCreatedJob] = useState<CreateJobPosting | null>(null);
  const [questions, setQuestions] = useState<CreateQuestion[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingQuestions, setSavingQuestions] = useState(false);
  const [departments, setDepartments] = useState<{ department_id: string; department_name: string }[]>([]);
  const [masterSkills, setMasterSkills] = useState<SfiaSkill[]>([]);
  const [sfiaSelected, setSfiaSelected] = useState<Map<string, number>>(new Map());
  const [sfiaSearch, setSfiaSearch] = useState("");
  const [savingSfia, setSavingSfia] = useState(false);
  const [sfiaLoading, setSfiaLoading] = useState(false);
  const [suggestingSfia, setSuggestingSfia] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    employment_type: "",
    salary_range: "",
    closes_at: "",
    department_id: "",
  });

  useEffect(() => {
    apiFetch<{ department_id: string; department_name: string }[]>("/users/departments")
      .then(setDepartments)
      .catch(() => {});
  }, []);

  const goToSfiaStep = () => {
    setSfiaLoading(true);
    listSfiaSkills()
      .then(setMasterSkills)
      .catch(() => {})
      .finally(() => setSfiaLoading(false));
    setStep(3);
  };

  const handleCreatePosting = async (e: React.SyntheticEvent<HTMLFormElement>, asDraft = false) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        title: form.title,
        description: form.description,
        status: asDraft ? "draft" : "open",
      };
      if (form.location.trim()) payload.location = form.location.trim();
      if (form.employment_type) payload.employment_type = form.employment_type;
      if (form.salary_range.trim()) payload.salary_range = form.salary_range.trim();
      if (form.closes_at) payload.closes_at = new Date(form.closes_at).toISOString();
      if (form.department_id) payload.department_id = form.department_id;

      const job = await apiFetch<CreateJobPosting>("/jobs", { method: "POST", body: JSON.stringify(payload) });
      setCreatedJob(job);
      if (asDraft) {
        toast.success("Job saved as draft.");
        onCreate(job);
      } else {
        setStep(2);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create job posting";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveQuestions = async () => {
    if (!createdJob) return;
    setSavingQuestions(true);
    try {
      const payload = questions
        .filter((q) => q.question_text.trim())
        .map((q, i) => ({
          question_text: q.question_text.trim(),
          question_type: q.question_type,
          options: q.question_type !== "text" && q.options.length ? q.options.filter(Boolean) : undefined,
          is_required: q.is_required,
          sort_order: i,
        }));

      await apiFetch(`/jobs/${createdJob.job_posting_id}/questions`, {
        method: "PUT",
        body: JSON.stringify({ questions: payload }),
      });
      goToSfiaStep();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save questions";
      toast.error(message);
    } finally {
      setSavingQuestions(false);
    }
  };

  const handleSkipQuestions = () => {
    if (!createdJob) return;
    goToSfiaStep();
  };

  const handleSuggestSfia = async () => {
    if (!createdJob) return;
    setSuggestingSfia(true);
    try {
      const suggestions = await suggestJobSfiaSkills(createdJob.job_posting_id);
      if (suggestions.length === 0) {
        toast.info("No skill matches found in job description.");
        return;
      }
      setSfiaSelected((prev) => {
        const next = new Map(prev);
        for (const s of suggestions) {
          if (!next.has(s.skill_id)) next.set(s.skill_id, s.suggested_level);
        }
        return next;
      });
      toast.success(`${suggestions.length} skill${suggestions.length !== 1 ? "s" : ""} suggested from job description.`);
    } catch {
      toast.error("Failed to fetch suggestions.");
    } finally {
      setSuggestingSfia(false);
    }
  };

  const sfiaFiltered = useMemo(
    () =>
      masterSkills.filter(
        (s) =>
          s.skill.toLowerCase().includes(sfiaSearch.toLowerCase()) ||
          (s.category ?? "").toLowerCase().includes(sfiaSearch.toLowerCase()),
      ),
    [masterSkills, sfiaSearch],
  );

  const toggleSfiaSkill = (skillId: string) => {
    setSfiaSelected((prev) => {
      const next = new Map(prev);
      if (next.has(skillId)) next.delete(skillId);
      else next.set(skillId, 3);
      return next;
    });
  };

  const setSfiaLevel = (skillId: string, level: number) => {
    setSfiaSelected((prev) => {
      const next = new Map(prev);
      next.set(skillId, level);
      return next;
    });
  };

  const handleSaveSfia = async () => {
    if (!createdJob) return;
    setSavingSfia(true);
    try {
      const skills = Array.from(sfiaSelected.entries()).map(([skill_id, required_level]) => ({ skill_id, required_level }));
      await updateJobSfiaSkills(createdJob.job_posting_id, skills);
      toast.success("Job posting created!");
      onCreate(createdJob);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save SFIA skills";
      toast.error(message);
    } finally {
      setSavingSfia(false);
    }
  };

  const handleSkipSfia = () => {
    if (!createdJob) return;
    toast.success("Job posting created!");
    onCreate(createdJob);
  };

  return {
    step,
    setStep,
    createdJob,
    questions,
    setQuestions,
    saving,
    savingQuestions,
    departments,
    masterSkills,
    sfiaSelected,
    sfiaSearch,
    setSfiaSearch,
    savingSfia,
    sfiaLoading,
    suggestingSfia,
    form,
    setForm,
    sfiaFiltered,
    handleCreatePosting,
    handleSaveQuestions,
    handleSkipQuestions,
    goToSfiaStep,
    handleSuggestSfia,
    toggleSfiaSkill,
    setSfiaLevel,
    handleSaveSfia,
    handleSkipSfia,
  };
}
