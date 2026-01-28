import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function errorMiddleware(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  console.error(`[Error] ${statusCode}: ${message}`);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  if (req.xhr || req.headers.accept?.includes('application/json')) {
    res.status(statusCode).json({
      error: message,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
    return;
  }

  res.status(statusCode).render('pages/error.njk', {
    title: `Error ${statusCode}`,
    statusCode,
    message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
  });
}

export function notFoundMiddleware(req: Request, res: Response): void {
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }

  res.status(404).render('pages/error.njk', {
    title: 'Page Not Found',
    statusCode: 404,
    message: 'The page you are looking for does not exist.',
  });
}

export function createError(message: string, statusCode = 500): AppError {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
}
