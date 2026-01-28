import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getStorage } from '../services/storage';
import { InstanceInfo } from '../types/instance';

const router = Router();
const INSTANCE_COOKIE = 'fwf_instance_id';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000; // 1 year

// GET /api/instance - Get current instance info
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storage = getStorage();
    const data = await storage.getInstanceData(req.instanceId);

    if (!data) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    const info: InstanceInfo = {
      id: data.id,
      createdAt: data.createdAt,
      userCount: data.users.length,
      flagCount: data.flags.length,
      commentCount: data.comments.length,
      ratingCount: data.ratings.length,
    };

    res.json(info);
  } catch (error) {
    next(error);
  }
});

// POST /api/instance/new - Generate a new instance
router.post('/new', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const newInstanceId = uuidv4();
    const storage = getStorage();

    await storage.createInstance(newInstanceId);

    res.cookie(INSTANCE_COOKIE, newInstanceId, {
      maxAge: COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: 'lax',
    });

    // Destroy current session since we're switching instances
    req.session.destroy(() => {
      res.json({
        success: true,
        instanceId: newInstanceId,
      });
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/instance/reset - Reset current instance to defaults
router.post('/reset', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storage = getStorage();
    await storage.resetInstance(req.instanceId);

    // Destroy current session since data was reset
    req.session.destroy(() => {
      res.json({
        success: true,
        instanceId: req.instanceId,
      });
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/instance/switch - Switch to a different instance
router.post('/switch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { instanceId } = req.body as { instanceId: string };

    if (!instanceId) {
      return res.status(400).json({ error: 'Instance ID is required' });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(instanceId)) {
      return res.status(400).json({ error: 'Invalid instance ID format' });
    }

    const storage = getStorage();
    const exists = await storage.instanceExists(instanceId);

    if (!exists) {
      // Create the instance if it doesn't exist
      await storage.createInstance(instanceId);
    }

    res.cookie(INSTANCE_COOKIE, instanceId, {
      maxAge: COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: 'lax',
    });

    // Destroy current session since we're switching instances
    req.session.destroy(() => {
      res.json({
        success: true,
        instanceId,
        created: !exists,
      });
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/instance - Delete current instance (auto-generates new one)
router.delete('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storage = getStorage();
    await storage.deleteInstance(req.instanceId);

    // Generate a new instance
    const newInstanceId = uuidv4();
    await storage.createInstance(newInstanceId);

    res.cookie(INSTANCE_COOKIE, newInstanceId, {
      maxAge: COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: 'lax',
    });

    // Destroy current session
    req.session.destroy(() => {
      res.json({
        success: true,
        oldInstanceId: req.instanceId,
        newInstanceId,
      });
    });
  } catch (error) {
    next(error);
  }
});

export default router;
