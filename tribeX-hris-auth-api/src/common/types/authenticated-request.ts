import { Request } from 'express';

export interface AuthenticatedUser {
  sub_userid: string;
  user_id: string;
  email: string;
  company_id: string;
  roles: string[];
  role_id?: string;
  role_name: string;
  first_name?: string;
  last_name?: string;
  employee_id?: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
