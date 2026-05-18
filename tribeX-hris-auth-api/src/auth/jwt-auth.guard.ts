import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'node:crypto';
import { SupabaseService } from '../supabase/supabase.service';

function sha256(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function roleNameToPortal(roleName: string | null | undefined): string {
  const normalized = String(roleName ?? '').trim().toLowerCase();
  if (normalized === 'system admin') return 'system-admin';
  if (normalized === 'admin') return 'admin';
  if (normalized === 'manager' || normalized === 'group head') return 'manager';
  if (normalized === 'active employee' || normalized === 'employee') return 'employee';
  if (normalized === 'applicant') return 'applicant';
  return 'hr';
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    const authHeader: string | undefined =
      req.headers['authorization'] || req.headers['Authorization'];

    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid Authorization header format');
    }

    try {
      const decoded = this.jwtService.verify(token);

      // BLOCK refresh tokens from accessing protected routes
      if (decoded.type !== 'access') {
        throw new UnauthorizedException('Access token required');
      }

      const supabase = this.supabaseService.getClient();

      // Reject blacklisted (logged-out) tokens
      const { data: blacklisted } = await supabase
        .from('token_blacklist')
        .select('token_hash')
        .eq('token_hash', sha256(token))
        .maybeSingle();
      if (blacklisted)
        throw new UnauthorizedException('Token has been revoked');

      // Reject deactivated accounts — checked on every request so enforcement is immediate
      const { data: userStatus } = await supabase
        .from('user_profile')
        .select('user_id, company_id, role_id, email, employee_id, first_name, last_name, account_status')
        .eq('user_id', decoded.sub_userid)
        .maybeSingle();
      if (userStatus?.account_status === 'Inactive') {
        throw new UnauthorizedException('Account deactivated');
      }
      if (!userStatus?.user_id) {
        throw new UnauthorizedException('User not found');
      }

      const { data: assignmentRows, error: assignmentsError } = await supabase
        .from('user_role_assignments')
        .select('role_id, is_primary')
        .eq('user_id', decoded.sub_userid)
        .eq('is_active', true);
      if (assignmentsError) {
        throw new UnauthorizedException('Role lookup failed');
      }

      const assignmentRoleIds = [...new Set(
        (assignmentRows ?? [])
          .map((row: any) => String(row.role_id ?? '').trim())
          .filter(Boolean),
      )];

      let roleAssignments = [] as Array<{
        role_id: string;
        role_name: string;
        is_primary: boolean;
        portal_key: string;
      }>;

      if (assignmentRoleIds.length > 0) {
        const { data: roleRows, error: roleRowsError } = await supabase
          .from('role')
          .select('role_id, role_name')
          .in('role_id', assignmentRoleIds);
        if (roleRowsError) {
          throw new UnauthorizedException('Role lookup failed');
        }

        const roleNameById = new Map<string, string>(
          (roleRows ?? []).map((role: any) => [
            String(role.role_id ?? '').trim(),
            String(role.role_name ?? '').trim(),
          ]),
        );

        roleAssignments = (assignmentRows ?? [])
          .map((row: any) => {
            const roleId = String(row.role_id ?? '').trim();
            const roleName = roleNameById.get(roleId) ?? '';
            if (!roleId || !roleName) return null;
            return {
              role_id: roleId,
              role_name: roleName,
              is_primary: !!row.is_primary,
              portal_key: roleNameToPortal(roleName),
            };
          })
          .filter(Boolean) as typeof roleAssignments;
      }

      if (roleAssignments.length === 0) {
        const fallbackRoleId = String(userStatus.role_id ?? '').trim();
        if (!fallbackRoleId) {
          throw new UnauthorizedException('Role not found');
        }

        const { data: roleRow, error: roleError } = await supabase
          .from('role')
          .select('role_id, role_name')
          .eq('role_id', fallbackRoleId)
          .maybeSingle();
        if (roleError || !roleRow?.role_id || !roleRow?.role_name) {
          throw new UnauthorizedException('Role not found');
        }

        roleAssignments = [
          {
            role_id: String(roleRow.role_id),
            role_name: String(roleRow.role_name).trim(),
            is_primary: true,
            portal_key: roleNameToPortal(roleRow.role_name),
          },
        ];
      }

      const requestedRoleId = String(decoded.role_id ?? '').trim();
      const activeRole =
        roleAssignments.find((role) => role.role_id === requestedRoleId) ??
        roleAssignments.find((role) => role.is_primary) ??
        roleAssignments[0];

      if (!activeRole) {
        throw new UnauthorizedException('Role not found');
      }

      const roleNames = [...new Set(roleAssignments.map((role) => role.role_name))];
      const roleIds = [...new Set(roleAssignments.map((role) => role.role_id))];
      const availablePortals = [...new Set(roleAssignments.map((role) => role.portal_key))];

      req.user = {
        ...decoded,
        sub_userid: String(userStatus.user_id),
        user_id: String(userStatus.user_id),
        company_id: String(userStatus.company_id ?? ''),
        email: String(userStatus.email ?? ''),
        employee_id: String(userStatus.employee_id ?? ''),
        first_name: String(userStatus.first_name ?? ''),
        last_name: String(userStatus.last_name ?? ''),
        role_id: activeRole.role_id,
        role_name: activeRole.role_name,
        role_ids: roleIds,
        roles: roleNames,
        active_portal: activeRole.portal_key,
        available_portals: availablePortals,
        role_switch_options: roleAssignments.map((role) => ({
          role_id: role.role_id,
          role_name: role.role_name,
          portal_key: role.portal_key,
        })),
      };
      return true;
    } catch (err) {
      throw new UnauthorizedException(
        err instanceof UnauthorizedException ? err.message : 'Invalid token',
      );
    }
  }
}
