import { Step3SfiaSkills as SharedStep3SfiaSkills } from "../CreateJobModal/Step3SfiaSkills";
import type { SfiaSkill } from "@/lib/authApi";

export function Step3SfiaSkills({
  sfiaSearch,
  setSfiaSearch,
  handleSuggestSfia,
  suggestingSfia,
  sfiaLoading,
  sfiaSelected,
  sfiaFiltered,
  toggleSfiaSkill,
  setSfiaLevel,
  handleSkipSfia,
  handleSaveSfia,
  savingSfia,
}: Readonly<{
  sfiaSearch: string;
  setSfiaSearch: (value: string) => void;
  handleSuggestSfia: () => Promise<void>;
  suggestingSfia: boolean;
  sfiaLoading: boolean;
  sfiaSelected: Map<string, number>;
  sfiaFiltered: SfiaSkill[];
  toggleSfiaSkill: (skillId: string) => void;
  setSfiaLevel: (skillId: string, level: number) => void;
  handleSkipSfia: () => void;
  handleSaveSfia: () => Promise<void>;
  savingSfia: boolean;
}>) {
  return (
    <SharedStep3SfiaSkills
      sfiaSearch={sfiaSearch}
      setSfiaSearch={setSfiaSearch}
      handleSuggestSfia={handleSuggestSfia}
      suggestingSfia={suggestingSfia}
      sfiaLoading={sfiaLoading}
      sfiaSelected={sfiaSelected}
      sfiaFiltered={sfiaFiltered}
      toggleSfiaSkill={toggleSfiaSkill}
      setSfiaLevel={setSfiaLevel}
      handleSkipSfia={handleSkipSfia}
      handleSaveSfia={handleSaveSfia}
      savingSfia={savingSfia}
    />
  );
}
