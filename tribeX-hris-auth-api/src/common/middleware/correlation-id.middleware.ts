import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

const MAX_CORRELATION_ID_LENGTH = 128;
const CORRELATION_ID_HEADER = 'x-correlation-id';

function sanitizeCorrelationId(input?: string | string[]): string | null {
  if (!input) return null;

  const raw = Array.isArray(input) ? input[0] : input;
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, MAX_CORRELATION_ID_LENGTH);
  return cleaned.length > 0 ? cleaned : null;
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(
    req: Request & { correlationId?: string },
    res: Response,
    next: NextFunction,
  ): void {
    const incoming = sanitizeCorrelationId(req.headers[CORRELATION_ID_HEADER]);
    const correlationId = incoming ?? randomUUID();

    req.correlationId = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);

    next();
  }
}
