import {
  Controller,
  Post,
  Patch,
  Get,
  Put,
  Param,
  Body,
  Req,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { TimekeepingService } from './timekeeping.service';
import { TimePunchDto } from './dto/time-punch.dto';
import { ReportAbsenceDto } from './dto/report-absence.dto';
import { UpsertScheduleDto } from './dto/upsert-schedule.dto';
import { BulkScheduleDto } from './dto/bulk-schedule.dto';
import { ScheduleEffectiveDateDto } from './dto/schedule-effective-date.dto';
import { CompanyDefaultScheduleDto } from './dto/company-default-schedule.dto';
import { ReviewAbsenceDto } from './dto/review-absence.dto';
import { EditAttendanceDto } from './dto/edit-attendance.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

// Keep aligned with your existing user roles
const HR_AND_ABOVE = [
  'Admin',
  'System Admin',
  'HR Officer',
  'HR Recruiter',
  'HR Interviewer',
  'Manager',
];

// Roles that can create/edit schedules
const SCHEDULE_MANAGERS = ['System Admin', 'HR Officer', 'HR Recruiter', 'HR Interviewer'];

@ApiTags('Timekeeping')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('timekeeping')
export class TimekeepingController {
  constructor(private readonly timekeepingService: TimekeepingService) {}

  @Post('time-in')
  @ApiOperation({
    summary: 'Employee: Clock in',
    description:
      'Records a clock-in punch with GPS coordinates. ' +
      'Rejects duplicate clock-in without a matching clock-out. ' +
      'Requires an assigned work schedule.',
  })
  timeIn(@Body() dto: TimePunchDto, @Req() req: any) {
    return this.timekeepingService.timeIn(req.user.sub_userid, dto, req);
  }

  @Post('time-out')
  @ApiOperation({
    summary: 'Employee: Clock out',
    description:
      'Records a clock-out punch with GPS coordinates. ' +
      'Rejects if no prior clock-in exists for the current shift/day.',
  })
  timeOut(@Body() dto: TimePunchDto, @Req() req: any) {
    return this.timekeepingService.timeOut(req.user.sub_userid, dto, req);
  }

  @Post('report-absence')
  @ApiOperation({
    summary: 'Employee: Report an absence with reason',
    description:
      'Records an absence for today with a specified reason. ' +
      'Rejected if the employee has already clocked in or already reported absence today.',
  })
  reportAbsence(@Body() dto: ReportAbsenceDto, @Req() req: any) {
    return this.timekeepingService.reportAbsence(req.user.sub_userid, dto, req);
  }

  @Get('absence-requests')
  @UseGuards(RolesGuard)
  @Roles(...SCHEDULE_MANAGERS)
  @ApiOperation({
    summary: 'HR/System Admin: List employee absence requests',
    description:
      'Returns absence entries with review metadata. Defaults to pending if status filter is omitted.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    example: 'PENDING',
    description: 'Optional status filter (PENDING, APPROVED, DENIED, ABSENT).',
  })
  getAbsenceRequests(@Req() req: any, @Query('status') status?: string) {
    return this.timekeepingService.getAbsenceRequests(req.user.company_id, status);
  }

  @Patch('absence-requests/:logId/review')
  @UseGuards(RolesGuard)
  @Roles(...SCHEDULE_MANAGERS)
  @ApiOperation({
    summary: 'HR/System Admin: Approve or deny an absence request',
  })
  @ApiParam({ name: 'logId', description: 'attendance_time_logs.log_id for absence record' })
  reviewAbsenceRequest(
    @Param('logId') logId: string,
    @Body() dto: ReviewAbsenceDto,
    @Req() req: any,
  ) {
    return this.timekeepingService.reviewAbsenceRequest(
      logId,
      dto,
      req.user.company_id,
      req.user.sub_userid,
    );
  }

  @Patch('attendance/:userId/:date')
  @UseGuards(RolesGuard)
  @Roles(...SCHEDULE_MANAGERS)
  @ApiOperation({
    summary: 'HR/System Admin: Edit employee time-in/time-out for a given date',
  })
  @ApiParam({ name: 'userId', description: 'user_id of the target employee' })
  @ApiParam({ name: 'date', description: 'Date in YYYY-MM-DD format', example: '2026-04-24' })
  editAttendance(
    @Param('userId') userId: string,
    @Param('date') date: string,
    @Body() dto: EditAttendanceDto,
    @Req() req: any,
  ) {
    return this.timekeepingService.editAttendanceForDate(
      userId,
      date,
      dto,
      req.user.company_id,
      req.user.sub_userid,
    );
  }

  @Post('auto-mark-absent')
  @UseGuards(RolesGuard)
  @Roles('System Admin', 'HR Officer', 'HR Recruiter', 'HR Interviewer')
  @ApiOperation({
    summary: 'System: Auto-mark absent employees',
    description:
      'Marks all employees scheduled for today as absent if they have ' +
      'no clock-in and did not self-report an absence. ' +
      'Intended to be called at end of business day (or by a cron scheduler). ' +
      'Safe to call multiple times — duplicate absences are skipped. ' +
      'Restricted to HR/System Admin roles.',
  })
  autoMarkAbsent() {
    return this.timekeepingService.autoMarkAbsentEmployees();
  }

  @Get('my-status')
  @ApiOperation({
    summary: "Employee: Get today's punch status",
    description:
      "Returns the employee's current punch status for today, " +
      'including first clock-in and latest clock-out if present.',
  })
  getMyStatus(@Req() req: any) {
    return this.timekeepingService.getMyStatus(req.user.sub_userid);
  }

  @Get('my-timesheet')
  @ApiOperation({
    summary: 'Employee: View own timesheet',
    description:
      "Returns the authenticated employee's punches grouped by date. " +
      'Can be filtered by from/to date.',
  })
  @ApiQuery({ name: 'from', required: false, example: '2026-03-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-03-31' })
  getMyTimesheet(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.timekeepingService.getMyTimesheet(
      req.user.sub_userid,
      from,
      to,
    );
  }

  @Get('employees')
  @UseGuards(RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @ApiOperation({ summary: 'HR/Manager: List employees eligible for timekeeping' })
  getEmployees(@Req() req: any, @Query('asOf') asOf?: string) {
    return this.timekeepingService.getEmployeeUsers(req.user.company_id, asOf);
  }

  @Get('timesheets')
  @UseGuards(RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @ApiOperation({
    summary: 'HR/Manager: View all employee timesheets',
    description:
      "Returns all attendance logs scoped to the requester's company. " +
      'Includes employee details where available.',
  })
  @ApiQuery({ name: 'from', required: false, example: '2026-03-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-03-31' })
  getAllTimesheets(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.timekeepingService.getAllTimesheets(req.user.company_id, from, to);
  }

  @Get('timesheets/:userId/:date')
  @UseGuards(RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @ApiOperation({
    summary: "HR/Manager: View one employee's punches for a specific date",
    description:
      'Returns exact clock-in/clock-out records, GPS, IP, and status info ' +
      'for a specific employee on a given date.',
  })
  @ApiParam({
    name: 'userId',
    description: 'user_id of the target employee',
    example: '8c7ef5ea-1111-2222-3333-444455556666',
  })
  @ApiParam({
    name: 'date',
    description: 'Date in YYYY-MM-DD format',
    example: '2026-03-10',
  })
  getEmployeeDetail(
    @Param('userId') userId: string,
    @Param('date') date: string,
    @Req() req: any,
  ) {
    return this.timekeepingService.getEmployeeDetail(
      userId,
      date,
      req.user.company_id,
    );
  }

  // ─── Schedule CRUD ──────────────────────────────────────────────────────────

  @Get('my-schedule')
  @ApiOperation({ summary: 'Employee: Get own work schedule' })
  getMySchedule(@Req() req: any) {
    return this.timekeepingService.getMySchedule(req.user.sub_userid);
  }

  @Get('my-stats')
  @ApiOperation({ summary: 'Employee: Get attendance stats for a date range' })
  @ApiQuery({ name: 'from', required: true, example: '2026-04-01' })
  @ApiQuery({ name: 'to', required: true, example: '2026-04-30' })
  getMyStats(
    @Req() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.timekeepingService.getMyStats(req.user.sub_userid, from, to);
  }

  @Get('schedules')
  @UseGuards(RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @ApiOperation({ summary: 'HR/Manager: Get all employees with their assigned schedules' })
  getAllSchedules(@Req() req: any) {
    return this.timekeepingService.getAllSchedules(req.user.company_id);
  }

  @Get('schedules/company-default')
  @UseGuards(RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @ApiOperation({ summary: 'HR/System Admin: Get the company default schedule for new employees' })
  getCompanyDefaultSchedule(@Req() req: any) {
    return this.timekeepingService.getCompanyDefaultSchedule(req.user.company_id);
  }

  @Put('schedules/company-default')
  @UseGuards(RolesGuard)
  @Roles(...SCHEDULE_MANAGERS)
  @ApiOperation({ summary: 'HR/System Admin: Create or update the company default schedule for new employees' })
  upsertCompanyDefaultSchedule(
    @Body() dto: CompanyDefaultScheduleDto,
    @Req() req: any,
  ) {
    return this.timekeepingService.upsertCompanyDefaultSchedule(
      dto,
      req.user.company_id,
      req.user.sub_userid,
    );
  }

  @Post('schedules/company-default/backfill')
  @UseGuards(RolesGuard)
  @Roles(...SCHEDULE_MANAGERS)
  @ApiOperation({ summary: 'HR/System Admin: Apply company default schedule to unscheduled employees without a department' })
  backfillCompanyDefaultSchedule(@Req() req: any) {
    return this.timekeepingService.backfillCompanyDefaultSchedule(
      req.user.company_id,
      req.user.sub_userid,
    );
  }

  @Get('employees/:userId/schedule')
  @UseGuards(RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @ApiOperation({ summary: 'HR/Manager: Get a specific employee\'s schedule' })
  @ApiParam({ name: 'userId', description: 'user_id of the target employee' })
  getEmployeeSchedule(@Param('userId') userId: string, @Req() req: any) {
    return this.timekeepingService.getEmployeeSchedule(userId, req.user.company_id);
  }

  @Put('employees/:userId/schedule')
  @UseGuards(RolesGuard)
  @Roles(...SCHEDULE_MANAGERS)
  @ApiOperation({ summary: 'HR/System Admin: Create or update an employee\'s schedule' })
  @ApiParam({ name: 'userId', description: 'user_id of the target employee' })
  upsertSchedule(
    @Param('userId') userId: string,
    @Body() dto: UpsertScheduleDto,
    @Req() req: any,
  ) {
    return this.timekeepingService.upsertEmployeeSchedule(userId, dto, req.user.company_id, req.user.sub_userid);
  }

  @Post('employees/:userId/schedule/reset-department')
  @UseGuards(RolesGuard)
  @Roles(...SCHEDULE_MANAGERS)
  @ApiOperation({
    summary:
      "HR/System Admin: Reset an employee's custom schedule back to the department's standard schedule",
  })
  @ApiParam({ name: 'userId', description: 'user_id of the target employee' })
  resetScheduleToDepartment(
    @Param('userId') userId: string,
    @Body() dto: ScheduleEffectiveDateDto,
    @Req() req: any,
  ) {
    return this.timekeepingService.resetEmployeeScheduleToDepartment(
      userId,
      dto,
      req.user.company_id,
      req.user.sub_userid,
    );
  }

  @Post('employees/:userId/schedule/reset-company-default')
  @UseGuards(RolesGuard)
  @Roles(...SCHEDULE_MANAGERS)
  @ApiOperation({
    summary:
      "HR/System Admin: Reset an employee's custom schedule back to the whole company default schedule",
  })
  @ApiParam({ name: 'userId', description: 'user_id of the target employee' })
  resetScheduleToCompanyDefault(
    @Param('userId') userId: string,
    @Body() dto: ScheduleEffectiveDateDto,
    @Req() req: any,
  ) {
    return this.timekeepingService.resetEmployeeScheduleToCompanyDefault(
      userId,
      dto,
      req.user.company_id,
      req.user.sub_userid,
    );
  }

  @Post('schedules/bulk')
  @UseGuards(RolesGuard)
  @Roles(...SCHEDULE_MANAGERS)
  @ApiOperation({ summary: 'HR/System Admin: Bulk-assign a schedule to company, department, or selected employees' })
  bulkAssignSchedule(@Body() dto: BulkScheduleDto, @Req() req: any) {
    return this.timekeepingService.bulkAssignSchedule(dto, req.user.company_id, req.user.sub_userid);
  }
}
