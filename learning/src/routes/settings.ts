import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { getStorage } from '../services/storage';
import { requireAuth } from '../middleware/auth';
import { getAuthenticatorInfo } from '../config';
import { Passkey } from '../types/passkey';

const router = Router();

// Enrich passkeys with authenticator info from AAGUID database
function enrichPasskeys(passkeys: Passkey[]) {
  return passkeys.map((pk) => {
    const authInfo = getAuthenticatorInfo(pk.aaguid);
    return {
      ...pk,
      authenticatorName: authInfo?.name || 'Unknown Authenticator',
      authenticatorIcon: authInfo?.icon_light || undefined,
      authenticatorIconDark: authInfo?.icon_dark || undefined,
    };
  });
}

// GET /settings - Settings page
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storage = getStorage();
    const user = await storage.getUserById(req.instanceId, req.session.user!.id);

    if (!user) {
      req.session.destroy(() => {
        res.redirect('/login');
      });
      return;
    }

    const passkeys = await storage.getPasskeysByUserId(req.instanceId, user.id);
    const enrichedPasskeys = enrichPasskeys(passkeys);

    res.render('pages/settings.njk', {
      title: 'Settings - Fun with Flags and Passkeys',
      account: {
        username: user.username,
        passkeys: enrichedPasskeys,
        createdAt: user.createdAt,
        securityQuestion: user.securityQuestion,
        securityAnswer: user.securityAnswer,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /settings/password - Change password
router.post('/password', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    };

    const storage = getStorage();
    const user = await storage.getUserById(req.instanceId, req.session.user!.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const passkeys = await storage.getPasskeysByUserId(req.instanceId, user.id);
    const enrichedPasskeys = enrichPasskeys(passkeys);

    const accountData = {
      username: user.username,
      passkeys: enrichedPasskeys,
      createdAt: user.createdAt,
      securityQuestion: user.securityQuestion,
      securityAnswer: user.securityAnswer,
    };

    // Validate current password
    const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!validPassword) {
      return res.render('pages/settings.njk', {
        title: 'Settings - Fun with Flags and Passkeys',
        account: accountData,
        passwordError: 'Current password is incorrect',
      });
    }

    // Validate new password
    if (newPassword !== confirmPassword) {
      return res.render('pages/settings.njk', {
        title: 'Settings - Fun with Flags and Passkeys',
        account: accountData,
        passwordError: 'New passwords do not match',
      });
    }

    if (newPassword.length < 4) {
      return res.render('pages/settings.njk', {
        title: 'Settings - Fun with Flags and Passkeys',
        account: accountData,
        passwordError: 'Password must be at least 4 characters',
      });
    }

    // Update password
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await storage.updateUser(req.instanceId, user);

    res.render('pages/settings.njk', {
      title: 'Settings - Fun with Flags and Passkeys',
      account: accountData,
      passwordSuccess: 'Password updated successfully',
    });
  } catch (error) {
    next(error);
  }
});

// POST /settings/passkey/:id/delete - Delete a passkey
router.post(
  '/passkey/:id/delete',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid passkey ID' });
      }
      const storage = getStorage();
      const user = await storage.getUserById(req.instanceId, req.session.user!.id);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const passkey = await storage.getPasskeyById(req.instanceId, id);
      if (!passkey || passkey.userId !== user.id) {
        return res.status(404).json({ error: 'Passkey not found' });
      }

      await storage.deletePasskey(req.instanceId, id);

      // Check if this is an AJAX request
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.json({ success: true });
      }

      res.redirect('/settings');
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /settings/passkey/:id - Delete a passkey (AJAX)
router.delete(
  '/passkey/:id',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid passkey ID' });
      }
      const storage = getStorage();
      const user = await storage.getUserById(req.instanceId, req.session.user!.id);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const passkey = await storage.getPasskeyById(req.instanceId, id);
      if (!passkey || passkey.userId !== user.id) {
        return res.status(404).json({ error: 'Passkey not found' });
      }

      await storage.deletePasskey(req.instanceId, id);

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
