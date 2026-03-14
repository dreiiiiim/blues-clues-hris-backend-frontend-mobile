import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

// Role names must match exactly what is stored in the `role` table
const HR_AND_ABOVE = [
  'Admin',
  'System Admin',
  'HR Officer',
  'HR Recruiter',
  'HR Interviewer',
  'Manager',
];
const ADMIN_ONLY = ['Admin', 'System Admin'];

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('company/me')
  @UseGuards(RolesGuard)
  @Roles(...HR_AND_ABOVE)
  getMyCompany(@Req() req: any) {
    return this.usersService.getCompanyInfo(req.user.company_id);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(...HR_AND_ABOVE)
  findAll(@Req() req: any) {
    return this.usersService.findAll(req.user.company_id);
  }

  @Get('roles')
  @UseGuards(RolesGuard)
  @Roles(...HR_AND_ABOVE)
  getRoles(@Req() req: any) {
    return this.usersService.getRoles(req.user.company_id);
  }

  @UseGuards(RolesGuard)
  @Roles(...ADMIN_ONLY)
  @Post('departments')
  async createDepartment(
    @Body('department_name') name: string,
    @Req() req: any,
  ) {
    if (!name?.trim())
      throw new BadRequestException('Department name is required.');
    return this.usersService.createDepartment(name.trim(), req.user.company_id);
  }

  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles(...HR_AND_ABOVE)
  stats(@Req() req: any) {
    return this.usersService.stats(req.user.company_id);
  }

  @Get('departments')
  @UseGuards(RolesGuard)
  @Roles(...HR_AND_ABOVE)
  getDepartments(@Req() req: any) {
    return this.usersService.getDepartments(req.user.company_id);
  }

  @Get('companies')
  @UseGuards(RolesGuard)
  @Roles(...ADMIN_ONLY)
  getCompanies(@Req() req: any) {
    return this.usersService.getCompanies(req.user.company_id);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(...HR_AND_ABOVE)
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.usersService.findOne(id, req.user.company_id);
  }

  @UseGuards(RolesGuard)
  @Roles(...ADMIN_ONLY)
  @Post()
  create(@Body() createUserDto: CreateUserDto, @Req() req: any) {
    const companyId = createUserDto.company_id ?? req.user.company_id;
    if (!companyId)
      throw new BadRequestException('Your account has no company assignment.');
    return this.usersService.create(
      createUserDto,
      companyId,
      req.user.sub_userid,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(...ADMIN_ONLY)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Req() req: any,
  ) {
    return this.usersService.update(
      id,
      updateUserDto,
      req.user.company_id,
      req.user.sub_userid,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(...ADMIN_ONLY)
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.usersService.remove(
      id,
      req.user.company_id,
      req.user.sub_userid,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(...ADMIN_ONLY)
  @Patch(':id/resend-invite')
  async resendInvite(@Param('id') id: string, @Req() req: any) {
    return this.usersService.resendInvite(
      id,
      req.user.company_id ?? '',
      req.user.sub_userid,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(...ADMIN_ONLY)
  @Patch(':id/reactivate')
  async reactivate(@Param('id') id: string, @Req() req: any) {
    return this.usersService.reactivate(
      id,
      req.user.company_id,
      req.user.sub_userid,
    );
  }
}
