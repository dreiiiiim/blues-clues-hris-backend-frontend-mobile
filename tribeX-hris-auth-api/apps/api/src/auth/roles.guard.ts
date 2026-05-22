import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>(
      'roles',
      context.getHandler(),
    );

    if (!requiredRoles) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const activeRole = typeof user?.role_name === 'string' ? user.role_name : null;
    const assignedRoles = Array.isArray(user?.roles) ? user.roles : [];

    if (
      !requiredRoles.includes(String(activeRole ?? '')) &&
      !assignedRoles.some((role) => requiredRoles.includes(String(role)))
    ) {
      throw new ForbiddenException('Access denied');
    }

    return true;
  }
}
