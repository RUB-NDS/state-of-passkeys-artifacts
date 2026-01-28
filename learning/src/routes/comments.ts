import { Router, Request, Response, NextFunction } from 'express';
import { getStorage } from '../services/storage';
import { requireAuth } from '../middleware/auth';
import { Comment } from '../types/flag';

const router = Router();

// POST /comments - Create a new comment
router.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { flagId, content } = req.body as { flagId: string; content: string };

    if (!flagId || !content) {
      return res.status(400).json({ error: 'Flag ID and content are required' });
    }

    const flagIdNum = parseInt(flagId, 10);
    if (isNaN(flagIdNum)) {
      return res.status(400).json({ error: 'Invalid flag ID' });
    }

    const storage = getStorage();

    // Verify flag exists
    const flag = await storage.getFlagById(req.instanceId, flagIdNum);
    if (!flag) {
      return res.status(404).json({ error: 'Flag not found' });
    }

    const nextId = await storage.getNextCommentId(req.instanceId);
    const comment: Comment = {
      id: nextId,
      flagId: flagIdNum,
      userId: req.session.user!.id,
      content,
      createdAt: new Date().toISOString(),
    };

    await storage.createComment(req.instanceId, comment);

    // Check if this is an AJAX request
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({
        success: true,
        comment: {
          ...comment,
          user: {
            id: req.session.user!.id,
            username: req.session.user!.username,
          },
        },
      });
    }

    res.redirect(`/flags/${flagIdNum}`);
  } catch (error) {
    next(error);
  }
});

// DELETE /comments/:id - Delete a comment
router.delete('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid comment ID' });
    }
    const storage = getStorage();

    // Get the comment to check ownership and get flag ID
    const instanceData = await storage.getInstanceData(req.instanceId);
    const comment = instanceData?.comments.find((c) => c.id === id);

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Check ownership
    if (comment.userId !== req.session.user!.id) {
      return res.status(403).json({ error: 'You can only delete your own comments' });
    }

    await storage.deleteComment(req.instanceId, id);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// POST /comments/:id/delete - Delete comment (form submission)
router.post('/:id/delete', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).render('pages/error.njk', {
        title: 'Invalid Request',
        statusCode: 400,
        message: 'Invalid comment ID.',
      });
    }
    const { flagId } = req.body as { flagId: string };
    const storage = getStorage();

    // Get the comment to check ownership
    const instanceData = await storage.getInstanceData(req.instanceId);
    const comment = instanceData?.comments.find((c) => c.id === id);

    if (!comment) {
      return res.status(404).render('pages/error.njk', {
        title: 'Comment Not Found',
        statusCode: 404,
        message: 'The comment you are trying to delete does not exist.',
      });
    }

    // Check ownership
    if (comment.userId !== req.session.user!.id) {
      return res.status(403).render('pages/error.njk', {
        title: 'Forbidden',
        statusCode: 403,
        message: 'You can only delete your own comments.',
      });
    }

    await storage.deleteComment(req.instanceId, id);

    const redirectFlagId = flagId ? parseInt(flagId, 10) : comment.flagId;
    res.redirect(`/flags/${redirectFlagId}`);
  } catch (error) {
    next(error);
  }
});

export default router;
