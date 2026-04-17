import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { SupabaseService } from '../supabase/supabase.service';

type SfiaRequirement = {
  skill_id: string;
  skill_name: string;
  required_level: number;
  weight: number;
  level_descriptions: string[];
};

type ScoreApplicationParams = {
  applicationId: string;
  jobPostingId: string;
  applicantId: string;
  resumeSource?: { bucket: string; path: string; name: string };
};

type ScoreApplicationResult = {
  graded: boolean;
  sfia_matching_percentage?: number;
  matched_skills?: number;
  reason?: string;
};

type ScoreAllResult = {
  graded_applications: number;
  total_applications: number;
  reason?: string;
};

type ScoreWithFallbackResult = {
  sfia_match_percentage: number | null;
  sfia_grade: number | null;
  sfia_assessment_status: 'assessed' | 'not_assessed' | 'not_configured';
};

@Injectable()
export class SfiaScoringService {
  private readonly logger = new Logger(SfiaScoringService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async scoreApplication(params: ScoreApplicationParams): Promise<ScoreApplicationResult> {
    const { applicationId, jobPostingId, applicantId, resumeSource } = params;
    const supabase = this.supabaseService.getClient();

    await this.ensureApplicationMirror(applicationId, jobPostingId, applicantId);

    const requirements = await this.getJobSfiaRequirementsWithDescriptions(jobPostingId);
    if (requirements.length === 0) {
      return { graded: false, reason: 'This job has no SFIA required skills configured yet.' };
    }

    let resumePath: string;
    let resumeName: string;

    if (resumeSource) {
      resumePath = resumeSource.path;
      resumeName = resumeSource.name;
    } else {
      const { data: applicant, error: applicantError } = await supabase
        .from('applicant_profile')
        .select('resume_url, resume_name')
        .eq('applicant_id', applicantId)
        .maybeSingle();

      if (applicantError) throw new InternalServerErrorException(applicantError.message);
      if (!applicant?.resume_url) {
        return { graded: false, reason: 'No resume uploaded yet.' };
      }
      resumePath = applicant.resume_url;
      resumeName = applicant.resume_name ?? '';
    }

    const resumeText = await this.extractResumeTextFromStorage(resumePath, resumeName);
    const normalizedResume = this.normalizeText(resumeText);

    if (!normalizedResume) {
      return { graded: false, reason: 'Could not extract readable resume text for SFIA scan.' };
    }

    const supplyRows = requirements.map((req) => {
      const candidateLevel = this.estimateCandidateLevelFromResume(
        normalizedResume,
        req.skill_name,
        req.required_level,
        req.level_descriptions,
      );
      return {
        candidate_skill_score_sfia_id: crypto.randomUUID(),
        application_id: applicationId,
        skill_id: req.skill_id,
        candidate_level: candidateLevel,
        match_score: this.computeEstimatedMatchScore(candidateLevel, req.required_level),
      };
    });

    const { error: deleteError } = await supabase
      .from('candidate_skill_score_sfia')
      .delete()
      .eq('application_id', applicationId);
    if (deleteError) throw new InternalServerErrorException(deleteError.message);

    const { error: insertError } = await supabase
      .from('candidate_skill_score_sfia')
      .insert(supplyRows);
    if (insertError) throw new InternalServerErrorException(insertError.message);

    const percentage = this.computeSfiaRelevancePercentage(
      requirements.map((r) => ({ skill_id: r.skill_id, required_level: r.required_level })),
      supplyRows.map((r) => ({ skill_id: r.skill_id, candidate_level: r.candidate_level })),
    );

    const { error: updateError } = await supabase
      .from('job_application_sfia')
      .update({ sfia_matching_percentage: percentage })
      .eq('application_id', applicationId);
    if (updateError) {
      this.logger.warn(`Unable to cache sfia score for ${applicationId}: ${updateError.message}`);
    }

    return {
      graded: true,
      sfia_matching_percentage: percentage,
      matched_skills: supplyRows.length,
    };
  }

  async scoreAllApplicationsForApplicant(
    applicantId: string,
    resumeSource: { path: string; name: string },
  ): Promise<ScoreAllResult> {
    const supabase = this.supabaseService.getClient();

    const { data: apps, error: appsError } = await supabase
      .from('job_applications')
      .select('application_id, job_posting_id')
      .eq('applicant_id', applicantId);

    if (appsError) throw new InternalServerErrorException(appsError.message);

    const applications = apps ?? [];
    if (applications.length === 0) {
      return {
        graded_applications: 0,
        total_applications: 0,
        reason: 'No job applications yet. SFIA score will be generated after applying to a job.',
      };
    }

    const resumeText = await this.extractResumeTextFromStorage(resumeSource.path, resumeSource.name);
    const normalizedResume = this.normalizeText(resumeText);

    if (!normalizedResume) {
      return {
        graded_applications: 0,
        total_applications: applications.length,
        reason: 'Could not parse resume text. Please upload a clearer PDF or DOCX.',
      };
    }

    let gradedCount = 0;
    for (const app of applications) {
      await this.ensureApplicationMirror(app.application_id, app.job_posting_id, applicantId);

      const requirements = await this.getJobSfiaRequirementsWithDescriptions(app.job_posting_id);
      if (requirements.length === 0) continue;

      const supplyRows = requirements.map((req) => {
        const candidateLevel = this.estimateCandidateLevelFromResume(
          normalizedResume,
          req.skill_name,
          req.required_level,
          req.level_descriptions,
        );
        return {
          candidate_skill_score_sfia_id: crypto.randomUUID(),
          application_id: app.application_id,
          skill_id: req.skill_id,
          candidate_level: candidateLevel,
          match_score: this.computeEstimatedMatchScore(candidateLevel, req.required_level),
        };
      });

      const { error: deleteError } = await supabase
        .from('candidate_skill_score_sfia')
        .delete()
        .eq('application_id', app.application_id);
      if (deleteError) throw new InternalServerErrorException(deleteError.message);

      const { error: insertError } = await supabase
        .from('candidate_skill_score_sfia')
        .insert(supplyRows);
      if (insertError) throw new InternalServerErrorException(insertError.message);

      const percentage = this.computeSfiaRelevancePercentage(
        requirements.map((r) => ({ skill_id: r.skill_id, required_level: r.required_level })),
        supplyRows.map((r) => ({ skill_id: r.skill_id, candidate_level: r.candidate_level })),
      );

      const { error: updateError } = await supabase
        .from('job_application_sfia')
        .update({ sfia_matching_percentage: percentage })
        .eq('application_id', app.application_id);
      if (updateError) {
        this.logger.warn(`Unable to cache sfia score for ${app.application_id}: ${updateError.message}`);
      }

      gradedCount += 1;
    }

    return {
      graded_applications: gradedCount,
      total_applications: applications.length,
      reason:
        gradedCount === 0
          ? 'Applications found, but jobs have no SFIA requirements configured yet.'
          : undefined,
    };
  }

  async getScoreWithFallback(applicationId: string): Promise<ScoreWithFallbackResult> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('job_application_sfia')
      .select('sfia_matching_percentage, job_posting_id')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);

    if (!data) {
      return { sfia_match_percentage: null, sfia_grade: null, sfia_assessment_status: 'not_assessed' };
    }

    const raw = data.sfia_matching_percentage;
    if (raw == null || !Number.isFinite(Number(raw))) {
      const { data: demand, error: demandError } = await supabase
        .from('job_posting_sfia_skill')
        .select('skill_id')
        .eq('job_posting_id', data.job_posting_id)
        .limit(1);

      if (demandError) {
        this.logger.warn(`Could not check SFIA demand for ${data.job_posting_id}: ${demandError.message}`);
        return { sfia_match_percentage: null, sfia_grade: null, sfia_assessment_status: 'not_assessed' };
      }

      const hasDemand = (demand ?? []).length > 0;
      return {
        sfia_match_percentage: null,
        sfia_grade: null,
        sfia_assessment_status: hasDemand ? 'not_assessed' : 'not_configured',
      };
    }

    const percentage = Math.max(0, Math.min(100, Number(raw)));
    const grade = percentage <= 0 ? 1 : Math.max(1, Math.min(7, Math.ceil((percentage / 100) * 7)));

    return {
      sfia_match_percentage: Math.round(percentage * 100) / 100,
      sfia_grade: grade,
      sfia_assessment_status: 'assessed',
    };
  }

  private async ensureApplicationMirror(
    applicationId: string,
    jobPostingId: string,
    applicantId: string,
  ) {
    const supabase = this.supabaseService.getClient();

    const { error } = await supabase.from('job_application_sfia').upsert(
      {
        application_id: applicationId,
        job_posting_id: jobPostingId,
        applicant_id: applicantId,
        status: 'SUBMITTED',
        application_timestamp: new Date().toISOString(),
        ranking_mode: 'SFIA',
      },
      { onConflict: 'application_id' },
    );

    if (error) {
      this.logger.warn(`Unable to mirror ${applicationId} to job_application_sfia: ${error.message}`);
    }
  }

  private async getJobSfiaRequirementsWithDescriptions(jobPostingId: string): Promise<SfiaRequirement[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('job_posting_sfia_skill')
      .select(
        'skill_id, required_level, weight, sfia_skills(skill, level_1_desc, level_2_desc, level_3_desc, level_4_desc, level_5_desc, level_6_desc, level_7_desc)',
      )
      .eq('job_posting_id', jobPostingId);

    if (error) throw new InternalServerErrorException(error.message);

    return (data ?? [])
      .map((row: any) => {
        const skill = Array.isArray(row.sfia_skills) ? row.sfia_skills[0] : row.sfia_skills;
        if (!row.skill_id || !skill?.skill) return null;

        return {
          skill_id: row.skill_id as string,
          skill_name: skill.skill as string,
          required_level: Math.max(1, Math.min(7, Number(row.required_level) || 1)),
          weight: Number(row.weight) || 1,
          level_descriptions: [
            skill.level_1_desc,
            skill.level_2_desc,
            skill.level_3_desc,
            skill.level_4_desc,
            skill.level_5_desc,
            skill.level_6_desc,
            skill.level_7_desc,
          ].map((v) => (typeof v === 'string' ? v : '')),
        } satisfies SfiaRequirement;
      })
      .filter((r): r is SfiaRequirement => r !== null);
  }

  private async extractResumeTextFromStorage(filePath: string, fileName: string): Promise<string> {
    const supabase = this.supabaseService.getClient();

    const buckets = ['sfia-resumes', 'applicant-resumes', 'sfia_documents'];
    let binaryData: Blob | null = null;

    for (const bucket of buckets) {
      const { data } = await supabase.storage.from(bucket).download(filePath);
      if (data) {
        binaryData = data;
        break;
      }
    }

    if (!binaryData) return '';

    const buffer = Buffer.from(await binaryData.arrayBuffer());
    const sourceName = (fileName ?? filePath).toLowerCase();

    if (sourceName.endsWith('.pdf')) {
      const pdfParse: (input: Buffer) => Promise<{ text?: string }> = require('pdf-parse');
      const parsed = await pdfParse(buffer);
      return typeof parsed?.text === 'string' ? parsed.text : '';
    }

    if (sourceName.endsWith('.docx') || sourceName.endsWith('.doc')) {
      try {
        const mammoth: { extractRawText: (input: { buffer: Buffer }) => Promise<{ value?: string }> } =
          require('mammoth');
        const parsed = await mammoth.extractRawText({ buffer });
        if (typeof parsed?.value === 'string' && parsed.value.trim()) {
          return parsed.value;
        }
      } catch { /* fall through for binary .doc files */ }
    }

    return buffer.toString('utf8');
  }

  private normalizeText(input: string): string {
    return (input ?? '').toLowerCase().replaceAll(/\s+/g, ' ').trim();
  }

  private tokenize(input: string): string[] {
    return (input ?? '')
      .toLowerCase()
      .replaceAll(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 3);
  }

  private keywordCoverage(normalizedResume: string, descriptor: string): number {
    const tokens = this.tokenize(descriptor);
    if (tokens.length === 0) return 0;
    const matched = tokens.filter((t) => normalizedResume.includes(t)).length;
    return matched / tokens.length;
  }

  private estimateCandidateLevelFromResume(
    normalizedResume: string,
    skillName: string,
    requiredLevel: number,
    levelDescriptions: string[],
  ): number {
    const skillTokens = this.tokenize(skillName);
    const hasSkillMention = skillTokens.some((t) => normalizedResume.includes(t));

    let bestLevel = 0;
    let bestCoverage = 0;

    for (let i = 0; i < levelDescriptions.length; i++) {
      const coverage = this.keywordCoverage(normalizedResume, levelDescriptions[i]);
      if (coverage > bestCoverage) {
        bestCoverage = coverage;
        bestLevel = i + 1;
      }
    }

    if (bestLevel > 0 && bestCoverage >= 0.08) {
      return Math.max(1, Math.min(7, bestLevel));
    }

    if (hasSkillMention) {
      return Math.max(1, Math.min(7, requiredLevel - 1 || 1));
    }

    return 1;
  }

  private computeEstimatedMatchScore(candidateLevel: number, requiredLevel: number): number {
    if (candidateLevel === requiredLevel) return 100;
    if (candidateLevel > requiredLevel) return 85;
    if (requiredLevel <= 0) return 0;
    return Math.round((candidateLevel / requiredLevel) * 70 * 100) / 100;
  }

  private computeSfiaRelevancePercentage(
    requirements: Array<{ skill_id: string; required_level: number }>,
    supply: Array<{ skill_id: string; candidate_level: number }>,
  ): number {
    const supplyMap = new Map(supply.map((r) => [r.skill_id, r.candidate_level]));
    let totalPoints = 0;
    for (const req of requirements) {
      const candidateLevel = supplyMap.get(req.skill_id) ?? 0;
      if (candidateLevel === req.required_level) totalPoints += 3;
      else if (candidateLevel > req.required_level) totalPoints += 1.5;
    }
    const maxPossible = requirements.length * 3;
    if (maxPossible <= 0) return 0;
    return Math.round((totalPoints / maxPossible) * 100 * 100) / 100;
  }
}
