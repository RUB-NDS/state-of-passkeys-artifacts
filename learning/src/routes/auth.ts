import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { getStorage } from '../services/storage';
import { redirectIfAuthenticated, requireAuth } from '../middleware/auth';
import { User, LoginInput } from '../types/user';

const router = Router();

// GET /login
router.get('/login', redirectIfAuthenticated, (req: Request, res: Response) => {
  res.render('pages/login.njk', {
    title: 'Login - Fun with Flags and Passkeys',
  });
});

// POST /login
router.post(
  '/login',
  redirectIfAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, password } = req.body as LoginInput;

      if (!username || !password) {
        return res.render('pages/login.njk', {
          title: 'Login - Fun with Flags and Passkeys',
          error: 'Username and password are required',
        });
      }

      const storage = getStorage();
      const user = await storage.getUserByUsername(req.instanceId, username);

      if (!user) {
        return res.render('pages/login.njk', {
          title: 'Login - Fun with Flags and Passkeys',
          error: 'Invalid username or password',
        });
      }

      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) {
        return res.render('pages/login.njk', {
          title: 'Login - Fun with Flags and Passkeys',
          error: 'Invalid username or password',
        });
      }

      // Check if 2FA with passkey is required
      if (req.authVerifier.options.passkeyFlow === '2fa') {
        const userPasskeys = await storage.getPasskeysByUserId(req.instanceId, user.id);
        if (userPasskeys.length > 0) {
          // Store partial auth in session for 2FA flow
          req.session.passkeyUserId = user.id;
          return res.redirect('/login/2fa');
        }
      }

      // Set session
      req.session.user = {
        id: user.id,
        username: user.username,
      };

      res.redirect('/flags');
    } catch (error) {
      next(error);
    }
  }
);

// GET /login/2fa - 2FA passkey page
router.get('/login/2fa', (req: Request, res: Response) => {
  if (!req.session.passkeyUserId) {
    return res.redirect('/login');
  }

  res.render('pages/login-2fa.njk', {
    title: '2FA Verification - Fun with Flags and Passkeys',
  });
});

// POST /login/check-username - Check if user has passkeys (for a2 flow)
router.post('/login/check-username', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username } = req.body as { username: string };

    if (!username) {
      return res.json({ hasPasskeys: false, exists: false });
    }

    const storage = getStorage();
    const user = await storage.getUserByUsername(req.instanceId, username);

    if (!user) {
      return res.json({ hasPasskeys: false, exists: false });
    }

    const userPasskeys = await storage.getPasskeysByUserId(req.instanceId, user.id);

    res.json({
      exists: true,
      hasPasskeys: userPasskeys.length > 0,
      userId: user.id,
    });
  } catch (error) {
    next(error);
  }
});

// GET /register
router.get('/register', redirectIfAuthenticated, (req: Request, res: Response) => {
  res.render('pages/register.njk', {
    title: 'Register - Fun with Flags and Passkeys',
  });
});

// POST /register
router.post(
  '/register',
  redirectIfAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, password, confirmPassword, securityQuestion, securityAnswer } = req.body as {
        username: string;
        password: string;
        confirmPassword: string;
        securityQuestion?: string;
        securityAnswer?: string;
      };

      // Validation
      if (!username || !password || !confirmPassword) {
        return res.render('pages/register.njk', {
          title: 'Register - Fun with Flags and Passkeys',
          error: 'All fields are required',
          username,
        });
      }

      if (password !== confirmPassword) {
        return res.render('pages/register.njk', {
          title: 'Register - Fun with Flags and Passkeys',
          error: 'Passwords do not match',
          username,
        });
      }

      if (password.length < 4) {
        return res.render('pages/register.njk', {
          title: 'Register - Fun with Flags and Passkeys',
          error: 'Password must be at least 4 characters',
          username,
        });
      }

      const storage = getStorage();

      // Check if username already exists
      const existingUser = await storage.getUserByUsername(req.instanceId, username);
      if (existingUser) {
        return res.render('pages/register.njk', {
          title: 'Register - Fun with Flags and Passkeys',
          error: 'Username already taken',
          username,
        });
      }

      // Create user
      const passwordHash = await bcrypt.hash(password, 10);
      const nextId = await storage.getNextUserId(req.instanceId);
      const user: User = {
        id: nextId,
        username,
        passwordHash,
        createdAt: new Date().toISOString(),
        ...(securityQuestion && securityAnswer
          ? { securityQuestion, securityAnswer }
          : {}),
      };

      await storage.createUser(req.instanceId, user);

      // Set session
      req.session.user = {
        id: user.id,
        username: user.username,
      };

      res.redirect('/flags');
    } catch (error) {
      next(error);
    }
  }
);

// POST /logout
router.post('/logout', requireAuth, (req: Request, res: Response) => {
  // Clear user but preserve challenge tracking data for reused challenge exploits
  delete req.session.user;
  delete req.session.challenge;
  delete req.session.passkeyUserId;
  res.redirect('/login');
});

// GET /logout (for convenience)
router.get('/logout', (req: Request, res: Response) => {
  // Clear user but preserve challenge tracking data for reused challenge exploits
  delete req.session.user;
  delete req.session.challenge;
  delete req.session.passkeyUserId;
  res.redirect('/login');
});

export default router;
