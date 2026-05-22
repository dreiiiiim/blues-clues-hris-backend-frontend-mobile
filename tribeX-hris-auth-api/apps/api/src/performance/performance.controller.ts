import {
  Controller, Get, Post, Patch, Put, Delete, Body, Param, Query, Req, UseGuards,
  UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PerformanceService } from './performance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  CreateGoalDto, CreateEvaluationDto, CreateViolationDto, CreatePipDto,
  PipUpdateDto, ReviewPipUpdateDto, ApproveItemDto, ReviewItemDto, AddCommentDto,
  PatchViolationDto, CycleSettingsDto, CreateViolationRuleDto, CreateBonusRuleDto,
  CreateCycleDto, PatchCycleDto, PatchGoalDto, GoalProgressDto, RejectGoalDto,
  CreateSelfAssessmentDto,
} from './dto/performance.dto';

const EMPLOYEE  = ['Active Employee', 'Employee'];
const MANAGER   = ['Manager', 'Group Head'];
const HR        = ['HR Officer', 'HR Recruiter', 'HR Interviewer', 'HR Performance Management Officer'];
const HR_ONLY   = ['HR Officer', 'HR Performance Management Officer'];
const SA        = ['System Admin'];
const ALL_STAFF = [...EMPLOYEE, ...MANAGER, ...HR, 'Admin', 'System Admin'];

@ApiTags('Performance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('performance')
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  health() { return { status: 'ok' }; }

  // ── Settings ─────────────────────────────────────────────────────────────
  @Get('settings/full')
  @UseGuards(RolesGuard) @Roles(...SA)
  @ApiOperation({ summary: 'System Admin: Get all performance settings' })
  getFullSettings(@Req() req: any) { return this.performanceService.getFullSettings(req.user.company_id); }

  @Patch('settings/full')
  @UseGuards(RolesGuard) @Roles(...SA)
  @ApiOperation({ summary: 'System Admin: Save all performance settings (PATCH)' })
  saveFullSettings(@Req() req: any, @Body() dto: CycleSettingsDto) { return this.performanceService.saveFullSettings(req.user.company_id, req.user.sub_userid, dto); }

  @Put('settings/full')
  @UseGuards(RolesGuard) @Roles(...SA)
  @ApiOperation({ summary: 'System Admin: Save all performance settings (PUT)' })
  saveFullSettingsPut(@Req() req: any, @Body() dto: CycleSettingsDto) { return this.performanceService.saveFullSettings(req.user.company_id, req.user.sub_userid, dto); }

  @Post('settings/full')
  @UseGuards(RolesGuard) @Roles(...SA)
  @ApiOperation({ summary: 'System Admin: Save all performance settings (POST)' })
  saveFullSettingsPost(@Req() req: any, @Body() dto: CycleSettingsDto) { return this.performanceService.saveFullSettings(req.user.company_id, req.user.sub_userid, dto); }

  // ── Violation Rules ───────────────────────────────────────────────────────
  @Post('violation-rules')
  @UseGuards(RolesGuard) @Roles(...SA)
  @ApiOperation({ summary: 'System Admin: Create violation rule' })
  createViolationRule(@Req() req: any, @Body() dto: CreateViolationRuleDto) { return this.performanceService.createViolationRule(req.user.company_id, dto); }

  @Delete('violation-rules/:rule_id')
  @UseGuards(RolesGuard) @Roles(...SA)
  @ApiOperation({ summary: 'System Admin: Delete violation rule' })
  deleteViolationRule(@Param('rule_id') ruleId: string, @Req() req: any) { return this.performanceService.deleteViolationRule(ruleId, req.user.company_id); }

  // ── Bonus Rules ───────────────────────────────────────────────────────────
  @Get('bonus-rules/compute')
  @UseGuards(RolesGuard) @Roles(...MANAGER, ...HR_ONLY)
  @ApiOperation({ summary: 'Manager/HR: Compute bonus for employee at rating' })
  @ApiQuery({ name: 'user_id', required: true }) @ApiQuery({ name: 'rating', required: true })
  computeBonusRules(@Req() req: any, @Query('user_id') userId: string, @Query('rating') rating: string) { return this.performanceService.computeBonusRules(req.user.company_id, userId, parseFloat(rating)); }

  @Post('bonus-rules')
  @UseGuards(RolesGuard) @Roles(...SA)
  @ApiOperation({ summary: 'System Admin: Create bonus rule' })
  createBonusRule(@Req() req: any, @Body() dto: CreateBonusRuleDto) { return this.performanceService.createBonusRule(req.user.company_id, dto); }

  @Patch('bonus-rules/:id')
  @UseGuards(RolesGuard) @Roles(...SA)
  @ApiOperation({ summary: 'System Admin: Update bonus rule' })
  updateBonusRule(@Param('id') id: string, @Req() req: any, @Body() dto: CreateBonusRuleDto) { return this.performanceService.updateBonusRule(id, req.user.company_id, dto); }

  @Delete('bonus-rules/:id')
  @UseGuards(RolesGuard) @Roles(...SA)
  @ApiOperation({ summary: 'System Admin: Delete bonus rule' })
  deleteBonusRule(@Param('id') id: string, @Req() req: any) { return this.performanceService.deleteBonusRule(id, req.user.company_id); }

  // ── Cycles ────────────────────────────────────────────────────────────────
  @Get('cycles/active')
  @ApiOperation({ summary: 'Any: Get active cycle' })
  getActiveCycle(@Req() req: any) { return this.performanceService.getActiveCyclePublic(req.user.company_id); }

  @Get('cycles')
  @UseGuards(RolesGuard) @Roles(...HR, ...MANAGER, ...SA)
  @ApiOperation({ summary: 'HR/Manager/SA: List all cycles' })
  getCycles(@Req() req: any) { return this.performanceService.getCycles(req.user.company_id); }

  @Post('cycles')
  @UseGuards(RolesGuard) @Roles(...HR_ONLY, ...SA)
  @ApiOperation({ summary: 'HR/SA: Create cycle' })
  createCycle(@Req() req: any, @Body() dto: CreateCycleDto) { return this.performanceService.createCycle(req.user.company_id, req.user.sub_userid, dto); }

  @Patch('cycles/:id')
  @UseGuards(RolesGuard) @Roles(...HR_ONLY, ...SA)
  @ApiOperation({ summary: 'HR/SA: Update cycle' })
  patchCycle(@Param('id') id: string, @Req() req: any, @Body() dto: PatchCycleDto) { return this.performanceService.patchCycle(id, req.user.company_id, dto); }

  @Delete('cycles/:id')
  @UseGuards(RolesGuard) @Roles(...HR_ONLY, ...SA)
  @ApiOperation({ summary: 'HR/SA: Delete cycle (only if no associated data)' })
  deleteCycle(@Param('id') id: string, @Req() req: any) { return this.performanceService.deleteCycle(id, req.user.company_id); }

  // ── Goals ─────────────────────────────────────────────────────────────────
  @Get('goals/my')
  @UseGuards(RolesGuard) @Roles(...EMPLOYEE)
  @ApiOperation({ summary: 'Employee: My goals' })
  getMyGoals(@Req() req: any) { return this.performanceService.getMyGoals(req.user.sub_userid, req.user.company_id); }

  @Get('goals/team')
  @UseGuards(RolesGuard) @Roles(...MANAGER)
  @ApiOperation({ summary: 'Manager: Team goals' })
  getTeamGoals(@Req() req: any) { return this.performanceService.getTeamGoals(req.user.sub_userid, req.user.company_id); }

  @Get('goals/all')
  @UseGuards(RolesGuard) @Roles(...HR)
  @ApiOperation({ summary: 'HR: All goals' })
  getAllGoals(@Req() req: any) { return this.performanceService.getAllGoals(req.user.company_id); }

  @Post('goals')
  @UseGuards(RolesGuard) @Roles(...EMPLOYEE, ...MANAGER)
  @ApiOperation({ summary: 'Employee/Manager: Create goal' })
  createGoal(@Req() req: any, @Body() dto: CreateGoalDto) { return this.performanceService.createGoal(req.user.sub_userid, req.user.role_name, req.user.company_id, dto); }

  @Patch('goals/:id/approve')
  @UseGuards(RolesGuard) @Roles(...HR_ONLY)
  @ApiOperation({ summary: 'HR: Approve goal' })
  approveGoal(@Param('id') id: string, @Req() req: any) { return this.performanceService.approveGoal(id, req.user.sub_userid, req.user.company_id); }

  @Patch('goals/:id/reject')
  @UseGuards(RolesGuard) @Roles(...HR_ONLY)
  @ApiOperation({ summary: 'HR: Reject goal' })
  rejectGoal(@Param('id') id: string, @Req() req: any, @Body() dto: RejectGoalDto) { return this.performanceService.rejectGoal(id, req.user.sub_userid, req.user.company_id, dto.reason); }

  @Get('goals/:id/progress')
  @ApiOperation({ summary: 'Any: Goal progress history' })
  getGoalProgress(@Param('id') id: string) { return this.performanceService.getGoalProgress(id); }

  @Post('goals/:id/progress')
  @UseGuards(RolesGuard) @Roles(...EMPLOYEE, ...MANAGER, ...HR_ONLY)
  @ApiOperation({ summary: 'Employee/Manager/HR: Log goal progress' })
  addGoalProgress(@Param('id') id: string, @Req() req: any, @Body() dto: GoalProgressDto) { return this.performanceService.addGoalProgress(id, req.user.sub_userid, req.user.company_id, dto); }

  @Patch('goals/:id')
  @UseGuards(RolesGuard) @Roles(...EMPLOYEE, ...MANAGER)
  @ApiOperation({ summary: 'Employee/Manager: Update goal' })
  patchGoal(@Param('id') id: string, @Req() req: any, @Body() dto: PatchGoalDto) { return this.performanceService.patchGoal(id, req.user.sub_userid, req.user.company_id, dto); }

  @Delete('goals/:id')
  @UseGuards(RolesGuard) @Roles(...EMPLOYEE, ...MANAGER)
  @ApiOperation({ summary: 'Employee/Manager: Delete goal (only PENDING or REJECTED)' })
  deleteGoal(@Param('id') id: string, @Req() req: any) { return this.performanceService.deleteGoal(id, req.user.sub_userid, req.user.company_id); }

  // ── Evaluations ───────────────────────────────────────────────────────────
  @Get('evaluations/my')
  @UseGuards(RolesGuard) @Roles(...EMPLOYEE)
  @ApiOperation({ summary: 'Employee: My evaluations' })
  getMyEvaluations(@Req() req: any) { return this.performanceService.getMyEvaluations(req.user.sub_userid, req.user.company_id); }

  @Get('evaluations/my/history')
  @UseGuards(RolesGuard) @Roles(...EMPLOYEE)
  @ApiOperation({ summary: 'Employee: Evaluation history' })
  getMyEvaluationHistory(@Req() req: any) { return this.performanceService.getMyEvaluationHistory(req.user.sub_userid, req.user.company_id); }

  @Get('evaluations/team')
  @UseGuards(RolesGuard) @Roles(...MANAGER)
  @ApiOperation({ summary: 'Manager: Team evaluations' })
  getTeamEvaluations(@Req() req: any) { return this.performanceService.getTeamEvaluations(req.user.sub_userid, req.user.company_id); }

  @Get('evaluations/all')
  @UseGuards(RolesGuard) @Roles(...HR)
  @ApiOperation({ summary: 'HR: All evaluations' })
  getAllEvaluations(@Req() req: any) { return this.performanceService.getAllEvaluations(req.user.company_id); }

  @Get('evaluations/:id')
  @ApiOperation({ summary: 'Any: Get evaluation by ID' })
  getEvaluationById(@Param('id') id: string) { return this.performanceService.getEvaluationById(id); }

  @Post('evaluations')
  @UseGuards(RolesGuard) @Roles(...MANAGER)
  @ApiOperation({ summary: 'Manager: Submit evaluation' })
  createEvaluation(@Req() req: any, @Body() dto: CreateEvaluationDto) { return this.performanceService.createEvaluation(req.user.sub_userid, req.user.role_name, req.user.company_id, dto); }

  @Patch('evaluations/:id/submit')
  @UseGuards(RolesGuard) @Roles(...MANAGER)
  @ApiOperation({ summary: 'Manager: Submit evaluation to HR' })
  submitEvaluation(@Param('id') id: string, @Req() req: any) { return this.performanceService.submitEvaluation(id, req.user.sub_userid, req.user.company_id); }

  @Patch('evaluations/:id/countersign')
  @UseGuards(RolesGuard) @Roles(...HR_ONLY)
  @ApiOperation({ summary: 'HR: Countersign evaluation' })
  countersignEvaluation(@Param('id') id: string, @Req() req: any) { return this.performanceService.countersignEvaluation(id, req.user.sub_userid, req.user.company_id); }

  @Patch('evaluations/:id/acknowledge')
  @UseGuards(RolesGuard) @Roles(...EMPLOYEE)
  @ApiOperation({ summary: 'Employee: Acknowledge evaluation' })
  acknowledgeEvaluation(@Param('id') id: string, @Req() req: any) { return this.performanceService.acknowledgeEvaluation(id, req.user.sub_userid); }

  @Get('evaluations/:eval_id/comments')
  @UseGuards(RolesGuard) @Roles(...MANAGER, ...HR_ONLY)
  @ApiOperation({ summary: 'Manager/HR: Get evaluation comments' })
  getEvaluationComments(@Param('eval_id') evalId: string) { return this.performanceService.getEvaluationComments(evalId); }

  @Post('evaluations/:eval_id/comments')
  @UseGuards(RolesGuard) @Roles(...MANAGER, ...HR_ONLY)
  @ApiOperation({ summary: 'Manager/HR: Add comment to evaluation' })
  addEvaluationComment(@Param('eval_id') evalId: string, @Req() req: any, @Body() dto: AddCommentDto) { return this.performanceService.addEvaluationComment(evalId, req.user.sub_userid, req.user.role_name, dto); }

  // ── Violations ────────────────────────────────────────────────────────────
  @Get('violations/detailed')
  @UseGuards(RolesGuard) @Roles(...HR)
  @ApiOperation({ summary: 'HR: Violations with details' })
  getViolationsDetailed(@Req() req: any) { return this.performanceService.getViolationsDetailed(req.user.company_id); }

  @Get('violations/stats')
  @UseGuards(RolesGuard) @Roles(...HR)
  @ApiOperation({ summary: 'HR: Violation stats by severity' })
  getViolationStats(@Req() req: any) { return this.performanceService.getViolationStats(req.user.company_id); }

  @Get('violations')
  @UseGuards(RolesGuard) @Roles(...HR, ...MANAGER)
  @ApiOperation({ summary: 'HR/Manager: List violations' })
  getViolations(@Req() req: any) { return this.performanceService.getViolations(req.user.company_id); }

  @Post('violations')
  @UseGuards(RolesGuard) @Roles(...HR_ONLY, 'HR Recruiter', ...MANAGER)
  @ApiOperation({ summary: 'HR/Manager: Log violation' })
  createViolation(@Req() req: any, @Body() dto: CreateViolationDto) { return this.performanceService.createViolation(req.user.sub_userid, req.user.role_name, req.user.company_id, dto); }

  @Post('violations/upload-evidence')
  @UseGuards(RolesGuard) @Roles(...HR_ONLY, 'HR Recruiter', ...MANAGER)
  @ApiOperation({ summary: 'HR/Manager: Upload violation evidence file' })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadViolationEvidence(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    return this.performanceService.uploadViolationEvidence(file, req.user.company_id);
  }

  @Post('documents/upload')
  @UseGuards(RolesGuard) @Roles(...HR_ONLY, ...MANAGER)
  @ApiOperation({ summary: 'HR/Manager: Upload performance document (signed eval or PIP agreement)' })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }))
  uploadPerformanceDocument(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    return this.performanceService.uploadPerformanceDocument(file, req.user.company_id);
  }

  @Patch('violations/:id')
  @UseGuards(RolesGuard) @Roles(...HR_ONLY)
  @ApiOperation({ summary: 'HR: Update violation' })
  patchViolation(@Param('id') id: string, @Req() req: any, @Body() dto: PatchViolationDto) { return this.performanceService.patchViolation(id, req.user.company_id, dto); }

  // ── PIP ───────────────────────────────────────────────────────────────────
  @Get('pip/my')
  @UseGuards(RolesGuard) @Roles(...EMPLOYEE)
  @ApiOperation({ summary: 'Employee: My PIPs' })
  getMyPip(@Req() req: any) { return this.performanceService.getMyPip(req.user.sub_userid, req.user.company_id); }

  @Get('pip/team')
  @UseGuards(RolesGuard) @Roles(...MANAGER)
  @ApiOperation({ summary: 'Manager: Team PIPs' })
  getTeamPip(@Req() req: any) { return this.performanceService.getTeamPip(req.user.sub_userid, req.user.company_id); }

  @Get('pip/all')
  @UseGuards(RolesGuard) @Roles(...HR)
  @ApiOperation({ summary: 'HR: All PIPs' })
  getAllPip(@Req() req: any) { return this.performanceService.getAllPip(req.user.company_id); }

  @Get('pip/:id')
  @ApiOperation({ summary: 'Any: Get PIP by ID' })
  getPipById(@Param('id') id: string) { return this.performanceService.getPipById(id); }

  @Post('pip')
  @UseGuards(RolesGuard) @Roles(...MANAGER)
  @ApiOperation({ summary: 'Manager: Initiate PIP' })
  createPip(@Req() req: any, @Body() dto: CreatePipDto) { return this.performanceService.createPip(req.user.sub_userid, req.user.role_name, req.user.company_id, dto); }

  @Patch('pip/:id/approve')
  @UseGuards(RolesGuard) @Roles(...HR_ONLY)
  @ApiOperation({ summary: 'HR: Approve PIP' })
  approvePip(@Param('id') id: string, @Req() req: any) { return this.performanceService.approvePip(id, req.user.sub_userid, req.user.company_id); }

  @Patch('pip/:id/status')
  @UseGuards(RolesGuard) @Roles(...MANAGER, ...HR_ONLY)
  @ApiOperation({ summary: 'Manager/HR: Update PIP status' })
  patchPipStatus(@Param('id') id: string, @Body() dto: any) { return this.performanceService.patchPipStatus(id, dto); }

  @Get('pip/:pip_id/updates')
  @ApiOperation({ summary: 'Any: Get PIP updates' })
  getPipUpdates(@Param('pip_id') pipId: string) { return this.performanceService.getPipUpdates(pipId); }

  @Post('pip/:pip_id/updates')
  @UseGuards(RolesGuard) @Roles(...EMPLOYEE)
  @ApiOperation({ summary: 'Employee: Submit PIP progress update' })
  createPipUpdate(@Param('pip_id') pipId: string, @Req() req: any, @Body() dto: PipUpdateDto) { return this.performanceService.createPipUpdate(pipId, req.user.sub_userid, dto); }

  @Patch('pip-updates/:update_id/review')
  @UseGuards(RolesGuard) @Roles(...MANAGER)
  @ApiOperation({ summary: 'Manager: Review PIP update' })
  reviewPipUpdate(@Param('update_id') updateId: string, @Req() req: any, @Body() dto: ReviewPipUpdateDto) { return this.performanceService.reviewPipUpdate(updateId, req.user.sub_userid, dto); }

  // ── Rewards ───────────────────────────────────────────────────────────────
  @Get('rewards')
  @UseGuards(RolesGuard) @Roles(...HR)
  @ApiOperation({ summary: 'HR: List all rewards' })
  getRewards(@Req() req: any) { return this.performanceService.getRewards(req.user.company_id); }

  @Patch('rewards/sync-all')
  @UseGuards(RolesGuard) @Roles(...HR_ONLY)
  @ApiOperation({ summary: 'HR: Sync all rewards to payroll' })
  syncAllRewards(@Req() req: any) { return this.performanceService.syncAllRewards(req.user.company_id); }

  @Patch('rewards/:id/sync')
  @UseGuards(RolesGuard) @Roles(...HR_ONLY)
  @ApiOperation({ summary: 'HR: Sync single reward to payroll' })
  syncReward(@Param('id') id: string) { return this.performanceService.syncReward(id); }

  // ── Dashboards ────────────────────────────────────────────────────────────
  @Get('employee/dashboard')
  @UseGuards(RolesGuard) @Roles(...EMPLOYEE)
  @ApiOperation({ summary: 'Employee: Performance dashboard' })
  getEmployeeDashboard(@Req() req: any) { return this.performanceService.getEmployeeDashboard(req.user.sub_userid, req.user.company_id); }

  @Get('manager/dashboard')
  @UseGuards(RolesGuard) @Roles(...MANAGER)
  @ApiOperation({ summary: 'Manager: Team performance dashboard' })
  getManagerDashboard(@Req() req: any) { return this.performanceService.getManagerDashboard(req.user.sub_userid, req.user.company_id); }

  @Get('manager/team')
  @UseGuards(RolesGuard) @Roles(...MANAGER)
  @ApiOperation({ summary: 'Manager: Team member performance overview' })
  getManagerTeam(@Req() req: any) { return this.performanceService.getManagerTeam(req.user.sub_userid, req.user.company_id); }

  @Get('hr/dashboard')
  @UseGuards(RolesGuard) @Roles(...HR)
  @ApiOperation({ summary: 'HR: Performance dashboard' })
  getHrDashboard(@Req() req: any) { return this.performanceService.getHrDashboard(req.user.company_id); }

  @Get('hr/approvals')
  @UseGuards(RolesGuard) @Roles(...HR_ONLY)
  @ApiOperation({ summary: 'HR: Approval inbox' })
  @ApiQuery({ name: 'tab', required: false })
  getHrApprovals(@Req() req: any, @Query('tab') tab?: string) { return this.performanceService.getHrApprovals(req.user.company_id, tab); }

  @Patch('hr/approvals/:id/approve')
  @UseGuards(RolesGuard) @Roles(...HR_ONLY)
  @ApiOperation({ summary: 'HR: Approve item' })
  approveHrItem(@Param('id') id: string, @Req() req: any, @Body() dto: ApproveItemDto) { return this.performanceService.approveHrItem(id, req.user.sub_userid, dto); }

  @Patch('hr/approvals/:id/review')
  @UseGuards(RolesGuard) @Roles(...HR_ONLY)
  @ApiOperation({ summary: 'HR: Review item (approve or reject with comment)' })
  reviewHrItem(@Param('id') id: string, @Req() req: any, @Body() dto: ReviewItemDto) { return this.performanceService.reviewHrItem(id, req.user.sub_userid, dto); }

  // ── Activity Logs ─────────────────────────────────────────────────────────
  @Get('activity-logs')
  @UseGuards(RolesGuard) @Roles(...HR_ONLY, ...SA)
  @ApiOperation({ summary: 'HR/SA: Activity logs' })
  @ApiQuery({ name: 'page', required: false }) @ApiQuery({ name: 'limit', required: false })
  getActivityLogs(@Req() req: any, @Query('page') page?: string, @Query('limit') limit?: string) { return this.performanceService.getActivityLogs(req.user.company_id, page ? parseInt(page) : 1, limit ? parseInt(limit) : 50); }

  // ── Self-Assessments ──────────────────────────────────────────────────────
  @Get('self-assessment/my')
  @UseGuards(RolesGuard) @Roles(...EMPLOYEE)
  @ApiOperation({ summary: 'Employee: Get my self-assessment for active cycle' })
  getMySelfAssessment(@Req() req: any) { return this.performanceService.getMySelfAssessment(req.user.sub_userid, req.user.company_id); }

  @Post('self-assessment')
  @UseGuards(RolesGuard) @Roles(...EMPLOYEE)
  @ApiOperation({ summary: 'Employee: Submit or update self-assessment' })
  createOrUpdateSelfAssessment(@Req() req: any, @Body() dto: CreateSelfAssessmentDto) { return this.performanceService.createOrUpdateSelfAssessment(req.user.sub_userid, req.user.company_id, dto); }

  @Get('self-assessment/user/:user_id')
  @UseGuards(RolesGuard) @Roles(...MANAGER)
  @ApiOperation({ summary: 'Manager: View team member self-assessment' })
  getSelfAssessmentByUser(@Param('user_id') targetUserId: string, @Req() req: any) { return this.performanceService.getSelfAssessmentByUser(targetUserId, req.user.company_id); }

  // ── Rating Labels ─────────────────────────────────────────────────────────
  @Get('settings/labels')
  @ApiOperation({ summary: 'Any authenticated user: Get rating scale labels' })
  getRatingLabels(@Req() req: any) { return this.performanceService.getRatingLabels(req.user.company_id); }
}
