import { Router, Request, Response, NextFunction } from 'express';
import { getStorage } from '../services/storage';

const router = Router();

// GET /profile/:id - View user profile
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(404).render('pages/error.njk', {
        title: 'User Not Found',
        statusCode: 404,
        message: 'Invalid user ID.',
      });
    }

    const storage = getStorage();
    const user = await storage.getUserById(req.instanceId, id);

    if (!user) {
      return res.status(404).render('pages/error.njk', {
        title: 'User Not Found',
        statusCode: 404,
        message: 'The user you are looking for does not exist.',
      });
    }

    // Get user's flags
    const userFlags = await storage.getFlagsByUserId(req.instanceId, id);

    // Get comments and ratings counts by iterating through all flags
    const allFlags = await storage.getFlags(req.instanceId);
    let commentsCount = 0;
    let ratingsCount = 0;

    for (const flag of allFlags) {
      const comments = await storage.getCommentsByFlagId(req.instanceId, flag.id);
      const ratings = await storage.getRatingsByFlagId(req.instanceId, flag.id);
      commentsCount += comments.filter((c) => c.userId === id).length;
      ratingsCount += ratings.filter((r) => r.userId === id).length;
    }

    res.render('pages/profile.njk', {
      title: `${user.username} - Fun with Flags and Passkeys`,
      profile: {
        id: user.id,
        username: user.username,
        createdAt: user.createdAt,
      },
      stats: {
        flags: userFlags.length,
        comments: commentsCount,
        ratings: ratingsCount,
      },
      flags: userFlags,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
