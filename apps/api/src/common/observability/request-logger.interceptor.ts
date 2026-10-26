import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class RequestLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const requestId =
      request.header('x-request-id') ?? randomUUID();
    response.setHeader('X-Request-Id', requestId);

    const started = Date.now();
    const { method, originalUrl } = request;

    return next.handle().pipe(
      tap({
        finalize: () => {
          const duration = Date.now() - started;
          this.logger.log(
            `${method} ${originalUrl} ${response.statusCode} ${duration}ms requestId=${requestId}`,
          );
        },
      }),
    );
  }
}
