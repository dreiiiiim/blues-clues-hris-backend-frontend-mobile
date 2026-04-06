import { Injectable, BadRequestException, NotFoundException, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { MailService } from '../mail/mail.service';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { SaveProfileDto } from './dto/save-profile.dto';
import { AssignTemplateDto } from './dto/assign-template.dto';
import { AddRemarkDto } from './dto/add-remark.dto';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  // =========================================================
  // 1. EMPLOYEE METHODS (Ty's domain)
  // =========================================================

  async getMySession(accountId: string) {
    const supabase = this.supabaseService.getClient();

    // Get the session
    const { data: session, error: sessionErr } = await supabase
      .from('onboarding_sessions')
      .select('*')
      .eq('account_id', accountId)
      .order('deadline_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sessionErr) throw new BadRequestException(sessionErr.message);
    if (!session) return null;

    // Get template name
    const { data: template } = await supabase
      .from('onboarding_templates')
      .select('name')
      .eq('template_id', session.template_id)
      .single();

    // Get employee name
    const { data: user } = await supabase
      .from('user_profile')
      .select('first_name, last_name, employee_id')
      .eq('user_id', accountId)
      .single();

    // Get all onboarding items joined with template_items
    const { data: items, error: itemsErr } = await supabase
      .from('onboarding_items')
      .select(`
        onboarding_item_id,
        session_id,
        template_item_id,
        status,
        is_requested,
        delivery_method,
        delivery_address,
        template_items (
          item_id,
          type,
          tab_category,
          title,
          description,
          rich_content,
          is_required
        )
      `)
      .eq('session_id', session.session_id);

    if (itemsErr) throw new BadRequestException(itemsErr.message);

    // Get all document submissions for this session's items
    const itemIds = (items || []).map(i => i.onboarding_item_id);
    let submissions: any[] = [];
    if (itemIds.length > 0) {
      const { data } = await supabase
        .from('onboarding_documents')
        .select('*')
        .in('onboarding_item_id', itemIds);
      submissions = data || [];
    }

    // Get remarks
    const { data: remarks } = await supabase
      .from('onboarding_remarks')
      .select(`
        remark_id,
        session_id,
        author_id,
        tab_tag,
        remark_text,
        created_at
      `)
      .eq('session_id', session.session_id)
      .order('created_at', { ascending: true });

    // Get author names for remarks
    const authorIds = [...new Set((remarks || []).map(r => r.author_id))];
    let authorMap: Record<string, string> = {};
    if (authorIds.length > 0) {
      const { data: authors } = await supabase
        .from('user_profile')
        .select('user_id, first_name, last_name')
        .in('user_id', authorIds);
      for (const a of authors || []) {
        authorMap[a.user_id] = `${a.first_name} ${a.last_name}`;
      }
    }

    // Get profile (employee_staging)
    const { data: profile } = await supabase
      .from('employee_staging')
      .select('*')
      .eq('session_id', session.session_id)
      .maybeSingle();

    // Group items by tab_category
    const grouped = {
      documents: [] as any[],
      tasks: [] as any[],
      equipment: [] as any[],
      hr_forms: [] as any[],
      profile_items: [] as any[],
      welcome: [] as any[],
    };

    for (const item of items || []) {
      const ti = item.template_items as any;
      const category = ti.tab_category as string;
      const itemSubmissions = submissions.filter(s => s.onboarding_item_id === item.onboarding_item_id);

      const base = {
        onboarding_item_id: item.onboarding_item_id,
        title: ti.title,
        status: item.status,
        is_required: ti.is_required,
        type: ti.type,
        description: ti.description,
        rich_content: ti.rich_content,
      };

      if (category === 'documents') {
        grouped.documents.push({
          ...base,
          files: itemSubmissions.filter(s => !s.is_proof_of_receipt),
          upload_history: itemSubmissions.filter(s => !s.is_proof_of_receipt),
        });
      } else if (category === 'tasks') {
        grouped.tasks.push(base);
      } else if (category === 'equipment') {
        grouped.equipment.push({
          ...base,
          is_requested: item.is_requested,
          delivery_method: item.delivery_method,
          delivery_address: item.delivery_address,
          proof_of_receipt: itemSubmissions.filter(s => s.is_proof_of_receipt),
        });
      } else if (category === 'hr_forms') {
        grouped.hr_forms.push(base);
      } else if (category === 'profile') {
        grouped.profile_items.push(base);
      } else if (category === 'welcome') {
        grouped.welcome.push(base);
      }
    }

    // Format remarks
    const formattedRemarks = (remarks || []).map(r => ({
      remark_id: r.remark_id,
      tab_tag: r.tab_tag,
      remark_text: r.remark_text,
      created_at: r.created_at,
      author: authorMap[r.author_id] || 'Unknown',
    }));

    return {
      session_id: session.session_id,
      account_id: session.account_id,
      template_id: session.template_id,
      template_name: template?.name || null,
      employee_name: user ? `${user.first_name} ${user.last_name}` : null,
      employee_id: user?.employee_id || null,
      assigned_position: session.assigned_position,
      assigned_department: session.assigned_department,
      status: session.status,
      progress_percentage: session.progress_percentage,
      deadline_date: session.deadline_date,
      completed_at: session.completed_at,
      documents: grouped.documents,
      tasks: grouped.tasks,
      equipment: grouped.equipment,
      hr_forms: grouped.hr_forms,
      profile_items: grouped.profile_items,
      welcome: grouped.welcome,
      profile: profile || null,
      remarks: formattedRemarks,
    };
  }

  async uploadDocument(
    onboardingItemId: string,
    file: Express.Multer.File,
    isProofOfReceipt: boolean = false,
  ) {
    if (!file) throw new BadRequestException('No file uploaded.');

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only PDF, JPG, and PNG allowed.');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('File is too large. Maximum size is 5MB.');
    }

    const supabase = this.supabaseService.getClient();

    // Verify the item exists
    const { data: item, error: itemErr } = await supabase
      .from('onboarding_items')
      .select('onboarding_item_id, session_id')
      .eq('onboarding_item_id', onboardingItemId)
      .single();

    if (itemErr || !item) throw new NotFoundException('Onboarding item not found.');

    // Upload to Supabase Storage
    const filePath = `${item.session_id}/${onboardingItemId}/${Date.now()}_${file.originalname}`;
    const { error: uploadErr } = await supabase.storage
      .from('onboarding-documents')
      .upload(filePath, file.buffer, { contentType: file.mimetype });

    if (uploadErr) throw new BadRequestException(`Upload failed: ${uploadErr.message}`);

    // Generate signed URL (valid for 7 days)
    const { data: urlData } = await supabase.storage
      .from('onboarding-documents')
      .createSignedUrl(filePath, 60 * 60 * 24 * 7);

    const fileUrl = urlData?.signedUrl || filePath;

    // Insert submission record
    const { data: submission, error: subErr } = await supabase
      .from('onboarding_documents')
      .insert({
        submission_id: crypto.randomUUID(),
        onboarding_item_id: onboardingItemId,
        file_url: fileUrl,
        file_name: file.originalname,
        file_size_bytes: file.size,
        file_type: file.mimetype,
        is_proof_of_receipt: isProofOfReceipt,
        status: 'uploaded',
        uploaded_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (subErr) throw new BadRequestException(subErr.message);

    // Update item status to submitted
    await supabase
      .from('onboarding_items')
      .update({ status: 'submitted' })
      .eq('onboarding_item_id', onboardingItemId);

    // Recalculate progress
    await this.recalculateProgress(item.session_id);

    this.logger.log(`File uploaded for item: ${onboardingItemId}`);
    return submission;
  }

  async confirmTask(onboardingItemId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: item, error } = await supabase
      .from('onboarding_items')
      .select('onboarding_item_id, session_id')
      .eq('onboarding_item_id', onboardingItemId)
      .single();

    if (error || !item) throw new NotFoundException('Onboarding item not found.');

    await supabase
      .from('onboarding_items')
      .update({ status: 'confirmed' })
      .eq('onboarding_item_id', onboardingItemId);

    await this.recalculateProgress(item.session_id);

    this.logger.log(`Task confirmed: ${onboardingItemId}`);
    return { message: 'Task confirmed successfully', onboarding_item_id: onboardingItemId, status: 'confirmed' };
  }

  async saveProfile(sessionId: string, dto: SaveProfileDto) {
    const supabase = this.supabaseService.getClient();

    // Check if profile already exists for this session
    const { data: existing } = await supabase
      .from('employee_staging')
      .select('profile_id')
      .eq('session_id', sessionId)
      .maybeSingle();

    let result: any;
    if (existing) {
      const { data, error } = await supabase
        .from('employee_staging')
        .update({ ...dto, status: 'submitted' })
        .eq('session_id', sessionId)
        .select()
        .single();
      if (error) throw new BadRequestException(error.message);
      result = data;
    } else {
      const { data, error } = await supabase
        .from('employee_staging')
        .insert({
          profile_id: crypto.randomUUID(),
          session_id: sessionId,
          ...dto,
          status: 'submitted',
        })
        .select()
        .single();
      if (error) throw new BadRequestException(error.message);
      result = data;
    }

    // Mark profile onboarding items as confirmed so they count toward progress
    const { data: profileItems } = await supabase
      .from('onboarding_items')
      .select('onboarding_item_id, template_items!inner(tab_category)')
      .eq('session_id', sessionId)
      .eq('template_items.tab_category', 'profile');

    if (profileItems && profileItems.length > 0) {
      await supabase
        .from('onboarding_items')
        .update({ status: 'confirmed' })
        .in('onboarding_item_id', profileItems.map(i => i.onboarding_item_id));
    }

    await this.recalculateProgress(sessionId);
    return result;
  }

  async submitForReview(sessionId: string) {
    const supabase = this.supabaseService.getClient();

    await supabase
      .from('onboarding_sessions')
      .update({ status: 'for-review' })
      .eq('session_id', sessionId);

    this.logger.log(`Session ${sessionId} submitted for review`);
    return { message: 'Onboarding submitted for HR review', session_id: sessionId, status: 'for-review' };
  }

  // =========================================================
  // 2. HR METHODS (Kerr's domain)
  // =========================================================

  async getAllOnboardingSessions() {
    const supabase = this.supabaseService.getClient();

    const { data: sessions, error } = await supabase
      .from('onboarding_sessions')
      .select(`
        session_id,
        account_id,
        template_id,
        assigned_position,
        assigned_department,
        status,
        progress_percentage,
        deadline_date,
        completed_at
      `)
      .order('deadline_date', { ascending: true });

    if (error) throw new BadRequestException(error.message);

    // Enrich with employee names and template names
    const enriched: any[] = [];
    for (const s of sessions || []) {
      const { data: user } = await supabase
        .from('user_profile')
        .select('first_name, last_name')
        .eq('user_id', s.account_id)
        .single();

      const { data: template } = await supabase
        .from('onboarding_templates')
        .select('name')
        .eq('template_id', s.template_id)
        .single();

      enriched.push({
        ...s,
        employee_name: user ? `${user.first_name} ${user.last_name}` : null,
        template_name: template?.name || null,
      });
    }

    return enriched;
  }

  async getSessionById(sessionId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: session } = await supabase
      .from('onboarding_sessions')
      .select('account_id')
      .eq('session_id', sessionId)
      .single();

    if (!session) throw new NotFoundException('Session not found.');

    // Delegate to getMySession using the account_id
    return this.getMySession(session.account_id);
  }

  async updateItemStatus(onboardingItemId: string, dto: UpdateTaskStatusDto, authorId?: string) {
    const supabase = this.supabaseService.getClient();

    const { data: item, error } = await supabase
      .from('onboarding_items')
      .select('onboarding_item_id, session_id')
      .eq('onboarding_item_id', onboardingItemId)
      .single();

    if (error || !item) throw new NotFoundException('Onboarding item not found.');

    await supabase
      .from('onboarding_items')
      .update({ status: dto.status })
      .eq('onboarding_item_id', onboardingItemId);

    // If there are remarks, save them
    if (dto.remarks) {
      await supabase.from('onboarding_remarks').insert({
        remark_id: crypto.randomUUID(),
        session_id: item.session_id,
        author_id: authorId ?? crypto.randomUUID(),
        tab_tag: dto.tab_tag ?? 'Documents',
        remark_text: dto.remarks,
        created_at: new Date().toISOString(),
      });
    }

    await this.recalculateProgress(item.session_id);

    this.logger.log(`Item ${onboardingItemId} updated to: ${dto.status}`);
    return { message: `Item marked as ${dto.status}`, onboarding_item_id: onboardingItemId, status: dto.status };
  }

  async addRemark(dto: AddRemarkDto, authorId: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('onboarding_remarks')
      .insert({
        remark_id: crypto.randomUUID(),
        session_id: dto.session_id,
        author_id: authorId,
        tab_tag: dto.tab_tag,
        remark_text: dto.remark_text,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async approveSession(sessionId: string) {
    const supabase = this.supabaseService.getClient();

    await supabase
      .from('onboarding_sessions')
      .update({ status: 'approved', completed_at: new Date().toISOString() })
      .eq('session_id', sessionId);

    return { message: 'Onboarding approved', session_id: sessionId, status: 'approved' };
  }

  // =========================================================
  // 3. SYSTEM ADMIN METHODS (Kerr's domain)
  // =========================================================

  async createTemplate(dto: CreateTemplateDto) {
    const supabase = this.supabaseService.getClient();

    // Validate position exists
    const { data: position } = await supabase
      .from('job_positions')
      .select('position_id')
      .eq('position_id', dto.position_id)
      .maybeSingle();

    if (!position) throw new BadRequestException('Invalid position_id: position does not exist');

    // Validate department exists
    const { data: dept } = await supabase
      .from('department')
      .select('department_id')
      .eq('department_id', dto.department_id)
      .maybeSingle();

    if (!dept) throw new BadRequestException('Invalid department_id: department does not exist');

    const templateId = crypto.randomUUID();

    // Insert template
    const { error: templateErr } = await supabase
      .from('onboarding_templates')
      .insert({
        template_id: templateId,
        name: dto.name,
        department_id: dto.department_id,
        position_id: dto.position_id,
        default_deadline_days: dto.default_deadline_days,
        created_at: new Date().toISOString(),
      });

    if (templateErr) throw new BadRequestException(templateErr.message);

    // Insert template items
    const itemRows = dto.items.map(item => ({
      item_id: crypto.randomUUID(),
      template_id: templateId,
      type: item.type,
      tab_category: item.tab_category,
      title: item.title,
      description: item.description || null,
      rich_content: item.rich_content || null,
      is_required: item.is_required,
    }));

    if (itemRows.length > 0) {
      const { error: itemsErr } = await supabase
        .from('template_items')
        .insert(itemRows);
      if (itemsErr) throw new BadRequestException(itemsErr.message);
    }

    this.logger.log(`Template created: ${dto.name}`);
    return { message: 'Template created', template_id: templateId, name: dto.name, items_count: itemRows.length };
  }

  async getAllTemplates() {
    const supabase = this.supabaseService.getClient();

    const { data: templates, error } = await supabase
      .from('onboarding_templates')
      .select(`
        template_id,
        name,
        department_id,
        position_id,
        default_deadline_days,
        created_at,
        template_items (
          item_id,
          type,
          tab_category,
          title,
          description,
          is_required
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);

    // Enrich with position and department names
    const enriched: any[] = [];
    for (const t of templates || []) {
      const { data: pos } = await supabase
        .from('job_positions')
        .select('position_name')
        .eq('position_id', t.position_id)
        .maybeSingle();

      const { data: department } = await supabase
        .from('department')
        .select('department_name')
        .eq('department_id', t.department_id)
        .maybeSingle();

      enriched.push({
        ...t,
        position_name: pos?.position_name || null,
        department_name: department?.department_name || null,
      });
    }

    return enriched;
  }

  async assignTemplate(dto: AssignTemplateDto) {
    const supabase = this.supabaseService.getClient();

    const sessionId = crypto.randomUUID();

    // Create the session
    const { error: sessionErr } = await supabase
      .from('onboarding_sessions')
      .insert({
        session_id: sessionId,
        account_id: dto.account_id,
        template_id: dto.template_id,
        assigned_position: dto.assigned_position,
        assigned_department: dto.assigned_department,
        status: 'not-started',
        progress_percentage: 0,
        deadline_date: dto.deadline_date,
      });

    if (sessionErr) throw new BadRequestException(sessionErr.message);

    // Get template items and create onboarding_items for each
    const { data: templateItems } = await supabase
      .from('template_items')
      .select('*')
      .eq('template_id', dto.template_id);

    if (templateItems && templateItems.length > 0) {
      const onboardingItems = templateItems.map(ti => ({
        onboarding_item_id: crypto.randomUUID(),
        session_id: sessionId,
        template_item_id: ti.item_id,
        status: 'pending',
        is_requested: null,
        delivery_method: null,
      }));

      const { error: itemsErr } = await supabase
        .from('onboarding_items')
        .insert(onboardingItems);

      if (itemsErr) throw new BadRequestException(itemsErr.message);
    }

    this.logger.log(`Template ${dto.template_id} assigned to ${dto.account_id}`);
    return { message: 'Template assigned', session_id: sessionId };
  }

  async requestEquipment(onboardingItemId: string, dto: { is_requested: boolean; delivery_method: 'office' | 'delivery'; delivery_address?: string }) {
    const supabase = this.supabaseService.getClient();

    const { data: item, error } = await supabase
      .from('onboarding_items')
      .select('onboarding_item_id, session_id')
      .eq('onboarding_item_id', onboardingItemId)
      .single();

    if (error || !item) throw new NotFoundException('Onboarding item not found.');

    await supabase
      .from('onboarding_items')
      .update({ is_requested: dto.is_requested, delivery_method: dto.delivery_method, delivery_address: dto.delivery_address ?? null, status: 'submitted' })
      .eq('onboarding_item_id', onboardingItemId);

    await this.recalculateProgress(item.session_id);
    return { message: 'Equipment requested', onboarding_item_id: onboardingItemId };
  }

  async getAllPositions() {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('job_positions')
      .select('position_id, position_name, department_id, created_at')
      .order('position_name', { ascending: true });

    if (error) throw new BadRequestException(error.message);

    const enriched: any[] = [];
    for (const p of data || []) {
      const { data: dept } = await supabase
        .from('department')
        .select('department_name')
        .eq('department_id', p.department_id)
        .maybeSingle();

      enriched.push({
        ...p,
        department_name: dept?.department_name || null,
      });
    }

    return enriched;
  }

  async createPosition(dto: { department_id: string; position_name: string }) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('job_positions')
      .insert({
        position_id: crypto.randomUUID(),
        department_id: dto.department_id,
        position_name: dto.position_name,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async addTemplateItem(templateId: string, dto: { type: string; tab_category: string; title: string; description?: string; is_required: boolean }) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('template_items')
      .insert({
        item_id: crypto.randomUUID(),
        template_id: templateId,
        type: dto.type,
        tab_category: dto.tab_category,
        title: dto.title,
        description: dto.description || null,
        is_required: dto.is_required,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    // Propagate to all active sessions using this template
    const { data: activeSessions } = await supabase
      .from('onboarding_sessions')
      .select('session_id')
      .eq('template_id', templateId)
      .neq('status', 'approved');

    if (activeSessions && activeSessions.length > 0) {
      await supabase.from('onboarding_items').insert(
        activeSessions.map(s => ({
          onboarding_item_id: crypto.randomUUID(),
          session_id: s.session_id,
          template_item_id: data.item_id,
          status: 'pending',
          is_requested: null,
          delivery_method: null,
        }))
      );
      for (const s of activeSessions) {
        await this.recalculateProgress(s.session_id);
      }
    }

    return data;
  }

  async updateTemplateItem(itemId: string, dto: { title?: string; description?: string; is_required?: boolean }) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('template_items')
      .update(dto)
      .eq('item_id', itemId)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    // If is_required changed, recalculate progress for all active sessions using this template
    if (dto.is_required !== undefined) {
      const { data: activeSessions } = await supabase
        .from('onboarding_sessions')
        .select('session_id')
        .eq('template_id', data.template_id)
        .neq('status', 'approved');

      for (const s of activeSessions || []) {
        await this.recalculateProgress(s.session_id);
      }
    }

    return data;
  }

  async getDepartments() {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('department')
      .select('department_id, department_name, company_id')
      .order('department_name', { ascending: true });

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateSessionDeadline(sessionId: string, deadlineDate: string) {
    const supabase = this.supabaseService.getClient();

    const { error } = await supabase
      .from('onboarding_sessions')
      .update({ deadline_date: deadlineDate })
      .eq('session_id', sessionId);

    if (error) throw new BadRequestException(error.message);

    await this.recalculateProgress(sessionId);
    return { session_id: sessionId, deadline_date: deadlineDate };
  }

  // =========================================================
  // SHARED HELPERS
  // =========================================================

  private async recalculateProgress(sessionId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: items } = await supabase
      .from('onboarding_items')
      .select(`
        status,
        template_items!inner ( is_required, tab_category )
      `)
      .eq('session_id', sessionId);

    if (!items || items.length === 0) return;

    // Exclude welcome items — they auto-confirm on start and shouldn't affect progress
    const trackable = items.filter((i: any) => i.template_items.tab_category !== 'welcome');
    const required = trackable.filter((i: any) => i.template_items.is_required);
    const completed = required.filter((i: any) =>
      ['approved', 'confirmed', 'issued'].includes(i.status)
    );

    const percentage = required.length > 0
      ? Math.round((completed.length / required.length) * 100)
      : 0;

    const { data: session } = await supabase
      .from('onboarding_sessions')
      .select('status, deadline_date')
      .eq('session_id', sessionId)
      .single();

    const update: Record<string, any> = { progress_percentage: percentage };

    if (session && !['for-review', 'approved'].includes(session.status)) {
      const isOverdue = new Date(session.deadline_date) < new Date();
      if (isOverdue) {
        update.status = 'overdue';
      } else if (percentage > 0) {
        update.status = 'in-progress';
      } else {
        update.status = 'not-started';
      }
    }

    await supabase
      .from('onboarding_sessions')
      .update(update)
      .eq('session_id', sessionId);
  }

  // =========================================================
  // PHASE 1: NEW HIRE APPROVAL (onboarding_submissions)
  // =========================================================

  async createOnboardingRecord(params: {
    applicationId: string;
    applicantId: string;
    jobPostingId: string;
    companyId: string;
  }) {
    const supabase = this.supabaseService.getClient();
    const { data: existing } = await supabase
      .from('onboarding_submissions')
      .select('submission_id')
      .eq('application_id', params.applicationId)
      .maybeSingle();
    if (existing) return existing;

    const { data: applicant } = await supabase
      .from('applicant_profile')
      .select('first_name, last_name, phone_number')
      .eq('applicant_id', params.applicantId)
      .maybeSingle();

    const { data, error } = await supabase
      .from('onboarding_submissions')
      .insert({
        applicant_id:   params.applicantId,
        application_id: params.applicationId,
        job_posting_id: params.jobPostingId,
        company_id:     params.companyId,
        status:         'pending',
        first_name:     applicant?.first_name ?? null,
        last_name:      applicant?.last_name ?? null,
        phone:          applicant?.phone_number ?? null,
      })
      .select('submission_id')
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async getMyOnboarding(applicantId: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('onboarding_submissions')
      .select('*, job_postings ( title )')
      .eq('applicant_id', applicantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? null;
  }

  async saveOnboarding(applicantId: string, body: Record<string, any>) {
    const supabase = this.supabaseService.getClient();
    const { data: submission, error: findErr } = await supabase
      .from('onboarding_submissions')
      .select('submission_id, status')
      .eq('applicant_id', applicantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (findErr) throw new InternalServerErrorException(findErr.message);
    if (!submission) throw new NotFoundException('No onboarding record found.');
    if (submission.status === 'approved') throw new BadRequestException('Onboarding has already been approved.');
    if (submission.status === 'submitted') throw new BadRequestException('Onboarding is under review. Wait for HR feedback before editing.');

    const allowed = ['first_name','last_name','phone','address','date_of_birth','nationality','civil_status',
      'emergency_contact_name','emergency_contact_phone','emergency_contact_relationship','preferred_username','department_id','start_date'];
    const patch: Record<string, any> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) patch[key] = body[key];
    }
    if (Object.keys(patch).length === 0) return { message: 'Nothing to update' };

    const { data, error } = await supabase
      .from('onboarding_submissions')
      .update(patch)
      .eq('submission_id', submission.submission_id)
      .select('*')
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async submitOnboarding(applicantId: string) {
    const supabase = this.supabaseService.getClient();
    const { data: submission, error: findErr } = await supabase
      .from('onboarding_submissions')
      .select('*')
      .eq('applicant_id', applicantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (findErr) throw new InternalServerErrorException(findErr.message);
    if (!submission) throw new NotFoundException('No onboarding record found.');
    if (submission.status === 'approved') throw new BadRequestException('Onboarding has already been approved.');
    if (submission.status === 'submitted') throw new BadRequestException('Onboarding is already submitted and under review.');

    const REQUIRED = ['first_name','last_name','phone','address','date_of_birth','nationality','civil_status',
      'emergency_contact_name','emergency_contact_phone','preferred_username'];
    const missing = REQUIRED.filter(f => !submission[f]);
    if (missing.length > 0) throw new BadRequestException(`Missing required fields: ${missing.join(', ')}`);

    const { data, error } = await supabase
      .from('onboarding_submissions')
      .update({ status: 'submitted', submitted_at: new Date().toISOString() })
      .eq('submission_id', submission.submission_id)
      .select('*')
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async getHROnboardingSubmissions(companyId: string, statusFilter?: string) {
    const supabase = this.supabaseService.getClient();

    // First try to filter by the stored company_id on the submission (fast path).
    // If that returns nothing, fall back to joining through job_postings to catch
    // records where company_id was not set correctly on creation.
    let query = supabase
      .from('onboarding_submissions')
      .select('*, applicant_profile ( first_name, last_name, email, phone_number ), job_postings ( title, company_id )')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (statusFilter) query = query.eq('status', statusFilter);
    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);

    if (data && data.length > 0) return data;

    // Fallback: find submissions whose job_posting belongs to this company.
    // This catches records created without the correct company_id.
    let fallbackQuery = supabase
      .from('onboarding_submissions')
      .select('*, applicant_profile ( first_name, last_name, email, phone_number ), job_postings!inner ( title, company_id )')
      .eq('job_postings.company_id', companyId)
      .order('created_at', { ascending: false });
    if (statusFilter) fallbackQuery = fallbackQuery.eq('status', statusFilter);
    const { data: fallbackData, error: fallbackError } = await fallbackQuery;
    if (fallbackError) throw new InternalServerErrorException(fallbackError.message);

    // Back-fill company_id on any records that were missing it
    const mismatched = (fallbackData ?? []).filter((s: any) => s.company_id !== companyId);
    if (mismatched.length > 0) {
      await supabase
        .from('onboarding_submissions')
        .update({ company_id: companyId })
        .in('submission_id', mismatched.map((s: any) => s.submission_id));
    }

    return fallbackData ?? [];
  }

  async getHROnboardingSubmission(submissionId: string, companyId: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('onboarding_submissions')
      .select('*, applicant_profile ( first_name, last_name, email, phone_number ), job_postings ( title )')
      .eq('submission_id', submissionId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException('Submission not found.');
    return data;
  }

  async approveOnboardingSubmission(submissionId: string, roleId: string, companyId: string) {
    const supabase = this.supabaseService.getClient();
    const { data: submission, error: subErr } = await supabase
      .from('onboarding_submissions')
      .select('*')
      .eq('submission_id', submissionId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (subErr) throw new InternalServerErrorException(subErr.message);
    if (!submission) throw new NotFoundException('Submission not found.');
    if (submission.status !== 'submitted') throw new BadRequestException('Submission must be in "submitted" state to approve.');
    if (!submission.preferred_username) throw new BadRequestException('Applicant must provide a preferred username before approval.');

    const { data: role } = await supabase.from('role').select('role_id').eq('role_id', roleId).maybeSingle();
    if (!role) throw new BadRequestException('Selected role does not exist.');

    const userId = crypto.randomUUID();
    const employeeCode = `EMP-${Math.floor(1000000 + Math.random() * 9000000)}`;

    const { error: insertError } = await supabase.from('user_profile').insert({
      user_id: userId,
      email: (await supabase.from('applicant_profile').select('email').eq('applicant_id', submission.applicant_id).maybeSingle()).data?.email ?? '',
      first_name: submission.first_name,
      last_name: submission.last_name,
      role_id: roleId,
      company_id: companyId,
      employee_id: employeeCode,
      username: submission.preferred_username,
      account_status: 'Pending',
      ...(submission.department_id ? { department_id: submission.department_id } : {}),
      ...(submission.start_date ? { start_date: submission.start_date } : {}),
    });
    if (insertError) throw new InternalServerErrorException(insertError.message);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    await supabase.from('user_invites').insert({ invite_id: crypto.randomUUID(), user_id: userId, token_hash: tokenHash, expires_at: expiresAt });

    await supabase.from('onboarding_submissions').update({ status: 'approved' }).eq('submission_id', submissionId);

    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
    const inviteLink = `${appUrl}/set-password?token=${rawToken}`;
    const { data: applicant } = await supabase.from('applicant_profile').select('email').eq('applicant_id', submission.applicant_id).maybeSingle();
    try {
      await this.mailService.sendInvite(applicant?.email ?? '', inviteLink);
    } catch {
      this.logger.log(`[onboarding approve] invite link for ${applicant?.email}: ${inviteLink}`);
    }

    return { user_id: userId, employee_id: employeeCode, email: applicant?.email ?? '', invite_expires_at: expiresAt };
  }

  async rejectOnboardingSubmission(submissionId: string, hrNotes: string, companyId: string) {
    const supabase = this.supabaseService.getClient();
    const { data: submission } = await supabase
      .from('onboarding_submissions')
      .select('submission_id, status')
      .eq('submission_id', submissionId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (!submission) throw new NotFoundException('Submission not found.');
    if (submission.status !== 'submitted') throw new BadRequestException('Only submitted onboarding forms can be rejected.');
    const { error } = await supabase
      .from('onboarding_submissions')
      .update({ status: 'rejected', hr_notes: hrNotes })
      .eq('submission_id', submissionId);
    if (error) throw new InternalServerErrorException(error.message);
    return { message: 'Submission rejected.' };
  }
}
