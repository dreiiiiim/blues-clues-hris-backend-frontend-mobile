"use client";

import { useEffect, useMemo, useState } from "react";
import { authFetch, getJobSfiaSkills, listSfiaSkills, suggestJobSfiaSkills, updateJobSfiaSkills, type SfiaSkill } from "@/lib/authApi";
import { API_BASE_URL } from "@/lib/api";
import { toast } from "sonner";

export interface EditJobPosting {
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

export interface EditQuestion {
  id: string;
  question_text: string;
  question_type: "text" | "multiple_choice" | "checkbox";
  options: string[];
  is_required: boolean;
}

interface StoredQuestion {
  question_id: string;
  question_text: string;
  question_type: "text" | "multiple_choice" | "checkbox";
  options: string[] | null;
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

export function useEditJobWizard({
  job,
  onSave,
}: Readonly<{
  job: EditJobPosting;
  onSave: (updated: EditJobPosting) => void;
}>) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);
  const [savingQuestions, setSavingQuestions] = useState(false);
  const [savingSfia, setSavingSfia] = useState(false);
  const [suggestingSfia, setSuggestingSfia] = useState(false);
  const [departments, setDepartments] = useState<{ department_id: string; department_name: string }[]>([]);

  const [savedJob, setSavedJob] = useState<EditJobPosting>(job);
  const [form, setForm] = useState({
    title: job.title,
    description: job.description,
    location: job.location ?? "",
    employment_type: job.employment_type ?? "",
    salary_range: job.salary_range ?? "",
    closes_at: job.closes_at ? job.closes_at.slice(0, 10) : "",
    department_id: job.department_id ?? "",
    status: job.status,
  });

  const [questions, setQuestions] = useState<EditQuestion[]>([]);
  const [questionsLoaded, setQuestionsLoaded] = useState(false);
  const [questionsLoading, setQuestionsLoading] = useState(false);

  const [masterSkills, setMasterSkills] = useState<SfiaSkill[]>([]);
  const [sfiaSelected, setSfiaSelected] = useState<Map<string, number>>(new Map());
  const [sfiaSearch, setSfiaSearch] = useState("");
  const [sfiaLoading, setSfiaLoading] = useState(false);
  const [sfiaLoaded, setSfiaLoaded] = useState(false);

  useEffect(() => {
    apiFetch<{ department_id: string; department_name: string }[]>("/users/departments")
      .then(setDepartments)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (step !== 2 || questionsLoaded) return;
    setQuestionsLoading(true);
    apiFetch<StoredQuestion[]>(`/jobs/${job.job_posting_id}/questions`)
      .then((existing) =>
        setQuestions(
          existing.map((q) => ({
            id: q.question_id,
            question_text: q.question_text,
            question_type: q.question_type,
            options: q.options?.length ? q.options : [""],
            is_required: q.is_required,
          })),
        ),
      )
      .catch(() => toast.error("Failed to load questions"))
      .finally(() => {
        setQuestionsLoading(false);
        setQuestionsLoaded(true);
      });
  }, [step, questionsLoaded, job.job_posting_id]);

  useEffect(() => {
    if (step !== 3 || sfiaLoaded) return;
    setSfiaLoading(true);
    Promise.all([listSfiaSkills(), getJobSfiaSkills(job.job_posting_id)])
      .then(([master, current]) => {
        setMasterSkills(master);
        const map = new Map<string, number>();
        for (const s of current) map.set(s.skill_id, s.required_level);
        setSfiaSelected(map);
      })
      .catch(() => {})
      .finally(() => {
        setSfiaLoading(false);
        setSfiaLoaded(true);
      });
  }, [step, sfiaLoaded, job.job_posting_id]);

  const buildPatchPayload = () => ({
    title: form.title,
    description: form.description,
    location: form.location.trim() || null,
    employment_type: form.employment_type || null,
    salary_range: form.salary_range.trim() || null,
    closes_at: form.closes_at ? new Date(form.closes_at).toISOString() : null,
    department_id: form.department_id || null,
    status: form.status,
  });

  const handleSaveDetails = async (e: React.SyntheticEvent, andClose = false) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await apiFetch<EditJobPosting>(`/jobs/${job.job_posting_id}`, {
        method: "PATCH",
        body: JSON.stringify(buildPatchPayload()),
      });
      setSavedJob(updated);
      if (andClose) {
        toast.success("Job posting updated!");
        onSave(updated);
      } else {
        setStep(2);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update job posting";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveQuestions = async () => {
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
      await apiFetch(`/jobs/${job.job_posting_id}/questions`, {
        method: "PUT",
        body: JSON.stringify({ questions: payload }),
      });
      setStep(3);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save questions";
      toast.error(message);
    } finally {
      setSavingQuestions(false);
    }
  };

  const handleSuggestSfia = async () => {
    setSuggestingSfia(true);
    try {
      const suggestions = await suggestJobSfiaSkills(job.job_posting_id);
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

  const handleSaveSfia = async () => {
    setSavingSfia(true);
    try {
      const skills = Array.from(sfiaSelected.entries()).map(([skill_id, required_level]) => ({ skill_id, required_level }));
      await updateJobSfiaSkills(job.job_posting_id, skills);
      toast.success("Job posting updated!");
      onSave(savedJob);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save SFIA skills";
      toast.error(message);
    } finally {
      setSavingSfia(false);
    }
  };

  const handleSkipSfia = () => {
    toast.success("Job posting updated!");
    onSave(savedJob);
  };

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

  const sfiaFiltered = useMemo(
    () =>
      masterSkills.filter(
        (s) =>
          s.skill.toLowerCase().includes(sfiaSearch.toLowerCase()) ||
          (s.category ?? "").toLowerCase().includes(sfiaSearch.toLowerCase()),
      ),
    [masterSkills, sfiaSearch],
  );

  return {
    step,
    setStep,
    saving,
    savingQuestions,
    savingSfia,
    suggestingSfia,
    departments,
    form,
    setForm,
    questions,
    setQuestions,
    questionsLoading,
    sfiaSearch,
    setSfiaSearch,
    sfiaLoading,
    sfiaSelected,
    sfiaFiltered,
    handleSaveDetails,
    handleSaveQuestions,
    handleSuggestSfia,
    handleSaveSfia,
    handleSkipSfia,
    toggleSfiaSkill,
    setSfiaLevel,
  };
}
