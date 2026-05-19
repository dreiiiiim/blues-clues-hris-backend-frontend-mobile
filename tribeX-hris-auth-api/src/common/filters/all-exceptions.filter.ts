import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { correlationId?: string }>();

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const fallbackErrorText = HttpStatus[statusCode] ?? 'Error';
    const fallbackMessage =
      statusCode === HttpStatus.INTERNAL_SERVER_ERROR
        ? 'Internal Server Error'
        : fallbackErrorText;

    const exceptionBody = isHttpException ? exception.getResponse() : null;

    let message = fallbackMessage;
    let error = fallbackErrorText;

    if (typeof exceptionBody === 'string') {
      message = exceptionBody;
    } else if (exceptionBody && typeof exceptionBody === 'object') {
      const body = exceptionBody as { message?: string | string[]; error?: string };
      if (Array.isArray(body.message)) {
        message = body.message.join('; ');
      } else if (typeof body.message === 'string' && body.message.trim().length > 0) {
        message = body.message;
      }
      if (typeof body.error === 'string' && body.error.trim().length > 0) {
        error = body.error;
      }
    }

    if (statusCode >= 500 || !(exception instanceof HttpException)) {
      const err = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(
        `${request.method} ${request.originalUrl ?? request.url} [${statusCode}] correlationId=${request.correlationId ?? 'unknown'} — ${err.message}`,
        err.stack,
      );
    }

    response.status(statusCode).json({
      statusCode,
      message,
      error,
      correlationId: request.correlationId ?? 'unknown',
      timestamp: new Date().toISOString(),
      path: request.originalUrl ?? request.url,
    });
  }
}
