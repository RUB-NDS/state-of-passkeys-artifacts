import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getStorage } from '../services/storage';

const INSTANCE_COOKIE = 'fwf_instance_id';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000; // 1 year

export async function instanceMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let instanceId = req.cookies[INSTANCE_COOKIE] as string | undefined;

    // If no instance cookie, generate a new one
    if (!instanceId) {
      instanceId = uuidv4();
      res.cookie(INSTANCE_COOKIE, instanceId, {
        maxAge: COOKIE_MAX_AGE,
        httpOnly: true,
        sameSite: 'lax',
      });
    }

    // Ensure instance exists in storage
    const storage = getStorage();
    const exists = await storage.instanceExists(instanceId);

    if (!exists) {
      await storage.createInstance(instanceId);
    }

    req.instanceId = instanceId;
    next();
  } catch (error) {
    next(error);
  }
}
