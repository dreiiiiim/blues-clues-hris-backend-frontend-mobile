import { Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';

/**
 * Standardized error handler for Supabase database errors
 * Converts database errors to appropriate HTTP exceptions
 */
export class DatabaseErrorHandler {
  static handle(
    error: any,
    context: string,
    logger?: Logger,
  ): BadRequestException {
    if (logger) {
      logger.error(`Database error in ${context}: ${error.message}`, error.stack);
    }

    // Handle Supabase-specific error codes
    if (error.code === 'PGRST116') {
      throw new BadRequestException(`Record not found in ${context}`);
    }
    if (error.code === 'PGRST301') {
      throw new BadRequestException(`Invalid query in ${context}: ${error.message}`);
    }
    if (error.code === 'PGRST100') {
      throw new BadRequestException(`Authentication failed in ${context}`);
    }
    if (error.code === '23505') {
      // Unique constraint violation
      throw new BadRequestException(`Duplicate record in ${context}: ${error.message}`);
    }
    if (error.code === '23503') {
      // Foreign key constraint violation
      throw new BadRequestException(`Referenced record not found in ${context}`);
    }

    throw new BadRequestException(
      `Failed to perform operation in ${context}: ${error.message || 'Unknown error'}`,
    );
  }
}
