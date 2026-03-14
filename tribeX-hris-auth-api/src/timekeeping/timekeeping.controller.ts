import {
  Controller,
  Post,
  Get,
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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

// Mirrors the role constants used in users.controller.ts
const HR_AND_ABOVE = [
  'Admin',
  'System Admin',
  'HR Officer',
  'HR Recruiter',
  'HR Interviewer',
  'Manager',
];

@ApiTags('Timekeeping')
@UseGuards(JwtAuthGuard) // All timekeeping routes require a valid JWT
@Controller('timekeeping')
export class TimekeepingController {
  constructor(private readonly timekeepingService: TimekeepingService) {}

  // --- EMPLOYEE ROUTES ---

  @Post('time-in')
  @ApiOperation({
    summary: 'Employee: Clock in',
    description:
      'Records a TIME_IN punch with GPS coordinates. ' +
      'Rejects if already timed in today without a time-out. ' +
      'GPS coordinates are required.',
  })
  timeIn(@Body() dto: TimePunchDto, @Req() req: any) {
    // user_id and company_id always come from the JWT, never from the request body
    return this.timekeepingService.timeIn(
      req.user.sub_userid,
      req.user.company_id,
      dto,
      req,
    );
  }

  @Post('time-out')
  @ApiOperation({
    summary: 'Employee: Clock out',
    description:
      'Records a TIME_OUT punch with GPS coordinates. ' +
      'Rejects if no TIME_IN exists for today.',
  })
  timeOut(@Body() dto: TimePunchDto, @Req() req: any) {
    return this.timekeepingService.timeOut(
      req.user.sub_userid,
      req.user.company_id,
      dto,
      req,
    );
  }

  @Get('my-status')
  @ApiOperation({
    summary: "Employee: Get today's punch status",
    description:
      "Returns the employee's time-in and time-out for today, " +
      'plus current status (TIME_IN | TIME_OUT | null = not yet punched).',
  })
  getMyStatus(@Req() req: any) {
    return this.timekeepingService.getMyStatus(req.user.sub_userid);
  }

  @Get('my-timesheet')
  @ApiOperation({
    summary: 'Employee: View own timesheet',
    description:
      "Returns the authenticated employee's punches grouped by date. " +
      'Optionally filter by date range using from and to (YYYY-MM-DD).',
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

  // --- HR / MANAGER ROUTES ---

  @Get('timesheets')
  @UseGuards(RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @ApiOperation({
    summary: 'HR/Manager: View all employee timesheets',
    description:
      "Returns all punch records scoped to the requester's company. " +
      'Includes employee name and ID via join on user_profile. ' +
      'Optionally filter by date range using from and to (YYYY-MM-DD).',
  })
  @ApiQuery({ name: 'from', required: false, example: '2026-03-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-03-31' })
  getAllTimesheets(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    // company_id always from JWT — HR can only see their own company's records
    return this.timekeepingService.getAllTimesheets(
      req.user.company_id,
      from,
      to,
    );
  }

  @Get('timesheets/:userId/:date')
  @UseGuards(RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @ApiOperation({
    summary: "HR/Manager: View one employee's punches for a specific date",
    description:
      'Returns exact TIME_IN / TIME_OUT timestamps and GPS coordinates for a ' +
      'specific employee on a specific date. This is the detail view from the ' +
      'sequence diagram (Step 2). GPS/IP location is included.',
  })
  @ApiParam({
    name: 'userId',
    description: 'user_id of the target employee (UUID)',
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
    // company_id from JWT ensures HR can only query employees in their own company
    return this.timekeepingService.getEmployeeDetail(
      userId,
      date,
      req.user.company_id,
    );
  }
}
