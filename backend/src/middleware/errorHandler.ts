import { Request, Response, NextFunction } from 'express';
import { appLogger } from '../services/logger';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(err: AppError, req: Request, res: Response, _next: NextFunction): void {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  appLogger.error(`[${code}] ${req.method} ${req.originalUrl} - ${err.message}`);
  if (res.headersSent) {
    return;
  }
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: err.message,
    },
  });
}
