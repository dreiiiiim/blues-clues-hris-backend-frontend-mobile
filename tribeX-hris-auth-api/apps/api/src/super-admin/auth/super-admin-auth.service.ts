import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '@app/supabase';
import { SuperAdminLoginDto } from './dto/super-admin-login.dto';

@Injectable()
export class SuperAdminAuthService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: SuperAdminLoginDto) {
    const supabase = this.supabaseService.getClient();

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: dto.email,
      password: dto.password,
    });

    if (authError || !authData.user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const role = authData.user.user_metadata?.role;
    if (role !== 'super_admin') {
      throw new UnauthorizedException('Access denied — not a super admin');
    }

    const { data: adminUser, error: dbError } = await supabase
      .from('super_admin_users')
      .select('id, email, name')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (dbError || !adminUser) {
      throw new UnauthorizedException('Super admin record not found');
    }

    const payload = {
      sub: adminUser.id,
      email: adminUser.email,
      role: 'super_admin' as const,
      name: adminUser.name,
    };

    const access_token = this.jwtService.sign(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: '8h',
    });

    return {
      access_token,
      user: { id: adminUser.id, email: adminUser.email, name: adminUser.name },
    };
  }
}
