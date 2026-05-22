import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus, UploadedFile, UseInterceptors, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { OnboardingService } from './onboarding.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { AssignTemplateDto } from './dto/assign-template.dto';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('System Admin Onboarding')
@ApiBearerAuth()
@Controller('onboarding/system-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminOnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('templates')
  @Roles('System Admin')
  @ApiOperation({ summary: 'Create a new onboarding template with items' })
  createTemplate(@Body() dto: CreateTemplateDto) {
    return this.onboardingService.createTemplate(dto);
  }

  @Get('templates')
  @Roles('System Admin')
  @ApiOperation({ summary: 'List all onboarding templates with their items' })
  getAllTemplates() {
    return this.onboardingService.getAllTemplates();
  }

  @Post('assign')
  @Roles('System Admin', 'HR Officer')
  @ApiOperation({ summary: 'Assign a template to an employee, creating their onboarding session' })
  assignTemplate(@Body() dto: AssignTemplateDto) {
    return this.onboardingService.assignTemplate(dto);
  }

  @Get('positions')
  @Roles('System Admin')
  @ApiOperation({ summary: 'List all job positions with department names' })
  getPositions() {
    return this.onboardingService.getAllPositions();
  }

  @Post('positions')
  @Roles('System Admin')
  @ApiOperation({ summary: 'Create a new job position' })
  createPosition(@Body() body: { department_id: string; position_name: string }) {
    return this.onboardingService.createPosition(body);
  }

  @Get('departments')
  @Roles('System Admin', 'HR Officer')
  @ApiOperation({ summary: 'List all departments' })
  getDepartments() {
    return this.onboardingService.getDepartments();
  }

  @Post('template-assets/images')
  @Roles('System Admin')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Upload an image asset for onboarding template rich content' })
  uploadTemplateImage(@UploadedFile() file: Express.Multer.File) {
    return this.onboardingService.uploadTemplateImage(file);
  }

  @Post('templates/:templateId/items')
  @Roles('System Admin')
  @ApiOperation({ summary: 'Add a new item to an existing template' })
  addTemplateItem(
    @Param('templateId') templateId: string,
    @Body() body: { type: string; tab_category: string; title: string; description?: string; is_required: boolean; rich_content?: string },
  ) {
    return this.onboardingService.addTemplateItem(templateId, body);
  }

  @Patch('template-items/:itemId')
  @Roles('System Admin')
  @ApiOperation({ summary: 'Update a template item (title, description, is_required, rich_content)' })
  updateTemplateItem(
    @Param('itemId') itemId: string,
    @Body() body: { title?: string; description?: string; is_required?: boolean; rich_content?: string },
  ) {
    return this.onboardingService.updateTemplateItem(itemId, body);
  }

  @Delete('template-items/:itemId')
  @Roles('System Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a template item' })
  deleteTemplateItem(@Param('itemId') itemId: string) {
    return this.onboardingService.deleteTemplateItem(itemId);
  }

  // ── Training Video Management ────────────────────────────────────────────────

  @Post('training-videos/upload')
  @Roles('System Admin')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Upload a training video file to Supabase storage and return its public URL' })
  uploadTrainingVideo(@UploadedFile() file: Express.Multer.File) {
    return this.onboardingService.uploadTrainingVideo(file);
  }

  @Post('training-videos')
  @Roles('System Admin')
  @ApiOperation({ summary: 'Create a new onboarding training video' })
  createTrainingVideo(@Body() dto: CreateVideoDto, @Req() req: any) {
    return this.onboardingService.createTrainingVideo(req.user.company_id, dto, req.user.sub_userid);
  }

  @Get('training-videos')
  @Roles('System Admin')
  @ApiOperation({ summary: 'List training videos for the company, optionally filtered by templateId' })
  getTrainingVideos(@Req() req: any, @Query('templateId') templateId?: string) {
    return this.onboardingService.getTrainingVideos(req.user.company_id, templateId);
  }

  @Patch('training-videos/:videoId')
  @Roles('System Admin')
  @ApiOperation({ summary: 'Update a training video (title, description, url, order, active status)' })
  updateTrainingVideo(
    @Param('videoId') videoId: string,
    @Body() dto: UpdateVideoDto,
    @Req() req: any,
  ) {
    return this.onboardingService.updateTrainingVideo(videoId, req.user.company_id, dto);
  }

  @Delete('training-videos/:videoId')
  @Roles('System Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a training video' })
  deleteTrainingVideo(@Param('videoId') videoId: string, @Req() req: any) {
    return this.onboardingService.deleteTrainingVideo(videoId, req.user.company_id);
  }
}
