import { Router } from 'express';
import authRoutes from './auth';
import flagsRoutes from './flags';
import commentsRoutes from './comments';
import ratingsRoutes from './ratings';
import settingsRoutes from './settings';
import passkeyRoutes from './passkey';
import instanceRoutes from './instance';
import verifiersRoutes from './verifiers';
import profileRoutes from './profile';
import { notFoundMiddleware } from '../middleware/error';

const router = Router();

// Page routes
router.get('/', (req, res) => {
  res.redirect('/flags');
});

router.get('/guide', (req, res) => {
  res.render('pages/guide', { title: 'How to Use - Fun with Flags and Passkeys' });
});

// Auth routes
router.use('/', authRoutes);

// Flag routes
router.use('/flags', flagsRoutes);

// Comment routes
router.use('/comments', commentsRoutes);

// Rating routes
router.use('/ratings', ratingsRoutes);

// Settings routes
router.use('/settings', settingsRoutes);

// Passkey API routes
router.use('/api/passkey', passkeyRoutes);

// Instance API routes
router.use('/api/instance', instanceRoutes);

// Verifiers routes
router.use('/verifiers', verifiersRoutes);

// Profile routes
router.use('/profile', profileRoutes);

// 404 handler
router.use(notFoundMiddleware);

export default router;
