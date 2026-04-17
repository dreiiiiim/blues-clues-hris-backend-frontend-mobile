import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as crypto from 'node:crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { CreateJobPostingDto } from './dto/create-job-posting.dto';
import { UpdateJobPostingDto } from './dto/update-job-posting.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ApplicationQuestionDto } from './dto/create-questions.dto';
import { GetRankedCandidatesDto } from './dto/get-ranked-candidates.dto';
import { ManualRankingItemDto } from './dto/save-manual-ranking.dto';
import { ScheduleInterviewDto } from './dto/schedule-interview.dto';
import { InterviewResponseDto } from './dto/interview-response.dto';
import { OnboardingService } from '../onboarding/onboarding.service';

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

type SfiaRequirementWithDescriptors = {
  skill_id: string;
  skill_name: string;
  required_level: number;
  weight: number;
  level_descriptions: string[];
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

const NOTIFIABLE_STATUSES: Record<string, { type: string; message: string }> = {
  shortlisted: {
    type: 'SHORTLISTED',
    message: 'Congratulations! Your application has been shortlisted.',
  },
  rejected: {
    type: 'REJECTED',
    message: 'Thank you for applying. Unfortunately, your application was not selected at this time.',
  },
  hold: {
    type: 'HOLD',
    message: 'Your application is currently on hold. We will update you soon.',
  },
};

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly auditService: AuditService,
    private readonly mailService: MailService,
    private readonly onboardingService: OnboardingService,
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
      `Job posting created: "${dto.title}"`,
      performedBy,
      companyId,
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
      .select('*, job_applications(application_id, applicant_profile(status))')
      .eq('company_id', companyId)
      .order('posted_at', { ascending: false });

    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []).map((row: any) => ({
      ...row,
      // Only count applicants who have not been converted to employees (matches pipeline filter)
      applicant_count: (row.job_applications as any[] ?? []).filter(
        (a: any) => a.applicant_profile?.status !== 'converted_employee',
      ).length,
      job_applications: undefined,
    }));
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
      `Job posting updated: "${existing.title}" - fields: ${changedFields.join(', ')}${statusChange}`,
      performedBy,
      companyId,
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
      `Job posting closed: "${existing.title}"`,
      performedBy,
      companyId,
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
        `Application form cleared: job "${existing.title}"`,
        performedBy,
        companyId,
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
      `Application form updated: job "${existing.title}" - ${questions.length} question(s) set`,
      performedBy,
      companyId,
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

    const { data: regularApps, error: regularError } = await supabase
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
          applicant_code,
          status
        )
      `)
      .eq('job_posting_id', jobPostingId)
      .order('applied_at', { ascending: false });

    if (regularError) throw new InternalServerErrorException(regularError.message);

    const { data: sfiaApps, error: sfiaError } = await supabase
      .from('job_application_sfia')
      .select('application_id, status, application_timestamp, applicant_id')
      .eq('job_posting_id', jobPostingId)
      .order('application_timestamp', { ascending: false });

    if (sfiaError) {
      this.logger.warn(`Unable to fetch SFIA applications for job ${jobPostingId}: ${sfiaError.message}`);
    }

    const regularIds = new Set((regularApps ?? []).map((a: { application_id: string }) => a.application_id));

    const uniqueSfiaApps = (sfiaApps ?? []).filter(
      (a: { application_id: string }) => !regularIds.has(a.application_id),
    );

    let sfiaProfiles: ApplicantProfileRow[] = [];
    if (uniqueSfiaApps.length > 0) {
      const applicantIds = uniqueSfiaApps.map((a: { applicant_id: string }) => a.applicant_id);
      const { data: profiles } = await supabase
        .from('applicant_profile')
        .select('applicant_id, first_name, last_name, email, phone_number, applicant_code, status')
        .in('applicant_id', applicantIds);
      sfiaProfiles = (profiles ?? []) as ApplicantProfileRow[];
    }

    const profileMap = new Map(sfiaProfiles.map((p) => [p.applicant_id, p]));

    const normalizedSfiaApps = uniqueSfiaApps.map(
      (a: { application_id: string; status: string; application_timestamp: string; applicant_id: string }) => ({
        application_id: a.application_id,
        status: a.status?.toLowerCase() ?? 'submitted',
        applied_at: a.application_timestamp,
        applicant_id: a.applicant_id,
        applicant_profile: profileMap.get(a.applicant_id) ?? null,
      }),
    );

    const all = [...(regularApps ?? []), ...normalizedSfiaApps].sort(
      (a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime(),
    );

    // Exclude applicants already converted to employees so they don't show in the pipeline
    return all.filter((a: any) => {
      const profile = a.applicant_profile as { status?: string } | null;
      return profile?.status !== 'converted_employee';
    });
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

    const jobPosting = await this.findOnePosting(jobPostingId, companyId);

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
      `Manual candidate ranking saved for "${jobPosting.title}" (${rankings.length} candidate(s))`,
      performedBy,
      companyId,
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
        application_id, status, applied_at, job_posting_id,
        applicant_profile (first_name, last_name, email, phone_number, applicant_code, resume_url, resume_name, resume_uploaded_at)
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

    // Get all interview schedules for this application, keyed by stage
    const { data: schedules } = await supabase
      .from('interview_schedules')
      .select('application_id, stage, scheduled_date, scheduled_time, duration_minutes, format, location, meeting_link, interviewer_name, interviewer_title, notes, created_at, applicant_response, applicant_response_note, applicant_responded_at')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false });

    // Build a map: stage → schedule. Also expose the latest as interview_schedule for backwards compat.
    const interview_schedules: Record<string, any> = {};
    for (const s of (schedules ?? [])) {
      const key = s.stage ?? 'first_interview';
      interview_schedules[key] = s;
    }
    const latestSchedule = (schedules ?? [])[0] ?? null;

    // Generate a signed URL for the resume if it's stored as a file path
    const profile = (app as any).applicant_profile as Record<string, any> | null;
    if (profile?.resume_url && !profile.resume_url.startsWith('https://')) {
      const { data: urlData } = await supabase.storage
        .from('applicant-resumes')
        .createSignedUrl(profile.resume_url, 60 * 60 * 24 * 7);
      if (urlData?.signedUrl) {
        (app as any).applicant_profile = { ...profile, resume_url: urlData.signedUrl };
      }
    }

    const sfiaScore = await this.getSfiaScoreForApplication(applicationId);

    return {
      ...app,
      answers: answers ?? [],
      interview_schedule: latestSchedule,
      interview_schedules,
      sfia_match_percentage: sfiaScore.sfia_match_percentage,
      sfia_grade: sfiaScore.sfia_grade,
    };
  }

  async updateApplicationStatus(applicationId: string, status: string, companyId: string) {
    const supabase = this.supabaseService.getClient();
    const normalizedStatus = status.toLowerCase();

    const { data: app, error: appError } = await supabase
      .from('job_applications')
      .select('application_id, job_posting_id, applicant_id')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (appError) throw new InternalServerErrorException(appError.message);

    if (app) {
      await this.findOnePosting(app.job_posting_id, companyId);

      await this.assertCanSetHiredStatus(
        normalizedStatus,
        applicationId,
        app.applicant_id,
        companyId,
      );

      const { error } = await supabase
        .from('job_applications')
        .update({ status })
        .eq('application_id', applicationId);

      if (error) throw new InternalServerErrorException(error.message);
      await this.insertApplicantStatusNotification(app.applicant_id, app.job_posting_id, normalizedStatus);

      // When an applicant is hired, auto-create their onboarding record
      if (normalizedStatus === 'hired') {
        await this.onboardingService.createOnboardingRecord({
          applicationId: app.application_id,
          applicantId:   app.applicant_id,
          jobPostingId:  app.job_posting_id,
          companyId,
        });
        // Also create the 4-stage wizard session for the applicant portal
        await this.onboardingService.createApplicantSession({
          applicantId:  app.applicant_id,
          jobPostingId: app.job_posting_id,
          companyId,
        });
        // Mark applicant as in onboarding — blocks further job applications
        await supabase
          .from('applicant_profile')
          .update({ status: 'onboarding' })
          .eq('applicant_id', app.applicant_id);
      }

      return { message: 'Application status updated' };
    }

    // Fall back to SFIA applications table
    const { data: sfiaApp, error: sfiaAppError } = await supabase
      .from('job_application_sfia')
      .select('application_id, job_posting_id, applicant_id')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (sfiaAppError) throw new InternalServerErrorException(sfiaAppError.message);
    if (!sfiaApp) throw new NotFoundException('Application not found');

    await this.findOnePosting(sfiaApp.job_posting_id, companyId);

    const { error: sfiaUpdateError } = await supabase
      .from('job_application_sfia')
      .update({ status: status.toUpperCase() })
      .eq('application_id', applicationId);

    if (sfiaUpdateError) throw new InternalServerErrorException(sfiaUpdateError.message);
    await this.insertApplicantStatusNotification(sfiaApp.applicant_id, sfiaApp.job_posting_id, normalizedStatus);

    return { message: 'Application status updated' };
  }

  async scheduleInterview(applicationId: string, dto: ScheduleInterviewDto, companyId: string) {
    const supabase = this.supabaseService.getClient();

    // Verify application belongs to this company
    const { data: app, error: appError } = await supabase
      .from('job_applications')
      .select('application_id, job_posting_id, applicant_id, status')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (appError) throw new InternalServerErrorException(appError.message);
    if (!app) throw new NotFoundException('Application not found');

    await this.findOnePosting(app.job_posting_id, companyId);

    // Upsert per stage — one schedule row per (application, stage)
    // NOTE: Supabase requires a unique constraint on (application_id, stage) for this to work.
    // Run this migration if not already done:
    //   ALTER TABLE interview_schedules ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'first_interview';
    //   CREATE UNIQUE INDEX IF NOT EXISTS interview_schedules_app_stage_key ON interview_schedules (application_id, stage);
    const stage = dto.stage ?? 'first_interview';

    // Detect reschedule: check if a schedule already exists for this stage
    const { data: existingSchedule } = await supabase
      .from('interview_schedules')
      .select('schedule_id')
      .eq('application_id', applicationId)
      .eq('stage', stage)
      .maybeSingle();
    const isReschedule = !!existingSchedule;

    const scheduleId = crypto.randomUUID();
    const { error: insertError } = await supabase
      .from('interview_schedules')
      .upsert({
        schedule_id:        scheduleId,
        application_id:     applicationId,
        company_id:         companyId,
        stage,
        scheduled_date:     dto.scheduled_date,
        scheduled_time:     dto.scheduled_time,
        duration_minutes:   dto.duration_minutes,
        format:             dto.format,
        location:           dto.location ?? null,
        meeting_link:       dto.meeting_link ?? null,
        interviewer_name:   dto.interviewer_name,
        interviewer_title:  dto.interviewer_title ?? null,
        notes:              dto.notes ?? null,
        scheduled_by_email: dto.scheduled_by_email ?? null,
        // Reset applicant response on reschedule
        applicant_response:      null,
        applicant_response_note: null,
        applicant_responded_at:  null,
        updated_at:         new Date().toISOString(),
      }, { onConflict: 'application_id,stage' });

    if (insertError) throw new InternalServerErrorException(insertError.message);

    // Update application status to match the scheduled stage so the
    // applicant's notification bell reflects the current interview stage.
    await supabase
      .from('job_applications')
      .update({ status: stage })
      .eq('application_id', applicationId);

    // Fetch applicant info for the email
    const { data: profile } = await supabase
      .from('applicant_profile')
      .select('first_name, last_name, email')
      .eq('applicant_id', app.applicant_id)
      .maybeSingle();

    const { data: posting } = await supabase
      .from('job_postings')
      .select('title')
      .eq('job_posting_id', app.job_posting_id)
      .maybeSingle();

    if (profile?.email) {
      const applicantName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Applicant';
      const stageLabelMap: Record<string, string> = {
        first_interview:     '1st Interview',
        technical_interview: 'Technical Interview',
        final_interview:     'Final Interview',
      };
      await this.mailService.sendInterviewScheduleEmail({
        to:               profile.email,
        applicantName,
        jobTitle:         posting?.title ?? 'the position',
        stageLabel:       stageLabelMap[stage] ?? stage,
        isReschedule,
        scheduledDate:    dto.scheduled_date,
        scheduledTime:    dto.scheduled_time,
        durationMinutes:  dto.duration_minutes,
        format:           dto.format,
        location:         dto.location,
        meetingLink:      dto.meeting_link,
        interviewerName:  dto.interviewer_name,
        interviewerTitle: dto.interviewer_title,
        notes:            dto.notes,
      });
    }

    await this.auditService.log(
      `Interview scheduled for application ${applicationId} on ${dto.scheduled_date} at ${dto.scheduled_time}`,
      'system',
      companyId,
    );

    return { message: 'Interview scheduled and email sent', schedule_id: scheduleId };
  }

  async cancelInterviewSchedule(applicationId: string, stage: string, companyId: string, reason?: string) {
    const supabase = this.supabaseService.getClient();

    const { data: app, error: appError } = await supabase
      .from('job_applications')
      .select('application_id, job_posting_id, applicant_id')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (appError) throw new InternalServerErrorException(appError.message);
    if (!app) throw new NotFoundException('Application not found');

    await this.findOnePosting(app.job_posting_id, companyId);

    // Find the schedule for this specific stage
    const { data: schedule } = await supabase
      .from('interview_schedules')
      .select('scheduled_date, scheduled_time, duration_minutes, format')
      .eq('application_id', applicationId)
      .eq('stage', stage)
      .maybeSingle();

    if (!schedule) {
      // No schedule found — nothing to cancel, just return success
      return { message: 'No schedule found for this stage' };
    }

    // Delete the schedule row for this stage
    const { error: deleteError } = await supabase
      .from('interview_schedules')
      .delete()
      .eq('application_id', applicationId)
      .eq('stage', stage);

    if (deleteError) throw new InternalServerErrorException(deleteError.message);

    // Send cancellation email to applicant
    const { data: profile } = await supabase
      .from('applicant_profile')
      .select('first_name, last_name, email')
      .eq('applicant_id', app.applicant_id)
      .maybeSingle();

    const { data: posting } = await supabase
      .from('job_postings')
      .select('title')
      .eq('job_posting_id', app.job_posting_id)
      .maybeSingle();

    const stageLabelMap: Record<string, string> = {
      first_interview:     '1st Interview',
      technical_interview: 'Technical Interview',
      final_interview:     'Final Interview',
    };

    if (profile?.email) {
      const applicantName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Applicant';
      await this.mailService.sendInterviewCancellationEmail({
        to:            profile.email,
        applicantName,
        jobTitle:      posting?.title ?? 'the position',
        scheduledDate: schedule.scheduled_date,
        scheduledTime: schedule.scheduled_time,
        stageLabel:    stageLabelMap[stage] ?? stage,
        reason:        reason ?? null,
      });
    }

    await this.auditService.log(
      `Interview schedule cancelled for application ${applicationId}, stage: ${stage}`,
      'system',
      companyId,
    );

    return { message: 'Interview schedule cancelled and applicant notified' };
  }

  async resendInterviewEmail(applicationId: string, companyId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: app, error: appError } = await supabase
      .from('job_applications')
      .select('application_id, job_posting_id, applicant_id')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (appError) throw new InternalServerErrorException(appError.message);
    if (!app) throw new NotFoundException('Application not found');

    await this.findOnePosting(app.job_posting_id, companyId);

    const { data: schedule, error: schedError } = await supabase
      .from('interview_schedules')
      .select('scheduled_date, scheduled_time, duration_minutes, format, location, meeting_link, interviewer_name, interviewer_title, notes')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (schedError) throw new InternalServerErrorException(schedError.message);
    if (!schedule) throw new NotFoundException('No interview schedule found for this application');

    const { data: profile } = await supabase
      .from('applicant_profile')
      .select('first_name, last_name, email')
      .eq('applicant_id', app.applicant_id)
      .maybeSingle();

    const { data: posting } = await supabase
      .from('job_postings')
      .select('title')
      .eq('job_posting_id', app.job_posting_id)
      .maybeSingle();

    if (!profile?.email) throw new NotFoundException('Applicant email not found');

    const applicantName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Applicant';
    await this.mailService.sendInterviewScheduleEmail({
      to:               profile.email,
      applicantName,
      jobTitle:         posting?.title ?? 'the position',
      scheduledDate:    schedule.scheduled_date,
      scheduledTime:    schedule.scheduled_time,
      durationMinutes:  schedule.duration_minutes,
      format:           schedule.format,
      location:         schedule.location,
      meetingLink:      schedule.meeting_link,
      interviewerName:  schedule.interviewer_name,
      interviewerTitle: schedule.interviewer_title,
      notes:            schedule.notes,
    });

    return { message: 'Interview email resent successfully' };
  }

  // ---------------------------------------------------------------------------
  // Applicant interview schedule & response methods
  // ---------------------------------------------------------------------------

  async getMyInterviewSchedules(applicantId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: apps, error: appsError } = await supabase
      .from('job_applications')
      .select('application_id, status, job_postings (title, job_posting_id)')
      .eq('applicant_id', applicantId);

    if (appsError) throw new InternalServerErrorException(appsError.message);
    if (!apps?.length) return [];

    const appIds = apps.map((a) => a.application_id);

    const { data: schedules, error: schedError } = await supabase
      .from('interview_schedules')
      .select('schedule_id, application_id, stage, scheduled_date, scheduled_time, duration_minutes, format, location, meeting_link, interviewer_name, interviewer_title, notes, created_at, applicant_response, applicant_response_note, applicant_responded_at')
      .in('application_id', appIds)
      .order('created_at', { ascending: false });

    if (schedError) throw new InternalServerErrorException(schedError.message);

    const appMap = new Map(apps.map((a) => [a.application_id, a]));

    return (schedules ?? []).map((s) => ({
      ...s,
      job_title:          (appMap.get(s.application_id) as any)?.job_postings?.title ?? '',
      application_status: (appMap.get(s.application_id) as any)?.status ?? '',
    }));
  }

  async respondToInterview(applicationId: string, applicantId: string, dto: InterviewResponseDto) {
    const supabase = this.supabaseService.getClient();

    const { data: app, error: appError } = await supabase
      .from('job_applications')
      .select('application_id, job_posting_id, applicant_id, job_postings (title)')
      .eq('application_id', applicationId)
      .eq('applicant_id', applicantId)
      .maybeSingle();

    if (appError) throw new InternalServerErrorException(appError.message);
    if (!app) throw new NotFoundException('Application not found');

    // If the applicant specifies a stage, update that stage's schedule.
    // Otherwise, update the most recent pending schedule (applicant_response IS NULL).
    const baseUpdate = supabase
      .from('interview_schedules')
      .update({
        applicant_response:      dto.action,
        applicant_response_note: dto.note ?? null,
        applicant_responded_at:  new Date().toISOString(),
      })
      .eq('application_id', applicationId);

    const { data: schedule, error: schedError } = await (
      dto.stage
        ? baseUpdate.eq('stage', dto.stage)
        : baseUpdate.is('applicant_response', null)
    )
      .select('scheduled_by_email, scheduled_date, scheduled_time, stage')
      .maybeSingle();

    if (schedError) throw new InternalServerErrorException(schedError.message);
    if (!schedule) throw new NotFoundException('No pending interview schedule found for this application');

    const { data: profile } = await supabase
      .from('applicant_profile')
      .select('first_name, last_name, email')
      .eq('applicant_id', applicantId)
      .maybeSingle();

    if (schedule.scheduled_by_email && profile?.email) {
      const applicantName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Applicant';
      this.mailService.sendApplicantResponseEmail({
        to:             schedule.scheduled_by_email,
        applicantName,
        applicantEmail: profile.email,
        jobTitle:       (app.job_postings as any)?.title ?? 'the position',
        action:         dto.action,
        note:           dto.note,
        scheduledDate:  schedule.scheduled_date,
        scheduledTime:  schedule.scheduled_time,
      }).catch(() => {});
    }

    return { message: 'Response recorded' };
  }

  async getHRInterviewCalendar(companyId: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('interview_schedules')
      .select(`
        schedule_id, application_id, scheduled_date, scheduled_time, duration_minutes,
        format, location, meeting_link, interviewer_name, interviewer_title,
        applicant_response, created_at,
        job_applications (
          status, applicant_id,
          job_postings (title, job_posting_id)
        )
      `)
      .eq('company_id', companyId)
      .order('scheduled_date', { ascending: true });

    if (error) throw new InternalServerErrorException(error.message);

    const applicantIds = [
      ...new Set(
        (data ?? [])
          .map((s) => (s.job_applications as any)?.applicant_id)
          .filter(Boolean),
      ),
    ];

    const { data: profiles } = applicantIds.length
      ? await supabase
          .from('applicant_profile')
          .select('applicant_id, first_name, last_name, email')
          .in('applicant_id', applicantIds)
      : { data: [] };

    const profileMap = new Map((profiles ?? []).map((p) => [p.applicant_id, p]));

    return (data ?? []).map((s) => {
      const app     = s.job_applications as any;
      const profile = profileMap.get(app?.applicant_id);
      return {
        schedule_id:        s.schedule_id,
        application_id:     s.application_id,
        scheduled_date:     s.scheduled_date,
        scheduled_time:     s.scheduled_time,
        duration_minutes:   s.duration_minutes,
        format:             s.format,
        location:           s.location,
        meeting_link:       s.meeting_link,
        interviewer_name:   s.interviewer_name,
        interviewer_title:  s.interviewer_title,
        applicant_response: s.applicant_response,
        created_at:         s.created_at,
        application_status: app?.status,
        job_title:          app?.job_postings?.title ?? '',
        job_posting_id:     app?.job_postings?.job_posting_id ?? '',
        first_name:         profile?.first_name ?? '',
        last_name:          profile?.last_name  ?? '',
        email:              profile?.email       ?? '',
      };
    });
  }

  async getHRInterviewNotifications(companyId: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('interview_schedules')
      .select(`
        schedule_id, application_id, scheduled_date, scheduled_time, format,
        interviewer_name, applicant_response, applicant_response_note, applicant_responded_at,
        job_applications (
          applicant_id,
          job_postings (title)
        )
      `)
      .eq('company_id', companyId)
      .not('applicant_response', 'is', null)
      .order('applicant_responded_at', { ascending: false });

    if (error) throw new InternalServerErrorException(error.message);

    const applicantIds = [
      ...new Set(
        (data ?? [])
          .map((s) => (s.job_applications as any)?.applicant_id)
          .filter(Boolean),
      ),
    ];

    const { data: profiles } = applicantIds.length
      ? await supabase
          .from('applicant_profile')
          .select('applicant_id, first_name, last_name, email')
          .in('applicant_id', applicantIds)
      : { data: [] };

    const profileMap = new Map((profiles ?? []).map((p) => [p.applicant_id, p]));

    return (data ?? []).map((s) => {
      const app     = s.job_applications as any;
      const profile = profileMap.get(app?.applicant_id);
      return {
        schedule_id:             s.schedule_id,
        application_id:          s.application_id,
        scheduled_date:          s.scheduled_date,
        scheduled_time:          s.scheduled_time,
        format:                  s.format,
        interviewer_name:        s.interviewer_name,
        applicant_response:      s.applicant_response,
        applicant_response_note: s.applicant_response_note,
        applicant_responded_at:  s.applicant_responded_at,
        job_title:               app?.job_postings?.title ?? '',
        first_name:              profile?.first_name ?? '',
        last_name:               profile?.last_name  ?? '',
        email:                   profile?.email       ?? '',
      };
    });
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

    // Block hired/onboarding applicants from applying to new jobs
    const { data: applicantProfile } = await supabase
      .from('applicant_profile')
      .select('status')
      .eq('applicant_id', applicantId)
      .maybeSingle();
    if (applicantProfile?.status === 'onboarding' || applicantProfile?.status === 'converted_employee') {
      throw new ForbiddenException('You have already been hired and cannot apply to new positions.');
    }

    const { data: existing } = await supabase
      .from('job_applications')
      .select('application_id')
      .eq('job_posting_id', jobPostingId)
      .eq('applicant_id', applicantId)
      .maybeSingle();

    if (existing) throw new ConflictException('You have already applied to this job');

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

    let sfiaAutoscan: { graded: boolean; reason?: string; sfia_matching_percentage?: number };
    try {
      sfiaAutoscan = await this.autoGenerateSfiaScoresForApplication({
        applicationId: application_id,
        jobPostingId,
        applicantId,
      });
    } catch (scanError: any) {
      this.logger.warn(`[applyToJob] Auto SFIA scan failed for application ${application_id}: ${scanError?.message ?? scanError}`);
      sfiaAutoscan = {
        graded: false,
        reason: 'Auto SFIA scan failed. Applicant can trigger a manual scan later.',
      };
    }

    return {
      ...data,
      sfia_autoscan: sfiaAutoscan,
    };
  }

  async scanResumeForApplicationSfia(applicationId: string, applicantId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: app, error } = await supabase
      .from('job_applications')
      .select('application_id, job_posting_id, applicant_id')
      .eq('application_id', applicationId)
      .eq('applicant_id', applicantId)
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    if (!app) throw new NotFoundException('Application not found');

    return this.autoGenerateSfiaScoresForApplication({
      applicationId: app.application_id,
      jobPostingId: app.job_posting_id,
      applicantId: app.applicant_id,
    });
  }

  async getMyApplicationDetail(applicationId: string, applicantId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: app, error } = await supabase
      .from('job_applications')
      .select(`
        application_id, status, applied_at, job_posting_id,
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

    const { data: schedules } = await supabase
      .from('interview_schedules')
      .select('schedule_id, application_id, stage, scheduled_date, scheduled_time, duration_minutes, format, location, meeting_link, interviewer_name, interviewer_title, notes, created_at, updated_at, applicant_response, applicant_response_note, applicant_responded_at')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false });

    // Build a per-stage map so the frontend can pick the right schedule
    const interview_schedules: Record<string, any> = {};
    for (const s of (schedules ?? [])) {
      const key = s.stage ?? 'first_interview';
      interview_schedules[key] = s;
    }
    const latestSchedule = (schedules ?? [])[0] ?? null;

    const sfiaScore = await this.getSfiaScoreForApplication(applicationId);

    return {
      ...app,
      answers: answers ?? [],
      interview_schedule: latestSchedule,
      interview_schedules,
      sfia_match_percentage: sfiaScore.sfia_match_percentage,
      sfia_grade: sfiaScore.sfia_grade,
    };
  }

  private async getSfiaScoreForApplication(applicationId: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('job_application_sfia')
      .select('sfia_matching_percentage')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);

    const percentage = data?.sfia_matching_percentage == null
      ? null
      : normalizeNumber(data.sfia_matching_percentage);

    if (percentage == null || !Number.isFinite(percentage)) {
      const { data: application, error: applicationError } = await supabase
        .from('job_applications')
        .select('job_posting_id, applicant_id')
        .eq('application_id', applicationId)
        .maybeSingle();

      if (applicationError) throw new InternalServerErrorException(applicationError.message);
      if (!application) {
        return { sfia_match_percentage: null, sfia_grade: null, sfia_assessment_status: 'not_assessed' as const };
      }

      const demandSkills = await this.getJobDemandSkills(application.job_posting_id);
      if (demandSkills.length === 0) {
        return { sfia_match_percentage: null, sfia_grade: null, sfia_assessment_status: 'not_configured' as const };
      }

      const supplySkills = await this.getCandidateSupplySkills([
        {
          application_id: applicationId,
          job_posting_id: application.job_posting_id,
          applicant_id: application.applicant_id,
          status: 'submitted',
          application_timestamp: new Date().toISOString(),
          pre_screening_score: null,
          sfia_matching_percentage: null,
          manual_rank_position: null,
          ranking_mode: 'sfia',
        },
      ]);

      const computed = this.computeSfiaScore(demandSkills, supplySkills);
      const computedPercentage = computed.relevancePercentage;

      if (computed.maxPossiblePoints <= 0) {
        return { sfia_match_percentage: null, sfia_grade: null, sfia_assessment_status: 'not_configured' as const };
      }

      const fallbackGrade = computedPercentage <= 0 ? 1 : Math.max(1, Math.min(7, Math.ceil((computedPercentage / 100) * 7)));
      return {
        sfia_match_percentage: roundToTwo(computedPercentage),
        sfia_grade: fallbackGrade,
        sfia_assessment_status: 'assessed' as const,
      };
    }

    const bounded = Math.max(0, Math.min(100, percentage));
    const grade = bounded <= 0 ? 1 : Math.max(1, Math.min(7, Math.ceil((bounded / 100) * 7)));

    return {
      sfia_match_percentage: roundToTwo(bounded),
      sfia_grade: grade,
      sfia_assessment_status: 'assessed' as const,
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

  async getUnreadNotifications(applicantId: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('notifications')
      .select('notification_id, applicant_id, job_posting_id, message, type, is_read, created_at')
      .eq('applicant_id', applicantId)
      .eq('is_read', false)
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async markNotificationRead(notificationId: string, applicantId: string) {
    const supabase = this.supabaseService.getClient();

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('notification_id', notificationId)
      .eq('applicant_id', applicantId);

    if (error) throw new InternalServerErrorException(error.message);
    return { message: 'Notification marked as read' };
  }

  async getSurveyScores(jobPostingId: string, companyId: string) {
    const supabase = this.supabaseService.getClient();

    await this.findOnePosting(jobPostingId, companyId);

    const { data: questions, error: qErr } = await supabase
      .from('survey_questions')
      .select('question_id, is_required')
      .eq('job_posting_id', jobPostingId);

    if (qErr) throw new InternalServerErrorException(qErr.message);

    const questionIds = (questions ?? []).map((q: any) => q.question_id).filter(Boolean);
    if (questionIds.length === 0) {
      return {
        job_posting_id: jobPostingId,
        total_respondents: 0,
        scores: [],
      };
    }

    const requiredMap = new Map<string, boolean>(
      (questions ?? []).map((q: any) => [q.question_id, Boolean(q.is_required)]),
    );

    const { data: allResponses, error: rErr } = await supabase
      .from('survey_responses')
      .select('response_id, application_id, applicant_id, response, survey_question_id, submitted_at')
      .in('survey_question_id', questionIds);

    if (rErr) throw new InternalServerErrorException(rErr.message);

    const scoreMap = new Map<
      string,
      {
        applicant_id: string;
        application_id: string;
        total_score: number;
        response_count: number;
        last_submitted: string;
      }
    >();

    for (const row of allResponses ?? []) {
      const existing = scoreMap.get(row.applicant_id)
        ?? this.createInitialSurveyScoreEntry(row.applicant_id, row.application_id, row.submitted_at);

      this.applySurveyScoreRow(existing, row, requiredMap);

      scoreMap.set(row.applicant_id, existing);
    }

    const applicantIds = [...scoreMap.keys()];
    const { data: profiles, error: pErr } = applicantIds.length
      ? await supabase
          .from('applicant_profile')
          .select('applicant_id, first_name, last_name, email')
          .in('applicant_id', applicantIds)
      : { data: [], error: null };

    if (pErr) throw new InternalServerErrorException(pErr.message);

    const profileMap = new Map<
      string,
      { first_name: string | null; last_name: string | null; email: string | null }
    >((profiles ?? []).map((p: any) => [
      p.applicant_id,
      {
        first_name: p.first_name ?? null,
        last_name: p.last_name ?? null,
        email: p.email ?? null,
      },
    ] as const));

    const result = [...scoreMap.values()]
      .map((entry) => {
        const profile = profileMap.get(entry.applicant_id);
        return {
          ...entry,
          first_name: profile?.first_name ?? null,
          last_name: profile?.last_name ?? null,
          email: profile?.email ?? null,
        };
      })
      .sort((a, b) => b.total_score - a.total_score);

    return {
      job_posting_id: jobPostingId,
      total_respondents: result.length,
      scores: result,
    };
  }

  private async assertCanSetHiredStatus(
    normalizedStatus: string,
    applicationId: string,
    applicantId: string,
    companyId: string,
  ) {
    if (normalizedStatus !== 'hired') return;

    const supabase = this.supabaseService.getClient();
    const { data: applicantProfile } = await supabase
      .from('applicant_profile')
      .select('status')
      .eq('applicant_id', applicantId)
      .maybeSingle();

    if (applicantProfile?.status === 'converted_employee') {
      throw new ConflictException(
        'This applicant has already been converted to an employee and cannot be re-hired.',
      );
    }

    const { data: hiredApps } = await supabase
      .from('job_applications')
      .select('application_id, job_posting_id')
      .eq('applicant_id', applicantId)
      .eq('status', 'hired')
      .neq('application_id', applicationId);

    if (!hiredApps || hiredApps.length === 0) return;

    const hiredPostingIds = hiredApps.map((a: any) => a.job_posting_id);
    const { data: inSameCompany } = await supabase
      .from('job_postings')
      .select('job_posting_id')
      .in('job_posting_id', hiredPostingIds)
      .eq('company_id', companyId)
      .limit(1);

    if (inSameCompany && inSameCompany.length > 0) {
      throw new ConflictException(
        'This applicant has already been hired for a position at this company. An applicant can only be hired once per company.',
      );
    }
  }

  private async insertApplicantStatusNotification(
    applicantId: string,
    jobPostingId: string,
    normalizedStatus: string,
  ) {
    const notifPayload = NOTIFIABLE_STATUSES[normalizedStatus];
    if (!notifPayload) return;

    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.from('notifications').insert({
      applicant_id: applicantId,
      job_posting_id: jobPostingId,
      message: notifPayload.message,
      type: notifPayload.type,
      is_read: false,
      created_at: new Date().toISOString(),
    });

    if (error) throw new InternalServerErrorException(error.message);
  }

  private createInitialSurveyScoreEntry(
    applicantId: string,
    applicationId: string,
    submittedAt: string,
  ) {
    return {
      applicant_id: applicantId,
      application_id: applicationId,
      total_score: 0,
      response_count: 0,
      last_submitted: submittedAt,
    };
  }

  private applySurveyScoreRow(
    entry: {
      total_score: number;
      response_count: number;
      last_submitted: string;
    },
    row: {
      response: string;
      survey_question_id: string;
      submitted_at: string;
    },
    requiredMap: Map<string, boolean>,
  ) {
    const rawResponse = typeof row.response === 'string' ? row.response.trim() : '';
    if (rawResponse === '') return;

    const numeric = Number(rawResponse);
    if (Number.isFinite(numeric)) {
      entry.total_score += numeric;
    } else if (requiredMap.get(row.survey_question_id)) {
      entry.total_score += 1;
    }

    entry.response_count += 1;
    if (row.submitted_at && (!entry.last_submitted || row.submitted_at > entry.last_submitted)) {
      entry.last_submitted = row.submitted_at;
    }
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

    // Fetch SFIA-tracked applications (have supply skill data)
    const { data: sfiaData, error: sfiaError } = await supabase
      .from('job_application_sfia')
      .select(
        'application_id, job_posting_id, applicant_id, status, application_timestamp, pre_screening_score, sfia_matching_percentage, manual_rank_position, ranking_mode',
      )
      .eq('job_posting_id', jobPostingId);

    if (sfiaError) {
      this.handleMissingSfiaSchema(sfiaError.message, 'job_application_sfia');
    }

    // Also include regular job_applications so all applicants appear in SFIA ranking
    const { data: regularData, error: regularError } = await supabase
      .from('job_applications')
      .select('application_id, job_posting_id, applicant_id, status, applied_at')
      .eq('job_posting_id', jobPostingId);

    if (regularError) throw new InternalServerErrorException(regularError.message);

    const sfiaIds = new Set((sfiaData ?? []).map((r: any) => r.application_id));

    // Normalise regular applications into RankedApplicationRow shape (no SFIA data yet)
    const regularNormalized: RankedApplicationRow[] = (regularData ?? [])
      .filter((r: any) => !sfiaIds.has(r.application_id))
      .map((r: any) => ({
        application_id:           r.application_id,
        job_posting_id:           r.job_posting_id,
        applicant_id:             r.applicant_id,
        status:                   r.status,
        application_timestamp:    r.applied_at,
        pre_screening_score:      null,
        sfia_matching_percentage: null,
        manual_rank_position:     null,
        ranking_mode:             'sfia',
      }));

    return [...(sfiaData ?? []) as RankedApplicationRow[], ...regularNormalized];
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

  private async autoGenerateSfiaScoresForApplication(params: {
    applicationId: string;
    jobPostingId: string;
    applicantId: string;
  }) {
    const { applicationId, jobPostingId, applicantId } = params;

    await this.ensureSfiaApplicationMirror(applicationId, jobPostingId, applicantId);

    const supabase = this.supabaseService.getClient();
    const { data: applicant, error: applicantError } = await supabase
      .from('applicant_profile')
      .select('resume_url, resume_name')
      .eq('applicant_id', applicantId)
      .maybeSingle();

    if (applicantError) throw new InternalServerErrorException(applicantError.message);
    if (!applicant?.resume_url) {
      return {
        graded: false,
        reason: 'No resume uploaded yet.',
      };
    }

    const requirements = await this.getJobSfiaRequirementsWithDescriptions(jobPostingId);
    if (requirements.length === 0) {
      return {
        graded: false,
        reason: 'This job has no SFIA required skills configured yet.',
      };
    }

    const resumeText = await this.extractResumeTextFromStorage(
      applicant.resume_url,
      applicant.resume_name ?? null,
    );

    const normalizedResume = this.normalizeText(resumeText);
    if (!normalizedResume) {
      return {
        graded: false,
        reason: 'Could not extract readable resume text for SFIA scan.',
      };
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

    const computed = this.computeSfiaScore(
      requirements.map((req) => ({
        skill_id: req.skill_id,
        skill_name: req.skill_name,
        required_level: req.required_level,
        weight: req.weight,
      })),
      supplyRows.map((row) => {
        const req = requirements.find((r) => r.skill_id === row.skill_id);
        return {
          owner_key: applicationId,
          skill_id: row.skill_id,
          skill_name: req?.skill_name ?? row.skill_id,
          candidate_level: row.candidate_level,
          match_score: row.match_score,
        };
      }),
    );

    await this.cacheSfiaScore(jobPostingId, applicationId, computed.relevancePercentage);

    return {
      graded: true,
      sfia_matching_percentage: computed.relevancePercentage,
      matched_skills: supplyRows.length,
    };
  }

  private async ensureSfiaApplicationMirror(
    applicationId: string,
    jobPostingId: string,
    applicantId: string,
  ) {
    const supabase = this.supabaseService.getClient();

    const { data: existing, error: findError } = await supabase
      .from('job_application_sfia')
      .select('application_id')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (findError) throw new InternalServerErrorException(findError.message);
    if (existing) return;

    const { error: insertError } = await supabase
      .from('job_application_sfia')
      .insert({
        application_id: applicationId,
        job_posting_id: jobPostingId,
        applicant_id: applicantId,
        status: 'SUBMITTED',
        application_timestamp: new Date().toISOString(),
        ranking_mode: 'SFIA',
      });

    if (insertError) throw new InternalServerErrorException(insertError.message);
  }

  private async getJobSfiaRequirementsWithDescriptions(jobPostingId: string): Promise<SfiaRequirementWithDescriptors[]> {
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

        const levelDescriptions = [
          skill.level_1_desc,
          skill.level_2_desc,
          skill.level_3_desc,
          skill.level_4_desc,
          skill.level_5_desc,
          skill.level_6_desc,
          skill.level_7_desc,
        ].map((value) => (typeof value === 'string' ? value : ''));

        return {
          skill_id: row.skill_id,
          skill_name: skill.skill,
          required_level: normalizeNumber(row.required_level),
          weight: normalizeNumber(row.weight) || 1,
          level_descriptions: levelDescriptions,
        } satisfies SfiaRequirementWithDescriptors;
      })
      .filter((row): row is SfiaRequirementWithDescriptors => row !== null);
  }

  private async extractResumeTextFromStorage(filePath: string, fileName: string | null) {
    const supabase = this.supabaseService.getClient();

    const bucketCandidates = ['applicant-resumes', 'sfia_documents'];
    let binaryData: Blob | null = null;

    for (const bucket of bucketCandidates) {
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
      return this.extractPdfText(buffer);
    }

    if (sourceName.endsWith('.docx')) {
      return this.extractDocxText(buffer);
    }

    return buffer.toString('utf8');
  }

  private async extractPdfText(buffer: Buffer) {
    try {
      const pdfParse: (input: Buffer) => Promise<{ text?: string }> = require('pdf-parse');
      const parsed = await pdfParse(buffer);
      return typeof parsed?.text === 'string' ? parsed.text : '';
    } catch {
      return '';
    }
  }

  private async extractDocxText(buffer: Buffer) {
    try {
      const mammoth: { extractRawText: (input: { buffer: Buffer }) => Promise<{ value?: string }> } = require('mammoth');
      const parsed = await mammoth.extractRawText({ buffer });
      return typeof parsed?.value === 'string' ? parsed.value : '';
    } catch {
      return '';
    }
  }

  private normalizeText(input: string) {
    return (input ?? '').toLowerCase().replaceAll(/\s+/g, ' ').trim();
  }

  private estimateCandidateLevelFromResume(
    normalizedResume: string,
    skillName: string,
    requiredLevel: number,
    levelDescriptions: string[],
  ) {
    const skillTokens = this.tokenize(skillName);
    const hasSkillMention = skillTokens.some((token) => normalizedResume.includes(token));

    let bestLevel = 0;
    let bestCoverage = 0;

    for (let i = 0; i < levelDescriptions.length; i += 1) {
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

  private tokenize(input: string) {
    return (input ?? '')
      .toLowerCase()
      .replaceAll(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 3);
  }

  private keywordCoverage(normalizedResume: string, descriptor: string) {
    const descriptorTokens = this.tokenize(descriptor);
    if (descriptorTokens.length === 0) return 0;

    const matched = descriptorTokens.filter((token) => normalizedResume.includes(token)).length;
    return matched / descriptorTokens.length;
  }

  private computeEstimatedMatchScore(candidateLevel: number, requiredLevel: number) {
    if (candidateLevel === requiredLevel) return 100;
    if (candidateLevel > requiredLevel) return 85;
    if (requiredLevel <= 0) return 0;

    return roundToTwo((candidateLevel / requiredLevel) * 70);
  }

  private handleMissingSfiaSchema(message: string, tableName: string) {
    if (message.includes('schema cache')) {
      this.logger.error(
        `SFIA ranking requires the ${tableName} table, but it is not available in the configured Supabase project.`,
      );
    }
  }

  // ─── B1: Accept Hiring Offer ───────────────────────────────────────────────

  async acceptOffer(applicationId: string, applicantId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: app, error: fetchErr } = await supabase
      .from('job_applications')
      .select('application_id, applicant_id, status')
      .eq('application_id', applicationId)
      .eq('applicant_id', applicantId)
      .maybeSingle();

    if (fetchErr) throw new InternalServerErrorException(fetchErr.message);
    if (!app) throw new NotFoundException('Application not found.');
    if (app.status !== 'hired')
      throw new BadRequestException('Offer can only be accepted when status is "hired".');

    const { error } = await supabase
      .from('job_applications')
      .update({ status: 'offer_accepted', offer_accepted_at: new Date().toISOString() })
      .eq('application_id', applicationId);

    if (error) throw new InternalServerErrorException(error.message);

    this.logger.log(`[acceptOffer] Application ${applicationId} accepted by applicant ${applicantId}`);
    return { status: 'offer_accepted' };
  }

  private getManilaDayCode(date = new Date()): string {
    const shortWeekday = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      timeZone: 'Asia/Manila',
    })
      .format(date)
      .toUpperCase();

    const dayCodeMap: Record<string, string> = {
      SUN: 'SUN',
      MON: 'MON',
      TUE: 'TUES',
      WED: 'WED',
      THU: 'THURS',
      FRI: 'FRI',
      SAT: 'SAT',
    };

    return dayCodeMap[shortWeekday] ?? 'MON';
  }

  private parseScheduleWorkdays(rawWorkdays: unknown): string[] {
    if (!rawWorkdays) return [];

    if (Array.isArray(rawWorkdays)) {
      return rawWorkdays.map((d) => String(d).trim().toUpperCase()).filter(Boolean);
    }

    if (typeof rawWorkdays === 'string') {
      const trimmed = rawWorkdays.trim();
      if (!trimmed) return [];

      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            return parsed.map((d) => String(d).trim().toUpperCase()).filter(Boolean);
          }
        } catch {
          // fall through to CSV parsing
        }
      }

      return trimmed
        .split(',')
        .map((d) => d.trim().toUpperCase())
        .filter(Boolean);
    }

    return [];
  }

  // ─── B7: Cron — Auto-mark absent at end of day (11:59 PM Manila) ──────────

  @Cron('59 23 * * *', { timeZone: 'Asia/Manila', name: 'autoMarkAbsent' })
  async autoMarkAbsent() {
    const supabase = this.supabaseService.getClient();
    const cronLogger = new Logger('autoMarkAbsent');

    const manilaDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    const manilaStart = `${manilaDate}T00:00:00.000+08:00`;
    const manilaEnd = `${manilaDate}T23:59:59.999+08:00`;
    const dayCode = this.getManilaDayCode();

    const { data: schedules, error: schedErr } = await supabase
      .from('schedules')
      .select('employee_id, workdays');

    if (schedErr) { cronLogger.error(`Failed to fetch schedules: ${schedErr.message}`); return; }

    const scheduledToday = (schedules ?? []).filter((s: any) => {
      const workdays = this.parseScheduleWorkdays(s.workdays);
      return workdays.includes(dayCode);
    });

    if (scheduledToday.length === 0) { cronLogger.log(`No employees scheduled for ${manilaDate}`); return; }

    const employeeIds = scheduledToday.map((s: any) => s.employee_id as string).filter(Boolean);

    const { data: existingLogs } = await supabase
      .from('attendance_time_logs')
      .select('employee_id')
      .in('employee_id', employeeIds)
      .gte('timestamp', manilaStart)
      .lte('timestamp', manilaEnd);

    const loggedSet = new Set((existingLogs ?? []).map((l: any) => l.employee_id as string));

    const absentRows = scheduledToday
      .filter((s: any) => !loggedSet.has(s.employee_id as string))
      .map((s: any) => ({
        log_id: crypto.randomUUID(),
        employee_id: s.employee_id,
        log_type: 'absence',
        status: 'ABSENT',
        clock_type: 'ABSENT_NO_CLOCKIN',
        timestamp: `${manilaDate}T23:59:00.000+08:00`,
        log_status: 'APPROVED',
        notes: 'Auto-marked by system — no clock-in recorded',
      }));

    if (absentRows.length === 0) { cronLogger.log(`All scheduled employees clocked in on ${manilaDate}`); return; }

    const { error: insertErr } = await supabase.from('attendance_time_logs').insert(absentRows);
    if (insertErr) cronLogger.error(`Failed to insert absent records: ${insertErr.message}`);
    else cronLogger.log(`Auto-marked ${absentRows.length} employee(s) absent for ${manilaDate}`);
  }

  // ─── B7 continued: Cron — Auto close open clock-ins (00:01 AM Manila) ─────

  @Cron('1 0 * * *', { timeZone: 'Asia/Manila', name: 'autoCloseOpenClockIns' })
  async autoCloseOpenClockIns() {
    const supabase = this.supabaseService.getClient();
    const cronLogger = new Logger('autoCloseOpenClockIns');

    const yesterday = new Date(Date.now() - 86400000)
      .toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    const yesterdayStart = `${yesterday}T00:00:00.000+08:00`;
    const yesterdayEnd = `${yesterday}T23:59:59.999+08:00`;

    const { data: openIns, error: fetchErr } = await supabase
      .from('attendance_time_logs')
      .select('log_id, employee_id, schedule_id')
      .eq('log_type', 'time-in')
      .gte('timestamp', yesterdayStart)
      .lte('timestamp', yesterdayEnd);

    if (fetchErr) { cronLogger.error(`Failed to fetch open clock-ins: ${fetchErr.message}`); return; }
    if (!openIns || openIns.length === 0) return;

    const empIds = openIns.map((l: any) => l.employee_id as string);
    const { data: timeOuts } = await supabase
      .from('attendance_time_logs')
      .select('employee_id')
      .eq('log_type', 'time-out')
      .in('employee_id', empIds)
      .gte('timestamp', yesterdayStart)
      .lte('timestamp', yesterdayEnd);

    const timedOutSet = new Set((timeOuts ?? []).map((l: any) => l.employee_id as string));

    const closeRows = (openIns as any[])
      .filter((l) => !timedOutSet.has(l.employee_id as string))
      .map((l) => ({
        log_id: crypto.randomUUID(),
        employee_id: l.employee_id,
        schedule_id: l.schedule_id ?? null,
        log_type: 'time-out',
        clock_type: 'NO_CLOCKOUT',
        status: 'PRESENT',
        log_status: 'APPROVED',
        timestamp: `${yesterday}T23:59:00.000+08:00`,
        notes: 'Auto clock-out — employee did not clock out',
      }));

    if (closeRows.length === 0) return;

    const { error: insertErr } = await supabase.from('attendance_time_logs').insert(closeRows);
    if (insertErr) cronLogger.error(`Failed to insert auto clock-outs: ${insertErr.message}`);
    else cronLogger.log(`Auto clock-out recorded for ${closeRows.length} employee(s) from ${yesterday}`);
  }
}
