import { Router, Request, Response, NextFunction } from 'express';
import { getStorage } from '../services/storage';
import { requireAuth } from '../middleware/auth';
import { Rating } from '../types/flag';

const router = Router();

// POST /ratings - Create or update a rating
router.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { flagId, value } = req.body as { flagId: string; value: number };

    if (!flagId || value === undefined) {
      return res.status(400).json({ error: 'Flag ID and value are required' });
    }

    const flagIdNum = parseInt(flagId, 10);
    if (isNaN(flagIdNum)) {
      return res.status(400).json({ error: 'Invalid flag ID' });
    }

    const ratingValue = parseInt(String(value), 10);
    if (isNaN(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const storage = getStorage();

    // Verify flag exists
    const flag = await storage.getFlagById(req.instanceId, flagIdNum);
    if (!flag) {
      return res.status(404).json({ error: 'Flag not found' });
    }

    // Check if user already rated this flag
    const existingRating = await storage.getUserRating(
      req.instanceId,
      flagIdNum,
      req.session.user!.id
    );

    const nextId = existingRating?.id ?? (await storage.getNextRatingId(req.instanceId));
    const rating: Rating = {
      id: nextId,
      flagId: flagIdNum,
      userId: req.session.user!.id,
      value: ratingValue,
      createdAt: existingRating?.createdAt || new Date().toISOString(),
    };

    await storage.createOrUpdateRating(req.instanceId, rating);

    // Get updated ratings for this flag
    const ratings = await storage.getRatingsByFlagId(req.instanceId, flagIdNum);
    const averageRating =
      ratings.length > 0 ? ratings.reduce((sum, r) => sum + r.value, 0) / ratings.length : 0;

    // Check if this is an AJAX request
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({
        success: true,
        rating: rating.value,
        averageRating,
        totalRatings: ratings.length,
      });
    }

    res.redirect(`/flags/${flagIdNum}`);
  } catch (error) {
    next(error);
  }
});

// DELETE /ratings/:flagId - Delete user's rating for a flag
router.delete('/:flagId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const flagIdNum = parseInt(req.params.flagId, 10);
    if (isNaN(flagIdNum)) {
      return res.status(400).json({ error: 'Invalid flag ID' });
    }
    const storage = getStorage();

    const existingRating = await storage.getUserRating(
      req.instanceId,
      flagIdNum,
      req.session.user!.id
    );

    if (!existingRating) {
      return res.status(404).json({ error: 'Rating not found' });
    }

    await storage.deleteRating(req.instanceId, existingRating.id);

    // Get updated ratings for this flag
    const ratings = await storage.getRatingsByFlagId(req.instanceId, flagIdNum);
    const averageRating =
      ratings.length > 0 ? ratings.reduce((sum, r) => sum + r.value, 0) / ratings.length : 0;

    res.json({
      success: true,
      averageRating,
      totalRatings: ratings.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
