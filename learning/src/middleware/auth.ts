import { Request, Response, NextFunction } from 'express';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.user) {
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    res.redirect('/login');
    return;
  }
  next();
}

export function redirectIfAuthenticated(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.user) {
    res.redirect('/');
    return;
  }
  next();
}
