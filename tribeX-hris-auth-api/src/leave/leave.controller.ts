import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { LeaveService } from './leave.service';
import { FileLeaveRequestDto } from './dto/file-leave-request.dto';
import { ReviewLeaveRequestDto } from './dto/review-leave-request.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';

const HR_AND_ABOVE = [
  'Admin',
  'System Admin',
  'HR Officer',
  'HR Recruiter',
  'HR Interviewer',
  'Manager',
];

@ApiTags('Leave')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('leave')
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  // ── EMPLOYEE ROUTES ──────────────────────────────────────────

  @Get('balances')
  @ApiOperation({ summary: 'Employee: Get own leave balances' })
  @ApiOperation({
    summary: 'Get my leave balances for the current year',
    description: 'Returns leave balances (Vacation, Sick, Emergency, Personal) for the employee',
  })
  getMyBalances(@Req() req: AuthenticatedRequest) {
    return this.leaveService.getMyLeaveBalances(
      req.user.sub_userid,
      req.user.company_id,
    );
  }

  @Post('requests')
  @HttpCode(201)
  @ApiOperation({ summary: 'Employee: File a leave request' })
  @ApiOperation({
    summary: 'File a new leave request',
    description: 'Employees submit leave requests for manager/HR approval',
  })
  fileLeaveRequest(
    @Req() req: AuthenticatedRequest,
    @Body() dto: FileLeaveRequestDto,
  ) {
    return this.leaveService.fileLeaveRequest(
      req.user.sub_userid,
      req.user.company_id,
      dto,
    );
  }

  @Get('requests/me')
  @ApiOperation({ summary: 'Employee: Get own leave request history' })
  @ApiOperation({
    summary: 'Get my leave request history',
    description: 'Returns all leave requests submitted by the employee',
  })
  getMyLeaveRequests(@Req() req: AuthenticatedRequest) {
    return this.leaveService.getMyLeaveRequests(req.user.sub_userid);
  }

  @Patch('requests/:requestId/cancel')
  @ApiOperation({ summary: 'Employee: Cancel a pending leave request (instant)' })
  cancelPendingLeave(
    @Param('requestId') requestId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.leaveService.cancelPendingLeave(requestId, req.user.sub_userid);
  }

  @Patch('requests/:requestId/request-revocation')
  @ApiOperation({ summary: 'Employee: Request revocation of an approved leave (future dates only)' })
  requestLeaveRevocation(
    @Param('requestId') requestId: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: { reason: string },
  ) {
    return this.leaveService.requestLeaveRevocation(requestId, req.user.sub_userid, body.reason);
  }

  @Patch('requests/:requestId/review-revocation')
  @UseGuards(RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @ApiOperation({ summary: 'HR: Approve or reject an employee revocation request' })
  reviewLeaveRevocation(
    @Param('requestId') requestId: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: { action: 'approve' | 'reject' },
  ) {
    return this.leaveService.reviewLeaveRevocation(
      requestId,
      req.user.sub_userid,
      req.user.company_id,
      body.action,
    );
  }

  @Post('upload-attachment')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiOperation({ summary: 'Employee: Upload leave proof attachment (image or PDF)' })
  uploadAttachment(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.leaveService.uploadLeaveAttachment(req.user.sub_userid, file);
  }

  // ── HR ROUTES ────────────────────────────────────────────────

  @Get('requests')
  @UseGuards(RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @ApiOperation({ summary: 'HR: Get all leave requests for company' })
  @ApiQuery({ name: 'status', required: false, example: 'Pending' })
  getLeaveRequests(
    @Req() req: AuthenticatedRequest,
    @Query('status') status?: string,
  ) {
    return this.leaveService.getLeaveRequests(req.user.company_id, status);
  }

  @Patch('requests/:requestId')
  @UseGuards(RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @ApiOperation({ summary: 'HR: Approve or reject a leave request' })
  reviewLeaveRequest(
    @Param('requestId') requestId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: ReviewLeaveRequestDto,
  ) {
    return this.leaveService.reviewLeaveRequest(
      requestId,
      req.user.sub_userid,
      req.user.company_id,
      dto,
    );
  }
}
