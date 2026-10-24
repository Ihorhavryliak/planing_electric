import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let error = 'Internal Server Error';
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      const payload = exception.getResponse();

      error = exception.name
        .replace(/Exception$/, '')
        .replace(/([a-z])([A-Z])/g, '$1 $2');
      message = exception.message;

      if (typeof payload === 'string') {
        message = payload;
      } else if (payload && typeof payload === 'object') {
        const record = payload as Record<string, unknown>;

        if (
          typeof record.message === 'string' ||
          Array.isArray(record.message)
        ) {
          message = record.message as string | string[];
        }

        if (typeof record.error === 'string') {
          error = record.error;
        }
      }
    }

    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`${request.method} ${request.originalUrl} -> ${status}`);
    }

    const body: ApiErrorBody = {
      statusCode: status,
      error,
      message,
      path: request.originalUrl || request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
  }
}
