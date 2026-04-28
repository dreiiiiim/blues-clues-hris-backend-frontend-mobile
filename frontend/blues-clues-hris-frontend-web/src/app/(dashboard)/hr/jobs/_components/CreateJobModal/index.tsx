"use client";

import { Check, X } from "lucide-react";
import type { SyntheticEvent } from "react";
import { Step1JobDetails } from "./Step1JobDetails";
import { Step2Questions } from "./Step2Questions";
import { Step3SfiaSkills } from "./Step3SfiaSkills";
import { useCreateJobWizard, type CreateJobPosting } from "./useCreateJobWizard";

function stepTitle(step: 1 | 2 | 3): string {
  switch (step) {
    case 1:
      return "Create Job Posting";
    case 2:
      return "Build Application Form";
    default:
      return "Configure SFIA Skills";
  }
}

function stepSubtitle(step: 1 | 2 | 3): string {
  switch (step) {
    case 1:
      return "Fill in the details for the new position";
    case 2:
      return "Add questions applicants must answer";
    default:
      return "Set required skill levels for SFIA matching";
  }
}

export function CreateJobModal({
  onClose,
  onCreate,
}: Readonly<{
  onClose: () => void;
  onCreate: (job: CreateJobPosting) => void;
}>) {
  const wizard = useCreateJobWizard(onCreate);

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-card shadow-2xl">
        <div className="shrink-0 px-6 pb-4 pt-5">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold leading-tight text-foreground">{stepTitle(wizard.step)}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{stepSubtitle(wizard.step)}</p>
            </div>
            <button onClick={onClose} className="ml-2 shrink-0 rounded-md p-1.5 transition-colors hover:bg-muted/50">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <div className="flex w-full items-start">
            <button type="button" onClick={() => wizard.setStep(1)} className="group flex cursor-pointer flex-col items-center gap-1">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-200 ${wizard.step === 1 ? "bg-primary text-primary-foreground ring-2 ring-primary/20 ring-offset-1 ring-offset-card" : wizard.step > 1 ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
                {wizard.step > 1 ? <Check className="h-3.5 w-3.5" /> : "1"}
              </div>
              <span className={`whitespace-nowrap text-[10px] font-medium leading-none ${wizard.step === 1 ? "text-primary" : "text-muted-foreground"}`}>Job Details</span>
            </button>
            <div className="mx-2 mt-[13px] flex-1">
              <div className={`h-px w-full transition-colors duration-300 ${wizard.step > 1 ? "bg-emerald-400/70" : "bg-border"}`} />
            </div>
            <button type="button" onClick={() => { if (wizard.createdJob) wizard.setStep(2); }} disabled={!wizard.createdJob} className={`group flex flex-col items-center gap-1 ${wizard.createdJob ? "cursor-pointer" : "cursor-default"}`}>
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-200 ${wizard.step === 2 ? "bg-primary text-primary-foreground ring-2 ring-primary/20 ring-offset-1 ring-offset-card" : wizard.step > 2 && wizard.createdJob ? "bg-emerald-500 text-white" : wizard.createdJob ? "bg-muted text-muted-foreground group-hover:bg-muted/70" : "bg-muted/40 text-muted-foreground/40"}`}>
                {wizard.step > 2 && wizard.createdJob ? <Check className="h-3.5 w-3.5" /> : "2"}
              </div>
              <span className={`whitespace-nowrap text-[10px] font-medium leading-none ${wizard.step === 2 ? "text-primary" : wizard.createdJob ? "text-muted-foreground" : "text-muted-foreground/40"}`}>App Form</span>
            </button>
            <div className="mx-2 mt-[13px] flex-1">
              <div className={`h-px w-full transition-colors duration-300 ${wizard.step > 2 ? "bg-emerald-400/70" : "bg-border"}`} />
            </div>
            <button type="button" onClick={() => { if (wizard.createdJob) wizard.goToSfiaStep(); }} disabled={!wizard.createdJob} className={`group flex flex-col items-center gap-1 ${wizard.createdJob ? "cursor-pointer" : "cursor-default"}`}>
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-200 ${wizard.step === 3 ? "bg-primary text-primary-foreground ring-2 ring-primary/20 ring-offset-1 ring-offset-card" : wizard.createdJob ? "bg-muted text-muted-foreground group-hover:bg-muted/70" : "bg-muted/40 text-muted-foreground/40"}`}>
                3
              </div>
              <span className={`whitespace-nowrap text-[10px] font-medium leading-none ${wizard.step === 3 ? "text-primary" : wizard.createdJob ? "text-muted-foreground" : "text-muted-foreground/40"}`}>SFIA Skills</span>
            </button>
          </div>
        </div>
        <div className="border-t border-border" />

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {wizard.step === 1 && (
            <Step1JobDetails
              form={wizard.form}
              setForm={wizard.setForm}
              departments={wizard.departments}
              saving={wizard.saving}
              onClose={onClose}
              onSubmit={(e) => wizard.handleCreatePosting(e, false)}
              onSaveDraft={() => wizard.handleCreatePosting({ preventDefault: () => {} } as SyntheticEvent<HTMLFormElement>, true)}
            />
          )}

          {wizard.step === 2 && (
            <Step2Questions
              questions={wizard.questions}
              setQuestions={wizard.setQuestions}
              savingQuestions={wizard.savingQuestions}
              onSkip={wizard.handleSkipQuestions}
              onNext={wizard.handleSaveQuestions}
            />
          )}

          {wizard.step === 3 && (
            <Step3SfiaSkills
              sfiaSearch={wizard.sfiaSearch}
              setSfiaSearch={wizard.setSfiaSearch}
              handleSuggestSfia={wizard.handleSuggestSfia}
              suggestingSfia={wizard.suggestingSfia}
              sfiaLoading={wizard.sfiaLoading}
              sfiaSelected={wizard.sfiaSelected}
              sfiaFiltered={wizard.sfiaFiltered}
              toggleSfiaSkill={wizard.toggleSfiaSkill}
              setSfiaLevel={wizard.setSfiaLevel}
              handleSkipSfia={wizard.handleSkipSfia}
              handleSaveSfia={wizard.handleSaveSfia}
              savingSfia={wizard.savingSfia}
            />
          )}
        </div>
      </div>
    </div>
  );
}
