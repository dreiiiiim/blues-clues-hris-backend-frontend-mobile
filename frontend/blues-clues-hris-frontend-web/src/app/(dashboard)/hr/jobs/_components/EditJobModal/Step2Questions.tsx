import { Loader2 } from "lucide-react";
import { Step2Questions as SharedStep2Questions } from "../CreateJobModal/Step2Questions";
import type { EditQuestion } from "./useEditJobWizard";

export function Step2Questions({
  questions,
  setQuestions,
  questionsLoading,
  savingQuestions,
  onSkip,
  onNext,
}: Readonly<{
  questions: EditQuestion[];
  setQuestions: (questions: EditQuestion[]) => void;
  questionsLoading: boolean;
  savingQuestions: boolean;
  onSkip: () => void;
  onNext: () => Promise<void>;
}>) {
  if (questionsLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading questions...
        </div>
      </div>
    );
  }

  return (
    <SharedStep2Questions
      questions={questions}
      setQuestions={setQuestions}
      savingQuestions={savingQuestions}
      onSkip={onSkip}
      onNext={onNext}
    />
  );
}
