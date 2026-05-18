import { IsString, IsOptional, IsNumber, IsBoolean, IsArray, IsEnum, Min, Max, IsUUID, IsDateString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateGoalDto {
  @IsOptional() @IsString() user_id?: string;
  @IsString() title: string;
  @IsString() category: string;
  @IsString() kpi: string;
  @IsString() target: string;
  @IsOptional() @IsString() deadline?: string;
  @IsOptional() @IsString() priority?: string;
}

export class CreateEvaluationGoalResultDto {
  @IsString() perf_goals_id: string;
  @IsBoolean() completed: boolean;
}

export class EvaluationRecommendationsDto {
  @IsBoolean() promotion: boolean;
  @IsBoolean() bonus: boolean;
  @IsBoolean() merit: boolean;
}

export class CreateEvaluationDto {
  @IsString() user_id: string;
  @IsString() review_period: string;
  @IsNumber() scale_rating: number;
  @IsString() rating_status: string;
  @IsOptional() @IsString() perf_comments?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateEvaluationGoalResultDto) goal_results?: CreateEvaluationGoalResultDto[];
  @IsOptional() @ValidateNested() @Type(() => EvaluationRecommendationsDto) recommendations?: EvaluationRecommendationsDto;
}

export class CreateViolationDto {
  @IsString() user_id: string;
  @IsString() violation_type: string;
  @IsString() severity: string;
  @IsString() description: string;
  @IsOptional() @IsString() evidence?: string;
  @IsOptional() @IsString() occured_at?: string;
}

export class CreatePipDto {
  @IsString() user_id: string;
  @IsOptional() @IsString() perf_eval_id?: string;
  @IsOptional() @IsString() deadline?: string;
  @IsOptional() @IsArray() pip_goals?: any[];
}

export class PipUpdateDto {
  @IsOptional() @IsArray() progress_data?: any[];
  @IsOptional() @IsString() progress_summary?: string;
  @IsOptional() @IsString() milestone_label?: string;
}

export class ReviewPipUpdateDto {
  @IsOptional() @IsString() manager_notes?: string;
}

export class ApproveItemDto {
  @IsString() type: string;
  @IsOptional() @IsString() document_url?: string;
}

export class ReviewItemDto {
  @IsString() type: string;
  @IsString() action: string;
  @IsOptional() @IsString() comment?: string;
}

export class AddCommentDto {
  @IsString() comment_text: string;
}

export class PatchViolationDto {
  @IsOptional() @IsString() action_status?: string;
  @IsOptional() @IsString() disciplinary_action?: string;
}

export class CycleSettingsDto {
  @IsOptional() settings?: any;
  @IsOptional() violation_rules?: any[];
  @IsOptional() bonus_rules?: any[];
}

export class CreateViolationRuleDto {
  @IsOptional() @IsNumber() violation_count?: number;
  @IsOptional() @IsString() severity_threshold?: string;
  @IsOptional() @IsString() resulting_action?: string;
  @IsOptional() @IsBoolean() affects_bonus?: boolean;
  @IsOptional() @IsBoolean() affects_merit?: boolean;
  @IsOptional() @IsBoolean() affects_perks?: boolean;
  @IsOptional() @IsString() rule_description?: string;
  @IsOptional() @IsNumber() within_days?: number;
  @IsOptional() @IsNumber() suspension_days?: number;
  // Display string fields (frontend sends these)
  @IsOptional() @IsString() condition?: string;
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsString() affectedBenefits?: string;
}

export class CreateBonusRuleDto {
  @IsNumber() rating_min: number;
  @IsNumber() rating_max: number;
  @IsNumber() bonus_pct: number;
  @IsNumber() merit_increase_pct: number;
  @IsBoolean() promotion_eligible: boolean;
  @IsOptional() @IsString() rating_label?: string;
  @IsOptional() @IsString() amount_type?: string;
  @IsOptional() @IsNumber() bonus_fixed_amount?: number;
  @IsOptional() @IsNumber() merit_fixed_amount?: number;
}

export class CreateCycleDto {
  @IsString() cycle_name: string;
  @IsString() start_date: string;
  @IsString() end_date: string;
  @IsOptional() @IsString() status?: string;
}

export class PatchCycleDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() cycle_name?: string;
  @IsOptional() @IsString() start_date?: string;
  @IsOptional() @IsString() end_date?: string;
}

export class PatchGoalDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() kpi?: string;
  @IsOptional() @IsString() target?: string;
  @IsOptional() @IsString() deadline?: string;
  @IsOptional() @IsNumber() progress_pct?: number;
  @IsOptional() @IsString() status?: string;
}

export class GoalProgressDto {
  @Min(0) @Max(100) @IsNumber() progress_pct: number;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() progress_value?: string;
  @IsOptional() @IsString() checkpoint_type?: string;
}

export class RejectGoalDto {
  @IsOptional() @IsString() reason?: string;
}

export class CreateSelfAssessmentDto {
  @IsArray() goal_results: any[];
  @IsOptional() @IsString() self_comments?: string;
}
