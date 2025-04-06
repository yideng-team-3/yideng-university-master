import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ValidationError } from 'class-validator';

interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  path?: string;
  timestamp?: string;
  details?: Record<string, any>;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = '服务器内部错误';
    let error = 'Internal Server Error';
    let details: Record<string, any> | undefined;

    // 处理 HTTP 异常
    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'object') {
        const excResObj = exceptionResponse as Record<string, any>;
        
        // 处理验证错误
        if (excResObj.message && Array.isArray(excResObj.message) && 
            excResObj.message[0] instanceof ValidationError) {
          message = this.formatValidationErrors(excResObj.message as ValidationError[]);
          error = 'Validation Error';
        } else {
          message = excResObj.message || message;
          error = excResObj.error || error;
          details = excResObj.details;
        }
      } else if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      }
    } else if (exception instanceof Error) {
      // 处理一般错误
      message = exception.message;
      // 在开发环境中记录堆栈信息
      if (process.env.NODE_ENV !== 'production') {
        details = { stack: exception.stack };
      }
    }

    // 记录错误
    this.logger.error(
      `${request.method} ${request.url} - ${statusCode} - ${
        typeof message === 'string' ? message : JSON.stringify(message)
      }`,
      exception instanceof Error ? exception.stack : undefined,
    );

    // 构建标准错误响应
    const errorResponse: ErrorResponse = {
      statusCode,
      message,
      error,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    if (details && process.env.NODE_ENV !== 'production') {
      errorResponse.details = details;
    }

    response.status(statusCode).json(errorResponse);
  }

  // 格式化验证错误
  private formatValidationErrors(errors: ValidationError[]): string[] {
    const result: string[] = [];
    
    function extractMessages(error: ValidationError) {
      if (error.constraints) {
        result.push(...Object.values(error.constraints));
      }
      
      if (error.children && error.children.length > 0) {
        error.children.forEach(extractMessages);
      }
    }
    
    errors.forEach(extractMessages);
    return result;
  }
}
