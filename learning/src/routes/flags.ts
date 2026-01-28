import { Router, Request, Response, NextFunction } from 'express';
import { getStorage } from '../services/storage';
import { requireAuth } from '../middleware/auth';
import { Flag, FlagWithDetails, CommentWithUser, CreateFlagInput } from '../types/flag';

const router = Router();

// GET /flags - List all flags (home page)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storage = getStorage();
    const flags = await storage.getFlags(req.instanceId);
    const users = await storage.getUsers(req.instanceId);

    // Add user info and ratings to each flag
    const flagsWithDetails = await Promise.all(
      flags.map(async (flag) => {
        const user = users.find((u) => u.id === flag.userId);
        const ratings = await storage.getRatingsByFlagId(req.instanceId, flag.id);
        const comments = await storage.getCommentsByFlagId(req.instanceId, flag.id);
        const averageRating =
          ratings.length > 0 ? ratings.reduce((sum, r) => sum + r.value, 0) / ratings.length : 0;

        let userRating: number | undefined;
        if (req.session?.user) {
          const rating = await storage.getUserRating(req.instanceId, flag.id, req.session.user.id);
          userRating = rating?.value;
        }

        return {
          ...flag,
          user: user ? { id: user.id, username: user.username } : { id: 0, username: 'Unknown' },
          comments: comments.length,
          ratings,
          averageRating,
          userRating,
        };
      })
    );

    // Sort by creation date (newest first)
    flagsWithDetails.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    res.render('pages/home.njk', {
      title: 'Fun with Flags and Passkeys',
      flags: flagsWithDetails,
    });
  } catch (error) {
    next(error);
  }
});

// GET /flags/new - Create new flag form
router.get('/new', requireAuth, (req: Request, res: Response) => {
  res.render('pages/flag-create.njk', {
    title: 'Create Flag - Fun with Flags and Passkeys',
  });
});

// POST /flags - Create a new flag
router.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, imageUrl, country } = req.body as CreateFlagInput;

    // Validation
    if (!title || !description || !imageUrl || !country) {
      return res.render('pages/flag-create.njk', {
        title: 'Create Flag - Fun with Flags and Passkeys',
        error: 'All fields are required',
        form: { title, description, imageUrl, country },
      });
    }

    const storage = getStorage();
    const nextId = await storage.getNextFlagId(req.instanceId);
    const flag: Flag = {
      id: nextId,
      userId: req.session.user!.id,
      title,
      description,
      imageUrl,
      country,
      createdAt: new Date().toISOString(),
    };

    await storage.createFlag(req.instanceId, flag);

    res.redirect(`/flags/${flag.id}`);
  } catch (error) {
    next(error);
  }
});

// GET /flags/:id - View a single flag
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(404).render('pages/error.njk', {
        title: 'Flag Not Found',
        statusCode: 404,
        message: 'Invalid flag ID.',
      });
    }
    const storage = getStorage();

    const flag = await storage.getFlagById(req.instanceId, id);
    if (!flag) {
      return res.status(404).render('pages/error.njk', {
        title: 'Flag Not Found',
        statusCode: 404,
        message: 'The flag you are looking for does not exist.',
      });
    }

    const users = await storage.getUsers(req.instanceId);
    const user = users.find((u) => u.id === flag.userId);
    const ratings = await storage.getRatingsByFlagId(req.instanceId, flag.id);
    const comments = await storage.getCommentsByFlagId(req.instanceId, flag.id);

    const commentsWithUsers: CommentWithUser[] = comments.map((comment) => {
      const commentUser = users.find((u) => u.id === comment.userId);
      return {
        ...comment,
        user: commentUser
          ? { id: commentUser.id, username: commentUser.username }
          : { id: 0, username: 'Unknown' },
      };
    });

    // Sort comments by date (newest first)
    commentsWithUsers.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const averageRating =
      ratings.length > 0 ? ratings.reduce((sum, r) => sum + r.value, 0) / ratings.length : 0;

    let userRating: number | undefined;
    if (req.session?.user) {
      const rating = await storage.getUserRating(req.instanceId, flag.id, req.session.user.id);
      userRating = rating?.value;
    }

    const flagWithDetails: FlagWithDetails = {
      ...flag,
      user: user ? { id: user.id, username: user.username } : { id: 0, username: 'Unknown' },
      comments: commentsWithUsers,
      ratings,
      averageRating,
      userRating,
    };

    const isOwner = req.session?.user?.id === flag.userId;

    res.render('pages/flag-detail.njk', {
      title: `${flag.title} - Fun with Flags and Passkeys`,
      flag: flagWithDetails,
      isOwner,
    });
  } catch (error) {
    next(error);
  }
});

// GET /flags/:id/edit - Edit flag form
router.get('/:id/edit', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(404).render('pages/error.njk', {
        title: 'Flag Not Found',
        statusCode: 404,
        message: 'Invalid flag ID.',
      });
    }
    const storage = getStorage();

    const flag = await storage.getFlagById(req.instanceId, id);
    if (!flag) {
      return res.status(404).render('pages/error.njk', {
        title: 'Flag Not Found',
        statusCode: 404,
        message: 'The flag you are looking for does not exist.',
      });
    }

    // Check ownership
    if (flag.userId !== req.session.user!.id) {
      return res.status(403).render('pages/error.njk', {
        title: 'Forbidden',
        statusCode: 403,
        message: 'You can only edit your own flags.',
      });
    }

    res.render('pages/flag-edit.njk', {
      title: `Edit ${flag.title} - Fun with Flags and Passkeys`,
      flag,
    });
  } catch (error) {
    next(error);
  }
});

// POST /flags/:id - Update a flag
router.post('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(404).render('pages/error.njk', {
        title: 'Flag Not Found',
        statusCode: 404,
        message: 'Invalid flag ID.',
      });
    }
    const { title, description, imageUrl, country } = req.body as CreateFlagInput;

    const storage = getStorage();
    const flag = await storage.getFlagById(req.instanceId, id);

    if (!flag) {
      return res.status(404).render('pages/error.njk', {
        title: 'Flag Not Found',
        statusCode: 404,
        message: 'The flag you are looking for does not exist.',
      });
    }

    // Check ownership
    if (flag.userId !== req.session.user!.id) {
      return res.status(403).render('pages/error.njk', {
        title: 'Forbidden',
        statusCode: 403,
        message: 'You can only edit your own flags.',
      });
    }

    // Validation
    if (!title || !description || !imageUrl || !country) {
      return res.render('pages/flag-edit.njk', {
        title: `Edit ${flag.title} - Fun with Flags and Passkeys`,
        error: 'All fields are required',
        flag: { ...flag, title, description, imageUrl, country },
      });
    }

    const updatedFlag: Flag = {
      ...flag,
      title,
      description,
      imageUrl,
      country,
    };

    await storage.updateFlag(req.instanceId, updatedFlag);

    res.redirect(`/flags/${id}`);
  } catch (error) {
    next(error);
  }
});

// POST /flags/:id/delete - Delete a flag
router.post('/:id/delete', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(404).json({ error: 'Invalid flag ID' });
    }
    const storage = getStorage();

    const flag = await storage.getFlagById(req.instanceId, id);
    if (!flag) {
      return res.status(404).json({ error: 'Flag not found' });
    }

    // Check ownership
    if (flag.userId !== req.session.user!.id) {
      return res.status(403).json({ error: 'You can only delete your own flags' });
    }

    await storage.deleteFlag(req.instanceId, id);

    res.redirect('/flags');
  } catch (error) {
    next(error);
  }
});

export default router;
