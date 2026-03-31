import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateJobPostingDto } from './dto/create-job-posting.dto';
import { UpdateJobPostingDto } from './dto/update-job-posting.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ApplicationQuestionDto } from './dto/create-questions.dto';
import { ApplicationResumeUploadDto } from './dto/application-resume-upload.dto';
import { GetRankedCandidatesDto } from './dto/get-ranked-candidates.dto';
import { ManualRankingItemDto } from './dto/save-manual-ranking.dto';

type RankingMode = 'sfia' | 'manual';

type SfiaDemandSkill = {
  skill_id: string;
  skill_name: string;
  required_level: number;
  weight: number;
};

type SfiaSupplySkill = {
  owner_key: string;
  skill_id: string;
  skill_name: string;
  candidate_level: number;
  match_score: number | null;
};

type SkillBreakdown = {
  sfia_skill_id: string;
  skill_name: string;
  demand_level: number;
  supply_level: number;
  points: number;
  matched: boolean;
};

type RankedCandidate = {
  application_id: string;
  applicant_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  applicant_code: string | null;
  status: string;
  applied_at: string;
  sfia_match_percentage: number;
  sfia_rank: number;
  manual_rank_position: number | null;
  effective_rank: number;
  skill_breakdown: SkillBreakdown[];
};

type RankedApplicationRow = {
  application_id: string;
  job_posting_id: string;
  applicant_id: string;
  status: string;
  application_timestamp: string;
  pre_screening_score: number | null;
  sfia_matching_percentage: number | null;
  manual_rank_position: number | null;
  ranking_mode: string;
};

type ApplicantProfileRow = {
  applicant_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
  applicant_code: string | null;
};

function normalizeNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ---------------------------------------------------------------------------
  // HR-facing methods — all scoped by companyId from JWT
  // ---------------------------------------------------------------------------

  async createPosting(dto: CreateJobPostingDto, companyId: string, performedBy: string) {
    const supabase = this.supabaseService.getClient();
    const job_posting_id = crypto.randomUUID();

    const { data, error } = await supabase
      .from('job_postings')
      .insert({
        job_posting_id,
        company_id: companyId,
        title: dto.title,
        description: dto.description,
        location: dto.location ?? null,
        employment_type: dto.employment_type ?? null,
        salary_range: dto.salary_range ?? null,
        department_id: dto.department_id ?? null,
        closes_at: dto.closes_at ?? null,
        status: 'open',
        posted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);

    await this.auditService.log(
      `Job posting created: "${dto.title}" (ID: ${job_posting_id})`,
      performedBy,
    );

    return data;
  }

  async findAllPostings(companyId: string) {
    const supabase = this.supabaseService.getClient();

    // Auto-close any open postings whose closes_at has passed
    const now = new Date().toISOString();
    await supabase
      .from('job_postings')
      .update({ status: 'closed' })
      .eq('company_id', companyId)
      .eq('status', 'open')
      .not('closes_at', 'is', null)
      .lt('closes_at', now);

    const { data, error } = await supabase
      .from('job_postings')
      .select('*')
      .eq('company_id', companyId)
      .order('posted_at', { ascending: false });

    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async findOnePosting(jobPostingId: string, companyId: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('job_postings')
      .select('*')
      .eq('job_posting_id', jobPostingId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException('Job posting not found');
    return data;
  }

  async updatePosting(jobPostingId: string, dto: UpdateJobPostingDto, companyId: string, performedBy: string) {
    const supabase = this.supabaseService.getClient();

    const existing = await this.findOnePosting(jobPostingId, companyId);

    const updateFields: Record<string, any> = {};
    if (dto.title !== undefined) updateFields.title = dto.title;
    if (dto.description !== undefined) updateFields.description = dto.description;
    if (dto.location !== undefined) updateFields.location = dto.location;
    if (dto.employment_type !== undefined) updateFields.employment_type = dto.employment_type;
    if (dto.salary_range !== undefined) updateFields.salary_range = dto.salary_range;
    if (dto.department_id !== undefined) updateFields.department_id = dto.department_id;
    if (dto.closes_at !== undefined) updateFields.closes_at = dto.closes_at;
    if (dto.status !== undefined) updateFields.status = dto.status;

    const { data, error } = await supabase
      .from('job_postings')
      .update(updateFields)
      .eq('job_posting_id', jobPostingId)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);

    // Build a human-readable summary of what changed
    const changedFields = Object.keys(updateFields);
    const statusChange = dto.status && dto.status !== existing.status
      ? ` (status: ${existing.status} → ${dto.status})`
      : '';
    await this.auditService.log(
      `Job posting updated: "${existing.title}" (ID: ${jobPostingId}) - fields: ${changedFields.join(', ')}${statusChange}`,
      performedBy,
    );

    return data;
  }

  async closePosting(jobPostingId: string, companyId: string, performedBy: string) {
    const supabase = this.supabaseService.getClient();

    const existing = await this.findOnePosting(jobPostingId, companyId);

    const { error } = await supabase
      .from('job_postings')
      .update({ status: 'closed' })
      .eq('job_posting_id', jobPostingId)
      .eq('company_id', companyId);

    if (error) throw new InternalServerErrorException(error.message);

    await this.auditService.log(
      `Job posting closed: "${existing.title}" (ID: ${jobPostingId})`,
      performedBy,
    );

    return { message: 'Job posting closed successfully' };
  }

  // ---------------------------------------------------------------------------
  // Application questions — HR manages, applicants read
  // ---------------------------------------------------------------------------

  async setQuestionsForPosting(jobPostingId: string, questions: ApplicationQuestionDto[], companyId: string, performedBy: string) {
    const supabase = this.supabaseService.getClient();

    // Verify job ownership
    const existing = await this.findOnePosting(jobPostingId, companyId);

    // Replace all existing questions
    await supabase.from('application_questions').delete().eq('job_posting_id', jobPostingId);

    if (questions.length === 0) {
      await this.auditService.log(
        `Application form cleared: job "${existing.title}" (ID: ${jobPostingId})`,
        performedBy,
      );
      return [];
    }

    const rows = questions.map((q, i) => ({
      question_id: crypto.randomUUID(),
      job_posting_id: jobPostingId,
      question_text: q.question_text,
      question_type: q.question_type,
      options: q.options ?? null,
      is_required: q.is_required ?? true,
      sort_order: q.sort_order ?? i,
    }));

    const { data, error } = await supabase
      .from('application_questions')
      .insert(rows)
      .select();

    if (error) throw new InternalServerErrorException(error.message);

    await this.auditService.log(
      `Application form updated: job "${existing.title}" (ID: ${jobPostingId}) - ${questions.length} question(s) set`,
      performedBy,
    );

    return data ?? [];
  }

  async getQuestionsForPosting(jobPostingId: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('application_questions')
      .select('question_id, question_text, question_type, options, is_required, sort_order')
      .eq('job_posting_id', jobPostingId)
      .order('sort_order');

    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  // ---------------------------------------------------------------------------
  // Applications — HR view
  // ---------------------------------------------------------------------------

  async getApplicationsForJob(jobPostingId: string, companyId: string) {
    const supabase = this.supabaseService.getClient();

    await this.findOnePosting(jobPostingId, companyId);

    const { data, error } = await supabase
      .from('job_applications')
      .select(`
        application_id,
        status,
        applied_at,
        applicant_id,
        applicant_profile (
          first_name,
          last_name,
          email,
          phone_number,
          applicant_code
        )
      `)
      .eq('job_posting_id', jobPostingId)
      .order('applied_at', { ascending: false });

    if (error) throw new InternalServerErrorException(error.message);

    const applications = data ?? [];
    return Promise.all(
      applications.map(async (application: any) => ({
        ...application,
        resume_upload: await this.getLatestResumeUpload(
          application.applicant_id,
          jobPostingId,
        ),
      })),
    );
  }

  async getRankedCandidates(
    jobPostingId: string,
    companyId: string,
    query: GetRankedCandidatesDto,
  ) {
    const mode: RankingMode = query.mode ?? 'sfia';
    const limit = query.limit ?? 20;

    const job = await this.findOnePosting(jobPostingId, companyId);
    const applications = await this.getRankedApplicationRows(jobPostingId, companyId);
    const demandSkills = await this.getJobDemandSkills(jobPostingId);

    const ranked = await this.buildRankedCandidates(
      jobPostingId,
      applications,
      demandSkills,
    );

    const sfiaRanked = ranked.map((candidate, index) => ({
      ...candidate,
      sfia_rank: index + 1,
    }));

    const manuallyRanked = this.sortCandidatesByMode(sfiaRanked, mode).map(
      (candidate, index) => ({
        ...candidate,
        effective_rank: index + 1,
      }),
    );

    return {
      job_posting_id: jobPostingId,
      title: job.title,
      ranking_mode: mode,
      total_candidates: manuallyRanked.length,
      top_count: Math.min(limit, manuallyRanked.length),
      required_skill_count: demandSkills.length,
      candidates: manuallyRanked.slice(0, limit),
    };
  }

  async saveManualRanking(
    jobPostingId: string,
    companyId: string,
    performedBy: string,
    rankings: ManualRankingItemDto[],
  ) {
    const supabase = this.supabaseService.getClient();

    await this.findOnePosting(jobPostingId, companyId);

    const { data: applications, error: applicationsError } = await supabase
      .from('job_application_sfia')
      .select('application_id, manual_rank_position')
      .eq('job_posting_id', jobPostingId);

    if (applicationsError) {
      throw new InternalServerErrorException(applicationsError.message);
    }

    const validApplicationIds = new Set(
      (applications ?? []).map((row: { application_id: string }) => row.application_id),
    );

    const uniqueIds = new Set<string>();
    const uniqueRanks = new Set<number>();
    for (const item of rankings) {
      if (!validApplicationIds.has(item.application_id)) {
        throw new BadRequestException(
          `Application ${item.application_id} does not belong to this job posting`,
        );
      }
      if (uniqueIds.has(item.application_id)) {
        throw new BadRequestException('Duplicate application_id in manual ranking payload');
      }
      if (uniqueRanks.has(item.rank)) {
        throw new BadRequestException('Duplicate rank values are not allowed');
      }
      uniqueIds.add(item.application_id);
      uniqueRanks.add(item.rank);
    }

    const updates = rankings.map((item) =>
      supabase
        .from('job_application_sfia')
        .update({ manual_rank_position: item.rank, ranking_mode: 'MANUAL' })
        .eq('job_posting_id', jobPostingId)
        .eq('application_id', item.application_id),
    );

    const results = await Promise.all(updates);
    const failed = results.find((result) => result.error);
    if (failed?.error) {
      throw new InternalServerErrorException(failed.error.message);
    }

    const previousRankMap = new Map(
      (applications ?? []).map((row: { application_id: string; manual_rank_position: number | null }) => [
        row.application_id,
        row.manual_rank_position,
      ]),
    );

    const historyRows = rankings.map((item) => ({
      history_id: crypto.randomUUID(),
      application_id: item.application_id,
      performed_by: performedBy,
      previous_rank: previousRankMap.get(item.application_id) ?? null,
      new_rank: item.rank,
      changed_at: new Date().toISOString(),
    }));

    const { error: historyError } = await supabase
      .from('manual_ranking_history')
      .insert(historyRows);

    if (historyError) {
      throw new InternalServerErrorException(historyError.message);
    }

    await this.auditService.log(
      `Manual candidate ranking saved for job ${jobPostingId} (${rankings.length} candidate(s))`,
      performedBy,
    );

    return {
      message: 'Manual ranking saved successfully',
      job_posting_id: jobPostingId,
      updated_count: rankings.length,
    };
  }

  async getApplicationDetail(applicationId: string, companyId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: app, error } = await supabase
      .from('job_applications')
      .select(`
        application_id, applicant_id, status, applied_at, job_posting_id,
        applicant_profile (first_name, last_name, email, phone_number, applicant_code)
      `)
      .eq('application_id', applicationId)
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    if (!app) throw new NotFoundException('Application not found');

    // Verify job belongs to this company
    await this.findOnePosting(app.job_posting_id, companyId);

    // Get answers joined with question info
    const { data: answers } = await supabase
      .from('applicant_answers')
      .select(`
        answer_id, answer_value,
        application_questions (question_id, question_text, question_type, options, sort_order)
      `)
      .eq('application_id', applicationId)
      .order('application_questions(sort_order)');

    return {
      ...app,
      answers: answers ?? [],
      resume_upload: await this.getLatestResumeUpload(app.applicant_id, app.job_posting_id),
    };
  }

  async updateApplicationStatus(
    applicationId: string,
    status: string,
    companyId: string,
    rejectionReason?: string,
  ) {
    const supabase = this.supabaseService.getClient();

    const { data: app, error: appError } = await supabase
      .from('job_applications')
      .select('application_id, job_posting_id, applicant_id')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (appError) throw new InternalServerErrorException(appError.message);
    if (!app) throw new NotFoundException('Application not found');

    await this.findOnePosting(app.job_posting_id, companyId);

    // Prepare update object
    const updateData: any = { status };
    
    // Add rejection_reason if status is rejected
    if (status.toLowerCase() === 'rejected' && rejectionReason) {
      updateData.rejection_reason = rejectionReason;
    }

    const { error } = await supabase
      .from('job_applications')
      .update(updateData)
      .eq('application_id', applicationId);

    if (error) throw new InternalServerErrorException(error.message);

    // Create notification for status changes
    const statusMessages: Record<string, string> = {
      'shortlisted': 'Great news! Your application has been shortlisted.',
      'rejected': 'Thank you for applying. Unfortunately, we won\'t be moving forward at this time.',
      'hold': 'Your application is currently on hold. We\'ll be in touch soon.',
      'first_interview': 'You have been scheduled for a first interview!',
      'technical_interview': 'You have been scheduled for a technical interview!',
      'final_interview': 'You have been scheduled for a final interview!',
      'hired': 'Congratulations! We\'re excited to welcome you to the team!',
    };

    if (statusMessages[status.toLowerCase()]) {
      try {
        await this.notificationsService.createNotification({
          applicant_id: app.applicant_id,
          message: statusMessages[status.toLowerCase()],
          notification_type: 'status_update',
          related_application_id: applicationId,
        });
      } catch (notifError) {
        this.logger.error(`Failed to create notification: ${notifError}`);
        // Don't fail the status update if notification fails
      }
    }

    return { message: 'Application status updated' };
  }

  async getSurveyScore(applicationId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: application, error: appError } = await supabase
      .from('job_applications')
      .select('application_id, applicant_id, survey_score')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (appError) throw new InternalServerErrorException(appError.message);
    if (!application) throw new NotFoundException('Application not found');

    return { 
      applicationId: application.application_id,
      applicantId: application.applicant_id,
      surveyScore: application.survey_score ?? 0,
    };
  }

  // Calculate survey score from applicant answers with weighted scoring
  private async calculateSurveyScore(applicationId: string): Promise<number> {
    const supabase = this.supabaseService.getClient();

    const { data: answers, error } = await supabase
      .from('applicant_answers')
      .select(`answer_value, application_questions (question_type, options, sort_order, is_required)`)
      .eq('application_id', applicationId);

    if (error) {
      console.error('Error fetching answers:', error.message);
      return 0;
    }

    if (!answers || answers.length === 0) return 0;

    let totalWeightedScore = 0;
    let totalWeight = 0;

    answers.forEach((record: any) => {
      const val = record.answer_value;
      const question = record.application_questions;
      
      if (!val || !question) return;

      let score = 0;
      // Required questions have higher weight
      let weight = question.is_required ? 1.5 : 1.0;

      // Normalize different answer types to 0-100 scale
      if (question.question_type === 'text') {
        // Enhanced text scoring: consider both length and word count
        const trimmedText = val.trim();
        const wordCount = trimmedText.split(/\s+/).length;
        const charCount = trimmedText.length;
        
        // Score based on both word count and character count
        // Ideal: 50-150 words or 250-750 characters
        const wordScore = Math.min(100, (wordCount / 75) * 100); // 75 words = 100 points
        const charScore = Math.min(100, (charCount / 500) * 100); // 500 chars = 100 points
        
        // Take the average of both scores
        score = (wordScore + charScore) / 2;
        
        // Bonus points for punctuation (indicates structured response)
        const punctuationCount = (trimmedText.match(/[.!?]/g) || []).length;
        if (punctuationCount > 0) {
          score = Math.min(100, score + punctuationCount * 2);
        }
      } else if (question.question_type === 'multiple_choice') {
        // Multiple choice: options are stored as strings in the options array
        if (question.options && Array.isArray(question.options)) {
          const idx = question.options.indexOf(val);
          if (idx !== -1) {
            // Assume options are ordered from least to most desirable
            // Give full points for last option, scaled down for earlier options
            const optionCount = question.options.length;
            score = ((idx + 1) / optionCount) * 100;
          } else {
            // If value not in options, try parsing as number
            const numVal = parseFloat(val);
            score = isNaN(numVal) ? 50 : Math.min(100, numVal); // Default 50 if unparseable
          }
        } else {
          const numVal = parseFloat(val);
          score = isNaN(numVal) ? 50 : Math.min(100, numVal);
        }
      } else if (question.question_type === 'checkbox') {
        // Checkbox: parse as JSON array and count selected items
        try {
          const selected = JSON.parse(val);
          if (Array.isArray(selected) && selected.length > 0) {
            const optionCount = question.options?.length || selected.length;
            // Score based on percentage of options selected
            // But penalize selecting too many or too few
            const selectionRatio = selected.length / optionCount;
            
            // Optimal selection is 40-60% of options
            if (selectionRatio >= 0.4 && selectionRatio <= 0.6) {
              score = 100;
            } else if (selectionRatio < 0.4) {
              // Too few selected
              score = (selectionRatio / 0.4) * 100;
            } else {
              // Too many selected
              score = 100 - ((selectionRatio - 0.6) / 0.4) * 30; // Max 30 point penalty
            }
          } else {
            score = 0;
          }
        } catch {
          // If parsing fails, try numeric value
          const numVal = parseFloat(val);
          score = isNaN(numVal) ? 0 : Math.min(100, numVal);
        }
      } else {
        // Default: try to parse as number
        const numVal = parseFloat(val);
        score = isNaN(numVal) ? 50 : Math.min(100, numVal);
      }

      totalWeightedScore += score * weight;
      totalWeight += weight;
    });

    // Normalize to 0-100 range
    const normalizedScore = totalWeight > 0 ? (totalWeightedScore / totalWeight) : 0;
    return Math.round(normalizedScore * 100) / 100;
  }

  // ---------------------------------------------------------------------------
  // Public methods — no auth required
  // ---------------------------------------------------------------------------

  async getPublicCareersBySlug(slug: string) {
    const supabase = this.supabaseService.getClient();

    const { data: company } = await supabase
      .from('company')
      .select('company_id, company_name, slug')
      .eq('slug', slug)
      .maybeSingle();

    if (!company) throw new NotFoundException('Company not found');

    const { data: jobs } = await supabase
      .from('job_postings')
      .select('job_posting_id, title, description, location, employment_type, salary_range, posted_at, closes_at')
      .eq('company_id', company.company_id)
      .eq('status', 'open')
      .or('closes_at.is.null,closes_at.gt.' + new Date().toISOString())
      .order('posted_at', { ascending: false });

    return {
      company_id: company.company_id,
      company_name: company.company_name,
      slug: company.slug,
      jobs: jobs ?? [],
    };
  }

  // ---------------------------------------------------------------------------
  // Applicant-facing methods — scoped by companyId from applicant JWT
  // ---------------------------------------------------------------------------

  async getOpenJobsForApplicant(companyId: string | null) {
    const supabase = this.supabaseService.getClient();

    let query = supabase
      .from('job_postings')
      .select('*')
      .eq('status', 'open')
      .or('closes_at.is.null,closes_at.gt.' + new Date().toISOString())
      .order('posted_at', { ascending: false });

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query;

    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async applyToJob(jobPostingId: string, applicantId: string, companyId: string | null, dto: CreateApplicationDto) {
    if (!companyId) {
      throw new ForbiddenException(
        'Your account is not linked to a company. Please register via the company-specific link.',
      );
    }

    const supabase = this.supabaseService.getClient();

    const { data: job } = await supabase
      .from('job_postings')
      .select('job_posting_id, status')
      .eq('job_posting_id', jobPostingId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (!job) throw new NotFoundException('Job posting not found');
    if (job.status !== 'open') throw new ForbiddenException('This job posting is no longer accepting applications');

    const { data: existing } = await supabase
      .from('job_applications')
      .select('application_id')
      .eq('job_posting_id', jobPostingId)
      .eq('applicant_id', applicantId)
      .maybeSingle();

    if (existing) throw new ConflictException('You have already submitted an application for this role.');

    const application_id = crypto.randomUUID();
    const { data, error } = await supabase
      .from('job_applications')
      .insert({
        application_id,
        job_posting_id: jobPostingId,
        applicant_id: applicantId,
        status: 'submitted',
        applied_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);

    await this.ensureSfiaApplicationRow({
      applicationId: application_id,
      applicantId,
      jobPostingId,
      status: 'submitted',
      appliedAt: data.applied_at,
    });

    // Save answers if provided
    if (dto.answers && dto.answers.length > 0) {
      const answerRows = dto.answers.map((a) => ({
        answer_id: crypto.randomUUID(),
        application_id,
        question_id: a.question_id,
        answer_value: a.answer_value ?? null,
      }));

      const { error: answerError } = await supabase.from('applicant_answers').insert(answerRows);
      if (answerError) {
        console.error('Failed to save applicant answers:', answerError.message);
      }
    }

    return {
      ...data,
      resume_upload: dto.resume_storage_path && dto.resume_file_name
        ? {
            file_name: dto.resume_file_name,
            storage_path: dto.resume_storage_path,
            signed_url: '',
          }
        : await this.getLatestResumeUpload(applicantId, jobPostingId),
    };
  }

  async getMyApplicationDetail(applicationId: string, applicantId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: app, error } = await supabase
      .from('job_applications')
      .select(`
        application_id, applicant_id, status, applied_at, job_posting_id,
        applicant_profile (first_name, last_name, email, phone_number, applicant_code),
        job_postings (title, description, location, employment_type, salary_range, status, posted_at, closes_at)
      `)
      .eq('application_id', applicationId)
      .eq('applicant_id', applicantId)
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    if (!app) throw new NotFoundException('Application not found');

    const { data: answers } = await supabase
      .from('applicant_answers')
      .select(`
        answer_id, answer_value,
        application_questions (question_id, question_text, question_type, options, sort_order)
      `)
      .eq('application_id', applicationId)
      .order('application_questions(sort_order)');

    return {
      ...app,
      answers: answers ?? [],
      resume_upload: await this.getLatestResumeUpload(app.applicant_id, app.job_posting_id),
    };
  }

  async getMyApplications(applicantId: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('job_applications')
      .select(`
        application_id,
        status,
        applied_at,
        job_posting_id,
        job_postings (
          title,
          location,
          employment_type,
          status
        )
      `)
      .eq('applicant_id', applicantId)
      .order('applied_at', { ascending: false });

    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  private async buildRankedCandidates(
    jobPostingId: string,
    applications: RankedApplicationRow[],
    demandSkills: SfiaDemandSkill[],
  ): Promise<RankedCandidate[]> {
    const supplyRows = await this.getCandidateSupplySkills(applications);
    const applicantProfiles = await this.getApplicantProfiles(applications);
    const groupedSupply = supplyRows.reduce<Record<string, SfiaSupplySkill[]>>(
      (acc, row) => {
        acc[row.owner_key] ??= [];
        acc[row.owner_key].push(row);
        return acc;
      },
      {},
    );
    const profileByApplicantId = new Map(
      applicantProfiles.map((profile) => [profile.applicant_id, profile]),
    );

    const ranked = applications.map((application) => {
      const profile = profileByApplicantId.get(application.applicant_id);
      const supplySkills =
        groupedSupply[application.application_id] ?? [];

      const score = this.computeSfiaScore(demandSkills, supplySkills);
      void this.cacheSfiaScore(jobPostingId, application.application_id, score.relevancePercentage);

      return {
        application_id: application.application_id,
        applicant_id: application.applicant_id,
        first_name: profile?.first_name ?? '',
        last_name: profile?.last_name ?? '',
        email: profile?.email ?? '',
        phone_number: profile?.phone_number ?? null,
        applicant_code: profile?.applicant_code ?? null,
        status: application.status,
        applied_at: application.application_timestamp,
        sfia_match_percentage: score.relevancePercentage,
        sfia_rank: 0,
        manual_rank_position: normalizeNumber(application.manual_rank_position) || null,
        effective_rank: 0,
        skill_breakdown: score.breakdown,
      } satisfies RankedCandidate;
    });

    return ranked.sort((a, b) => {
      if (b.sfia_match_percentage !== a.sfia_match_percentage) {
        return b.sfia_match_percentage - a.sfia_match_percentage;
      }
      return new Date(a.applied_at).getTime() - new Date(b.applied_at).getTime();
    });
  }

  private sortCandidatesByMode(
    candidates: RankedCandidate[],
    mode: RankingMode,
  ): RankedCandidate[] {
    if (mode === 'sfia') return [...candidates];

    return [...candidates].sort((a, b) => {
      const leftRank = a.manual_rank_position ?? Number.MAX_SAFE_INTEGER;
      const rightRank = b.manual_rank_position ?? Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return a.sfia_rank - b.sfia_rank;
    });
  }

  private computeSfiaScore(
    demandSkills: SfiaDemandSkill[],
    supplySkills: SfiaSupplySkill[],
  ) {
    const skillById = new Map(
      supplySkills.map((skill) => [skill.skill_id, skill]),
    );

    const relevantDemand = demandSkills;

    const breakdown = relevantDemand.map((demandSkill) => {
      const supplySkill = skillById.get(demandSkill.skill_id);
      const supplyLevel = supplySkill?.candidate_level ?? 0;

      let points = 0;
      if (supplyLevel === demandSkill.required_level) points = 3;
      else if (supplyLevel > demandSkill.required_level) points = 1.5;

      return {
        sfia_skill_id: demandSkill.skill_id,
        skill_name: demandSkill.skill_name,
        demand_level: demandSkill.required_level,
        supply_level: supplyLevel,
        points,
        matched: points > 0,
      } satisfies SkillBreakdown;
    });

    const totalPoints = breakdown.reduce((sum, item) => sum + item.points, 0);
    const maxPossiblePoints = relevantDemand.length * 3;
    const relevancePercentage =
      maxPossiblePoints > 0
        ? roundToTwo((totalPoints / maxPossiblePoints) * 100)
        : 0;

    return {
      totalPoints,
      maxPossiblePoints,
      relevancePercentage,
      breakdown,
    };
  }

  private async getJobDemandSkills(jobPostingId: string): Promise<SfiaDemandSkill[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('job_posting_sfia_skill')
      .select('job_posting_skills_id, job_posting_id, skill_id, required_level, weight')
      .eq('job_posting_id', jobPostingId);

    if (error) {
      this.handleMissingSfiaSchema(error.message, 'job_posting_sfia_skill');
      throw new InternalServerErrorException(error.message);
    }

    const demandRows = (data ?? [])
      .map((row: Record<string, unknown>) => {
        const skillId = this.readFirstString(row, [
          'sfia_skill_id',
          'skill_id',
          'sfia_id',
        ]);
        if (!skillId) return null;

        return {
          skill_id: skillId,
          skill_name: skillId,
          required_level: normalizeNumber(
            this.readFirstValue(row, ['required_level', 'level']),
          ),
          weight: normalizeNumber(this.readFirstValue(row, ['weight'])),
        } satisfies SfiaDemandSkill;
      })
      .filter((row): row is SfiaDemandSkill => row !== null);

    return this.attachSkillNames(demandRows);
  }

  private async getCandidateSupplySkills(
    applications: RankedApplicationRow[],
  ): Promise<SfiaSupplySkill[]> {
    if (applications.length === 0) return [];

    const applicationIds = applications
      .map((row) => row.application_id)
      .filter((value): value is string => Boolean(value));

    if (applicationIds.length === 0) return [];

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('candidate_skill_score_sfia')
      .select('application_id, skill_id, candidate_level, match_score')
      .in('application_id', applicationIds);

    if (error) {
      this.handleMissingSfiaSchema(error.message, 'candidate_skill_score_sfia');
      throw new InternalServerErrorException(error.message);
    }

    const supplyRows = (data ?? [])
      .map((row: Record<string, unknown>) => {
        const ownerKey =
          this.readFirstString(row, ['applicant_id', 'application_id']) ?? '';
        const skillId = this.readFirstString(row, [
          'sfia_skill_id',
          'skill_id',
          'sfia_id',
        ]);
        if (!ownerKey || !skillId) return null;

        return {
          owner_key: ownerKey,
          skill_id: skillId,
          skill_name: skillId,
          candidate_level: normalizeNumber(
            this.readFirstValue(row, ['candidate_level', 'level']),
          ),
          match_score: this.readNullableNumber(row, ['match_score']),
        } satisfies SfiaSupplySkill;
      })
      .filter((row): row is SfiaSupplySkill => row !== null);

    return this.attachSkillNames(supplyRows);
  }

  private async cacheSfiaScore(
    jobPostingId: string,
    applicationId: string,
    sfiaMatchPercentage: number,
  ) {
    const supabase = this.supabaseService.getClient();

    const { error } = await supabase
      .from('job_application_sfia')
      .update({ sfia_matching_percentage: sfiaMatchPercentage })
      .eq('job_posting_id', jobPostingId)
      .eq('application_id', applicationId);

    if (error) {
      this.logger.warn(
        `Unable to cache sfia_match_percentage for application ${applicationId}: ${error.message}`,
      );
    }
  }

  private async ensureSfiaApplicationRow(params: {
    applicationId: string;
    applicantId: string;
    jobPostingId: string;
    status: string;
    appliedAt: string;
  }) {
    const supabase = this.supabaseService.getClient();

    const { error } = await supabase.from('job_application_sfia').upsert(
      {
        application_id: params.applicationId,
        job_posting_id: params.jobPostingId,
        applicant_id: params.applicantId,
        status: params.status,
        application_timestamp: params.appliedAt,
        ranking_mode: 'SFIA',
      },
      {
        onConflict: 'application_id',
      },
    );

    if (error) {
      this.handleMissingSfiaSchema(error.message, 'job_application_sfia');
      this.logger.warn(
        `Unable to mirror application ${params.applicationId} to job_application_sfia: ${error.message}`,
      );
    }
  }

  private async getLatestResumeUpload(
    applicantId: string,
    jobPostingId: string,
  ): Promise<ApplicationResumeUploadDto | null> {
    const supabase = this.supabaseService.getClient();
    const folder = `${applicantId}/${jobPostingId}`;

    const { data: files, error } = await supabase.storage
      .from('sfia-resumes')
      .list(folder, {
        limit: 20,
        sortBy: { column: 'name', order: 'desc' },
      });

    if (error) {
      if (error.message.toLowerCase().includes('bucket')) return null;
      this.logger.warn(
        `Unable to inspect SFIA resume storage for ${folder}: ${error.message}`,
      );
      return null;
    }

    const latest = files?.find((file) => file.name);
    if (!latest) return null;

    const storagePath = `${folder}/${latest.name}`;
    const { data: signedData, error: signedError } = await supabase.storage
      .from('sfia-resumes')
      .createSignedUrl(storagePath, 60 * 60);

    if (signedError) {
      this.logger.warn(
        `Unable to sign SFIA resume ${storagePath}: ${signedError.message}`,
      );
      return {
        file_name: latest.name,
        storage_path: storagePath,
        signed_url: '',
      };
    }

    return {
      file_name: latest.name,
      storage_path: storagePath,
      signed_url: signedData.signedUrl,
    };
  }

  private readFirstValue(
    row: Record<string, unknown>,
    keys: string[],
  ): unknown {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null) return row[key];
    }
    return undefined;
  }

  private readFirstString(
    row: Record<string, unknown>,
    keys: string[],
  ): string | null {
    const value = this.readFirstValue(row, keys);
    return typeof value === 'string' && value.trim() !== '' ? value : null;
  }

  private readNullableNumber(
    row: Record<string, unknown>,
    keys: string[],
  ): number | null {
    const value = this.readFirstValue(row, keys);
    if (value === undefined || value === null || value === '') return null;
    const parsed = normalizeNumber(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private async getRankedApplicationRows(
    jobPostingId: string,
    companyId: string,
  ): Promise<RankedApplicationRow[]> {
    const supabase = this.supabaseService.getClient();

    await this.findOnePosting(jobPostingId, companyId);

    const { data, error } = await supabase
      .from('job_application_sfia')
      .select(
        'application_id, job_posting_id, applicant_id, status, application_timestamp, pre_screening_score, sfia_matching_percentage, manual_rank_position, ranking_mode',
      )
      .eq('job_posting_id', jobPostingId);

    if (error) {
      this.handleMissingSfiaSchema(error.message, 'job_application_sfia');
      throw new InternalServerErrorException(error.message);
    }

    return (data ?? []) as RankedApplicationRow[];
  }

  private async getApplicantProfiles(
    applications: RankedApplicationRow[],
  ): Promise<ApplicantProfileRow[]> {
    const applicantIds = applications
      .map((row) => row.applicant_id)
      .filter((value): value is string => Boolean(value));

    if (applicantIds.length === 0) return [];

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('applicant_profile')
      .select('applicant_id, first_name, last_name, email, phone_number, applicant_code')
      .in('applicant_id', applicantIds);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return (data ?? []) as ApplicantProfileRow[];
  }

  private async attachSkillNames<T extends { skill_id: string; skill_name: string }>(
    rows: T[],
  ): Promise<T[]> {
    const skillIds = [...new Set(rows.map((row) => row.skill_id).filter(Boolean))];
    if (skillIds.length === 0) return rows;

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('sfia_skills')
      .select('*')
      .in(this.getSkillPrimaryKeyColumn(), skillIds);

    if (error) {
      this.handleMissingSfiaSchema(error.message, 'sfia_skills');
      return rows;
    }

    const nameById = new Map<string, string>();
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      const id = this.readFirstString(row, ['skill_id', 'sfia_skill_id', 'id']);
      if (!id) continue;
      const name =
        this.readFirstString(row, ['skill_name', 'name']) ??
        this.readFirstString(row, ['skill']) ??
        id;
      nameById.set(id, name);
    }

    return rows.map((row) => ({
      ...row,
      skill_name: nameById.get(row.skill_id) ?? row.skill_name,
    }));
  }

  private getSkillPrimaryKeyColumn() {
    return 'skill_id';
  }

  private handleMissingSfiaSchema(message: string, tableName: string) {
    if (message.includes('schema cache')) {
      this.logger.error(
        `SFIA ranking requires the ${tableName} table, but it is not available in the configured Supabase project.`,
      );
    }
  }
}
