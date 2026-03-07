import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateUserDto } from './dto/create-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly supabaseService: SupabaseService) {}

  // All queries filter by company_id — this is what enforces multi-tenancy.
  // company_id comes from req.user (decoded from the JWT), never from the request body.

  async findAll(companyId: string) {
    const { data, error } = await this.supabaseService.getClient()
      .from('user_profile')
      .select('user_id, first_name, last_name, email, role_id')
      .eq('company_id', companyId)
      .order('first_name');

    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async findOne(id: string, companyId: string) {
    const { data, error } = await this.supabaseService.getClient()
      .from('user_profile')
      .select('user_id, first_name, last_name, email, role_id')
      .eq('user_id', id)
      .eq('company_id', companyId) // prevents cross-company lookups
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  }

  async stats(companyId: string) {
    const { count, error } = await this.supabaseService.getClient()
      .from('user_profile')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId);

    if (error) throw new Error(error.message);
    return { total: count ?? 0 };
  }

  create(dto: CreateUserDto) {}

  update(id: string, dto: UpdateUserDto) {}

  remove(id: string) {}
}
