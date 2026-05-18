import { Loader2, MoveRight, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CreateQuestion } from "./useCreateJobWizard";

function newQuestion(): CreateQuestion {
  return {
    id: crypto.randomUUID(),
    question_text: "",
    question_type: "text",
    options: [""],
    is_required: true,
  };
}

function QuestionBuilder({
  questions,
  onChange,
}: Readonly<{
  questions: CreateQuestion[];
  onChange: (qs: CreateQuestion[]) => void;
}>) {
  const updateQ = (id: string, patch: Partial<CreateQuestion>) =>
    onChange(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  const removeQ = (id: string) => onChange(questions.filter((q) => q.id !== id));
  const addOption = (id: string) =>
    updateQ(id, { options: [...(questions.find((q) => q.id === id)?.options ?? []), ""] });

  const updateOption = (id: string, idx: number, val: string) => {
    const q = questions.find((item) => item.id === id);
    if (!q) return;
    const options = [...q.options];
    options[idx] = val;
    updateQ(id, { options });
  };

  const removeOption = (id: string, idx: number) => {
    const q = questions.find((item) => item.id === id);
    if (!q) return;
    updateQ(id, { options: q.options.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-4">
      {questions.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/20 py-10">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
            <Plus className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No questions yet. Add your first question.</p>
        </div>
      )}
      {questions.map((q, idx) => (
        <div key={q.id} className="space-y-2 rounded-xl border border-border bg-background p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-muted-foreground">Question {idx + 1}</p>
            <button type="button" onClick={() => removeQ(q.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <Input
            value={q.question_text}
            onChange={(e) => updateQ(q.id, { question_text: e.target.value })}
            placeholder="Enter your question"
            className="h-9"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={q.question_type}
              onChange={(e) => updateQ(q.id, { question_type: e.target.value as CreateQuestion["question_type"] })}
              className="h-9 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="text">Text</option>
              <option value="multiple_choice">Multiple Choice</option>
              <option value="checkbox">Checkbox</option>
            </select>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={q.is_required} onChange={(e) => updateQ(q.id, { is_required: e.target.checked })} />
              Required
            </label>
          </div>
          {q.question_type !== "text" && (
            <div className="space-y-2">
              {q.options.map((opt, i) => (
                <div key={`${q.id}-opt-${i}`} className="flex items-center gap-2">
                  <Input value={opt} onChange={(e) => updateOption(q.id, i, e.target.value)} placeholder={`Option ${i + 1}`} className="h-8 text-xs" />
                  <button type="button" onClick={() => removeOption(q.id, i)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => addOption(q.id)}>
                Add Option
              </Button>
            </div>
          )}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 border-dashed" onClick={() => onChange([...questions, newQuestion()])}>
        <Plus className="h-3.5 w-3.5" /> Add Question
      </Button>
    </div>
  );
}

export function Step2Questions({
  questions,
  setQuestions,
  savingQuestions,
  onSkip,
  onNext,
}: Readonly<{
  questions: CreateQuestion[];
  setQuestions: (questions: CreateQuestion[]) => void;
  savingQuestions: boolean;
  onSkip: () => void;
  onNext: () => Promise<void>;
}>) {
  return (
    <div className="space-y-4">
      <QuestionBuilder questions={questions} onChange={setQuestions} />
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="ghost" className="gap-1.5" onClick={onSkip} disabled={savingQuestions}>
          Skip for now
        </Button>
        <Button className="flex-1 gap-1.5" onClick={() => void onNext()} disabled={savingQuestions}>
          {savingQuestions ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Next</span><MoveRight className="h-4 w-4" /></>}
        </Button>
      </div>
    </div>
  );
}
